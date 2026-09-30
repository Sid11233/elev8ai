-- Phase B: LinkedIn-style story on the freelancer profile.

alter table public.profiles
  add column headline text check (char_length(headline) <= 120),
  add column about text check (char_length(about) <= 3000);

-- Users may edit these on their own profile (column-level grant).
grant update (headline, about) on public.profiles to authenticated;
