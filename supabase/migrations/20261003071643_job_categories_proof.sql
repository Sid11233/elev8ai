-- Phase 8: job categories reference table + proof types. A job category is only
-- postable if it's listed here (admin-gated), and each maps to a proof_type.

create table public.job_categories (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  label text not null check (char_length(label) between 2 and 80),
  proof_type text not null check (proof_type in ('file_watermarked','file_staging','verified_event','verified_publish')),
  launch_ready boolean not null default true,
  sort integer not null default 0
);

alter table public.job_categories enable row level security;
revoke all on public.job_categories from anon, authenticated;
grant select on public.job_categories to authenticated;
create policy "Signed-in read job categories"
on public.job_categories for select to authenticated using (true);
create policy "Admins manage job categories"
on public.job_categories for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.job_categories (slug, label, proof_type, sort) values
  ('clipping', 'Clipping', 'file_watermarked', 0),
  ('content', 'Content & graphic design', 'file_watermarked', 1),
  ('copywriting', 'Copywriting', 'file_watermarked', 2),
  ('voiceover', 'Voiceover & audio', 'file_watermarked', 3),
  ('podcast_editing', 'Podcast editing', 'file_watermarked', 4),
  ('logo_design', 'Logo & thumbnail design', 'file_watermarked', 5),
  ('deck_design', 'Presentation & deck design', 'file_watermarked', 6),
  ('photo_editing', 'Photo editing & retouching', 'file_watermarked', 7),
  ('cv_writing', 'Resume & CV writing', 'file_watermarked', 8),
  ('proofreading', 'Proofreading & editing', 'file_watermarked', 9),
  ('transcription', 'Transcription', 'file_watermarked', 10),
  ('translation', 'Translation', 'file_watermarked', 11),
  ('uiux_design', 'UI/UX mockup design', 'file_watermarked', 12),
  ('illustration', 'Illustration & digital art', 'file_watermarked', 13),
  ('blog_writing', 'Blog & SEO writing', 'file_watermarked', 14),
  ('web_dev', 'Web development', 'file_staging', 15),
  ('landing_pages', 'Landing page builds', 'file_staging', 16),
  ('app_prototypes', 'Mobile app prototypes', 'file_staging', 17),
  ('automation', 'Automation & bot builds', 'file_staging', 18),
  ('chrome_extensions', 'Chrome extension development', 'file_staging', 19),
  ('cold_calling', 'Cold calling & appointment setting', 'verified_event', 20),
  ('webinar_hosting', 'Webinar & event hosting', 'verified_event', 21),
  ('interview_scheduling', 'Customer interview scheduling', 'verified_event', 22),
  ('ugc_posting', 'UGC & creator posting', 'verified_publish', 23),
  ('affiliate_posting', 'Affiliate & promotional posting', 'verified_publish', 24),
  ('review_posting', 'Review & testimonial posting', 'verified_publish', 25);

-- jobs.proof_type, derived from the category.
alter table public.jobs
  add column proof_type text check (proof_type in ('file_watermarked','file_staging','verified_event','verified_publish'));

-- Backfill existing jobs from their category.
update public.jobs j
set proof_type = c.proof_type
from public.job_categories c
where c.slug = j.category;

-- Replace the old 4-value category check with a FK to the reference table.
-- Drop any CHECK constraint on jobs that references the category column.
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'jobs' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%category%'
  loop
    execute format('alter table public.jobs drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.jobs
  add constraint jobs_category_fkey foreign key (category) references public.job_categories (slug);

-- On insert/update, validate the category is launch-ready and set proof_type.
create or replace function public.set_job_proof_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proof text;
  v_ready boolean;
begin
  select proof_type, launch_ready into v_proof, v_ready
  from public.job_categories where slug = new.category;
  if v_proof is null then
    raise exception 'Unknown job category';
  end if;
  if v_ready is not true then
    raise exception 'That category is not open for posting yet';
  end if;
  new.proof_type := v_proof;
  return new;
end;
$$;

create trigger jobs_set_proof_type
before insert or update of category on public.jobs
for each row execute function public.set_job_proof_type();
