-- Fairway: Supabase schema for stage 2 (friends, feed, cloud backup).
-- Run the whole file once in the Supabase SQL editor on a fresh project.
--
-- Model: the phone stays the source of truth (local-first). It publishes:
--   cards    one public snapshot per user: today's habits, streak, focus, the course itself
--   events   feed items: the daily card plus notable moments (stacks, goals, items, builds)
--   backups  the full local state, readable only by its owner, for restoring on a new phone
-- Friends are anyone who shares a group with you. Everything is gated by row level security.

create extension if not exists pgcrypto;

-- ---------- tables ----------

-- 8 chars, no 0/O/1/I so codes read clearly over a text message
create or replace function public.invite_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 8);
$$;

create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default '' check (char_length(name) <= 40),
  created_at  timestamptz not null default now()
);

create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 40),
  -- 8 chars, no 0/O/1/I so codes read clearly over a text message
  invite_code  text not null unique default public.invite_code(),
  created_by   uuid references public.profiles on delete set null,
  created_at   timestamptz not null default now()
);

create table public.group_members (
  group_id   uuid references public.groups on delete cascade,
  user_id    uuid references public.profiles on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

create table public.cards (
  user_id     uuid primary key references public.profiles on delete cascade default auth.uid(),
  card        jsonb not null,
  updated_at  timestamptz not null default now(),
  check (pg_column_size(card) < 200000)
);

create table public.backups (
  user_id     uuid primary key references public.profiles on delete cascade default auth.uid(),
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  check (pg_column_size(data) < 5000000)
);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade default auth.uid(),
  key         text not null,     -- client id, makes retries idempotent; 'day:YYYY-MM-DD' for the daily card
  kind        text not null check (kind in ('day', 'stack', 'goal', 'item', 'milestone', 'build')),
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, key),
  check (pg_column_size(payload) < 20000)
);
create index on public.events (updated_at desc);

create table public.reactions (
  event_id    uuid references public.events on delete cascade,
  user_id     uuid references public.profiles on delete cascade default auth.uid(),
  emoji       text not null check (emoji in ('🔥', '👏', '⛳', '😮', '😬')),
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id, emoji)
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events on delete cascade,
  user_id     uuid not null references public.profiles on delete cascade default auth.uid(),
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index on public.comments (event_id, created_at);

-- ---------- helpers ----------
-- security definer so policies can ask "do we share a group" without recursing through
-- group_members' own policy.

create or replace function public.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- updated_at on upsert
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger touch before update on public.cards   for each row execute function public.touch();
create trigger touch before update on public.backups for each row execute function public.touch();
create trigger touch before update on public.events  for each row execute function public.touch();

-- ---------- group RPCs ----------
-- Groups are created and joined through these, never by direct insert, so nobody can add
-- themselves to a group without its code.

create or replace function public.create_group(group_name text) returns public.groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into groups (name, created_by) values (trim(group_name), auth.uid()) returning * into g;
  insert into group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end $$;

create or replace function public.join_group(code text) returns public.groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from groups where invite_code = upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'));
  if g.id is null then raise exception 'No group with that code'; end if;
  if (select count(*) from group_members where group_id = g.id) >= 30 then raise exception 'Group is full'; end if;
  insert into group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  return g;
end $$;

-- ---------- row level security ----------

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.cards         enable row level security;
alter table public.backups       enable row level security;
alter table public.events        enable row level security;
alter table public.reactions     enable row level security;
alter table public.comments      enable row level security;

create policy "friends read profiles" on public.profiles for select using (shares_group(id));
create policy "insert own profile"    on public.profiles for insert with check (id = auth.uid());
create policy "update own profile"    on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members read group"   on public.groups for select using (is_member(id));

create policy "members read members" on public.group_members for select using (is_member(group_id));
create policy "leave group"          on public.group_members for delete using (user_id = auth.uid());

create policy "friends read cards" on public.cards for select using (shares_group(user_id));
create policy "insert own card"    on public.cards for insert with check (user_id = auth.uid());
create policy "update own card"    on public.cards for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own backup" on public.backups for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "friends read events" on public.events for select using (shares_group(user_id));
create policy "insert own events"   on public.events for insert with check (user_id = auth.uid());
create policy "update own events"   on public.events for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own events"   on public.events for delete using (user_id = auth.uid());

-- reactions and comments: visible and allowed on any event you can see
create policy "read reactions" on public.reactions for select
  using (exists (select 1 from events e where e.id = event_id));
create policy "react" on public.reactions for insert
  with check (user_id = auth.uid() and exists (select 1 from events e where e.id = event_id));
create policy "unreact" on public.reactions for delete using (user_id = auth.uid());

create policy "read comments" on public.comments for select
  using (exists (select 1 from events e where e.id = event_id));
create policy "comment" on public.comments for insert
  with check (user_id = auth.uid() and exists (select 1 from events e where e.id = event_id));
create policy "delete own comment" on public.comments for delete
  using (user_id = auth.uid() or exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid()));

-- ---------- grants ----------
-- Supabase grants these to anon/authenticated by default; repeated so the file also runs
-- on plain Postgres for testing. Anonymous users get nothing: every policy needs auth.uid().

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.create_group(text), public.join_group(text) to authenticated;
revoke execute on function public.create_group(text), public.join_group(text) from anon, public;
