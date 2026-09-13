import { describe, expect, it } from "vitest";
import { calculateKpis, comparePeriods } from "../src/lib/metrics";
import { detectAnomalies } from "../src/lib/anomalies";
const fact = {
  campaignId: "g1",
  date: "2026-09-12",
  spend: 100,
  impressions: 10000,
  clicks: 100,
  conversions: 10,
  revenue: 400,
};
const ga = {
  campaignId: "g1",
  date: "2026-09-12",
  sessions: 80,
  purchases: 8,
  revenue: 320,
  newCustomers: 5,
};
describe("measurement", () => {
  it("withholds rates when a tiny denominator would overflow", () => {
    expect(
      calculateKpis([{ ...fact, conversions: 1e-320 }], []).cpa,
    ).toBeNull();
  });
  it("calculates ratios from totals and first-time customers", () => {
    expect(calculateKpis([fact], [ga])).toMatchObject({
      roas: 4,
      cpa: 10,
      ctr: 0.01,
      cvr: 0.1,
      cac: 20,
      siteCvr: 0.1,
      siteRevenue: 320,
      revenue: 400,
    });
  });
  it("weights daily ratios by their denominators", () => {
    expect(
      calculateKpis([fact, { ...fact, spend: 900, revenue: 900 }], []),
    ).toMatchObject({ roas: 1.3, cpa: 50, cac: null });
  });
  it("returns null rather than Infinity or fabricated zero rates", () => {
    expect(calculateKpis([], [])).toMatchObject({
      roas: null,
      cpa: null,
      ctr: null,
      cvr: null,
      cac: null,
      siteCvr: null,
    });
  });
  it("withholds CAC if any advertising fact lacks customer coverage", () => {
    expect(
      calculateKpis([fact, { ...fact, campaignId: "g2" }], [ga]).cac,
    ).toBeNull();
    expect(
      calculateKpis([fact], [{ ...ga, newCustomers: null }]).cac,
    ).toBeNull();
  });
  it("splits equal adjacent windows without overlap", () => {
    const rows = ["2026-09-05", "2026-09-06", "2026-09-12"].map((date) => ({
      ...fact,
      date,
    }));
    const result = comparePeriods(rows, [], 7, "2026-09-12");
    expect(result.current.spend).toBe(200);
    expect(result.previous.spend).toBe(100);
    expect(result.start).toBe("2026-09-06");
    expect(result.previousEnd).toBe("2026-09-05");
  });
  it("detects CPA deterioration and suppresses sparse observations", () => {
    const previous = calculateKpis([{ ...fact, conversions: 50 }], []);
    const current = calculateKpis(
      [{ ...fact, spend: 200, conversions: 50 }],
      [],
    );
    expect(
      detectAnomalies("g1", current, previous).some((a) => a.metric === "cpa"),
    ).toBe(true);
    expect(
      detectAnomalies(
        "g1",
        calculateKpis([fact], []),
        calculateKpis([fact], []),
      ),
    ).toEqual([]);
    expect(
      detectAnomalies(
        "g1",
        calculateKpis([{ ...fact, spend: 500, conversions: 1 }], []),
        previous,
      ).some((a) => a.metric === "cpa"),
    ).toBe(false);
  });
});
