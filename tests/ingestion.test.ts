import { describe, expect, it } from "vitest";
import { normalizeBatch } from "../src/lib/ingestion";
import { buildSampleExports } from "../src/lib/samples";
describe("source normalization", () => {
  it("normalizes cost micros and preserves separate GA4 revenue", () => {
    const batch = normalizeBatch(buildSampleExports());
    expect(batch.campaigns.length).toBe(6);
    expect(batch.ads.length).toBe(336);
    expect(batch.analytics.length).toBe(336);
    expect(
      batch.ads.every((a) => Number.isFinite(a.spend) && a.spend >= 0),
    ).toBe(true);
    expect(batch.analytics.every((a) => a.newCustomers !== null)).toBe(true);
  });
  it("rejects conflicting duplicate facts instead of double counting", () => {
    const input = buildSampleExports();
    input.googleAds.push({
      ...input.googleAds[0],
      metrics: { ...input.googleAds[0].metrics, costMicros: 1 },
    });
    expect(() => normalizeBatch(input)).toThrow(/duplicate/i);
  });
  it("rejects negative metrics and impossible calendar dates", () => {
    const input = buildSampleExports();
    input.googleAds[0].metrics.clicks = -1;
    expect(() => normalizeBatch(input)).toThrow();
    input.googleAds[0].metrics.clicks = 1;
    input.googleAds[0].segments.date = "2026-02-30";
    expect(() => normalizeBatch(input)).toThrow();
  });
});
