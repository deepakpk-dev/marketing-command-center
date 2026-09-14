import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
let db: PGlite;
const workspace = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const ids = {
  admin: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  viewer: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  analyst: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  approver: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  stranger: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};
const session = "77777777-7777-4777-8777-777777777777";
async function asUser<T>(
  who: keyof typeof ids | "workflow",
  run: () => Promise<T>,
): Promise<T> {
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify(
      who === "workflow"
        ? { role: "service_role" }
        : { role: "authenticated", sub: ids[who], session_id: session },
    ),
  ]);
  await db.exec(
    `set role ${who === "workflow" ? "service_role" : "authenticated"}`,
  );
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text); create table auth.sessions(id uuid, user_id uuid);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role;
  `);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into workspaces(id,name) values ($1,$2)", [
    other,
    "Other workspace",
  ]);
  for (const [role, id] of Object.entries(ids)) {
    await db.query("insert into auth.users(id,email) values ($1,$2)", [
      id,
      `${role}@test.invalid`,
    ]);
    await db.query("insert into auth.sessions(id,user_id) values ($1,$2)", [
      session,
      id,
    ]);
    if (role !== "stranger")
      await db.query(
        "insert into workspace_members(workspace_id,user_id,role) values ($1,$2,$3)",
        [workspace, id, role],
      );
  }
  await db.query(
    "insert into campaigns(workspace_id,id,external_id,name,channel,status) values ($1,'google:test','test','Test','google','active'),($2,'google:other','other','Other','google','active')",
    [workspace, other],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("database workspace authorization", () => {
  it("isolates reads by membership, not merely authenticated role", async () => {
    const rows = await asUser("viewer", () =>
      db.query<{ id: string }>("select id from campaigns order by id"),
    );
    expect(rows.rows.map((r) => r.id)).toEqual(["google:test"]);
    expect(
      (await asUser("stranger", () => db.query("select * from campaigns")))
        .rows,
    ).toEqual([]);
    await expect(
      asUser("viewer", () => db.exec("update campaigns set name='Tampered'")),
    ).rejects.toThrow();
  });
  it("permits analysts and workflow ingestion but rejects viewers and cross-workspace writes", async () => {
    const ingest = (w = workspace) =>
      db.query("select public.ingest_batch($1,$2,$3,$4,$5)", [
        w,
        "[]",
        "[]",
        "[]",
        JSON.stringify({
          id: crypto.randomUUID(),
          checksum: "test",
          rowCount: 0,
        }),
      ]);
    await expect(asUser("viewer", () => ingest())).rejects.toThrow(
      /permission/i,
    );
    await expect(asUser("analyst", () => ingest(other))).rejects.toThrow(
      /permission/i,
    );
    await asUser("analyst", () => ingest());
    await asUser("workflow", () => ingest());
    await expect(
      asUser("viewer", () =>
        db.query("select private.ingest_batch($1,$2,$3,$4,$5)", [
          workspace,
          "[]",
          "[]",
          "[]",
          "{}",
        ]),
      ),
    ).rejects.toThrow();
  });
  it("derives immutable approval identity and never permits workflow or analyst approval", async () => {
    const analysisId = crypto.randomUUID(),
      rec = crypto.randomUUID();
    await db.query(
      "insert into analysis_runs(id,workspace_id,provider,evidence,output) values($1,$2,'demo','{}','{}')",
      [analysisId, workspace],
    );
    await db.query(
      "insert into recommendations(id,workspace_id,analysis_id,data_version,fingerprint,campaign_id,title,action,rationale,risk,evidence,expected_impact) values($1,$2,$3,0,$4,'google:test','Test','investigate','Review','low','[]','Check')",
      [rec, workspace, analysisId, rec],
    );
    const decide = () =>
      db.query<{ result: { reviewer: string; reviewer_user_id: string } }>(
        "select public.record_decision($1,$2,$3,$4) as result",
        [workspace, rec, "approved", "Evidence checked"],
      );
    await expect(asUser("workflow", decide)).rejects.toThrow();
    await expect(asUser("analyst", decide)).rejects.toThrow(/permission/i);
    const result = await asUser("approver", decide);
    expect(result.rows[0].result.reviewer_user_id).toBe(ids.approver);
    expect(result.rows[0].result.reviewer).toBe("approver@test.invalid");
    await expect(asUser("approver", decide)).rejects.toThrow(/conflict/i);
    await expect(
      db.exec("update approval_events set reviewer='Someone else'"),
    ).rejects.toThrow(/immutable/i);
    await expect(
      asUser("approver", () =>
        db.query("select public.record_decision($1,$2,$3,$4,$5)", [
          workspace,
          rec,
          "rejected",
          "Spoof attempt",
          "CEO",
        ]),
      ),
    ).rejects.toThrow();
  });
  it("lets only admins manage membership and protects the final administrator", async () => {
    const setRole = (user: string, role: string | null) =>
      db.query("select public.set_member($1,$2,$3)", [workspace, user, role]);
    await expect(
      asUser("viewer", () => setRole(ids.viewer, "admin")),
    ).rejects.toThrow(/permission/i);
    await expect(
      asUser("admin", () => setRole(ids.admin, "viewer")),
    ).rejects.toThrow(/last administrator/i);
    await asUser("admin", () => setRole(ids.viewer, "analyst"));
    expect(
      (
        await db.query<{ role: string }>(
          "select role from workspace_members where user_id=$1",
          [ids.viewer],
        )
      ).rows[0].role,
    ).toBe("analyst");
    await asUser("admin", () => setRole(ids.viewer, "viewer"));
    await expect(
      asUser("viewer", () =>
        db.query("select * from public.list_members($1)", [workspace]),
      ),
    ).rejects.toThrow(/permission/i);
    expect(
      (
        await asUser("admin", () =>
          db.query("select * from public.list_members($1)", [workspace]),
        )
      ).rows,
    ).toHaveLength(4);
  });
  it("denies a revoked session even while its access token has not expired", async () => {
    await db.query("delete from auth.sessions where user_id=$1", [
      ids.approver,
    ]);
    expect(
      (await asUser("approver", () => db.query("select * from campaigns")))
        .rows,
    ).toEqual([]);
    await expect(
      asUser("approver", () =>
        db.query("select public.record_decision($1,$2,$3,$4)", [
          workspace,
          crypto.randomUUID(),
          "rejected",
          "Revoked session",
        ]),
      ),
    ).rejects.toThrow(/session/i);
  });
});
