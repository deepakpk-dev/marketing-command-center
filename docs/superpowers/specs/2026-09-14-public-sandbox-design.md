# Public evaluation sandbox

Approved in conversation: both public entry paths, contextual guidance, browser-local data and separate private access.

## Visitor experience

The root page offers Explore sample data and Upload my report with equal clarity. A quieter link opens the existing private workspace at /workspace. No public signup or shared password. Preserve Signal's existing light, warm-neutral, leaf-green product styling, system typography, keyboard focus and mobile responsiveness.

Sample entry opens populated Overview immediately. A dismissible evidence-review prompt guides the first action without a forced tour. Public navigation is Overview, Campaigns, Insights, Decisions and Data. Dataset labels always distinguish sample and uploaded data. Rule-based insights are not presented as live generative AI.

Upload progresses through Choose report, Check data and View insights. CSV parsing detects Google/Meta headers and supports explicit source/field selection when ambiguous. Validate each row before committing; preserve progress on errors, explain affected rows, and never silently drop or aggregate duplicate campaign/day facts. Preview source, campaigns, dates, currency and coverage. Accept one currency per report, never silently convert it. Missing conversions/revenue remain unavailable, not zero. Use daily report dates, rejecting multi-day Meta summary rows.

Short reports remain useful but comparisons and anomaly claims require complete adjacent daily windows. Provide exportable Google/Meta example CSVs and inline expandable export help. Show actionable warnings close to their context. Missing customer data cannot produce CAC; no synthetic GA4 is added to uploaded reports.

## Isolation and privacy

Public sample/imported data, analysis and decision history live in React memory only. Refresh clears the sandbox. No uploads, analytics payloads, AI calls or persistence containing report data. No public code imports server auth, repository or secrets. Selecting a new dataset replaces all old facts and decisions only after explicit confirmation where existing work would be lost. Clear my data returns to welcome and removes all React-held data. Decisions are simulations and never change advertising accounts. Private Supabase APIs retain existing authorization and origin protection.

## Implementation boundaries

Browser-safe CSV parsing and validation lives in src/lib/report-import.ts. Browser-safe measurement and rule-based recommendations live in src/lib/sandbox.ts, using existing period/threshold helpers where compatible. Separate components own welcome, import and sandbox workspace. Existing Dashboard remains the private UI at /workspace. Public entry does not call private APIs. Canonical redirect config includes /workspace as an account page.

## Acceptance

Unit tests cover quoted CSV, source/field inference, malformed rows, duplicate facts, currencies, missing metrics and complete-window measurement. Browser tests cover no-login sample journey, real uploaded journey, mapping, inline errors, replacement/clear isolation, simulated decision and CSV export, mobile/keyboard navigation and no private API requests. Existing private/auth tests continue to pass. Run lint, typecheck, full unit and browser suites and production build before release.
