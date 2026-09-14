# Workspace Auth Implementation Plan

> **For agentic workers:** Use executing-plans for inline implementation. User explicitly approved this design and requested implementation.

**Goal:** Link the dedicated project, provide durable reporting and individual identities with database-enforced permissions.

**Architecture:** One Next.js app; request-scoped cookie clients for users, scoped service access for workflows, private guarded SQL write implementations.

**Tech Stack:** Next.js 16, Supabase JS 2.116.0, Supabase SSR 0.12.7, Postgres 17, Vitest/PGlite, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-workspace-auth-design.md`

## Global Constraints

No Jilebi changes. No public signup. Never authorize with user metadata or browser-supplied reviewer names. Reporting requests use user JWTs and RLS. No automated campaign execution. Keep credentials out of Git and chat.

### Task 1: Database permissions

Files: `supabase/migrations/*_workspace_identity.sql`, `tests/workspace-database.test.ts`, `src/lib/permissions.ts`, `tests/permissions.test.ts`.
Interfaces: `permissionsFor(role)` returns read/ingest/analyze/approve/manageMembers booleans. SQL `workspace_members`, `record_decision`, `set_member`, `list_members` enforce matching permissions.

- [x] Write role tests and isolated JWT/RLS tests.
- [x] Observe failures before permission implementation.
- [x] Implement indexed memberships, RLS, guarded RPCs, verified approvals and last-admin protection.
- [x] Apply and inspect migrations only on the dedicated project.

### Task 2: Request identity and membership

Files: `src/lib/{auth,http,repository,supabase-auth,permissions}.ts`, session and membership API routes, `tests/identity.test.ts`.
Interfaces: `authorizeConnected(request, permission)` returns a request-scoped client, verified Access identity and response finalizer. `getRepository(sessionId, client)` binds reads/writes to that client.

- [x] Test legacy-cookie rejection, workflow approval denial and database-derived reviewer identity.
- [x] Observe failures before implementation.
- [x] Add validated request-scoped identity, current membership and cookie finalization.
- [x] Add invitation/member APIs, onboarding and sign-out; verify hosted access.

### Task 3: UI and delivery

Files: `src/components/{dashboard,approvals,analyst,connections,workspace-access}.tsx`, `src/app/auth/accept/**`, `scripts/bootstrap-admin.ts`, README/auth/deployment docs and configuration.

- [x] Implement individual sign-in, onboarding and permission-aware UI.
- [x] Configure ignored environment and invite the requested administrator.
- [x] Pass 42 tests/build, 4 demo browser tests and 16 hosted checks; record the leaked-password advisor warning.
- [x] Document remaining release requirements and leave the connected production preview.
- [ ] Optional source-control commit after final review; secrets and CLI temporary metadata remain ignored.
