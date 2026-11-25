-- HackTony initial persistence schema (authenticated users own their rows)
create table if not exists public.hackathons (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text not null default '',
  status text not null default 'Interested' check (status in ('Interested','Registered','In progress','Submitted','Completed')),
  start_date date,
  end_date date,
  submission_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hackathons_user_updated_idx on public.hackathons(user_id, updated_at desc);
alter table public.hackathons enable row level security;
grant select, insert, update, delete on public.hackathons to authenticated;
drop policy if exists "Users can read their hackathons" on public.hackathons;
create policy "Users can read their hackathons" on public.hackathons for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their hackathons" on public.hackathons;
create policy "Users can insert their hackathons" on public.hackathons for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their hackathons" on public.hackathons;
create policy "Users can update their hackathons" on public.hackathons for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their hackathons" on public.hackathons;
create policy "Users can delete their hackathons" on public.hackathons for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.gmail_discoveries (
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

create index if not exists gmail_discoveries_user_matched_idx on public.gmail_discoveries(user_id, matched_at desc);
alter table public.gmail_discoveries enable row level security;
grant select, insert, update, delete on public.gmail_discoveries to authenticated;
drop policy if exists "Users can read their email discoveries" on public.gmail_discoveries;
create policy "Users can read their email discoveries" on public.gmail_discoveries for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their email discoveries" on public.gmail_discoveries;
create policy "Users can insert their email discoveries" on public.gmail_discoveries for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their email discoveries" on public.gmail_discoveries;
create policy "Users can update their email discoveries" on public.gmail_discoveries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their email discoveries" on public.gmail_discoveries;
create policy "Users can delete their email discoveries" on public.gmail_discoveries for delete to authenticated using ((select auth.uid()) = user_id);
