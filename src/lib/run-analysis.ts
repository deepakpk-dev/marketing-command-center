import {
  analyzeDemo,
  analyzeOpenAI,
  buildEvidence,
  createAnalysisRun,
} from "./analyst";
import { enforceRateLimit, getAIProvider } from "./auth";
import { ApiError } from "./errors";
import type { Repository } from "./repository";
import type { ChannelFilter, Period } from "./types";
export async function runAnalysis(
  repo: Repository,
  days: Period,
  channel: ChannelFilter,
  identity: string,
) {
  const provider = getAIProvider();
  enforceRateLimit(
    `analysis:${identity}`,
    provider === "openai" ? 10 : 60,
    3600000,
  );
  const state = await repo.read(),
    evidence = buildEvidence(state, days, channel);
  if (!evidence.campaigns.length || !evidence.totals.current.spend)
    throw new ApiError(
      400,
      "Ingest advertising data for this selection before analyzing it.",
    );
  let output;
  try {
    output =
      provider === "openai"
        ? await analyzeOpenAI(evidence)
        : analyzeDemo(evidence);
  } catch {
    throw new ApiError(
      502,
      "AI analysis could not be completed or validated. Check credentials and provider limits, then retry. No recommendations were saved.",
    );
  }
  const result = createAnalysisRun(evidence, output, provider);
  await repo.saveAnalysis(result.run, result.recommendations);
  return {
    analysisId: result.run.id,
    provider,
    recommendationCount: output.recommendations.length,
    message: "Analysis complete. Actions are ready for review.",
  };
}
