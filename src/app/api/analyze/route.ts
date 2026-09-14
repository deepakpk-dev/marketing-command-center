import { filterSchema, readJson, withRepository } from "@/lib/http";
import { runAnalysis } from "@/lib/run-analysis";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return withRepository(
    request,
    async (repo, access) => {
      const { days, channel } = filterSchema.parse(await readJson(request));
      return runAnalysis(repo, days, channel, access.sessionId);
    },
    true,
    "analyze",
  );
}
