# Performance Marketing Command Center design

## Accepted scope

One Next.js application with all backend entry points in App Router route handlers. Pure domain modules are called by handlers for testability. The requested project folder is the delivery location. No external accounts are changed during development.

## Architecture

`src/app/api` owns HTTP validation and authorization; `src/lib` owns normalization, metrics, anomaly rules, analysis, repository storage, and approval state transitions. `src/components` owns the interactive dashboard. Postgres migrations provide durable storage. Demo storage uses isolated browser-session memory with expiration and a bounded session count; durable deployment uses Supabase.

## Data model and measurement

Workspace, campaign dimensions, daily advertising facts, daily GA4 facts, ingestion runs, analysis runs, recommendations, and immutable approval events. Ads revenue is platform-attributed. GA4 revenue is shown separately and never added to platform revenue. CTR is clicks/impressions, ad CVR is conversions/clicks, site CVR is purchases/sessions, CPA is spend/ad conversions, ROAS is ad revenue/spend. CAC uses explicitly supplied first-time purchasers, not GA4 new users. Missing denominators return null. Ratios use sums, not means of daily ratios. EUR and UTC date buckets are enforced.

## Ingestion and analysis

Sample exports match normalized shapes derived from Google Ads cost micros, Meta Ads action arrays, and GA4 dimension/metric exports. Atomic upsert by campaign/date/source permits replay. Invalid or conflicting rows reject the whole batch. Compare equal adjacent periods of 7, 14, or 28 days. Detect significant CPA, ROAS, CTR and CVR deterioration with a relative threshold and minimum signal counts. Deterministic explanations serve the demo. An optional OpenAI Responses adapter accepts only aggregate evidence and validates structured output. Outputs describe hypotheses, never proven causes.

## Approval

Recommendations begin pending. Approve or reject requires a reviewer note, creates an immutable event, and can succeed only once. Concurrent requests use a database compare-and-set procedure. Approved changes are execution handoff records only. No live campaign execution adapter ships in the MVP.

## Product and operations

Overview, campaigns, analyst, approvals, and connections screens. Period and channel filters, search, campaign evidence drawer, CSV export, manual sample sync, sample JSON upload, analyst refresh, approval notes, audit history, loading and error states. Supabase mode requires a shared application password and signed sessions. Workflow bearer credentials can access ingestion and pipeline only. CI runs lint, type checks, unit/database tests, production build, and browser tests. Docker and Vercel configuration ship with setup and live-adapter documentation.

## Acceptance

The application runs with no secrets. Sample sync is repeatable. Metrics, zero values, coverage, anomaly thresholds, malformed ingestion, auth, approval conflicts, and migration procedures are tested. A browser can complete sync, analysis, filtering, review and CSV export. Connected services are optional and documented as unverified unless configured.
