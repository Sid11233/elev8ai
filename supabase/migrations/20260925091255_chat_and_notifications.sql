-- Phase 4: per-job chat (conversations, messages, attachments) and notifications.

-- ---------------------------------------------------------------------------
-- conversations: one thread per accepted application
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  attachment_path text check (char_length(attachment_path) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_not_empty check (btrim(body) <> '' or attachment_path is not null)
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

-- Keep conversations sorted by latest activity.
create function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation();

-- The application's talent and admins take part in a conversation.
create function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.conversations c
    join public.applications a on a.id = c.application_id
    where c.id = p_conversation_id and a.user_id = (select auth.uid())
  );
$$;

-- Storage paths are "<conversation id>/<file>"; false for anything malformed.
create function public.can_access_conversation_folder(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folder text := split_part(p_object_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_conversation_participant(v_folder::uuid);
end;
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on public.conversations, public.messages from anon, authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body, attachment_path) on public.messages to authenticated;

create policy "Participants read conversations"
on public.conversations for select to authenticated
using ((select public.is_conversation_participant(id)));

create policy "Participants read messages"
on public.messages for select to authenticated
using ((select public.is_conversation_participant(conversation_id)));

create policy "Participants send messages as themselves"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and (select public.is_conversation_participant(conversation_id))
  and (attachment_path is null or attachment_path like conversation_id::text || '/%')
);

-- Marks the other side's messages as read. For talent that is everything they
-- didn't send; for admins it is the talent's messages.
create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_talent uuid;
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Conversation not found';
  end if;
  select a.user_id into v_talent
  from public.conversations c join public.applications a on a.id = c.application_id
  where c.id = p_conversation_id;

  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and read_at is null
    and case when v_talent = auth.uid() then sender_id <> auth.uid() else sender_id = v_talent end;
end;
$$;

-- Inbox rows for the current user (RLS limits which conversations appear).
create function public.list_conversations()
returns table (
  conversation_id uuid,
  application_id uuid,
  job_id uuid,
  job_title text,
  talent_id uuid,
  last_message_at timestamptz,
  last_message text,
  last_message_has_attachment boolean,
  last_sender_id uuid,
  unread_count integer
)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    a.id,
    j.id,
    j.title,
    a.user_id,
    coalesce(c.last_message_at, c.created_at),
    lm.body,
    lm.attachment_path is not null,
    lm.sender_id,
    (
      select count(*)::integer from public.messages m
      where m.conversation_id = c.id
        and m.read_at is null
        and case when a.user_id = (select auth.uid())
          then m.sender_id <> a.user_id
          else m.sender_id = a.user_id end
    )
  from public.conversations c
  join public.applications a on a.id = c.application_id
  join public.jobs j on j.id = a.job_id
  left join lateral (
    select m.body, m.attachment_path, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

revoke execute on function
  public.mark_conversation_read(uuid),
  public.list_conversations(),
  public.is_conversation_participant(uuid),
  public.can_access_conversation_folder(text)
from public, anon;
grant execute on function
  public.mark_conversation_read(uuid),
  public.list_conversations(),
  public.is_conversation_participant(uuid),
  public.can_access_conversation_folder(text)
to authenticated;
revoke execute on function public.touch_conversation() from public, anon, authenticated;

-- Accepting an application now also opens its conversation.
create or replace function public.decide_application(
  p_application_id uuid,
  p_accept boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review applications';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found or v_app.status <> 'pending' then
    raise exception 'This application has already been decided';
  end if;

  if p_accept then
    select * into v_job from public.jobs where id = v_app.job_id for update;
    if v_job.spots_taken >= v_job.slots then
      raise exception 'All spots for this job are already filled';
    end if;
    update public.jobs
    set spots_taken = spots_taken + 1,
        status = case when spots_taken + 1 >= slots then 'closed' else status end
    where id = v_job.id;

    insert into public.conversations (application_id)
    values (p_application_id)
    on conflict (application_id) do nothing;
  end if;

  update public.applications
  set status = case when p_accept then 'accepted' else 'rejected' end,
      decision_note = nullif(btrim(p_note), ''),
      decided_at = now(),
      decided_by = auth.uid()
  where id = p_application_id;
end;
$$;

-- Conversations for applications accepted before this migration.
insert into public.conversations (application_id)
select id from public.applications where status = 'accepted'
on conflict (application_id) do nothing;

-- chat-attachments bucket: private, participants only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments', 'chat-attachments', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

create policy "Participants upload chat attachments"
on storage.objects for insert to authenticated
with check (bucket_id = 'chat-attachments' and (select public.can_access_conversation_folder(name)));

create policy "Participants read chat attachments"
on storage.objects for select to authenticated
using (bucket_id = 'chat-attachments' and (select public.can_access_conversation_folder(name)));

-- ---------------------------------------------------------------------------
-- notifications: bell icon + email. Inserted by the server (service role).
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 50),
  title text not null check (char_length(title) <= 200),
  body text check (char_length(body) <= 1000),
  link text check (char_length(link) <= 500),
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users read own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users mark own notifications read"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.profiles add column email_opt_out boolean not null default false;
grant update (email_opt_out) on public.profiles to authenticated;

-- Live chat and the live bell.
alter publication supabase_realtime add table public.messages, public.notifications;
