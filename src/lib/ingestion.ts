import { z } from "zod";
import type { NormalizedBatch, Campaign } from "./types";
const nonnegative = z.number().finite().nonnegative().max(1e12);
const integer = nonnegative.int();
const numericString = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .transform(Number)
  .pipe(nonnegative);
const id = z.string().trim().min(1).max(120);
const name = z.string().trim().min(1).max(200);
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");
const google = z.object({
  customer: z.object({ currencyCode: z.literal("EUR") }),
  campaign: z.object({ id, name, status: z.enum(["ENABLED", "PAUSED"]) }),
  segments: z.object({ date: calendarDate }),
  metrics: z.object({
    costMicros: integer,
    impressions: integer,
    clicks: integer,
    conversions: nonnegative,
    conversionsValue: nonnegative,
  }),
});
const action = z.object({ action_type: z.string(), value: numericString });
const meta = z.object({
  campaign_id: id,
  campaign_name: name,
  date_start: calendarDate,
  account_currency: z.literal("EUR"),
  spend: numericString,
  impressions: numericString.pipe(integer),
  clicks: numericString.pipe(integer),
  actions: z.array(action).max(100),
  action_values: z.array(action).max(100),
});
const ga = z.object({
  dimensions: z.object({ date: z.string().regex(/^\d{8}$/), campaignId: id }),
  metrics: z.object({
    sessions: integer,
    purchases: integer,
    purchaseRevenue: nonnegative,
    firstTimePurchasers: integer.nullable(),
  }),
});
const schema = z
  .object({
    googleAds: z.array(google).max(10000).default([]),
    metaAds: z.array(meta).max(10000).default([]),
    ga4: z.array(ga).max(10000).default([]),
  })
  .strict();
export function normalizeBatch(input: unknown): NormalizedBatch {
  const source = schema.parse(input),
    result: NormalizedBatch = { campaigns: [], ads: [], analytics: [] };
  const campaigns = new Map<string, Campaign>();
  const addCampaign = (campaign: Campaign) => {
    const existing = campaigns.get(campaign.id);
    if (
      existing &&
      (existing.name !== campaign.name || existing.status !== campaign.status)
    )
      throw new Error("Conflicting campaign dimensions in batch");
    campaigns.set(campaign.id, campaign);
  };
  for (const row of source.googleAds) {
    const campaignId = `google:${row.campaign.id}`;
    addCampaign({
      id: campaignId,
      externalId: row.campaign.id,
      name: row.campaign.name,
      channel: "google",
      status: row.campaign.status === "ENABLED" ? "active" : "paused",
    });
    result.ads.push({
      campaignId,
      date: row.segments.date,
      spend: row.metrics.costMicros / 1e6,
      impressions: row.metrics.impressions,
      clicks: row.metrics.clicks,
      conversions: row.metrics.conversions,
      revenue: row.metrics.conversionsValue,
    });
  }
  for (const row of source.metaAds) {
    const campaignId = `meta:${row.campaign_id}`;
    addCampaign({
      id: campaignId,
      externalId: row.campaign_id,
      name: row.campaign_name,
      channel: "meta",
      status: "active",
    });
    const purchase = (rows: { action_type: string; value: number }[]) => {
      const matches = rows.filter((a) => a.action_type === "purchase");
      if (matches.length > 1) throw new Error("Duplicate Meta purchase action");
      return matches[0]?.value ?? 0;
    };
    result.ads.push({
      campaignId,
      date: row.date_start,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: purchase(row.actions),
      revenue: purchase(row.action_values),
    });
  }
  for (const row of source.ga4) {
    const raw = row.dimensions.date,
      date = calendarDate.parse(
        `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`,
      );
    result.analytics.push({
      campaignId: row.dimensions.campaignId,
      date,
      sessions: row.metrics.sessions,
      purchases: row.metrics.purchases,
      revenue: row.metrics.purchaseRevenue,
      newCustomers: row.metrics.firstTimePurchasers,
    });
  }
  result.campaigns = [...campaigns.values()];
  if (!result.ads.length && !result.analytics.length)
    throw new Error("Batch must contain advertising or analytics rows");
  if (result.ads.length + result.analytics.length > 10000)
    throw new Error("Batch exceeds 10,000 fact rows");
  for (const facts of [result.ads, result.analytics]) {
    const seen = new Set<string>();
    for (const fact of facts) {
      const key = `${fact.campaignId}:${fact.date}`;
      if (seen.has(key)) throw new Error(`Duplicate fact ${key}`);
      seen.add(key);
    }
  }
  return result;
}
