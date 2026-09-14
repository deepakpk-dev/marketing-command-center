# Deployment

## Local production preview

```powershell
npm ci
npm run check
npm run build
npm start
```

Production serves the same route-handler API as development. Development writes `.next-dev`; production writes `.next`. `npm start` loads the root environment, copies public/static assets into the standalone output, and launches its generated server. The public fixture is checked into the repository, so `npm run samples` is only needed when changing the fixture generator.

## Vercel

The connected application is live at [Marketing Command Center](https://marketing-command-center-deepakprabhs-projects.vercel.app), project `marketing-command-center` in `deepakprabhs-projects`. Node 24 and encrypted private production variables are configured. Vercel SSO deployment protection was disabled with owner approval; application authentication and database permissions remain enabled. The shorter `marketing-command-center.vercel.app` alias is unavailable and is not this application's address. This deployment uses `DATA_MODE=supabase`, `AI_PROVIDER=demo` and the public URL as `APP_ORIGIN`. Hosted Auth has exact `/auth/accept` and `/auth/reset` redirects for this origin.

Import this repository as a Next.js project, select Node 24, and use the included `vercel.json`. The lockfile defines exact installed versions. Build requires no database or API credentials. Add runtime environment variables through the deployment platform’s secret settings, then redeploy.

For a public sample portfolio, leave `DATA_MODE=demo` and `AI_PROVIDER=demo`; memory is not durable storage. For connected state, apply all migrations and configure URL, publishable key, server secret, workspace ID and workflow token. Configure hosted Auth site URL and exact `/auth/accept` redirects for the HTTPS domain. Review configuration differences before pushing and configure production SMTP. Test invitations, sign-in, roles and approvals on the deployed domain. Enable live AI only after access/storage verification. See [authentication](auth.md).

When running behind a reverse proxy, set `APP_ORIGIN` to the public HTTPS origin, for example `https://signal.example.com`. Without an explicit origin, the app compares the incoming Host and forwarded protocol, which also supports local Next.js hostname normalization. Your proxy must preserve Host and supply its own trusted forwarded protocol.

With `APP_ORIGIN` configured, visits to `/`, `/workspace` and `/auth/*` on alternate domains redirect temporarily to that canonical origin, preserving paths and query parameters. This includes `signal-marketing-command-center.vercel.app`, which is an alias of this project. Sign-in, invitations, recovery and browser sessions use the canonical domain together. API endpoints do not redirect; direct cross-origin API writes remain rejected. Redeploy after changing `APP_ORIGIN`, because Next.js builds the page redirect rules from this setting.

The root page is a public browser-local evaluation sandbox regardless of `DATA_MODE`. It never uses the private reporting/ingestion APIs, sends campaign files to the server, or saves visitor data. `/workspace` remains controlled by `DATA_MODE` and Supabase access; do not change production to demo mode to enable public evaluation. Public insights use local fixed rules, not the server AI provider. Serve the two example CSVs from `public/`. Public sandbox changes and uploaded data are temporary and reset on refresh.

## Docker

```powershell
docker build -t signal-command-center .
docker run --rm -p 3000:3000 --env-file .env.local signal-command-center
```

The standalone image runs as a non-root user and includes a liveness probe at `/api/health`. The image does not contain your env files. A persistent host still needs Supabase for data durability across container restarts. Docker configuration is provided; image execution requires Docker on the host and is separate from the verified Next.js production build.

## Release checks

CI verifies lint, types, domain behavior, the actual SQL migration via embedded Postgres, the production build and browser flows. On a configured deployment, additionally check Supabase access, real source metrics and the live AI response. Database migration and application version should be deployed together. Back up durable data before evolving schemas. The initial migration targets a new empty project namespace; it is not a repeatable script to apply over existing tables.

Use HTTPS, platform secret storage and a separate workflow token. Add distributed request/rate limits. Health reports liveness, not database/provider readiness. Individual identities, membership permissions, password recovery and the public HTTPS deployment are implemented and verified. Production SMTP with actual inbox-delivery tests, enforced MFA, monitoring and backup restore drills remain release requirements. See [verification](verification.md) and [email delivery](email-delivery.md).
