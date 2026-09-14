# Workspace identity and durable storage

User approved linking the dedicated Supabase project, applying schema, and implementing individual sign-ins and permissions. Project: `btgavjndnsegdsaspsmx`, Frankfurt, separate from Jilebi.

## Architecture

Keep one Next.js app and route-handler backend. Use request-scoped Supabase SSR clients with publishable keys, HTTP-only cookies, server-confirmed identity (`getUser`), and refreshed cookies on success and error responses. No shared password or browser Supabase client. All reports use the user's JWT and database RLS. Service credentials are restricted to scoped workflow ingestion/analysis and authorized Auth administration.

Workspace membership is stored in Postgres, never editable user metadata. Roles: viewer reads/exports; analyst additionally ingests and saves analysis; approver additionally decides recommendations; admin has all capabilities and manages membership. Read access requires membership. No direct authenticated writes to reporting tables. Public RPC wrappers are security invoker; private implementations enforce identity, current membership, and permissions before privileged writes. Approval requires a current Auth session and records the database-derived user ID and email, not a client label. Membership updates lock the workspace and prevent removal/demotion of its final admin.

Invite-only access. Admin sends invitations or grants existing accounts membership. Default Supabase invitation verification redirects to `/auth/accept`; browser fragment tokens are immediately removed from the address bar and exchanged through a same-origin POST after server validation. The invitation page sets an individual password. Existing users sign in with email/password. Sign-out revokes the local session. A local bootstrap script invites the first administrator; it cannot elevate arbitrary users through public endpoints. Supabase SMTP restrictions are surfaced honestly.

## Verification

Test role permissions, untrusted reviewer rejection/identity derivation, stale approvals, RLS tenant isolation, workflow inability to approve, revoked sessions, role changes and final-admin preservation. Execute SQL in PGlite and hosted Supabase. Run lint/types/build plus browser demo regression and connected sign-in/permission flows using temporary, clearly labeled test users; remove test memberships and Auth users after verification. Do not delete unrelated project data. Persist environment values locally outside Git. Deployment/cloud SMTP/backup restoration are not part of this change.
