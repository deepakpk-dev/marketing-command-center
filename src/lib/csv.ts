import type { CampaignPerformance } from "./types";
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportCsv(campaigns: CampaignPerformance[]): string {
  const header = [
    "Campaign",
    "Channel",
    "Period start (UTC)",
    "Period end (UTC)",
    "Spend (EUR)",
    "Platform revenue (EUR)",
    "Conversions",
    "ROAS",
    "CPA (EUR)",
    "CTR",
    "Ad CVR",
    "Modeled CAC (EUR)",
    "GA4 revenue (EUR)",
    "GA4 purchases",
    "GA4 site CVR",
  ];
  const rows = campaigns.map((c) => [
    c.name,
    c.channel,
    c.start,
    c.end,
    c.current.spend,
    c.current.revenue,
    c.current.conversions,
    c.current.roas,
    c.current.cpa,
    c.current.ctr,
    c.current.cvr,
    c.current.cac,
    c.current.siteRevenue,
    c.current.purchases,
    c.current.siteCvr,
  ]);
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
