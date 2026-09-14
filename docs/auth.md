# Individual sign-ins and permissions

This installation is linked to Supabase project `btgavjndnsegdsaspsmx` in Frankfurt. Both migrations are applied. Public signup is disabled. The first administrator invitation was accepted by Supabase for deepakp.tvla@gmail.com; inbox delivery and password setup remain the recipient's actions.

| Role | Read/export | Ingest/analyze | Approve/reject | Manage members |
| --- | --- | --- | --- | --- |
| Viewer | Yes | No | No | No |
| Analyst | Yes | Yes | No | No |
| Approver | Yes | No | Yes | No |
| Administrator | Yes | Yes | Yes | Yes |

Invitations return to `/auth/accept`. The browser removes URL-fragment tokens immediately, exchanges them through a route handler and lets the user set an individual password (12+ characters). Session cookies are HTTP-only, SameSite Lax and Secure over HTTPS. Every connected request validates the user with Supabase Auth and checks current workspace membership. Legacy shared-password cookies never grant access.

Reporting uses the user's JWT and workspace-scoped RLS. Active Auth sessions and current membership are required. Direct table writes are denied. Public write functions are security-invoker wrappers over guarded private functions. Approval identities come from the authenticated account ID and verified email, never a submitted reviewer label. Audit events are immutable. Membership removal takes effect on the next request. The last administrator cannot be removed or demoted.

Administrators manage invitations and roles in **Workspace access**. Confirmed existing accounts receive membership without changing their password or sending a new email; unconfirmed accounts receive another invitation request. Server secret credentials are limited to authorized invitation administration and ingestion/analysis workflows; workflow tokens cannot approve, manage members or export reports. The app selects one configured workspace; database policies isolate memberships across workspaces.

## Operator setup for another installation

Authenticate the Supabase CLI, initialize/link the intended project, and apply **all** migrations using `supabase db push`. Do not rerun the initial SQL over existing tables. Run `npm run supabase:configure` to retrieve keys with the authenticated project-local CLI and write ignored `.env.local`. It refuses accidental overwrites; `-- --refresh-keys` refreshes only keys for the already-linked project. Run `npm run admin:bootstrap -- your@email.com` to invite the first administrator. This operator-only command checks the linked project and refuses a second bootstrap administrator.

Required connected environment: `DATA_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `WORKSPACE_ID`, `WORKFLOW_TOKEN` and `APP_ORIGIN`. No shared app password or session-signing secret is used. Sync sample data or import a batch explicitly after sign-in; the connected workspace starts empty.

## API additions

- POST `/api/session`: `{email,password}`; GET status; DELETE sign-out.
- PUT `/api/session`: `{password}`, authenticated individual password update.
- POST `/api/session/exchange`: `{access_token,refresh_token}`, validated invitation session exchange.
- POST `/api/session/exchange`: also accepts `{token_hash,type}` where type is `invite` or `recovery`.
- POST `/api/session/recovery`: `{email}`, account-safe password recovery request. Sign-in links to `/auth/recover`; recovery emails return to `/auth/reset`.
- GET `/api/members`: administrator-only member listing.
- POST `/api/members`: administrator-only `{email,role}` invitation.
- PATCH `/api/members`: administrator-only `{userId,role}` change; `null` removes membership.

Connected approval bodies need only `{decision,note}`. An optional legacy reviewer field is ignored; the database records the real actor. Ingestion/analysis require analyst or administrator; decisions require approver or administrator.

## Verification and remaining release requirements

`npm run check` includes both SQL migrations, role isolation, revoked sessions, protected administrator membership and verified decision identities. Demo browser tests require a demo server. Optional hosted verification: `npx tsx scripts/verify-connected.ts --allow-hosted-writes`. This uses the production build on port 4000, creates a temporary confirmed viewer without sending mail, checks real sign-in/reporting/denied writes/revocation, then removes the account. Marketing facts and approval history are unchanged.

The public HTTPS origin, hosted Auth redirects and password recovery are configured and production-tested. Before general team use, configure production SMTP and verify actual inbox receipt. Supabase's default mail service has recipient/rate restrictions; invitation acceptance is not an inbox-delivery guarantee. MFA challenge/enrollment screens are not implemented. Hosted TOTP capability remains enabled, but enforced MFA is a separate task. Add distributed rate limits, monitoring and backup/restore testing. No live advertising API execution is claimed. See [email delivery](email-delivery.md).

Use hosting-platform secret storage. `.env.local` is Git-ignored, but this folder is inside OneDrive: ignore does not prevent folder synchronization. Do not distribute it with credentials; rotate exposed keys.

The final hosted security advisor reports leaked-password protection disabled. Enable it where available before public team use; no paid plan or feature was enabled automatically. See `verification.md` for the 16 passing hosted checks and remaining release boundaries.
