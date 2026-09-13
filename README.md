# AI Performance Marketing Command Center

**Signal** is a working portfolio application that turns advertising and analytics data into evidence, recommendations, and human decisions. One Next.js application runs the dashboard and all backend route handlers.

![Signal performance overview](docs/screenshots/overview.png)

## Run locally

Requires Node.js 22.13+ (Node 24 recommended).

```powershell
cd "C:\Users\revat\OneDrive\Desktop\Agentic engineering\AI Performance Marketing Command Center"
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No secrets or external accounts are required. Demo mode seeds 56 days of modeled data for six campaigns, with 336 advertising facts and 336 GA4 facts. The latest sample date is **12 September 2026**. The demo includes a Meta efficiency decline, a non-brand search conversion issue, and a controlled growth opportunity.

## What works

- Validated Google Ads, Meta Ads and GA4 export ingestion, JSON imports, and atomic campaign/date upserts.
- Weighted ROAS, CPA, CTR, ad CVR, GA4 site CVR, and CAC when first-time purchaser coverage is complete.
- Equal adjacent 7/14/28-day comparisons, channel filters, campaign search, sortable tables, interactive chart and campaign deep dives.
- Minimum-volume anomaly rules with explicit thresholds and measurement caveats.
- Deterministic sample analyst plus a server-only OpenAI Responses adapter with schema, campaign, budget and evidence validation.
- Pending → approved/rejected workflow with required notes, conflict protection, source-version checks, and immutable database audit events.
- Durable Supabase mode, signed password sessions, scoped workflow access, n8n definitions, CSV exports and sync history.
- Database migration tests, unit tests, browser tests, CI, standalone production build, Docker and Vercel configuration.

## Try the portfolio story

1. Review the seven-day overview and open **Prospecting | Broad**. Inspect CPA, ROAS and CTR changes.
2. Open **AI analyst** and expand the metric evidence. Explanations are hypotheses; the observed numbers are quoted from the data.
3. Open **Approvals**, review an action, add a note and approve or reject. Reload to see the session’s recorded decision.
4. Sync sample data twice. The fact count remains 672. Reanalysis of unchanged evidence preserves prior decisions.
5. Open **Connections**, download the example JSON, change a metric, and import it. Older pending actions become stale until fresh analysis.
6. Filter by channel or period and export the selected campaign report.

## Connected Supabase mode

Create a Supabase project, then execute `supabase/migrations/202609130001_initial.sql` through the SQL editor or your normal migration runner. The migration creates the default workspace, all tables, RLS, and transactional functions. It supports Supabase’s existing `anon`, `authenticated` and `service_role` roles; tests execute it against embedded Postgres.

Copy `.env.example` to `.env.local` and set:

```dotenv
DATA_MODE=supabase
AI_PROVIDER=demo
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=<server-side secret key>
WORKSPACE_ID=11111111-1111-4111-8111-111111111111
APP_PASSWORD=<unique password of at least 12 characters>
SESSION_SECRET=<random secret of at least 32 characters>
WORKFLOW_TOKEN=<separate random token of at least 32 characters>
```

Restart the app, sign in, and explicitly load sample data or import a source batch. `SUPABASE_SERVICE_ROLE_KEY` is supported as a legacy alternative to `SUPABASE_SECRET_KEY`. Keys stay on the server. Browser roles receive no table or RPC access. The MVP uses one configured workspace and a shared reviewer password; multi-user identity and tenant membership are future extensions.

## Optional live AI

In authenticated Supabase mode, set `AI_PROVIDER=openai`, provide `OPENAI_API_KEY` through server environment configuration, and optionally set `OPENAI_MODEL` (default `gpt-5-mini`). Click **Run analysis**. Only aggregate campaign metrics and evidence are sent; raw source exports and customer records are not sent. Provider failures, incomplete output, unknown campaigns, unsupported evidence and out-of-bounds budgets reject the analysis without saving recommendations. Live OpenAI requests require your own configured account and were not made during MVP verification.

## Tests and production

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

`check` runs lint, type checking, unit/database tests and a production build. PGlite executes the actual Postgres migration, including upsert replay, rollback, approval conflict and immutability tests. Browser tests exercise the marketer flow and mobile navigation. Development and production builds use separate output folders to avoid concurrent-build conflicts.

Deployment details: [deployment](docs/deployment.md). Data definitions: [measurement](docs/measurement.md). Integration contracts: [API](docs/api.md), [live adapters](docs/live-integrations.md), [workflows](workflows/README.md). Design and system boundaries: [architecture](docs/architecture.md).

## Practical limits

Demo state is isolated by an HTTP-only browser cookie but stored in server memory. It expires after 24 hours, is evicted beyond 100 sessions, resets on restart, and does not guarantee persistence across serverless instances. Use Supabase for durable approvals or real marketing data. Hosting-level rate limiting is recommended before exposing live AI; the app’s rate limits are best-effort per process. Reporting reads the latest 56-day fact window, paginates Supabase queries, and caps reads at 20,000 facts per table. There is no execution adapter for live ad changes: approval creates an execution handoff record for a human.

The source adapters ingest realistic **export contracts**, not live API calls. Ad-platform returns can include overlapping attribution and are not incremental profit. First-time purchaser counts in the fixture are modeled, and must come from customer/order data in a live integration. The app accepts EUR and UTC date buckets only. Credentials, OAuth consent, API permissions, attribution configuration and real account tests are the next integration work.
