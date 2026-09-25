# Security review (Phase 7b)

Audit of RLS policies, storage policies, server actions, API routes and the
payment webhook. Re-run the checks after any schema or auth change.

## Model

Two enforced layers, so a bug in one doesn't open a hole:

1. **Postgres RLS + column grants** on every table. Anonymous users have no
   grants at all; authenticated users only ever touch their own rows.
2. **Security-definer SQL functions** for every state change (apply, decide,
   submit, review, mark paid, submit/grade assignment, chat helpers). Each
   re-checks `auth.uid()` / `is_admin()` itself, so a missing check in a server
   action can't be exploited.

Server actions add a third layer (`requireUser` / `requireOnboardedProfile` /
`requireAdmin`).

## What was checked (all passing)

- **RLS enabled on all 17 tables**; anonymous access denied on every table
  (permission denied), and anonymous writes rejected.
- **Service-role key** (`createAdminClient`) is `server-only`, never imported by
  a client component, and never exposed as `NEXT_PUBLIC`.
- **Every admin server action** calls `requireAdmin`; the payouts CSV export
  route returns 404 for non-admins.
- **Every talent server action** calls `requireUser` / `requireOnboardedProfile`
  (only `signOut` is unguarded, which is correct).
- **Lemon Squeezy webhook** verifies the HMAC-SHA256 signature and is idempotent
  on the order id (a replayed order can't grant access twice).
- **Storage**: `submissions`, `chat-attachments`, `assignment-files` are private
  and scoped to the owner's folder (admins can read); `avatars` and
  `company-logos` are public-read by design.
- **No secrets** in tracked files; `.env.local` is gitignored.

## Attacks tried against the live database (all blocked)

Across phases, 150+ live assertions confirmed a talent user cannot:

- read another user's profile, applications, submissions, payouts, messages,
  payout details, or proof/attachment files;
- change their own role, accept/approve their own work, or pay themselves;
- grant themselves a badge or course access;
- apply to a gated job without the badge, a closed/expired/full job, or twice;
- read lesson bodies or video ids for a course they don't own (buyers-only
  video is enforced at the row level);
- post in, or read, a chat thread they aren't part of.

## How to re-run

- Live RLS scripts used during the build live in the scratchpad; the same checks
  are covered by the Playwright suite (`npm run test:e2e`).
- Anonymous-access sweep and guard greps: see the commands in this file's PR/commit.

## Residual items for launch

- Replace placeholder legal text in `/content` with lawyer-reviewed copy.
- Rotate any credentials shared during development (e.g. the Google OAuth
  secret) before go-live.
- Turn on Supabase daily backups for the production project.
