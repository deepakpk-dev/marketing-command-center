import { expect, it } from "vitest";
import { measureDataset, sampleDataset } from "../src/lib/sandbox";
import type { SandboxDataset } from "../src/lib/report-import";
const dataset: SandboxDataset = {
  source: "google",
  kind: "upload",
  currency: "USD",
  rows: [
    {
      campaignId: "google:99",
      name: "Only my campaign",
      status: "active",
      channel: "google",
      date: "2026-09-01",
      spend: 20,
      impressions: 100,
      clicks: 10,
      conversions: 2,
      revenue: null,
    },
  ],
};
it("measures only uploaded facts and preserves unavailable revenue", () => {
  const report = measureDataset(dataset, 7, "all");
  expect(report.campaigns).toHaveLength(1);
  expect(report.totals.spend).toBe(20);
  expect(report.totals.revenue).toBeNull();
  expect(report.totals.roas).toBeNull();
  expect(report.totals.cpa).toBe(10);
  expect(report.complete).toBe(false);
  expect(report.recommendations).toEqual([]);
});
it("does not treat absent conversions as zero", () => {
  const report = measureDataset(
    { ...dataset, rows: [{ ...dataset.rows[0], conversions: null }] },
    7,
    "all",
  );
  expect(report.totals.conversions).toBeNull();
  expect(report.totals.cpa).toBeNull();
});
it("sample data produces evidence-backed reviewable actions", () => {
  const report = measureDataset(sampleDataset(), 7, "all");
  expect(report.complete).toBe(true);
  expect(report.recommendations.length).toBeGreaterThan(0);
  expect(report.recommendations[0].evidence.length).toBeGreaterThan(0);
});
it("channel filters exclude the other platform without altering the source", () => {
  const sample = sampleDataset();
  const report = measureDataset(sample, 14, "google");
  expect(report.campaigns.every((c) => c.channel === "google")).toBe(true);
  expect(sample.rows.some((r) => r.channel === "meta")).toBe(true);
});
