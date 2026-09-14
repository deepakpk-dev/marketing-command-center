import { z } from "zod";
import { filterSchema, readJson, withRepository } from "@/lib/http";
import { runAnalysis } from "@/lib/run-analysis";
import { normalizeBatch } from "@/lib/ingestion";
import { ApiError } from "@/lib/errors";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return withRepository(
    request,
    async (repo, access) => {
      const input = z
        .object({
          days: z
            .union([z.literal(7), z.literal(14), z.literal(28)])
            .default(7),
          channel: z.enum(["all", "google", "meta"]).default("all"),
          batch: z.unknown().optional(),
        })
        .strict()
        .parse(await readJson(request));
      let ingestion = null;
      if (input.batch) {
        try {
          ingestion = await repo.ingest(
            normalizeBatch(input.batch),
            "workflow",
          );
        } catch {
          throw new ApiError(
            400,
            "Workflow batch is invalid. Ingestion was not committed.",
          );
        }
      }
      const filters = filterSchema.parse({
        days: input.days,
        channel: input.channel,
      });
      return {
        ingestion,
        ...(await runAnalysis(
          repo,
          filters.days,
          filters.channel,
          access.sessionId,
        )),
        execution: "human_approval_required",
      };
    },
    true,
    "analyze",
  );
}
