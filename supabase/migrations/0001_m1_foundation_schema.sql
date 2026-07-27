-- ============================================================================
-- Alyne — M1 migration 0001: foundation schema
--
-- Brings the live database up to Alyne-Schema-Proposal, carrying the existing
-- 7 profiles and 5 check-ins across. Nothing is deleted: the old `checkins`
-- table is renamed to `checkins_legacy_20260727` rather than dropped, so this
-- is reversible until someone explicitly drops it.
--
-- Apply via: Supabase Dashboard -> SQL Editor. Runs as one transaction; if any
-- statement fails the whole thing rolls back and the database is untouched.
--
-- Guarded throughout so re-running is safe.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Goal enum
-- ---------------------------------------------------------------------------
do $$ begin
  create type goal as enum
    ('fitness','writing','learning','quitting','mindfulness','other');
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------------
-- 2. profiles — reshape in place so existing rows and their auth links survive
-- ---------------------------------------------------------------------------

-- Renames are guarded individually: a half-applied run can be re-run safely.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'user_id')
  then alter table public.profiles rename column user_id to id; end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'name')
  then alter table public.profiles rename column name to display_name; end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'goal')
  then alter table public.profiles rename column goal to current_goal; end if;
end $$;

-- text -> enum. Verified against live data first: only 'fitness' and
-- 'quitting' are present, both valid members, so the cast cannot fail.
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'current_goal') = 'text'
  then
    alter table public.profiles
      alter column current_goal type goal using nullif(current_goal, '')::goal;
  end if;
end $$;

alter table public.profiles
  add column if not exists email                  text,
  add column if not exists timezone               text not null default 'UTC',
  add column if not exists plan                   text not null default 'free',
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status    text,
  add column if not exists current_period_end     timestamptz,
  add column if not exists current_streak         int  not null default 0,
  add column if not exists last_check_in_date     date,
  add column if not exists is_admin               boolean not null default false,
  add column if not exists created_at             timestamptz not null default now();

comment on column public.profiles.is_admin is
  'Admin override for /admin. Read only via public.is_admin() (security definer) '
  'so RLS policies on this table do not recurse.';
comment on column public.profiles.timezone is
  'IANA tz, drives the streak day boundary. Captured at sign-up from the browser.';

do $$ begin
  alter table public.profiles
    add constraint profiles_plan_check check (plan in ('free','paid'));
exception when duplicate_object then null;
end $$;

-- Partial unique: many rows may have no Stripe customer yet.
create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Primary key on id, if the May table did not already have one.
do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.profiles'::regclass and contype = 'p')
  then alter table public.profiles add primary key (id); end if;
end $$;

-- 1:1 with auth.users, cascading deletes.
do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.profiles'::regclass
                   and contype = 'f' and confrelid = 'auth.users'::regclass)
  then
    alter table public.profiles add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- May left updated_at nullable with no default.
update public.profiles set updated_at = coalesce(updated_at, now());
alter table public.profiles
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- Backfill email from auth (the proposal keeps a copy on the profile).
update public.profiles p
set    email = u.email
from   auth.users u
where  u.id = p.id
  and  p.email is distinct from u.email;


-- ---------------------------------------------------------------------------
-- 3. matches — a partnership between two users
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  goal       goal not null,
  user_a     uuid not null references public.profiles(id) on delete cascade,
  user_b     uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'active'
               check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  ended_at   timestamptz,
  ended_by   text check (ended_by in ('admin','system')),
  check (user_a <> user_b)
);

create index if not exists matches_user_a
  on public.matches (user_a) where status = 'active';
create index if not exists matches_user_b
  on public.matches (user_b) where status = 'active';

-- A user may hold at most one active match on each side. Together with the
-- engine's locking in migration 0003, this is the backstop that makes a
-- double-match impossible even if two enqueues race.
create unique index if not exists one_active_match_per_user_a
  on public.matches (user_a) where status = 'active';
create unique index if not exists one_active_match_per_user_b
  on public.matches (user_b) where status = 'active';


-- ---------------------------------------------------------------------------
-- 4. match_queue — the FIFO waiting room
-- ---------------------------------------------------------------------------
create table if not exists public.match_queue (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  goal        goal not null,
  status      text not null default 'waiting'
                check (status in ('waiting','matched','cancelled')),
  priority    boolean not null default false,
  enqueued_at timestamptz not null default now()
);

comment on column public.match_queue.priority is
  'Paid priority rematch. Set by the enqueue function from profiles.plan, '
  'never by the client — direct writes to this table are denied by RLS.';

-- Abuse guard: one active queue row per user.
create unique index if not exists one_active_queue_per_user
  on public.match_queue (user_id) where status = 'waiting';

-- FIFO lookup: priority band first, arrival order within each band.
create index if not exists queue_fifo
  on public.match_queue (goal, priority desc, enqueued_at) where status = 'waiting';


-- ---------------------------------------------------------------------------
-- 5. check_ins — the daily, streak-driving event
-- ---------------------------------------------------------------------------
create table if not exists public.check_ins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  match_id   uuid references public.matches(id) on delete set null,
  type       text not null check (type in ('photo','voice','text')),
  body       text,
  media_url  text,
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create index if not exists check_ins_user_date
  on public.check_ins (user_id, local_date);

-- Carry the legacy check-ins across.
--
-- NOTE: the live data breaks the proposal's `unique (user_id, local_date)`.
-- Salomeh has two check-ins on 2026-05-17 ("Ran 10k!!!" at 14:29 and "Hi" at
-- 14:39). `distinct on` keeps the EARLIEST per user per day, so the 10k one
-- survives and the "Hi" is left behind in the legacy table — not destroyed.
insert into public.check_ins (user_id, type, body, local_date, created_at)
select distinct on (c.user_id, (c.created_at at time zone 'UTC')::date)
       c.user_id,
       'text',
       c.message,
       (c.created_at at time zone 'UTC')::date,
       c.created_at
from   public.checkins c
where  c.user_id is not null
order  by c.user_id, (c.created_at at time zone 'UTC')::date, c.created_at asc
on conflict (user_id, local_date) do nothing;


-- ---------------------------------------------------------------------------
-- 6. messages — partner chat, kept separate from streak check-ins
--
-- In the proposal, so created here for completeness. No milestone (M1-M4)
-- builds a chat UI, so this table stays empty until chat is scoped and paid
-- for. It costs nothing to have and avoids a later migration.
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_match
  on public.messages (match_id, created_at);


-- ---------------------------------------------------------------------------
-- 7. Backfill streak state from the migrated history
-- ---------------------------------------------------------------------------
update public.profiles p
set    last_check_in_date = s.last_date
from  (select user_id, max(local_date) as last_date
       from   public.check_ins group by user_id) s
where  s.user_id = p.id;

-- Consecutive-day run ending on the user's last check-in (gaps and islands).
with runs as (
  select user_id,
         local_date,
         local_date - (row_number() over (partition by user_id
                                          order by local_date))::int as grp
  from   public.check_ins
),
islands as (
  select user_id, grp, count(*) as len, max(local_date) as ends
  from   runs group by user_id, grp
)
update public.profiles p
set    current_streak = i.len
from   islands i
where  i.user_id = p.id and i.ends = p.last_check_in_date;

-- A streak only stands if the last check-in was today or yesterday. Everyone
-- in the legacy data last checked in during May/June, so this correctly zeroes
-- them rather than showing a stale run they have long since broken.
update public.profiles
set    current_streak = 0
where  last_check_in_date is null
   or  last_check_in_date < current_date - 1;


-- ---------------------------------------------------------------------------
-- 8. Retire the legacy table (renamed, not dropped)
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'checkins')
  then
    alter table public.checkins rename to checkins_legacy_20260727;
  end if;
end $$;

comment on table public.checkins_legacy_20260727 is
  'Pre-M1 check-ins, superseded by public.check_ins on 2026-07-27. Retained so '
  'the migration is reversible, including the same-day duplicate that the new '
  'unique (user_id, local_date) constraint could not accept. Safe to drop once '
  'M1 is signed off.';


-- ---------------------------------------------------------------------------
-- 9. Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('check-ins', 'check-ins', false)
on conflict (id) do nothing;

commit;


-- ============================================================================
-- Verification — run separately after committing.
--
--   select id, display_name, email, current_goal, plan, timezone,
--          current_streak, last_check_in_date, is_admin
--   from public.profiles order by display_name;
--
--   select count(*) as migrated from public.check_ins;          -- expect 4
--   select count(*) as legacy   from public.checkins_legacy_20260727; -- expect 5
--
-- 4 not 5 is correct: the 2026-05-17 duplicate is intentionally left behind.
-- ============================================================================
