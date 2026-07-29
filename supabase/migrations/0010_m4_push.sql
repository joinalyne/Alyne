-- ============================================================================
-- Alyne — M4 migration 0010: push subscriptions and delivery log
--
-- Built to Salomeh's Push Notification Spec, which locks four notifications:
--   1. Partner checked in   (immediate)
--   2. Streak reminder      (19:00 user-local, skipped if already checked in)
--   3. Matched              (immediate)
--   4. Partner returned     (immediate, after 3+ silent days)
--
-- Two tables, because subscriptions and delivery history answer different
-- questions. Subscriptions answer "where do I send"; the log answers "should I
-- send at all", which is what enforces her two hard rules: at most one reminder
-- per day, and nothing during quiet hours.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Subscriptions
--
-- One row per device, not per user: someone may have the PWA on a phone and a
-- laptop, and both should receive. The endpoint is the browser's own unique
-- identifier for a subscription, so it is the natural key.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  -- Set when a push fails permanently, so a dead device stops being retried.
  failed_at  timestamptz
);

create index if not exists push_subs_user on public.push_subscriptions (user_id)
  where failed_at is null;

alter table public.push_subscriptions enable row level security;

create policy "push: read own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push: insert own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

-- Unsubscribing on this device is a legitimate self-serve action, unlike
-- unmatching. A user must always be able to stop notifications.
create policy "push: delete own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 2. Delivery log
--
-- Her spec caps reminders at one per day and forbids anything between 21:30
-- and 08:00 local. Neither rule can be enforced without knowing what was
-- already sent, and "what did we send" is not derivable from anything else.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in
               ('partner_checked_in','streak_reminder','matched','partner_returned')),
  -- The user's LOCAL date, so "one per day" means their day, not a UTC one.
  local_date date not null,
  sent_at    timestamptz not null default now()
);

-- Event notifications are uncapped, because the partner drives them. Reminders
-- are capped at one per local day, which this index enforces rather than
-- trusting the sender to check first.
create unique index if not exists one_reminder_per_local_day
  on public.notification_log (user_id, local_date)
  where kind = 'streak_reminder';

create index if not exists notification_log_user
  on public.notification_log (user_id, sent_at desc);

alter table public.notification_log enable row level security;
-- No policies: written by the send job under the service role, and there is no
-- reason for a user to read their own notification history in the app.


-- ---------------------------------------------------------------------------
-- 3. Quiet hours
--
-- 21:30 to 08:00 in the user's own timezone, per the spec. Expressed once here
-- so the reminder job and the event senders cannot drift apart.
-- ---------------------------------------------------------------------------
create or replace function public.in_quiet_hours(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.id is null then false
    else (now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::time
           >= time '21:30'
      or (now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::time
           < time '08:00'
  end
  from public.profiles p
  where p.id = p_user_id;
$$;

comment on function public.in_quiet_hours(uuid) is
  'True between 21:30 and 08:00 in the user''s own timezone. Spans midnight, '
  'hence the OR rather than a BETWEEN.';


-- ---------------------------------------------------------------------------
-- 4. Who needs the 19:00 reminder
--
-- Returns users who should be nudged right now: it is 19:00 or later locally,
-- they have not checked in today, they are matched, and they have not already
-- had today's reminder.
-- ---------------------------------------------------------------------------
create or replace function public.users_due_streak_reminder()
returns table (user_id uuid, local_date date, streak int, partner_name text)
language sql
stable
security definer
set search_path = public
as $$
  with local as (
    select p.id,
           p.current_streak,
           (now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))       as local_now,
           (now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date as local_today,
           p.last_check_in_date
    from public.profiles p
  )
  select l.id,
         l.local_today,
         l.current_streak,
         partner.display_name
  from local l
  join public.matches m
    on m.status = 'active' and (m.user_a = l.id or m.user_b = l.id)
  join public.profiles partner
    on partner.id = case when m.user_a = l.id then m.user_b else m.user_a end
  where l.local_now::time >= time '19:00'
    -- Quiet hours still win, so a late job cannot wake anyone.
    and l.local_now::time < time '21:30'
    and (l.last_check_in_date is null or l.last_check_in_date < l.local_today)
    and not exists (
      select 1 from public.notification_log n
      where n.user_id = l.id
        and n.kind = 'streak_reminder'
        and n.local_date = l.local_today
    );
$$;

comment on function public.users_due_streak_reminder() is
  'Spec rule 2: nudge at 19:00 local, only if not checked in, only if matched, '
  'at most once per local day, never inside quiet hours.';

revoke all on function public.users_due_streak_reminder() from public, authenticated;
revoke all on function public.in_quiet_hours(uuid) from public;

commit;
