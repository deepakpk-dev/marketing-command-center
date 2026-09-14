import { describe, expect, it } from "vitest";
import { readReport, validateReport } from "../src/lib/report-import";

function importCsv(text: string, currency = "EUR") {
  const parsed = readReport(text);
  return validateReport(
    parsed,
    parsed.mapping,
    parsed.source ?? "google",
    currency,
  );
}
const header =
  "Campaign ID,Campaign,Day,Cost,Currency code,Impressions,Clicks,Conversions,Conv. value\n";
describe("report import", () => {
  it("reads quoted names and original currency without cost-micros conversion", () => {
    const result = importCsv(
      "\ufeff" + header + '1,"Search, brand",2026-09-01,12.50,USD,100,10,2,40',
    );
    expect(result.errors).toEqual([]);
    expect(result.dataset?.currency).toBe("USD");
    expect(result.dataset?.rows[0]).toMatchObject({
      campaignId: "google:1",
      name: "Search, brand",
      spend: 12.5,
      revenue: 40,
    });
  });
  it("infers Meta currency from spend heading and keeps absent metrics unavailable", () => {
    const parsed = readReport(
      "Campaign ID,Campaign name,Reporting starts,Reporting ends,Amount spent (USD),Impressions,Clicks (all)\n2,Prospecting,2026-09-01,2026-09-01,25,1000,20",
    );
    expect(parsed.source).toBe("meta");
    const result = validateReport(parsed, parsed.mapping, "meta", "EUR");
    expect(result.errors).toEqual([]);
    expect(result.dataset?.currency).toBe("USD");
    expect(result.dataset?.rows[0]).toMatchObject({
      revenue: null,
      conversions: null,
    });
  });
  it.each([
    ["1,Brand,2026-02-30,12,EUR,100,10,2,40", /date/i],
    ["1,Brand,2026-09-01,-12,EUR,100,10,2,40", /spend/i],
    ["1,Brand,2026-09-01,12,EUR,100,10,no,40", /conversions/i],
  ])("blocks invalid rows with row-specific errors", (row, message) => {
    const result = importCsv(header + row);
    expect(result.dataset).toBeNull();
    expect(result.errors[0]).toMatchObject({ row: 2 });
    expect(result.errors[0].message).toMatch(message);
  });
  it("rejects duplicated campaign/day facts instead of doubling spend", () => {
    const row = "1,Brand,2026-09-01,12,EUR,100,10,2,40";
    const result = importCsv(header + row + "\n" + row);
    expect(result.dataset).toBeNull();
    expect(result.errors.some((e) => /duplicate/i.test(e.message))).toBe(true);
  });
  it("rejects mixed currencies", () => {
    const result = importCsv(
      header +
        "1,Brand,2026-09-01,12,EUR,100,10,2,40\n2,Other,2026-09-01,12,USD,100,10,2,40",
    );
    expect(result.dataset).toBeNull();
    expect(result.errors.some((e) => /currenc/i.test(e.message))).toBe(true);
  });
  it("rejects multi-day Meta summary rows", () => {
    const result = importCsv(
      "Campaign ID,Campaign name,Reporting starts,Reporting ends,Amount spent (EUR),Impressions,Clicks (all)\n2,Prospecting,2026-09-01,2026-09-07,25,1000,20",
    );
    expect(result.dataset).toBeNull();
    expect(result.errors.some((e) => /daily/i.test(e.message))).toBe(true);
  });
  it("allows explicit mapping for unfamiliar export columns", () => {
    const parsed = readReport(
      "identifier,title,date,money,views,visits\na,Example,2026-09-01,25,1000,20",
    );
    const result = validateReport(
      parsed,
      {
        campaignId: "identifier",
        name: "title",
        date: "date",
        spend: "money",
        impressions: "views",
        clicks: "visits",
      },
      "google",
      "GBP",
    );
    expect(result.errors).toEqual([]);
    expect(result.dataset?.currency).toBe("GBP");
  });
  it("reads semicolon exports with decimal comma and escaped quotes", () => {
    const result = importCsv(
      'Campaign ID;Campaign;Day;Cost;Impressions;Clicks\n1;"Brand ""A""";2026-09-01;12,50;100;10',
    );
    expect(result.errors).toEqual([]);
    expect(result.dataset?.rows[0]).toMatchObject({
      name: 'Brand "A"',
      spend: 12.5,
    });
  });
  it("requires a currency when it is absent from the file", () => {
    const result = importCsv(
      "Campaign ID,Campaign,Day,Cost,Impressions,Clicks\n1,Brand,2026-09-01,12,100,10",
      "",
    );
    expect(result.dataset).toBeNull();
    expect(result.errors.some((e) => /currency/i.test(e.message))).toBe(true);
  });
  it("rejects ambiguous comma decimals rather than silently multiplying cost", () => {
    const result = importCsv(
      header + '1,Brand,2026-09-01,"12,50",EUR,100,10,2,40',
    );
    expect(result.dataset).toBeNull();
    expect(result.errors.some((e) => /spend/i.test(e.message))).toBe(true);
  });
  it("rejects assigning one column to different metrics", () => {
    const parsed = readReport(header + "1,Brand,2026-09-01,12,EUR,100,10,2,40");
    const result = validateReport(
      parsed,
      { ...parsed.mapping, revenue: "Cost" },
      "google",
      "EUR",
    );
    expect(result.dataset).toBeNull();
    expect(result.errors.some((e) => /column/i.test(e.message))).toBe(true);
  });
  it("rejects malformed quotes and empty exports", () => {
    expect(() => readReport('Campaign,"Broken\n1,2')).toThrow(/quote/i);
    expect(() => readReport("")).toThrow(/CSV/i);
  });
});
