import type { Anomaly, Kpis } from "./types";
import { relativeChange } from "./metrics";
export function detectAnomalies(
  campaignId: string,
  current: Kpis,
  previous: Kpis,
): Anomaly[] {
  const rules = [
    {
      metric: "cpa" as const,
      threshold: 0.25,
      direction: 1,
      enough:
        current.conversions >= 20 &&
        previous.conversions >= 20 &&
        current.spend >= 100 &&
        previous.spend >= 100,
      label: "Cost per conversion increased",
    },
    {
      metric: "roas" as const,
      threshold: 0.2,
      direction: -1,
      enough:
        current.conversions >= 20 &&
        previous.conversions >= 20 &&
        current.spend >= 100 &&
        previous.spend >= 100,
      label: "Return on ad spend decreased",
    },
    {
      metric: "ctr" as const,
      threshold: 0.2,
      direction: -1,
      enough:
        current.impressions >= 10000 &&
        previous.impressions >= 10000 &&
        current.clicks >= 100 &&
        previous.clicks >= 100,
      label: "Click-through rate decreased",
    },
    {
      metric: "cvr" as const,
      threshold: 0.25,
      direction: -1,
      enough:
        current.clicks >= 300 &&
        previous.clicks >= 300 &&
        current.conversions >= 20 &&
        previous.conversions >= 20,
      label: "Ad conversion rate decreased",
    },
  ];
  return rules.flatMap((rule) => {
    const a = current[rule.metric],
      b = previous[rule.metric],
      change = relativeChange(a, b);
    if (
      !rule.enough ||
      a === null ||
      b === null ||
      change === null ||
      change * rule.direction < rule.threshold
    )
      return [];
    return [
      {
        campaignId,
        metric: rule.metric,
        change,
        current: a,
        previous: b,
        severity:
          Math.abs(change) >= 0.4
            ? ("critical" as const)
            : ("warning" as const),
        explanation: `${rule.label} ${Math.round(Math.abs(change) * 100)}% against the previous equal-length period. Investigate before changing spend.`,
      },
    ];
  });
}
