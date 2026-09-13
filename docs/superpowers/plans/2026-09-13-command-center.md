# Command Center Implementation Plan

> **For agentic workers:** Use inline execution with review checkpoints. User authorized sensible defaults and implementation without further design questions.

**Goal:** Deliver a runnable performance-marketing application with validated data, evidence-based analysis, and recorded human decisions.

**Architecture:** One Next.js app. Route handlers call pure domain logic and either session-isolated sample storage or a server-only Supabase repository.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-command-center-design.md`

## Global Constraints

One Next.js application with all backend entry points in App Router route handlers.
EUR and UTC date buckets are enforced.
No live campaign execution adapter ships in the MVP.
Ratios use sums, not means of daily ratios.

### Task 1: Analytics and ingestion

Files: `src/lib/{types,metrics,samples,ingestion,anomalies}.ts`, `tests/analytics.test.ts`, `tests/ingestion.test.ts`.
Interfaces: normalized Campaign, AdFact, AnalyticsFact; `calculateKpis`, `comparePeriods`, `normalizeBatch`, `detectAnomalies`.

- [x] Write independent metric expectations: spend 100, revenue 400, conversions 10, clicks 100, impressions 10000 must yield ROAS 4, CPA 10, CTR .01, CVR .1.
- [x] Run `npm test` and observe missing behavior.
- [x] Implement sum-based nullable ratios, strict source parsing, campaign/date keys, and minimum-volume anomaly checks.
- [x] Run `npm test` and verify edge cases including incomplete CAC coverage and duplicate rows.

### Task 2: Persistence, analyst, approval and API

Files: `supabase/migrations/*.sql`, `src/lib/{repository,analyst,auth,http}.ts`, `src/app/api/**/route.ts`, `tests/{approval,auth,database,analyst}.test.ts`.
Interfaces: repository snapshot, ingest, save analysis, atomic decide; aggregate-only analyst; session and workflow access.

- [x] Write a pending recommendation test which approves once then rejects a second decision with a conflict.
- [x] Write an auth test rejecting expired/tampered sessions and a database test replaying identical facts without extra rows.
- [x] Run failing tests before implementation.
- [x] Implement transaction-backed ingest and approval procedures, sample repository, bounded validated analyst output, route validation, origin checks and secure sessions.
- [x] Run `npm test`, checking the real migration in embedded Postgres.

### Task 3: Dashboard and delivery

Files: `src/components/*.tsx`, `src/app/{page,layout,globals.css}`, `e2e/dashboard.spec.ts`, `README.md`, `docs/*.md`, `workflows/*.json`, `Dockerfile`, `.github/workflows/ci.yml`.
Interfaces: REST endpoints return typed dashboard snapshots; UI submits sync, analysis, approval and export requests.

- [x] Write browser tests for filters, campaign details, approval persistence, sample sync replay, malformed uploads, CSV downloads and mobile navigation.
- [x] Implement responsive visual system, dashboard sections, busy/error states and connection contracts.
- [x] Run `npm run check` and `npm run test:e2e`.
- [x] Review measurement caveats, sample-mode labeling, secrets handling, live integration limits, and deployment instructions.
- [x] Initialize requested repository, commit source, and start a local preview.
