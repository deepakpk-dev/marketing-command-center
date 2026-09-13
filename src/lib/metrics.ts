import type {
  AdFact,
  AnalyticsFact,
  Kpis,
  Period,
  PeriodComparison,
} from "./types";
export const ratio = (
  numerator: number,
  denominator: number,
): number | null => {
  const value = denominator > 0 ? numerator / denominator : NaN;
  return Number.isFinite(value) ? value : null;
};
export const relativeChange = (
  current: number | null,
  previous: number | null,
): number | null =>
  current !== null && previous !== null && previous !== 0
    ? (current - previous) / previous
    : null;
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function calculateKpis(ads: AdFact[], analytics: AnalyticsFact[]): Kpis {
  const total = <T>(rows: T[], field: keyof T) =>
    rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
  const spend = total(ads, "spend"),
    revenue = total(ads, "revenue"),
    impressions = total(ads, "impressions"),
    clicks = total(ads, "clicks"),
    conversions = total(ads, "conversions");
  const sessions = total(analytics, "sessions"),
    purchases = total(analytics, "purchases"),
    siteRevenue = total(analytics, "revenue");
  const customerFacts = new Map(
    analytics.map((row) => [`${row.campaignId}:${row.date}`, row]),
  );
  const covered = ads.filter((row) => {
    const matched = customerFacts.get(`${row.campaignId}:${row.date}`);
    return matched && matched.newCustomers !== null;
  });
  const customerCoverage = ads.length ? covered.length / ads.length : 0;
  const newCustomers =
    ads.length && covered.length === ads.length
      ? covered.reduce(
          (sum, row) =>
            sum +
            (customerFacts.get(`${row.campaignId}:${row.date}`)?.newCustomers ??
              0),
          0,
        )
      : null;
  return {
    spend,
    revenue,
    impressions,
    clicks,
    conversions,
    sessions,
    purchases,
    siteRevenue,
    newCustomers,
    customerCoverage,
    roas: ratio(revenue, spend),
    cpa: ratio(spend, conversions),
    ctr: ratio(clicks, impressions),
    cvr: ratio(conversions, clicks),
    cac: newCustomers !== null ? ratio(spend, newCustomers) : null,
    siteCvr: ratio(purchases, sessions),
  };
}
export function comparePeriods(
  ads: AdFact[],
  analytics: AnalyticsFact[],
  days: Period,
  end: string,
): PeriodComparison {
  const start = shiftDate(end, -(days - 1)),
    previousEnd = shiftDate(start, -1),
    previousStart = shiftDate(start, -days);
  const between = <T extends { date: string }>(
    rows: T[],
    from: string,
    to: string,
  ) => rows.filter((row) => row.date >= from && row.date <= to);
  return {
    start,
    end,
    previousStart,
    previousEnd,
    current: calculateKpis(
      between(ads, start, end),
      between(analytics, start, end),
    ),
    previous: calculateKpis(
      between(ads, previousStart, previousEnd),
      between(analytics, previousStart, previousEnd),
    ),
  };
}
