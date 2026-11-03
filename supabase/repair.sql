-- Fairway: repair script. Safe to run on a project that already has Fairway's tables,
-- as many times as you like. It never deletes rows.
--
-- Use it when something else has been run in the same project (another app's schema, a
-- half-run script). It:
--   1. creates any missing Fairway tables and columns
--   2. restores Fairway's functions and triggers
--   3. drops EVERY policy on Fairway's 8 tables (including ones another script added) and
--      recreates Fairway's own, so nobody can see more than they should
--   4. re-applies grants
-- Other apps' tables are left alone.

begin;

create extension if not exists pgcrypto;

create or replace function public.invite_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 8);
$$;

-- ---------- tables and columns ----------

create table if not exists public.profiles (id uuid primary key references auth.users on delete cascade);
alter table public.profiles add column if not exists name text not null default '';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create table if not exists public.groups (id uuid primary key default gen_random_uuid());
alter table public.groups add column if not exists name text not null default 'Group';
alter table public.groups add column if not exists invite_code text default public.invite_code();
alter table public.groups add column if not exists created_by uuid references public.profiles on delete set null;
alter table public.groups add column if not exists created_at timestamptz not null default now();
create unique index if not exists groups_invite_code_key on public.groups (invite_code);

create table if not exists public.group_members (
  group_id uuid references public.groups on delete cascade,
  user_id  uuid references public.profiles on delete cascade,
  primary key (group_id, user_id)
);
alter table public.group_members add column if not exists joined_at timestamptz not null default now();
create index if not exists group_members_user_id_idx on public.group_members (user_id);

create table if not exists public.cards (user_id uuid primary key references public.profiles on delete cascade default auth.uid());
alter table public.cards add column if not exists card jsonb not null default '{}';
alter table public.cards add column if not exists updated_at timestamptz not null default now();

create table if not exists public.backups (user_id uuid primary key references public.profiles on delete cascade default auth.uid());
alter table public.backups add column if not exists data jsonb not null default '{}';
alter table public.backups add column if not exists updated_at timestamptz not null default now();

create table if not exists public.events (id uuid primary key default gen_random_uuid());
alter table public.events add column if not exists user_id uuid references public.profiles on delete cascade default auth.uid();
alter table public.events add column if not exists key text;
alter table public.events add column if not exists kind text;
alter table public.events add column if not exists payload jsonb not null default '{}';
alter table public.events add column if not exists created_at timestamptz not null default now();
alter table public.events add column if not exists updated_at timestamptz not null default now();
create unique index if not exists events_user_id_key_key on public.events (user_id, key);
create index if not exists events_updated_at_idx on public.events (updated_at desc);

create table if not exists public.reactions (
  event_id uuid references public.events on delete cascade,
  user_id  uuid references public.profiles on delete cascade default auth.uid(),
  emoji    text not null,
  primary key (event_id, user_id, emoji)
);
alter table public.reactions add column if not exists created_at timestamptz not null default now();

create table if not exists public.comments (id uuid primary key default gen_random_uuid());
alter table public.comments add column if not exists event_id uuid references public.events on delete cascade;
alter table public.comments add column if not exists user_id uuid references public.profiles on delete cascade default auth.uid();
alter table public.comments add column if not exists body text not null default '';
alter table public.comments add column if not exists created_at timestamptz not null default now();
create index if not exists comments_event_id_created_at_idx on public.comments (event_id, created_at);

-- ---------- functions and triggers ----------

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

create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch on public.cards;
drop trigger if exists touch on public.backups;
drop trigger if exists touch on public.events;
create trigger touch before update on public.cards   for each row execute function public.touch();
create trigger touch before update on public.backups for each row execute function public.touch();
create trigger touch before update on public.events  for each row execute function public.touch();

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

-- ---------- row level security: wipe and recreate ----------

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'groups', 'group_members', 'cards', 'backups', 'events', 'reactions', 'comments')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

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

-- ---------- grants (Fairway's tables only, so other apps' grants are untouched) ----------

revoke all on public.profiles, public.groups, public.group_members, public.cards, public.backups,
  public.events, public.reactions, public.comments from anon;
grant select, insert, update, delete on public.profiles, public.groups, public.group_members, public.cards,
  public.backups, public.events, public.reactions, public.comments to authenticated;
grant execute on function public.create_group(text), public.join_group(text) to authenticated;
revoke execute on function public.create_group(text), public.join_group(text) from anon, public;

commit;

-- What's in the project now. Fairway's 8 tables should each show rls = true.
select c.relname as table_name, c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
