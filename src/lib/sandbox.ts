import { normalizeBatch } from "./ingestion";
import { buildSampleExports } from "./samples";
import { calculateKpis, ratio, shiftDate } from "./metrics";
import { detectAnomalies } from "./anomalies";
import type { ChannelFilter, Period } from "./types";
import type { SandboxDataset, SandboxRow } from "./report-import";

export function sampleDataset(): SandboxDataset {
  const batch = normalizeBatch(buildSampleExports());
  return {
    kind: "sample",
    source: "both",
    currency: "EUR",
    rows: batch.ads.map((row) => {
      const campaign = batch.campaigns.find((c) => c.id === row.campaignId)!;
      return {
        ...row,
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
      };
    }),
  };
}
export function totalRows(rows: SandboxRow[]) {
  const sum = (field: "spend" | "impressions" | "clicks") =>
    rows.reduce((n, row) => n + row[field], 0);
  const optional = (field: "revenue" | "conversions") =>
    rows.length && rows.every((r) => r[field] !== null)
      ? rows.reduce((n, r) => n + (r[field] ?? 0), 0)
      : null;
  const spend = sum("spend"),
    impressions = sum("impressions"),
    clicks = sum("clicks"),
    revenue = optional("revenue"),
    conversions = optional("conversions");
  return {
    spend,
    impressions,
    clicks,
    revenue,
    conversions,
    roas: revenue === null ? null : ratio(revenue, spend),
    cpa: conversions === null ? null : ratio(spend, conversions),
    ctr: ratio(clicks, impressions),
    cvr: conversions === null ? null : ratio(conversions, clicks),
  };
}
export interface SandboxRecommendation {
  id: string;
  campaignId: string;
  title: string;
  rationale: string;
  evidence: string[];
}
export function measureDataset(
  dataset: SandboxDataset,
  days: Period,
  channel: ChannelFilter,
) {
  const end = [...dataset.rows.map((r) => r.date)].sort().at(-1)!;
  const start = shiftDate(end, 1 - days),
    previousStart = shiftDate(start, -days),
    previousEnd = shiftDate(start, -1);
  const selected = dataset.rows.filter(
    (r) => channel === "all" || r.channel === channel,
  );
  const current = selected.filter((r) => r.date >= start && r.date <= end);
  const previous = selected.filter(
    (r) => r.date >= previousStart && r.date <= previousEnd,
  );
  const ids = [...new Set(selected.map((r) => r.campaignId))];
  const campaigns = ids.map((campaignId) => {
    const all = selected.filter((r) => r.campaignId === campaignId),
      recent = current.filter((r) => r.campaignId === campaignId),
      baseline = previous.filter((r) => r.campaignId === campaignId);
    const complete =
      new Set(recent.map((r) => r.date)).size === days &&
      new Set(baseline.map((r) => r.date)).size === days;
    const totals = totalRows(recent),
      previousTotals = totalRows(baseline);
    const kpis = (rows: SandboxRow[]) =>
      calculateKpis(
        rows.map((r) => ({
          ...r,
          revenue: r.revenue ?? 0,
          conversions: r.conversions ?? 0,
        })),
        [],
      );
    const anomalies = complete
      ? detectAnomalies(campaignId, kpis(recent), kpis(baseline)).filter(
          (a) => {
            if (a.metric === "roas")
              return (
                totals.roas !== null &&
                previousTotals.roas !== null &&
                totals.conversions !== null &&
                previousTotals.conversions !== null
              );
            if (a.metric === "cpa" || a.metric === "cvr")
              return (
                totals.conversions !== null &&
                previousTotals.conversions !== null
              );
            return true;
          },
        )
      : [];
    return {
      campaignId,
      name: all.at(-1)!.name,
      channel: all[0].channel,
      status: all.at(-1)!.status,
      totals,
      previousTotals,
      complete,
      anomalies,
      rowCount: recent.length,
    };
  });
  const cash = (n: number | null) =>
    n === null
      ? "Unavailable"
      : new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: dataset.currency,
          maximumFractionDigits: 2,
        }).format(n);
  const recommendations: SandboxRecommendation[] = campaigns
    .filter((c) => c.anomalies.length)
    .map((c) => ({
      id: `${c.campaignId}:${end}:${days}:${channel}`,
      campaignId: c.campaignId,
      title: `Review ${c.name}`,
      rationale:
        "Efficiency crossed a review threshold. Check creative, audience mix and conversion tracking before making a capped, reversible adjustment. This is a hypothesis, not proof of cause.",
      evidence: [
        ...c.anomalies.map(
          (a) => `${a.explanation} (${Math.abs(a.change * 100).toFixed(1)}%).`,
        ),
        `CPA: ${cash(c.totals.cpa)}; previous ${cash(c.previousTotals.cpa)}.`,
        `ROAS: ${c.totals.roas?.toFixed(2) ?? "Unavailable"}; previous ${c.previousTotals.roas?.toFixed(2) ?? "Unavailable"}.`,
      ],
    }));
  return {
    start,
    end,
    previousStart,
    previousEnd,
    totals: totalRows(current),
    previousTotals: totalRows(previous),
    campaigns,
    recommendations,
    complete: campaigns.length > 0 && campaigns.every((c) => c.complete),
    days,
  };
}
export type SandboxReport = ReturnType<typeof measureDataset>;
export interface SandboxDecision {
  id: string;
  title: string;
  decision: "approved" | "rejected";
  note: string;
  evidence: string[];
  createdAt: string;
}
