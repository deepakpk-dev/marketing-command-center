# Verification record

Verified on 13 September 2026 in the requested Windows project folder using Node.js 24.14.1.

- ESLint: passed.
- TypeScript: passed.
- Vitest: 31 tests across 8 files passed, including the actual SQL migration executed in embedded Postgres (PGlite).
- Production build: passed.
- Standalone production startup (`npm start`): passed; static assets served correctly.
- Playwright against the standalone production server: all 4 Chromium tests passed in 9.1 seconds. Coverage includes review decisions and persistence, replayed ingestion, CSV download, malformed requests, cross-origin rejection, mobile layout, chart filters, and changed-data approval safeguards.
- Dashboard, analyst, approval, and mobile screenshots captured from the production application.
- Dependency audit: no reported vulnerabilities at installation.

The test suite uses modeled data and mocked provider responses. A hosted Supabase project, real OpenAI requests, live Google Ads/Meta/GA4 accounts, n8n execution, Docker runtime, and cloud deployment were **not** exercised. Configuration and integration contracts are supplied; no campaign changes are executed by this MVP. Embedded Postgres tests verify SQL behavior, not the complete hosted Supabase service.

Rerun `npm run check` and `npm run test:e2e` after changes. Browser tests reuse an existing local server outside CI; start the production server first to check the packaged application rather than development mode.
