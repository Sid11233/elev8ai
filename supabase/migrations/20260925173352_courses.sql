-- Phase 5: courses, lessons, course_access, lesson_completions.

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 3000),
  price_cents integer not null check (price_cents >= 0),
  skill_id uuid references public.skills (id) on delete set null,
  lemon_variant_id text check (char_length(lemon_variant_id) <= 60),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.courses.skill_id is 'Badge awarded when the course assignment is passed.';
comment on column public.courses.lemon_variant_id is 'Lemon Squeezy variant id for checkout.';

create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lessons: title/position are public (syllabus); body_md and video_id are
-- owner-only, enforced by RLS below.
-- ---------------------------------------------------------------------------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position integer not null default 0,
  title text not null check (char_length(title) between 2 and 200),
  body_md text check (char_length(body_md) <= 20000),
  video_id text check (char_length(video_id) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_course_position_idx on public.lessons (course_id, position);

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- course_access: created by the payment webhook (service role). One per buyer.
-- ---------------------------------------------------------------------------
create table public.course_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  order_id text,
  amount_cents integer check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index course_access_user_idx on public.course_access (user_id);

-- ---------------------------------------------------------------------------
-- lesson_completions: drives the progress bar. Owners only.
-- ---------------------------------------------------------------------------
create table public.lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index lesson_completions_user_idx on public.lesson_completions (user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.has_course_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_access
    where course_id = p_course_id and user_id = (select auth.uid())
  );
$$;

-- Public syllabus: lesson id/position/title only (no body or video), for a
-- published course or an admin. Lets non-owners see what they'd get.
create function public.get_course_syllabus(p_course_id uuid)
returns table (id uuid, "position" integer, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.position, l.title
  from public.lessons l
  join public.courses c on c.id = l.course_id
  where l.course_id = p_course_id
    and (c.published or public.is_admin())
  order by l.position, l.created_at;
$$;

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.course_access enable row level security;
alter table public.lesson_completions enable row level security;

revoke all on public.courses, public.lessons, public.course_access, public.lesson_completions
  from anon, authenticated;

-- courses: everyone logged in reads published; admins manage all.
grant select, insert, update, delete on public.courses to authenticated;
create policy "Read published courses, admins all"
on public.courses for select to authenticated
using (published or (select public.is_admin()));
create policy "Admins manage courses"
on public.courses for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- lessons: full rows (incl. body_md, video_id) only for owners/admins. The
-- syllabus function is how non-owners see titles.
grant select, insert, update, delete on public.lessons to authenticated;
create policy "Owners and admins read full lessons"
on public.lessons for select to authenticated
using ((select public.is_admin()) or (select public.has_course_access(course_id)));
create policy "Admins manage lessons"
on public.lessons for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- course_access: users read their own; admins read all. No user writes.
grant select on public.course_access to authenticated;
create policy "Users read own access, admins all"
on public.course_access for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

-- lesson_completions: users read/write their own, only for lessons they own.
grant select, insert, delete on public.lesson_completions to authenticated;
create policy "Users read own completions"
on public.lesson_completions for select to authenticated
using (user_id = (select auth.uid()));
create policy "Users mark lessons they own complete"
on public.lesson_completions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.lessons l
    where l.id = lesson_id and (select public.has_course_access(l.course_id))
  )
);
create policy "Users undo own completions"
on public.lesson_completions for delete to authenticated
using (user_id = (select auth.uid()));

revoke execute on function
  public.has_course_access(uuid),
  public.get_course_syllabus(uuid)
from public, anon;
grant execute on function
  public.has_course_access(uuid),
  public.get_course_syllabus(uuid)
to authenticated;
