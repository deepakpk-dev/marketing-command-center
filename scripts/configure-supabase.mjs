import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const ref = readFileSync(
  new URL("../supabase/.temp/project-ref", import.meta.url),
  "utf8",
).trim();
if (!/^[a-z]{20}$/.test(ref))
  throw new Error("Link a valid Supabase project before configuring the app.");
const destination = new URL("../.env.local", import.meta.url);
const refreshing = process.argv.includes("--refresh-keys");
if (existsSync(destination) && !refreshing)
  throw new Error(
    "Existing .env.local preserved. Configure its values manually; this command never overwrites secrets.",
  );
const keys = JSON.parse(
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
      ),
      "projects",
      "api-keys",
      "--project-ref",
      ref,
      "--output",
      "json",
      "--reveal",
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const publishable =
  keys.find((k) => k.api_key?.startsWith("sb_publishable_")) ||
  keys.find((k) => k.name === "anon");
const secret =
  keys.find((k) => k.api_key?.startsWith("sb_secret_")) ||
  keys.find((k) => k.name === "service_role");
if (!publishable?.api_key || !secret?.api_key)
  throw new Error(
    "Required Supabase keys were not returned. No environment file was written.",
  );
if (
  !/^sb_secret_[A-Za-z0-9_-]+$/.test(secret.api_key) &&
  !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secret.api_key)
)
  throw new Error("Supabase returned a secret placeholder. No keys written.");
if (refreshing && existsSync(destination)) {
  const existing = readFileSync(destination, "utf8");
  if (!existing.includes(`SUPABASE_URL=https://${ref}.supabase.co`))
    throw new Error("Environment belongs to another project; preserved.");
  writeFileSync(
    destination,
    existing
      .replace(
        /^SUPABASE_PUBLISHABLE_KEY=.*$/m,
        `SUPABASE_PUBLISHABLE_KEY=${publishable.api_key}`,
      )
      .replace(
        /^SUPABASE_SECRET_KEY=.*$/m,
        `SUPABASE_SECRET_KEY=${secret.api_key}`,
      ),
    { mode: 0o600 },
  );
} else
  writeFileSync(
    destination,
    [
      "DATA_MODE=supabase",
      "AI_PROVIDER=demo",
      "NEXT_TELEMETRY_DISABLED=1",
      `SUPABASE_URL=https://${ref}.supabase.co`,
      `SUPABASE_PUBLISHABLE_KEY=${publishable.api_key}`,
      `SUPABASE_SECRET_KEY=${secret.api_key}`,
      "WORKSPACE_ID=11111111-1111-4111-8111-111111111111",
      "APP_ORIGIN=http://127.0.0.1:3000",
      `WORKFLOW_TOKEN=${randomBytes(32).toString("base64url")}`,
      "OPENAI_MODEL=gpt-5-mini",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
console.log(
  `Configured project ${ref}. Credentials saved only in ignored .env.local; no keys printed.`,
);
