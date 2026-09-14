# Public Sandbox Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. Execute inline, without delegated agents.

**Goal:** Let visitors test a complete marketing-review workflow with sample data or local CSV reports, without login or live connections.

**Architecture:** Root public entry and browser-memory sandbox are separate from /workspace and its authenticated APIs. Parsing, measurement and simulated decisions are browser-safe pure functions; UI never sends report contents to the server.

**Tech Stack:** Next.js 16.3.5, React 19.3, TypeScript, Vitest and Playwright. No new dependencies.

**Spec:** docs/superpowers/specs/2026-09-14-public-sandbox-design.md

## Global Constraints

- Browser-local data and memory-only lifetime; no external report transmission.
- Preserve private Supabase authorization and origin protection.
- One currency per report; no silent conversion or invented missing metrics.
- Public decisions are simulations; complete daily coverage required for anomaly comparisons.
- Existing light, warm-neutral, leaf-green styling; keyboard access and mobile responsiveness.

## Task 1: CSV import and report validation

Files: src/lib/report-import.ts; tests/report-import.test.ts.
Interfaces: readReport(text): ParsedReport; validateReport(parsed, mapping, source, currency): ImportResult. Public types include source, row fields, mapping, errors and metadata.

- [x] Write failing literal fixtures: quoted campaign names, USD spend header, missing revenue, duplicate daily facts, mixed currency and bad dates. Example assertion: `expect(result.dataset?.rows[0].spend).toBe(12.5)` for `Cost` input `12.50`.
- [x] Run `npm test -- tests/report-import.test.ts`; confirm missing import feature fails.
- [x] Implement bounded CSV state machine (BOM, quoted delimiters/newlines, CRLF and escaped quotes), header inference, actionable validation and source mapping. Preserve null optional metrics. Reject >2MB and >10000 rows, ambiguous dates, duplicate facts and multi-day summaries.
- [x] Run parser tests, adding literal boundary fixtures as each validation branch is introduced.

## Task 2: Browser-safe reporting and decisions

Files: src/lib/sandbox.ts; tests/sandbox.test.ts.
Interfaces: sampleDataset(): SandboxDataset; measureDataset(dataset, days, channel): SandboxReport. Report includes nullable totals, campaign rows, recommendations and coverage.

- [x] Write failing tests proving upload excludes sample facts, missing revenue gives null ROAS, incomplete windows cannot produce alerts, currency remains original and sample yields reviewable evidence.
- [x] Run `npm test -- tests/sandbox.test.ts` and confirm the missing behavior.
- [x] Use existing comparePeriods/detectAnomalies with null-aware wrappers and complete-window checks. Derive simple evidence-backed rule recommendations with stable filter-specific IDs; retain evidence snapshots for simulated decisions.
- [x] Run both new unit suites and existing measurement suites.

## Task 3: Public entry, importer and workspace

Files: src/components/public-sandbox.tsx, report-uploader.tsx, sandbox-workspace.tsx; src/app/page.tsx; src/app/workspace/page.tsx; src/app/sandbox.css; next.config.ts; public/example-google-ads.csv; public/example-meta-ads.csv; e2e/public-sandbox.spec.ts; existing e2e/dashboard.spec.ts.

- [x] Write browser tests: sample opens without auth; CSV upload preview then imported-only dashboard; invalid row blocks import with actionable error; decision includes a note; export download; clear returns welcome; private API calls remain absent. Example: `await page.getByRole('button', { name: 'Explore sample data', exact: true }).click()` then assert Overview heading and Sample data label.
- [x] Run focused browser suite to confirm welcome/import behavior is absent.
- [x] Build welcome and inline three-step importer. Use inferred mapping with correction fields only where needed, source/currency selectors and report preview. Never import until valid. Add small downloadable examples and expandable contextual help.
- [x] Build public workspace navigation, filters, nullable metric strip, searchable/sortable table, inline evidence, rule-based insights, simulated decisions and audit history, CSV export, replacement confirmation and clear controls. Use semantic elements and memory-only React state. Explain refresh lifetime visibly.
- [x] Move original Dashboard entry to /workspace; add canonical account redirect and adapt existing private browser tests to visit /workspace.
- [x] Run full browser tests, inspect desktop/mobile screenshots and correct overflow, focus, confusing labels or privacy violations.

## Task 4: Release verification

Files: README.md and docs/deployment.md; generated Next type file only restored if changed by tooling.

- [x] Document public/private paths, accepted CSV fields, limitations and browser-memory privacy without presenting manuals as required user onboarding.
- [x] Run `npm run check`, `npm run test:e2e`, `git diff --check`; inspect actual results. Final results: 72 unit/database tests, 14 browser tests, lint, typecheck and production build pass.
- [x] Review imports/network boundary: public modules cannot import node:crypto, Supabase or private repositories.
- [x] Commit and push verified changes; deploy to the existing Vercel project, verify public entry and private signed-out protection on production.

## Release evidence

Implementation commit: 8556e32, fast-forwarded and pushed to main. Production deployment: dpl_9FGk2tLq1JvKwnWBVLTepXZB6ZN6, READY. All seven public browser tests pass against https://signal-marketing-command-center.vercel.app, including local upload, mapping, evidence handoff, simulated decision, CSV export, tab isolation, clearing and mobile layout. Live probes confirm canonical redirects, downloadable example CSVs, healthy service, and 401 protection on private dashboard and ingestion. No account changes, real emails or live ad-platform connections were made during this release.
