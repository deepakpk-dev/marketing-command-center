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

Import this repository as a Next.js project, select Node 24, and use the included `vercel.json`. The lockfile defines exact installed versions. Build requires no database or API credentials. Add runtime environment variables through the deployment platform’s secret settings, then redeploy.

For a public sample portfolio, leave `DATA_MODE=demo` and `AI_PROVIDER=demo`. Session memory can reset or differ between serverless functions; use this as an exploratory presentation, not durable decision storage. For dependable state, apply the Supabase migration, set `DATA_MODE=supabase`, configure URL, server secret, workspace ID, shared password and session secret, and test login, sync, analysis and approvals on the deployed domain. Set AI provider and key only after storage and access are verified. The AI and pipeline handlers have a 60-second duration configuration.

When running behind a reverse proxy, set `APP_ORIGIN` to the public HTTPS origin, for example `https://signal.example.com`. Without an explicit origin, the app compares the incoming Host and forwarded protocol, which also supports local Next.js hostname normalization. Your proxy must preserve Host and supply its own trusted forwarded protocol.

## Docker

```powershell
docker build -t signal-command-center .
docker run --rm -p 3000:3000 --env-file .env.local signal-command-center
```

The standalone image runs as a non-root user and includes a liveness probe at `/api/health`. The image does not contain your env files. A persistent host still needs Supabase for data durability across container restarts. Docker configuration is provided; image execution requires Docker on the host and is separate from the verified Next.js production build.

## Release checks

CI verifies lint, types, domain behavior, the actual SQL migration via embedded Postgres, the production build and browser flows. On a configured deployment, additionally check Supabase access, real source metrics and the live AI response. Database migration and application version should be deployed together. Back up durable data before evolving schemas. The initial migration targets a new empty project namespace; it is not a repeatable script to apply over existing tables.

Use HTTPS, platform secret storage, rotated random secrets and a separate workflow token. Add platform-level request/body/rate limits for a public connected app. App limits are per-process and do not provide distributed quota enforcement. Health reports process liveness only, not Supabase or provider readiness. The shared-password access model is intended for one portfolio workspace; use individual identities and membership checks before a team/multi-tenant release.
