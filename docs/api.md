# API contract

Route handlers use JSON and no-store responses. Supabase mode requires a signed `signal_auth` cookie. Demo mode issues `signal_demo` and isolates that session’s state. Supply the same cookie across requests to retain sample decisions. Cookies are HTTP-only, SameSite Lax, and Secure on HTTPS.

| Method and path                             | Purpose                                                                                                      | Access                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| GET `/api/dashboard?days=7&channel=all`     | Snapshot, KPI comparisons, campaigns, anomalies, chart, matching analysis, recommendations and recent events | Workspace session                                 |
| POST `/api/ingest`                          | Validate and atomically upsert a source JSON batch                                                           | Session or workflow bearer                        |
| PUT `/api/ingest`                           | Explicitly load the modeled fixture, body `{"source":"sample"}`                                              | Session or workflow bearer                        |
| POST `/api/analyze`                         | Analyze current selection, body `{"days":7,"channel":"all"}`                                                 | Session or workflow bearer                        |
| POST `/api/workflows/run`                   | Optional ingestion followed by analysis                                                                      | Session or workflow bearer                        |
| POST `/api/recommendations/{uuid}/decision` | Atomic approval/rejection with note                                                                          | Workspace session only                            |
| GET `/api/export?days=7&channel=all`        | CSV report for selected campaigns                                                                            | Workspace session only                            |
| GET/POST/DELETE `/api/session`              | Access status, password sign-in, sign-out                                                                    | Public entry point; origin checks and login limit |
| GET `/api/health`                           | Process liveness                                                                                             | Public; no secrets or business data               |

`days` accepts 7, 14 or 28; `channel` accepts `all`, `google` or `meta`. Invalid or unexpected query/body fields reject the request. Unknown campaigns in a facts-only batch must be ingested as dimensions first.

## Source batch

```json
{
  "googleAds": [
    {
      "customer": { "currencyCode": "EUR" },
      "campaign": {
        "id": "123",
        "name": "Search | Brand",
        "status": "ENABLED"
      },
      "segments": { "date": "2026-09-12" },
      "metrics": {
        "costMicros": 100000000,
        "impressions": 10000,
        "clicks": 100,
        "conversions": 10,
        "conversionsValue": 400
      }
    }
  ],
  "metaAds": [],
  "ga4": [
    {
      "dimensions": { "date": "20260912", "campaignId": "google:123" },
      "metrics": {
        "sessions": 80,
        "purchases": 8,
        "purchaseRevenue": 320,
        "firstTimePurchasers": 5
      }
    }
  ]
}
```

Meta rows use `campaign_id`, `campaign_name`, `date_start`, `account_currency: "EUR"`, numeric strings for `spend`, `impressions` and `clicks`, plus `actions` and `action_values` arrays of `{ "action_type": "purchase", "value": "10" }`. Only the explicit purchase action is counted. Other Meta purchase aliases must be mapped by the source adapter, never added together.

Dates must be real calendar dates, metrics finite and nonnegative, identifiers nonempty, and daily facts unique inside a batch. Duplicate rows reject the batch, including identical duplicates. Replaying an already committed batch in a new request updates existing facts without adding duplicates. Each successful request records a new ingestion event; replay is not event deduplication. Batch limits: 2 MB and 10,000 total facts. An invalid row prevents the whole transaction from committing.

The complete fixture is `public/sample-data.json`; regenerate it with `npm run samples`.

## Workflow request

Configure a separate server `WORKFLOW_TOKEN` with at least 32 random characters. Use an n8n HTTP Header Auth credential named Authorization with value `Bearer <token>`.

```http
POST /api/workflows/run
Authorization: Bearer <workflow-token>
Content-Type: application/json
```

```json
{
  "days": 7,
  "channel": "all",
  "batch": { "googleAds": [], "metaAds": [], "ga4": [] }
}
```

Omit `batch` to analyze existing data; an explicitly empty batch rejects ingestion. The response reports ingestion and analysis IDs, provider, proposed recommendation count, and `execution: "human_approval_required"`. Ingestion and analysis are separate commits: if ingestion succeeds but the AI provider fails, new facts stay committed and the request returns an error. Replaying the batch and reanalyzing safely recovers; no live ad changes occur.

## Decision request

```json
{
  "decision": "approved",
  "note": "Checked margins, attribution and budget cap.",
  "reviewer": "Workspace reviewer"
}
```

The display label is not an independently verified user identity in this shared-password MVP. Notes require 3 to 1,000 trimmed characters. A decision can happen once. Changed source data blocks approval of an old recommendation with 409; rejection can close an outdated action. Events preserve the note and time and cannot be edited in Postgres. Approval is an execution handoff, not permission for an autonomous system to change campaigns.
