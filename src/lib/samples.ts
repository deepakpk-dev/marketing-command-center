import { shiftDate } from "./metrics";
export const SAMPLE_END = "2026-09-12";
export interface GoogleRow {
  customer: { currencyCode: "EUR" };
  campaign: { id: string; name: string; status: "ENABLED" | "PAUSED" };
  segments: { date: string };
  metrics: {
    costMicros: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionsValue: number;
  };
}
export interface MetaRow {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  account_currency: "EUR";
  spend: string;
  impressions: string;
  clicks: string;
  actions: { action_type: string; value: string }[];
  action_values: { action_type: string; value: string }[];
}
export interface GaRow {
  dimensions: { date: string; campaignId: string };
  metrics: {
    sessions: number;
    purchases: number;
    purchaseRevenue: number;
    firstTimePurchasers: number | null;
  };
}
export interface SourceExports {
  googleAds: GoogleRow[];
  metaAds: MetaRow[];
  ga4: GaRow[];
}
const campaigns = [
  {
    id: "g-brand",
    name: "Search | Brand",
    channel: "google",
    daily: 185,
    roas: 7.4,
    ctr: 0.064,
    cvr: 0.098,
  },
  {
    id: "g-nonbrand",
    name: "Search | Non-brand",
    channel: "google",
    daily: 420,
    roas: 3.9,
    ctr: 0.032,
    cvr: 0.056,
  },
  {
    id: "g-shopping",
    name: "Shopping | Best sellers",
    channel: "google",
    daily: 315,
    roas: 5.1,
    ctr: 0.023,
    cvr: 0.071,
  },
  {
    id: "m-prospect",
    name: "Prospecting | Broad",
    channel: "meta",
    daily: 490,
    roas: 3.4,
    ctr: 0.014,
    cvr: 0.028,
  },
  {
    id: "m-retarget",
    name: "Retargeting | 30 days",
    channel: "meta",
    daily: 220,
    roas: 6.2,
    ctr: 0.022,
    cvr: 0.052,
  },
  {
    id: "m-creative",
    name: "Acquisition | Creator UGC",
    channel: "meta",
    daily: 290,
    roas: 4.7,
    ctr: 0.018,
    cvr: 0.039,
  },
];
export function buildSampleExports(): SourceExports {
  const result: SourceExports = { googleAds: [], metaAds: [], ga4: [] };
  for (let day = 0; day < 56; day++) {
    const date = shiftDate(SAMPLE_END, day - 55);
    campaigns.forEach((campaign, index) => {
      const wave =
        1 +
        Math.sin((day + index * 2) * 0.7) * 0.055 +
        (day % 7 === 5 ? 0.08 : 0);
      const lastWeek = day >= 49;
      const spend =
        Math.round(
          campaign.daily *
            wave *
            (campaign.id === "m-prospect" && lastWeek ? 1.16 : 1) *
            100,
        ) / 100;
      const fatigue = campaign.id === "m-prospect" && lastWeek;
      const landing = campaign.id === "g-nonbrand" && lastWeek;
      const roas =
        campaign.roas *
        (fatigue
          ? 0.62
          : landing
            ? 0.68
            : campaign.id === "g-brand" && lastWeek
              ? 1.12
              : 1) *
        (1 + Math.cos(day * 0.4 + index) * 0.04);
      const revenue = Math.round(spend * roas * 100) / 100;
      const conversions = Math.max(
        1,
        Math.round(revenue / (index < 3 ? 94 : 86)),
      );
      const cvr = campaign.cvr * (fatigue ? 0.85 : landing ? 0.64 : 1);
      const clicks = Math.round(conversions / cvr),
        impressions = Math.round(
          clicks / (campaign.ctr * (fatigue ? 0.69 : 1)),
        );
      if (campaign.channel === "google")
        result.googleAds.push({
          customer: { currencyCode: "EUR" },
          campaign: { id: campaign.id, name: campaign.name, status: "ENABLED" },
          segments: { date },
          metrics: {
            costMicros: Math.round(spend * 1e6),
            impressions,
            clicks,
            conversions,
            conversionsValue: revenue,
          },
        });
      else
        result.metaAds.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          date_start: date,
          account_currency: "EUR",
          spend: spend.toFixed(2),
          impressions: String(impressions),
          clicks: String(clicks),
          actions: [{ action_type: "purchase", value: String(conversions) }],
          action_values: [
            { action_type: "purchase", value: revenue.toFixed(2) },
          ],
        });
      const purchases = Math.round(
        conversions * (campaign.channel === "meta" ? 0.78 : 0.91),
      );
      result.ga4.push({
        dimensions: {
          date: date.replaceAll("-", ""),
          campaignId: `${campaign.channel}:${campaign.id}`,
        },
        metrics: {
          sessions: Math.round(clicks * 0.89),
          purchases,
          purchaseRevenue:
            Math.round(
              revenue * (campaign.channel === "meta" ? 0.79 : 0.92) * 100,
            ) / 100,
          firstTimePurchasers: Math.round(
            purchases * (campaign.id === "m-retarget" ? 0.22 : 0.71),
          ),
        },
      });
    });
  }
  return result;
}
