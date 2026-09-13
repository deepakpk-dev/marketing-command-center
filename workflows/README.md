# n8n integration

Import either JSON definition into n8n. Both start inactive and contain no credentials. These are integration templates with the correct application request contracts; execution inside n8n has not been tested in this environment.

`daily-sample-review.json` runs a weekday sample sync followed by analysis. Use it only with an isolated sample/portfolio workspace. It intentionally writes modeled data. `source-batch-review.json` receives a validated export-shaped JSON body through a webhook, then ingests and analyzes it. Add your Google/Meta/GA4 collector nodes before delivery as needed.

For each HTTP Request node, set the application URL and select an **HTTP Header Auth** credential with header name `Authorization` and value `Bearer <WORKFLOW_TOKEN>`. The server token must contain at least 32 characters. The default host URL supports n8n running in Docker on Windows against the local app. Use `http://localhost:3000` when n8n runs directly on the same host, or the deployed HTTPS domain for a hosted app. Configure a separate Header Auth credential on the source webhook; inbound collection and outbound app access should use different secrets.

Run the pipeline manually first. Check ingestion and analysis IDs, then open Signal’s approval queue. A bearer workflow cannot submit approval decisions or export campaign reports. Do not add an ad-execution node to these templates. For a production collector, add durable retries, provider pagination, date-completeness checks and failure handling; never retry a live campaign change without an idempotency design.

In demo mode, bearer requests use a separate workflow sample session, so the browser’s isolated demo will not share those mutations. Use Supabase mode to demonstrate n8n-to-browser durable handoff in one configured workspace. Identical batch replay records another ingestion event but keeps daily facts and their source version unchanged. Reanalysis of unchanged evidence does not reset prior review decisions.
