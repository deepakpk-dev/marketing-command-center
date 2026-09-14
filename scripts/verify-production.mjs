import { createClient } from "@supabase/supabase-js";
import { parseEnv } from "node:util";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const env = parseEnv(readFileSync(process.argv[2], "utf8"));
const origin = "https://marketing-command-center-deepakprabhs-projects.vercel.app";
assert.equal(env.SUPABASE_URL, "https://btgavjndnsegdsaspsmx.supabase.co");
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `production-check-${randomBytes(8).toString("hex")}@example.invalid`;
const password = randomBytes(24).toString("base64url");
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) throw new Error("Temporary account creation failed.");
const id = created.data.user.id;
assert.match(id, /^[a-f0-9-]{36}$/); assert.match(env.WORKSPACE_ID, /^[a-f0-9-]{36}$/);
const sql = (query) => execFileSync("supabase", ["db", "query", "--linked", query], { stdio: "pipe" });
let cookie = "";
let checks = 0;
async function call(path, method = "GET", data) {
  const response = await fetch(`${origin}${path}`, { method, headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  return response;
}
try {
  sql(`insert into public.workspace_members(workspace_id,user_id,role) values ('${env.WORKSPACE_ID}','${id}','viewer');`);
  assert.equal((await call("/api/health")).status, 200); checks++;
  assert.equal((await call("/api/dashboard")).status, 401); checks++;
  const login = await call("/api/session", "POST", { email, password });
  assert.equal(login.status, 200); checks++;
  assert.ok(login.headers.getSetCookie().some((c) => c.includes("HttpOnly") && c.includes("Secure"))); checks++;
  const dashboard = await call("/api/dashboard"); assert.equal(dashboard.status, 200); assert.equal((await dashboard.json()).access.role, "viewer"); checks++;
  assert.equal((await call("/api/analyze", "POST", {})).status, 403); checks++;
  const link = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: `${origin}/auth/reset` } });
  if (link.error) throw new Error("Temporary recovery link generation failed.");
  const exchange = await call("/api/session/exchange", "POST", { token_hash: link.data.properties.hashed_token, type: "recovery" });
  assert.equal(exchange.status, 200); checks++;
  const replacementPassword = randomBytes(24).toString("base64url");
  assert.equal((await call("/api/session", "PUT", { password: replacementPassword })).status, 200); checks++;
  assert.equal((await call("/api/session", "DELETE")).status, 200); checks++;
  cookie = "";
  assert.equal((await call("/api/session", "POST", { email, password: replacementPassword })).status, 200); checks++;
  const expired = await call("/api/session/exchange", "POST", { token_hash: link.data.properties.hashed_token, type: "recovery" }); assert.equal(expired.status, 401); checks++;
  console.log(`Production verification passed: ${checks} checks. HTTPS Auth, secure cookies, reporting permissions, single-use recovery, password update and sign-out verified.`);
} finally {
  sql(`delete from public.workspace_members where workspace_id='${env.WORKSPACE_ID}' and user_id='${id}';`);
  const removed = await admin.auth.admin.deleteUser(id);
  if (removed.error) throw new Error("Temporary production verification account cleanup failed.");
  console.log("Temporary test account removed; no marketing facts or approval history changed. No email sent.");
}
