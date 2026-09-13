import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const root = fileURLToPath(new URL("../", import.meta.url));
const standalone = join(root, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  console.error("Run npm run build before starting the production server.");
  process.exit(1);
}
process.env.NODE_ENV = "production";
nextEnv.loadEnvConfig(root, false);
cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});
process.env.HOSTNAME ||= "127.0.0.1";
await import(pathToFileURL(join(standalone, "server.js")).href);
