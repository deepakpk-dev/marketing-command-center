# Connecting live sources

The MVP ships validated export adapters and authenticated route handlers. It does not hold Google/Meta OAuth tokens, poll accounts, or execute live advertising changes. The following contracts allow a later worker, script or n8n flow to connect real APIs without replacing the dashboard.

## Google Ads

Use [Google Ads reporting](https://developers.google.com/google-ads/api/docs/reporting/overview) to request campaign ID/name/status, `segments.date`, customer currency, cost micros, impressions, clicks, conversions and conversion value. Map the SDK/API response into `googleAds[]`. Convert IDs to strings, preserve cost micros for the normalizer, and align the configured conversion goal with the purchase definition used for Meta comparisons. Add OAuth refresh-token storage, developer token, customer account IDs and manager account context outside the UI. Paginate and use provider-supported retry/backoff. Do not assume every primary Google conversion is a purchase.

## Meta Ads

Use the [Ads Insights API](https://developers.facebook.com/docs/marketing-api/insights/) at campaign/day grain. Request campaign IDs/names, date, account currency, spend, consistent click/impression metrics, action counts and action values. Choose the account’s purchase event definition and map it to exactly one `action_type: "purchase"` count and one value. Do not sum `purchase`, `omni_purchase` and pixel-purchase aliases for the same outcome. Align click/view attribution windows and account timezone before comparing periods. Supply a stable campaign status mapping when extending the current export contract.

## GA4

Use the [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1) for daily campaign-associated sessions, ecommerce purchases and purchase revenue. The fixture is an adapter contract, not a literal `runReport` response. Convert GA4 dimension/metric arrays to the flat `dimensions`/`metrics` object. Map the Google Ads campaign dimension or Meta UTM campaign ID to `google:<externalId>` / `meta:<externalId>`. Missing IDs, `(not set)`, organic and direct traffic need a separate unattributed fact design; do not silently assign them to paid campaigns.

`firstTimePurchasers` must come from order/customer history and a defined acquisition attribution method. Export null if unavailable. Do not substitute GA4 `newUsers`. A live warehouse should deduplicate order IDs and assign each first-time customer once before computing marketing CAC.

## Delivery and operations

1. Normalize date buckets to UTC and enforce EUR or add a tested FX layer.
2. Collect complete campaign/day rows, including true zero days. Track source watermark and completeness, not just the latest row date.
3. Post batches under the row/byte caps to `/api/ingest` using the workflow credential. Campaign/date upserts allow replay.
4. Replay recent days to incorporate delayed conversions. Retry transient provider errors with exponential backoff and durable job IDs.
5. Call `/api/analyze` or `/api/workflows/run`, then send the reviewer to the approval queue.
6. Keep approved actions as manual handoff until an execution adapter has account scoping, budget limits, freshness checks, reconciliation and idempotency tests.

Before using real data, validate a small date range against each platform UI and order ledger. Account permissions, consent, API quotas, attribution configuration, currency, timezone, source freshness and customer attribution are account-specific and have not been verified by the sample test suite.
