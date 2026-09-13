import { buildEvidence } from "./analyst";
import { publicConfig } from "./http";
import type { ChannelFilter, DashboardData, Period, StoreState } from "./types";
export function buildDashboard(
  state: StoreState,
  days: Period,
  channel: ChannelFilter,
): DashboardData {
  const evidence = buildEvidence(state, days, channel),
    ids = new Set(evidence.campaigns.map((c) => c.id));
  const points = new Map<
    string,
    { date: string; spend: number; revenue: number }
  >();
  for (const row of state.ads) {
    if (
      !ids.has(row.campaignId) ||
      row.date < evidence.start ||
      row.date > evidence.end
    )
      continue;
    const point = points.get(row.date) ?? {
      date: row.date,
      spend: 0,
      revenue: 0,
    };
    point.spend += row.spend;
    point.revenue += row.revenue;
    points.set(row.date, point);
  }
  const recommendations = state.recommendations
    .filter((r) => ids.has(r.campaignId))
    .map((r) => ({ ...r, stale: r.dataVersion !== state.dataVersion }));
  return {
    ...publicConfig(),
    evidence,
    timeline: [...points.values()].sort((a, b) => a.date.localeCompare(b.date)),
    recommendations,
    events: state.events.filter((e) =>
      recommendations.some((r) => r.id === e.recommendationId),
    ),
    analysis:
      state.analyses.find(
        (a) =>
          a.evidence.dataVersion === state.dataVersion &&
          a.evidence.days === days &&
          a.evidence.channel === channel &&
          a.evidence.end === evidence.end,
      ) ?? null,
    ingestions: state.ingestions,
    rowCount: state.ads.length + state.analytics.length,
  };
}
