-- HackTony-specific tables kept separate from the existing public hackathon catalogue
create table if not exists public.hacktony_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  platform text not null default '',
  status text not null default 'Interested' check (status in ('Interested','Registered','In progress','Submitted','Completed')),
  start_date date,
  end_date date,
  submission_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hacktony_events_user_updated_idx on public.hacktony_events(user_id, updated_at desc);
alter table public.hacktony_events enable row level security;
grant select, insert, update, delete on public.hacktony_events to authenticated;
drop policy if exists "HackTony users read own events" on public.hacktony_events;
create policy "HackTony users read own events" on public.hacktony_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "HackTony users insert own events" on public.hacktony_events;
create policy "HackTony users insert own events" on public.hacktony_events for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "HackTony users update own events" on public.hacktony_events;
create policy "HackTony users update own events" on public.hacktony_events for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "HackTony users delete own events" on public.hacktony_events;
create policy "HackTony users delete own events" on public.hacktony_events for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.hacktony_gmail_discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  subject text not null default '',
  sender text not null default '',
  message_date text not null default '',
  snippet text not null default '',
  platform text not null default 'Email',
  matched_at timestamptz not null default now(),
  status text not null default 'pending_review' check (status in ('pending_review','imported','dismissed')),
  unique (user_id, gmail_message_id)
);
create index if not exists hacktony_gmail_user_matched_idx on public.hacktony_gmail_discoveries(user_id, matched_at desc);
alter table public.hacktony_gmail_discoveries enable row level security;
grant select, insert, update, delete on public.hacktony_gmail_discoveries to authenticated;
drop policy if exists "HackTony users read own discoveries" on public.hacktony_gmail_discoveries;
create policy "HackTony users read own discoveries" on public.hacktony_gmail_discoveries for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "HackTony users insert own discoveries" on public.hacktony_gmail_discoveries;
create policy "HackTony users insert own discoveries" on public.hacktony_gmail_discoveries for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "HackTony users update own discoveries" on public.hacktony_gmail_discoveries;
create policy "HackTony users update own discoveries" on public.hacktony_gmail_discoveries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "HackTony users delete own discoveries" on public.hacktony_gmail_discoveries;
create policy "HackTony users delete own discoveries" on public.hacktony_gmail_discoveries for delete to authenticated using ((select auth.uid()) = user_id);
