import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// Explicit opt-in: creates one temporary confirmed Auth user, without sending mail.
if (!process.argv.includes("--allow-hosted-writes"))
  throw new Error(
    "Pass --allow-hosted-writes to create and remove a temporary verification account.",
  );
nextEnv.loadEnvConfig(process.cwd());
const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
assert.equal(process.env.SUPABASE_URL, `https://${ref}.supabase.co`);
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const workspace = process.env.WORKSPACE_ID!;
assert.match(workspace, /^[a-f0-9-]{36}$/);
const query = (sql: string) =>
  execFileSync("supabase", ["db", "query", "--linked", sql], { stdio: "pipe" });
const email = `verification-${randomBytes(8).toString("hex")}@example.invalid`;
const password = randomBytes(24).toString("base64url");
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (created.error || !created.data.user)
  throw new Error("Could not create temporary Auth verification account.");
const userId = created.data.user.id;
const server = spawn(process.execPath, ["scripts/start.mjs"], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    DATA_MODE: "supabase",
    PORT: "4000",
    HOSTNAME: "127.0.0.1",
    APP_ORIGIN: "http://127.0.0.1:4000",
  },
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let checks = 0;
const status = async (response: { status(): number }, expected: number) => {
  assert.equal(response.status(), expected);
  checks++;
};
try {
  query(
    `insert into public.workspace_members(workspace_id,user_id,role) values ('${workspace}','${userId}','viewer');`,
  );
  const publicClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const directLogin = await publicClient.auth.signInWithPassword({
    email,
    password,
  });
  console.log(
    `Direct Auth diagnostic: ${directLogin.error?.code || "success"}; ${directLogin.error?.message || "identity validated"}`,
  );
  assert.equal(directLogin.error, null);
  checks++;
  const signup = await publicClient.auth.signUp({
    email: `blocked-${randomBytes(8).toString("hex")}@example.invalid`,
    password,
  });
  assert.equal(signup.error?.code, "signup_disabled");
  checks++;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:4000/api/health")).ok) break;
    } catch {
      /* Wait for our own server. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch();
  const context = await browser.newContext();
  await status(
    await context.request.get("http://127.0.0.1:4000/api/dashboard"),
    401,
  );
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4000/workspace");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Your password", { exact: true }).fill(password);
  const loginResult = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/session") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const loginResponse = await loginResult;
  console.log(`Hosted browser sign-in status: ${loginResponse.status()}`);
  if (!loginResponse.ok())
    console.log(`Sign-in error: ${JSON.stringify(await loginResponse.json())}`);
  await page.getByText(email, { exact: true }).waitFor();
  checks++;
  // Exercise the same fragment exchange/password screen used by invitations.
  // Tokens remain in memory; never print the fragment or record browser traces.
  const session = directLogin.data.session!;
  await page.goto(
    `http://127.0.0.1:4000/auth/accept#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`,
  );
  await page.getByLabel("Confirm password", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "");
  checks++;
  const nextPassword = randomBytes(24).toString("base64url");
  await page.getByLabel("Your password", { exact: true }).fill(nextPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(nextPassword);
  await page
    .getByRole("button", { name: "Set password and open workspace" })
    .click();
  await page.getByText(email, { exact: true }).waitFor();
  checks++;
  const updatedLogin = await publicClient.auth.signInWithPassword({
    email,
    password: nextPassword,
  });
  assert.equal(updatedLogin.error, null);
  checks++;
  const response = await context.request.get(
    "http://127.0.0.1:4000/api/dashboard",
  );
  await status(response, 200);
  assert.equal((await response.json()).access.role, "viewer");
  checks++;
  for (const path of ["/api/ingest", "/api/analyze"])
    await status(
      await context.request.post(`http://127.0.0.1:4000${path}`, { data: {} }),
      403,
    );
  await status(
    await context.request.get("http://127.0.0.1:4000/api/members"),
    403,
  );
  const cookies = await context.cookies();
  assert.ok(
    cookies.some((cookie) => cookie.httpOnly && cookie.name.startsWith("sb-")),
  );
  checks++;
  query(
    `delete from public.workspace_members where workspace_id='${workspace}' and user_id='${userId}';`,
  );
  await status(
    await context.request.get("http://127.0.0.1:4000/api/dashboard"),
    403,
  );
  await status(
    await context.request.delete("http://127.0.0.1:4000/api/session"),
    200,
  );
  await status(
    await context.request.get("http://127.0.0.1:4000/api/dashboard"),
    401,
  );
  console.log(
    `Connected verification passed: ${checks} checks against hosted Auth, browser cookies, reporting, denied writes and immediate membership revocation.`,
  );
} finally {
  await browser?.close();
  server.kill();
  query(
    `delete from public.workspace_members where workspace_id='${workspace}' and user_id='${userId}';`,
  );
  const removed = await admin.auth.admin.deleteUser(userId);
  if (removed.error)
    throw new Error(
      "Temporary verification account cleanup failed; inspect Auth users.",
    );
  console.log(
    "Temporary verification account removed. No marketing data or approval history changed.",
  );
}
