-- Isle: Supabase schema for phase 2 (sync + friends).
-- Not used by the app yet. Phase 1 runs entirely on-device; this file is the target the
-- local store was shaped to match. Run it in the Supabase SQL editor on a fresh project.

create extension if not exists pgcrypto;

-- ---------- core tables ----------

create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null default '',
  avatar        text,
  timezone      text not null default 'Australia/Sydney',
  created_at    timestamptz not null default now()
);

create table public.groups (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  invite_code        text not null unique default upper(substr(md5(random()::text), 1, 6)),
  weekly_target_pct  int  not null default 80 check (weekly_target_pct between 1 and 100),
  created_at         timestamptz not null default now()
);

create table public.group_members (
  group_id   uuid references public.groups on delete cascade,
  user_id    uuid references public.profiles on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

create type habit_type as enum ('check', 'count', 'duration', 'limit');
create type habit_category as enum ('study', 'reading', 'fitness', 'screen', 'other');
create type visibility as enum ('friends', 'summary', 'private');
create type trust_level as enum ('verified', 'proof', 'honour');
create type log_source as enum ('manual', 'timer', 'screentime');

create table public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  name        text not null,
  type        habit_type not null,
  category    habit_category not null,
  target      numeric not null default 1,
  unit        text not null default '',
  schedule    jsonb not null default '{"kind":"daily"}',  -- {kind:'daily'} | {kind:'days',days:[0..6]} | {kind:'weekly',times:n}
  visibility  visibility not null default 'friends',
  goal_id     uuid,
  sort        int not null default 0,
  archived    boolean not null default false,
  created_at  date not null default current_date
);

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  log_date   date not null,
  value      numeric not null default 0,
  bucket     text,                       -- screen time bucket id for limit habits
  trust      trust_level not null default 'honour',
  proof_url  text,
  source     log_source not null default 'manual',
  done       boolean not null default false,  -- set by trigger, never by the client
  yield      int not null default 0,          -- set by trigger, never by the client
  unique (habit_id, log_date)
);
create index on public.habit_logs (user_id, log_date);

create table public.study_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  habit_id    uuid references public.habits on delete set null,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  duration_s  int generated always as (extract(epoch from ended_at - started_at)::int) stored
);

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles on delete cascade,
  title         text not null,
  target_value  numeric not null,
  unit          text not null default '',
  start_date    date not null default current_date,
  deadline      date not null,
  status        text not null default 'active' check (status in ('active', 'hit', 'missed'))
);
alter table public.habits add constraint habits_goal_fk foreign key (goal_id) references public.goals on delete set null;

create table public.goal_milestones (
  id        uuid primary key default gen_random_uuid(),
  goal_id   uuid not null references public.goals on delete cascade,
  title     text not null,
  due_date  date not null,
  done      boolean not null default false
);

create table public.buildings (
  id    text primary key,
  name  text not null,
  cost  jsonb not null default '{}'   -- {"timber":40,"paper":10}
);
insert into public.buildings (id, name, cost) values
  ('house', 'Cottage', '{}'),
  ('trees', 'Pine grove', '{"seeds":15}'),
  ('garden', 'Veggie garden', '{"seeds":25,"coins":5}'),
  ('library', 'Library', '{"timber":40,"paper":10}'),
  ('dock', 'Jetty', '{"timber":25,"stone":15}'),
  ('blossom', 'Blossom tree', '{"seeds":20,"coins":15}'),
  ('lighthouse', 'Lighthouse', '{"stone":40,"paper":30}'),
  ('boat', 'Sailboat', '{"timber":30,"coins":25}');

create table public.plot_state (
  user_id    uuid primary key references public.profiles on delete cascade,
  buildings  text[] not null default '{house}',
  spent      jsonb not null default '{}'
);

create table public.feed_events (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups on delete cascade,
  user_id     uuid not null references public.profiles on delete cascade,
  kind        text not null,  -- daily_summary, streak, build, goal_hit, goal_missed, group_target
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on public.feed_events (group_id, created_at desc);

create table public.reactions (
  event_id  uuid references public.feed_events on delete cascade,
  user_id   uuid references public.profiles on delete cascade,
  kind      text not null check (kind in ('nice', 'fire', 'clap', 'wow', 'nudge')),
  primary key (event_id, user_id, kind)
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.feed_events on delete cascade,
  user_id     uuid not null references public.profiles on delete cascade,
  body        text not null check (length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);

-- ---------- visibility helper ----------

-- True when `other` shares a group with the caller (or is the caller).
create or replace function public.is_groupmate(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from group_members a join group_members b using (group_id)
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ---------- game engine: yield is computed here so nobody can edit their own resources ----------

create or replace function public.habit_streak_before(h public.habits, d date) returns int
language plpgsql stable as $$
declare
  n int := 0;
  cur date := d - 1;
begin
  -- Daily and weekday habits only; weekly quotas get no streak bonus server side for now.
  if h.schedule->>'kind' = 'weekly' then return 0; end if;
  while cur >= h.created_at and n < 400 loop
    if h.schedule->>'kind' = 'days'
       and not (h.schedule->'days') @> to_jsonb(extract(dow from cur)::int) then
      cur := cur - 1; continue;
    end if;
    exit when not exists (select 1 from habit_logs where habit_id = h.id and log_date = cur and done);
    n := n + 1;
    cur := cur - 1;
  end loop;
  return n;
end $$;

create or replace function public.score_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  h habits;
  bucket_max numeric;
  mult numeric;
begin
  select * into h from habits where id = new.habit_id;
  if h.user_id <> new.user_id then raise exception 'habit does not belong to user'; end if;

  bucket_max := case new.bucket when 'u15' then 15 when '15' then 30 when '30' then 60 when '60' then 120 else null end;
  new.done := case h.type
    when 'check' then new.value >= 1
    when 'count' then new.value >= h.target
    when 'duration' then new.value >= h.target
    when 'limit' then bucket_max is not null and bucket_max <= h.target
  end;

  -- Verified must be backed by a real timer session of 10+ minutes that day.
  if new.trust = 'verified' and not exists (
    select 1 from study_sessions s
    where s.habit_id = new.habit_id and s.duration_s >= 600
      and (s.started_at at time zone (select timezone from profiles where id = new.user_id))::date = new.log_date
  ) then
    new.trust := 'honour';
  end if;
  if new.trust = 'proof' and new.proof_url is null then new.trust := 'honour'; end if;

  mult := case new.trust when 'verified' then 1.5 when 'proof' then 1.2 else 1.0 end;
  new.yield := case when new.done
    then round(10 * mult * (1 + least(0.5, 0.02 * habit_streak_before(h, new.log_date))))
    else 0 end;
  return new;
end $$;

create trigger score_log before insert or update on public.habit_logs
  for each row execute function public.score_log();

create or replace view public.v_resources with (security_invoker = true) as
select p.id as user_id, r.key as resource,
  coalesce(e.earned, 0) - coalesce((ps.spent->>r.key)::int, 0) as amount
from profiles p
cross join (values ('timber'), ('paper'), ('stone'), ('seeds'), ('coins')) as r(key)
left join plot_state ps on ps.user_id = p.id
left join lateral (
  select sum(l.yield) as earned
  from habit_logs l join habits h on h.id = l.habit_id
  where l.user_id = p.id and case h.category
    when 'study' then 'timber' when 'reading' then 'paper' when 'fitness' then 'stone'
    when 'screen' then 'seeds' else 'coins' end = r.key
) e on true;

-- The only way to spend resources.
create or replace function public.build(building text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c jsonb;
  k text;
  have int;
begin
  select cost into c from buildings where id = building;
  if c is null then raise exception 'unknown building'; end if;
  insert into plot_state (user_id) values (auth.uid()) on conflict do nothing;
  if exists (select 1 from plot_state where user_id = auth.uid() and building = any(buildings)) then
    raise exception 'already built';
  end if;
  for k in select jsonb_object_keys(c) loop
    select amount into have from v_resources where user_id = auth.uid() and resource = k;
    if coalesce(have, 0) < (c->>k)::int then raise exception 'not enough %', k; end if;
  end loop;
  update plot_state set
    buildings = buildings || building,
    spent = (select coalesce(jsonb_object_agg(key, coalesce((spent->>key)::int, 0) + coalesce((c->>key)::int, 0)), '{}')
             from (select jsonb_object_keys(spent || c) as key) ks)
  where user_id = auth.uid();
end $$;

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.study_sessions enable row level security;
alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.buildings enable row level security;
alter table public.plot_state enable row level security;
alter table public.feed_events enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;

create policy "read groupmates" on public.profiles for select using (is_groupmate(id));
create policy "edit self" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "members read group" on public.groups for select using (
  exists (select 1 from group_members where group_id = id and user_id = auth.uid()));
create policy "members read members" on public.group_members for select using (is_groupmate(user_id));
-- Joining by invite code goes through an edge function using the service key, not a client insert.

-- Private habits stay private; summary habits are visible but their logs are not.
create policy "own habits" on public.habits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "friends see shared habits" on public.habits for select using (
  visibility <> 'private' and is_groupmate(user_id));

create policy "own logs" on public.habit_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "friends see shared logs" on public.habit_logs for select using (
  is_groupmate(user_id) and exists (select 1 from habits h where h.id = habit_id and h.visibility = 'friends'));

create policy "own sessions" on public.study_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own goals" on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "friends see goals" on public.goals for select using (is_groupmate(user_id));
create policy "own milestones" on public.goal_milestones for all using (
  exists (select 1 from goals g where g.id = goal_id and g.user_id = auth.uid()));

create policy "anyone reads catalogue" on public.buildings for select using (true);
create policy "read plots" on public.plot_state for select using (is_groupmate(user_id));
-- No insert/update policy on plot_state: only build() can change it.

create policy "group reads feed" on public.feed_events for select using (
  exists (select 1 from group_members where group_id = feed_events.group_id and user_id = auth.uid()));
create policy "group reacts" on public.reactions for all using (
  user_id = auth.uid()) with check (user_id = auth.uid()
  and exists (select 1 from feed_events e join group_members m on m.group_id = e.group_id
              where e.id = event_id and m.user_id = auth.uid()));
create policy "group reads reactions" on public.reactions for select using (
  exists (select 1 from feed_events e join group_members m on m.group_id = e.group_id
          where e.id = event_id and m.user_id = auth.uid()));
create policy "group comments" on public.comments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "group reads comments" on public.comments for select using (
  exists (select 1 from feed_events e join group_members m on m.group_id = e.group_id
          where e.id = event_id and m.user_id = auth.uid()));
