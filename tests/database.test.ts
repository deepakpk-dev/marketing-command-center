import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
let db: PGlite;
const workspace = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;",
  );
  await db.exec(
    readFileSync("supabase/migrations/202609130001_initial.sql", "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Postgres storage contracts", () => {
  it("atomically upserts replayed source facts", async () => {
    const campaigns = [
      {
        id: "google:test",
        externalId: "test",
        name: "Test",
        channel: "google",
        status: "active",
      },
    ];
    const ads = [
      {
        campaignId: "google:test",
        date: "2026-09-12",
        spend: 100,
        impressions: 1000,
        clicks: 100,
        conversions: 10,
        revenue: 400,
      },
    ];
    for (const id of [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ]) {
      await db.query("select public.ingest_batch($1, $2, $3, $4, $5)", [
        workspace,
        JSON.stringify(campaigns),
        JSON.stringify(ads),
        "[]",
        JSON.stringify({ id, checksum: "a", rowCount: 1 }),
      ]);
    }
    const result = await db.query<{ count: number }>(
      "select count(*)::int as count from public.ad_daily",
    );
    expect(result.rows[0].count).toBe(1);
    expect(
      (
        await db.query<{ data_version: number }>(
          "select data_version::int from workspaces",
        )
      ).rows[0].data_version,
    ).toBe(1);
    await expect(
      db.query("update public.ad_daily set spend=-1"),
    ).rejects.toThrow();
  });
  it("rolls back an entire batch if a fact references an unknown campaign", async () => {
    const bad = [
      {
        campaignId: "missing",
        date: "2026-09-12",
        spend: 1,
        impressions: 1,
        clicks: 1,
        conversions: 1,
        revenue: 1,
      },
    ];
    await expect(
      db.query("select public.ingest_batch($1,$2,$3,$4,$5)", [
        workspace,
        "[]",
        JSON.stringify(bad),
        "[]",
        JSON.stringify({
          id: "44444444-4444-4444-8444-444444444444",
          checksum: "bad",
          rowCount: 1,
        }),
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from ingestion_runs",
        )
      ).rows[0].count,
    ).toBe(2);
  });
  it("records a decision only once and prohibits audit edits", async () => {
    const run = {
      id: "55555555-5555-4555-8555-555555555555",
      provider: "demo",
      evidence: {},
      output: {},
    };
    const rec = {
      id: "66666666-6666-4666-8666-666666666666",
      fingerprint: "test",
      campaignId: "google:test",
      title: "Review budget",
      action: "budget",
      rationale: "CPA doubled",
      risk: "medium",
      budgetChangePercent: -10,
      evidence: ["CPA 20"],
      expectedImpact: "Test recovery",
    };
    await db.query("select public.save_analysis($1,$2,$3)", [
      workspace,
      JSON.stringify(run),
      JSON.stringify([rec]),
    ]);
    await db.query("select public.record_decision($1,$2,$3,$4,$5)", [
      workspace,
      rec.id,
      "approved",
      "Reviewed budget cap",
      "Reviewer",
    ]);
    await expect(
      db.query("select public.record_decision($1,$2,$3,$4,$5)", [
        workspace,
        rec.id,
        "rejected",
        "Second decision",
        "Reviewer",
      ]),
    ).rejects.toThrow(/conflict/i);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from approval_events",
        )
      ).rows[0].count,
    ).toBe(1);
    await expect(
      db.query("update public.approval_events set note='Changed'"),
    ).rejects.toThrow(/immutable/i);
  });
  it("blocks stale approval and an analysis saved against an old version", async () => {
    const run = {
      id: "77777777-7777-4777-8777-777777777777",
      provider: "demo",
      evidence: { dataVersion: 1 },
      output: {},
    };
    const rec = {
      id: "88888888-8888-4888-8888-888888888888",
      fingerprint: "freshness",
      campaignId: "google:test",
      title: "Review fresh budget",
      action: "budget",
      rationale: "Check evidence",
      risk: "medium",
      budgetChangePercent: 10,
      evidence: ["CPA 10"],
      expectedImpact: "Measure recovery",
    };
    await db.query("select public.save_analysis($1,$2,$3)", [
      workspace,
      JSON.stringify(run),
      JSON.stringify([rec]),
    ]);
    const ads = [
      {
        campaignId: "google:test",
        date: "2026-09-12",
        spend: 101,
        impressions: 1000,
        clicks: 100,
        conversions: 10,
        revenue: 400,
      },
    ];
    await db.query("select public.ingest_batch($1,$2,$3,$4,$5)", [
      workspace,
      "[]",
      JSON.stringify(ads),
      "[]",
      JSON.stringify({
        id: "99999999-9999-4999-8999-999999999999",
        rowCount: 1,
        checksum: "changed",
      }),
    ]);
    await expect(
      db.query("select public.record_decision($1,$2,$3,$4,$5)", [
        workspace,
        rec.id,
        "approved",
        "Checked stale data",
        "Reviewer",
      ]),
    ).rejects.toThrow(/conflict/i);
    await expect(
      db.query("select public.save_analysis($1,$2,$3)", [
        workspace,
        JSON.stringify({ ...run, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
        "[]",
      ]),
    ).rejects.toThrow(/changed/i);
  });
  it("denies browser roles while allowing server RPC and read access", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.ad_daily")).rejects.toThrow(
        /permission/i,
      );
      await expect(
        db.query("select public.record_decision($1,$2,$3,$4,$5)", [
          workspace,
          "88888888-8888-4888-8888-888888888888",
          "approved",
          "Not a reviewer",
          "Anonymous",
        ]),
      ).rejects.toThrow(/permission/i);
    } finally {
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    try {
      expect(
        (await db.query("select * from public.ad_daily")).rows,
      ).toHaveLength(1);
    } finally {
      await db.exec("reset role");
    }
  });
});
