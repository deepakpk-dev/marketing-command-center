# Verification record

## Public HTTPS and recovery release — 14 September 2026

- Vercel production deployment `dpl_9PJS2HUvcKTyd8WDmqieXpgAe2Hp` reached READY. Public address: `https://marketing-command-center-deepakprabhs-projects.vercel.app`.
- Fresh `npm run check`: lint, TypeScript, all 45 tests across 12 files and production build passed.
- Public HTTP checks: health and session returned 200, signed-out dashboard returned 401, recovery page returned 200. Browser navigation from sign-in to the recovery form passed without Vercel login.
- All 11 live production checks passed: health, denied anonymous reporting, sign-in, secure HTTP-only cookies, authenticated viewer reporting, denied viewer analysis, recovery token exchange, password update, sign-out, new-password sign-in and rejection of a reused recovery token.
- Verification created and removed one temporary account/membership. No email was sent and no marketing facts or approval history changed.
- Hosted Auth site URL and exact accept/reset redirects were applied. Custom email templates could not be applied with the free default provider; they remain inactive in source configuration. Resend/custom SMTP and real inbox delivery remain pending a verified sender domain.
- Live AI/ad-platform APIs, distributed rate limiting, enforced MFA, monitoring, backup restore drills and Docker runtime remain separate release work. Earlier sections below are historical baseline records, not current deployment status.

## Individual identity release — 13 September 2026

- Target-folder `npm run check`: lint, TypeScript, all 42 tests across 11 files, and standalone production build passed.
- Latest standalone demo browser regression: all 4 Chromium tests passed (14.2 seconds).
- Hosted Supabase verification: all 16 checks passed, including real browser sign-in, blocked public signup, HTTP-only cookies, invitation-style fragment exchange and token removal, individual password setup, reporting, denied viewer writes/member administration, immediate membership revocation and sign-out.
- Temporary verification accounts were removed; no marketing facts or approval history were changed.
- Both migrations are applied to dedicated project `btgavjndnsegdsaspsmx`; Jilebi was not changed. Public reporting tables have RLS and public write wrappers use security-invoker functions.
- First administrator membership verified for deepakp.tvla@gmail.com. Supabase accepted the invitation request; actual inbox delivery/password setup are the recipient's actions.
- Hosted security advisor: one warning remains, **leaked password protection disabled**. This is an Auth hardening requirement; no paid feature or plan change was enabled automatically. Review availability in your project's Auth password-security settings.
- Connected standalone preview runs at `http://127.0.0.1:3000`.

Embedded Postgres tests cover all four role capabilities, cross-workspace RLS, guarded write RPCs, active-session checks, immutable approvals and last-administrator protection. Hosted browser checks exercised viewer restrictions and onboarding, not every role-management interaction. Live OpenAI/ad-platform APIs, production SMTP, cloud deployment, Docker execution, enforced MFA, recovery UI and backup restore drills remain unverified/unimplemented release work as described in `auth.md`.

## Original demo MVP baseline

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
