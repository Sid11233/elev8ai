@AGENTS.md

# Elev8ai

Marketplace where young people (18+) take paid micro-jobs from companies
and buy courses that unlock skill-gated jobs.

## MVP scope

- Roles: talent (default) and admin. Companies are admin-managed records.
- Job categories: clipping, cold_calling, content, web_dev.
- Flow: apply -> accept -> submit proof -> approve -> payout owed -> paid.
- Courses: pay once (Lemon Squeezy), lessons, one assignment,
  manual grading, pass awards a skill badge that unlocks gated jobs.
- Chat per accepted application. In-app + email notifications.
- Payouts are manual transfers logged by admin. No escrow, no subscriptions.
- Full table list: docs/schema.md.

## Stack

Next.js 16 App Router, TypeScript strict, Tailwind v4, shadcn/ui, Supabase
(Postgres, Auth, Storage, Realtime), Resend, Zod, Playwright.

## Rules

- Money is integer cents. Never floats.
- Every table has RLS enabled. Talent can only read/write their own rows.
  Admin checks go through a SQL function is_admin().
- All DB changes are SQL migration files in supabase/migrations.
- Validate every form and server action input with Zod.
- Server-only secrets never reach client components.
- Mobile-first UI; most talent will use phones.
- Small, reviewable changes. Explain the plan before large edits.
- After each feature: run typecheck, lint, and relevant tests.

## Code layout

- Supabase clients in src/lib/supabase: `client.ts` (Client Components),
  `server.ts` (Server Components / actions / route handlers), `admin.ts`
  (service role, bypasses RLS, server only), `proxy.ts` (session refresh).
- Next 16 renamed middleware to proxy: request interception lives in src/proxy.ts.
- Env vars are documented in .env.example; real values go in .env.local only.

## Commands

npm run dev | npm run build | npm run lint | npm run typecheck | npm run format | npm run test:e2e

Database (CLI is linked to the elev8ai dev project):
`npx supabase migration new <name>` -> edit SQL -> `npm run db:push` -> `npm run db:types`.
Profiles are keyed by `user_id`; users can only update whitelisted columns
(column grants), so new user-editable columns must be added to the grant.
