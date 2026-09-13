import { mkdir, writeFile } from "node:fs/promises";
import { buildSampleExports } from "../src/lib/samples";
const batch = buildSampleExports();
await mkdir("public", { recursive: true });
await writeFile(
  "public/sample-data.json",
  JSON.stringify(batch, null, 2) + "\n",
);
console.log(
  `Exported ${batch.googleAds.length + batch.metaAds.length + batch.ga4.length} modeled facts to public/sample-data.json`,
);
