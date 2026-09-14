import nextEnv from "@next/env";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { createAdminClient, workspaceId } from "../src/lib/supabase-auth";
import { findAuthUser } from "../src/lib/members";
nextEnv.loadEnvConfig(process.cwd(), false);
const email = z.email().parse(process.argv[2]).toLowerCase();
const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (process.env.SUPABASE_URL !== `https://${ref}.supabase.co`)
  throw new Error("Linked project and environment do not match.");
const admin = createAdminClient();
const { data: admins, error } = await admin
  .from("workspace_members")
  .select("user_id")
  .eq("workspace_id", workspaceId())
  .eq("role", "admin");
if (error)
  throw new Error(
    "Apply the workspace identity migration before bootstrapping.",
  );
if (admins.length)
  throw new Error(
    "An administrator already exists. Use the signed-in Workspace access screen; bootstrap never elevates additional accounts.",
  );
let user = await findAuthUser(admin, email);
let invited = false;
if (!user) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.APP_ORIGIN}/auth/accept`,
  });
  if (error || !data.user)
    throw new Error(
      `Administrator invitation failed (${error?.status || "unknown"}). Check SMTP recipient restrictions and rate limits. No membership was created.`,
    );
  user = data.user;
  invited = true;
}
const id = z.uuid().parse(user.id),
  workspace = z.uuid().parse(workspaceId());
const sql = `begin; select id from public.workspaces where id='${workspace}' for update; insert into public.workspace_members(workspace_id,user_id,role) select '${workspace}','${id}','admin' where not exists(select 1 from public.workspace_members where workspace_id='${workspace}' and role='admin') on conflict(workspace_id,user_id) do nothing; commit;`;
execFileSync("supabase", ["db", "query", "--linked", sql], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const { data: membership, error: verifyError } = await admin
  .from("workspace_members")
  .select("role")
  .eq("workspace_id", workspace)
  .eq("user_id", id)
  .single();
if (verifyError || membership?.role !== "admin")
  throw new Error(
    "First administrator membership could not be verified. No additional elevation was attempted.",
  );
console.log(
  `Administrator access verified for ${email}. ${invited ? "Supabase accepted the email invitation request; check your inbox." : "Existing account retained; sign in with its individual password."}`,
);
