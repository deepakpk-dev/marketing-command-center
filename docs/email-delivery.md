# Recovery and invitation delivery

The sign-in screen links to `/auth/recover`. The server validates input, enforces best-effort process rate limits, sends through Supabase Auth and returns a generic account-safe message. `/auth/reset` accepts the emailed link and updates the authenticated member's password through the existing session endpoint. It never sets a password on behalf of a user. SMTP failures return a retry message, not a false success.

Invitation and recovery templates put token hashes in URL fragments, which are removed before rendering. A person clicks **Continue to set password** to redeem the token. Ordinary email link prefetch does not consume it. Older Supabase access/refresh-token links remain supported. Expired links provide a recovery link. Re-inviting an unconfirmed user resends setup; a confirmed account retains its password. Membership and all permission checks remain enforced.

**Current hosted status:** these custom templates are supplied but inactive. Supabase rejected template customization on this free project using the default email provider. Configure custom SMTP before enabling them. The current hosted flow uses default Supabase email templates and supported access/refresh-token links. Templates alone do not establish deliverability.

## Resend free tier

Resend's free transactional plan currently allows 3,000 emails/month, capped at 100/day. Its `resend.dev` sender can send only to the Resend account email for testing. General invitations require a domain you own and verify. Vercel's provided `vercel.app` address is sufficient for web hosting, but cannot be verified as your email sender domain. A paid Resend subscription does not replace domain verification.

Once a domain is available, verify it in Resend, create a sending API key, then configure Supabase custom SMTP: host `smtp.resend.com`, port `465`, user `resend`, password the Resend API key, and a sender such as `Signal <access@your-verified-domain>`. Enter secrets directly in provider settings or through a protected local environment; never commit them. Disable click tracking for authentication emails. Check delivery/bounce records in Resend and test actual receipt before declaring production email ready.

Until that setup is complete, existing Supabase default mail continues to apply its testing restrictions. No Resend account, key, paid plan or domain has been provisioned by this change. Templates alone do not establish deliverability.

## Deployment

The deployed origin is `https://marketing-command-center-deepakprabhs-projects.vercel.app`. Production variables and hosted Auth redirects are configured for it. Live recovery-token exchange, password update and sign-in passed using a temporary account without sending mail. Actual inbox delivery remains unverified.

Deploy source with `.vercelignore` exclusions. Store only allowlisted runtime variables in the linked Vercel project's private production configuration. Set `APP_ORIGIN` to its verified production HTTPS address. In Supabase set `auth.site_url` and exact `additional_redirect_urls` for `/auth/accept` and `/auth/reset` on that domain; retain explicit localhost redirects for development. Review configuration changes before pushing templates. Test recovery, expired links, sign-in and permissions on the production origin.

Sources: [Resend pricing](https://resend.com/pricing), [test-domain limits](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
