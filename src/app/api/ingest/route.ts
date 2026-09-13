import { z, ZodError } from "zod";
import { normalizeBatch } from "@/lib/ingestion";
import { buildSampleExports } from "@/lib/samples";
import { readJson, withRepository } from "@/lib/http";
import { ApiError } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return withRepository(
    request,
    async (repo, access) => {
      const input = await readJson(request);
      let batch;
      try {
        batch = normalizeBatch(input);
      } catch (error) {
        if (error instanceof ZodError) throw error;
        throw new ApiError(
          400,
          error instanceof Error ? error.message : "Invalid source batch.",
        );
      }
      const run = await repo.ingest(
        batch,
        access.workflow ? "workflow" : "upload",
      );
      return {
        ...run,
        message: `${run.rowCount} records upserted. No duplicate facts created.`,
      };
    },
    true,
  );
}
export async function PUT(request: Request) {
  return withRepository(
    request,
    async (repo) => {
      // Explicit sample endpoint supports replay in development and isolated portfolio workspaces.
      const params = z
        .object({ source: z.literal("sample") })
        .parse(await readJson(request));
      const run = await repo.ingest(
        normalizeBatch(buildSampleExports()),
        params.source,
      );
      return {
        ...run,
        message: `${run.rowCount} sample records upserted. No duplicate facts created.`,
      };
    },
    true,
  );
}
