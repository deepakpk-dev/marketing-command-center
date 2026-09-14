import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
// Explicitly named source file; credentials go over CLI stdin, never arguments or output.
const envPath = process.argv[2];
const origin = process.argv[3];
if (!envPath || !origin || new URL(origin).protocol !== "https:") throw new Error("Provide local env path and the production HTTPS origin.");
const link = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
if (link.projectId !== "prj_hQ5ta4Z2Sr85USsqTUCdFLxgGaKO" || link.orgId !== "team_7xpXS2Iha7pOcUDCYMJRI5Or") throw new Error("Unexpected Vercel project.");
const source = parseEnv(readFileSync(envPath, "utf8"));
if (source.SUPABASE_URL !== "https://btgavjndnsegdsaspsmx.supabase.co") throw new Error("Unexpected Supabase project.");
const vars = { DATA_MODE: "supabase", AI_PROVIDER: "demo", NEXT_TELEMETRY_DISABLED: "1", SUPABASE_URL: source.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: source.SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY: source.SUPABASE_SECRET_KEY, WORKSPACE_ID: source.WORKSPACE_ID, WORKFLOW_TOKEN: source.WORKFLOW_TOKEN, APP_ORIGIN: origin };
const cli = resolve(process.env.APPDATA, "npm/node_modules/vercel/dist/vc.js");
for (const [name, value] of Object.entries(vars)) {
  if (!value) throw new Error(`Missing ${name}`);
  try { execFileSync(process.execPath, [cli, "env", "add", name, "production", "--sensitive", "--force", "--yes", "--scope", "deepakprabhs-projects"], { input: value, stdio: ["pipe", "pipe", "pipe"], windowsHide: true }); }
  catch { throw new Error(`Could not configure ${name}; no secret output retained.`); }
  console.log(`Configured ${name} as a private production environment variable.`);
}
