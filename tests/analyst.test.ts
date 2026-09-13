import { describe, expect, it } from "vitest";
import {
  buildEvidence,
  analyzeDemo,
  validateAnalysis,
} from "../src/lib/analyst";
import { normalizeBatch } from "../src/lib/ingestion";
import { buildSampleExports } from "../src/lib/samples";
describe("grounded analyst", () => {
  it("demonstrates a capped growth test alongside the deterioration actions", () => {
    const result = analyzeDemo(
      buildEvidence(normalizeBatch(buildSampleExports()), 7, "all"),
    );
    expect(
      result.recommendations.some(
        (action) =>
          action.campaignId === "google:g-brand" &&
          action.budgetChangePercent === 10,
      ),
    ).toBe(true);
  });
  it("builds aggregate evidence and actionable recommendations", () => {
    const data = normalizeBatch(buildSampleExports());
    const evidence = buildEvidence(data, 7, "all");
    const result = analyzeDemo(evidence);
    expect(evidence.end).toBe("2026-09-12");
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(
      result.recommendations.every((r) =>
        evidence.campaigns.some((c) => c.id === r.campaignId),
      ),
    ).toBe(true);
    expect(result.findings.some((f) => f.evidence.length > 0)).toBe(true);
  });
  it("rejects hallucinated campaign identifiers and excessive budgets", () => {
    const evidence = buildEvidence(
      normalizeBatch(buildSampleExports()),
      7,
      "all",
    );
    const result = analyzeDemo(evidence);
    expect(() =>
      validateAnalysis(
        {
          ...result,
          recommendations: [
            { ...result.recommendations[0], campaignId: "imaginary" },
          ],
        },
        evidence,
      ),
    ).toThrow();
    expect(() =>
      validateAnalysis(
        {
          ...result,
          recommendations: [
            { ...result.recommendations[0], budgetChangePercent: 80 },
          ],
        },
        evidence,
      ),
    ).toThrow();
  });
});
