# Deploying Elev8ai to production

This is the runbook for taking Elev8ai live on Vercel with a dedicated
production Supabase project. Do it once; keep this file updated as things change.

## 1. Create a separate production Supabase project

Never share the dev project with production.

1. Create a new Supabase project (Pro plan so daily backups are on).
2. Turn on **daily backups** (Database → Backups).
3. Link the CLI to it and push all migrations:
   ```bash
   npx supabase link --project-ref <prod-ref>
   npx supabase db push
   ```
4. In **Authentication → URL Configuration** set the Site URL to your real
   domain (e.g. `https://elev8ai.com`) and add `https://elev8ai.com/**` to the
   redirect URLs.
5. In **Authentication → Providers** enable Google and paste the OAuth client id
   and secret; add `https://<prod-ref>.supabase.co/auth/v1/callback` to the
   Google client's authorized redirect URIs.
6. In **Authentication → Emails → SMTP** set custom SMTP to Resend
   (host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API
   key) so login emails send from your domain and aren't rate-limited.
7. Change the **Confirm signup** and **Magic Link** email templates to link to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`.
8. After your first admin signs up, set their role:
   ```sql
   update public.profiles set role = 'admin'
   where user_id = (select id from auth.users where email = 'you@elev8ai.com');
   ```

## 2. Environment variables (set in Vercel → Settings → Environment Variables)

`NEXT_PUBLIC_*` are exposed to the browser; the rest are server-only. Never set
`SUPABASE_ACCESS_TOKEN` in Vercel (it's for the local CLI only).

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://elev8ai.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Production project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role key (server only) |
| `RESEND_API_KEY` | Send-only key on the verified domain |
| `EMAIL_FROM` | e.g. `Elev8ai <notifications@elev8ai.com>` |
| `LEMONSQUEEZY_API_KEY` | **Live** API key |
| `LEMONSQUEEZY_STORE_ID` | Store id |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | **Live** webhook signing secret (same value set in Lemon Squeezy) |
| `BUNNY_STREAM_LIBRARY_ID` | Video library id |
| `BUNNY_STREAM_API_KEY` | Library API key |
| `BUNNY_STREAM_TOKEN_KEY` | Token authentication key (for signed embeds) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project key (optional) |
| `NEXT_PUBLIC_POSTHOG_HOST` | e.g. `https://eu.i.posthog.com` (optional) |

## 3. Vercel

1. Import the GitHub repo into Vercel.
2. Add all the variables above (Production scope).
3. Connect the custom domain and confirm HTTPS.
4. Deploy from `main`.

## 4. Resend

1. Add and verify your domain (SPF + DKIM DNS records) so email doesn't land in
   spam.
2. Create a send-only API key and set `RESEND_API_KEY` / `EMAIL_FROM`.

## 5. Lemon Squeezy (live mode)

1. Switch the store to live mode.
2. Create the production product variants and put each variant id on the matching
   course in `/admin/courses`.
3. Add a webhook pointing to `https://elev8ai.com/api/webhooks/lemonsqueezy`,
   subscribed to `order_created` and `order_refunded`, using the same signing
   secret as `LEMONSQUEEZY_WEBHOOK_SECRET`.
4. Make one real ~$1 purchase, confirm access is granted, then refund it and
   confirm access is removed.

## 6. Bunny Stream

1. Create the production video library and upload the course videos.
2. Turn on **Embed View Token Authentication** and set `BUNNY_STREAM_TOKEN_KEY`.
3. Put each video's GUID on the matching lesson in `/admin/courses`.

## 7. Monitoring and analytics

- Sentry: create a project, set `NEXT_PUBLIC_SENTRY_DSN`. Errors report
  automatically (see `src/instrumentation.ts`).
- PostHog: create a project, set `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST`. Funnel
  events are captured server-side (see `src/lib/analytics.ts`).

## 8. Pre-launch checklist

- [ ] Security review run and every finding fixed.
- [ ] RLS enabled on every table (check the Supabase dashboard).
- [ ] Service role key only on the server, not in any client bundle.
- [ ] Webhook signature verified; replaying an order doesn't grant access twice.
- [ ] Daily backups on for the production project.
- [ ] Production env vars set in Vercel; custom domain on HTTPS.
- [ ] Resend domain verified.
- [ ] Lemon Squeezy live with the live webhook; one real $1 purchase refunded.
- [ ] Sentry and PostHog receiving events from production.
- [ ] Final legal pages published; admin roles set.
- [ ] 10–15 jobs open, at least 2 courses published.

## Routine

```bash
npm run build       # production build
npm run test:e2e    # against a built server (see CLAUDE.md)
```
Migrations: add SQL in `supabase/migrations`, then `npm run db:push` and
`npm run db:types`.
