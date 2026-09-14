# Architecture

```mermaid
flowchart LR
  Sources[Google Ads / Meta Ads / GA4 exports] --> Ingest[Route handler: validate and normalize]
  Ingest --> Store[Session repository or Supabase / Postgres]
  Store --> Metrics[Weighted KPIs and period comparisons]
  Metrics --> Rules[Volume-aware anomaly rules]
  Rules --> Analyst[Deterministic or OpenAI analyst]
  Analyst --> Queue[Pending recommendations]
  Queue --> Human[Reviewer note and decision]
  Human --> Audit[Immutable approval event]
  Audit --> Handoff[Manual execution handoff]
```

## One app, clear boundaries

`src/app/api/**/route.ts` provides every backend entry point. Route handlers validate input, authorize access, call the domain modules and return typed JSON. Pure calculation modules keep the financial definitions testable without a web server. Next.js supports this backend-for-frontend structure in [route handlers](https://nextjs.org/docs/app/getting-started/route-handlers).

`src/lib/ingestion.ts` validates source-specific exports and normalizes source IDs, units, currency and dates. `metrics.ts` sums facts and divides totals. `anomalies.ts` applies conservative, transparent rules. `analyst.ts` builds aggregate evidence, prepares explanations, validates structured provider output and creates action fingerprints. `repository.ts` supplies the same read/ingest/analyze/decide interface in both storage modes. The dashboard is a client boundary calling these route handlers; credentials never enter the client component tree.

## Storage relationships

Each campaign and fact belongs to a workspace. Ad and GA4 facts have composite workspace/campaign/date primary keys. Source namespaced IDs prevent Google and Meta collisions. Ingestion events record checksums and counts. Analysis runs preserve period inputs and the full validated output. Recommendations preserve period and evidence snapshots. Approval events record the decision, note, reviewer display label and time.

Transactions lock the workspace while ingesting, saving analysis or recording decisions. Source facts update only when values change. The workspace data version increments for changed data, not identical replay. Analysis saves reject an outdated data version. Approval updates require `status = pending` and matching source version; rejection remains possible for an outdated action. Concurrent decisions cannot both succeed. Action fingerprints include evidence and source version so unchanged analysis does not create another pending copy or undo decisions.

## Access and errors

Connected reporting/actions use validated Supabase Auth sessions, current membership and workspace-scoped RLS. Guarded private write functions enforce permissions behind public security-invoker wrappers. Approval events record the verified actor ID/email, not a submitted display label. Server secret access is restricted to authorized invitations and ingestion/analysis workflows. See [authentication](auth.md).

Workflow bearer credentials cover source ingestion and analysis. They cannot approve actions or read campaign exports. Cookie writes reject cross-origin browser requests. Uploads are streamed with a 2 MB cap. Routes return 400 for invalid data, 401 for missing sessions, 403 for unsafe origins, 409 for conflicts/stale data, 413 for oversized payloads, 429 for rate limits and sanitized server errors for provider/database failures. Database and AI errors never echo keys or raw provider responses.

## Scale and next extensions

The MVP computes the latest 56-day window in-process. For large accounts, add SQL reporting aggregates, durable queues and distributed rate limits. Workspace selection and onboarding remain SaaS extensions. Live execution must separately revalidate approval, evidence version, account identity, budget limits and idempotency.
