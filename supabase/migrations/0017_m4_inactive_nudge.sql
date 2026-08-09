-- ============================================================================
-- Alyne — M4 migration 0017: the inactive-partner nudge
--
-- Salomeh's spec: sent to the ACTIVE user when their partner has been silent for
-- three or more days, and the pair is simultaneously flagged in /admin. Email
-- only, deliberately not push, since her spec reserves push for the partner or
-- the streak and this is neither.
--
-- Frequency is the delicate part. Her stated principle is no nagging, and a
-- three-day silence often becomes a two-week one, so a daily email would be
-- exactly the "we miss you" spam she ruled out. Capped at one per silence
-- episode: sending again requires either a longer gap or a fresh silence.
-- ============================================================================

begin;

-- notification_log already carries the four push kinds. The nudge is logged in
-- the same place so "what have we sent this person" stays one question with one
-- answer.
alter table public.notification_log
  drop constraint if exists notification_log_kind_check;

alter table public.notification_log
  add constraint notification_log_kind_check check (kind in (
    'partner_checked_in', 'streak_reminder', 'matched', 'partner_returned',
    'inactive_nudge'
  ));


-- ---------------------------------------------------------------------------
-- Who should be nudged right now.
--
-- Returns the ACTIVE partner as the recipient, with the silent partner's details
-- for the copy. Both avatars are returned because the template shows the pair,
-- and both names because it addresses one and names the other.
-- ---------------------------------------------------------------------------
create or replace function public.pairs_needing_nudge()
returns table (
  match_id          uuid,
  recipient_id      uuid,
  recipient_name    text,
  recipient_email   text,
  recipient_avatar  text,
  partner_name      text,
  partner_avatar    text,
  days_silent       int
)
language sql
stable
security definer
set search_path = public
as $$
  with sides as (
    -- Each active pairing twice, once from each person's point of view, so the
    -- same query can find either partner going quiet.
    select m.id, m.user_a as me, m.user_b as them from public.matches m where m.status = 'active'
    union all
    select m.id, m.user_b as me, m.user_a as them from public.matches m where m.status = 'active'
  )
  select s.id,
         me.id, me.display_name, me.email, me.avatar_url,
         them.display_name, them.avatar_url,
         -- Measured in the SILENT person's own local days, which is what makes
         -- "three days" mean the same thing wherever they are.
         (((now() at time zone coalesce(nullif(them.timezone, ''), 'UTC'))::date)
           - them.last_check_in_date)::int
  from sides s
  join public.profiles me   on me.id = s.me
  join public.profiles them on them.id = s.them
  where me.email is not null
    -- The recipient must be the ACTIVE one. Nudging someone about their partner
    -- while they are also absent would be nagging them about their own silence.
    and me.last_check_in_date is not null
    and me.last_check_in_date
          >= ((now() at time zone coalesce(nullif(me.timezone, ''), 'UTC'))::date - 1)
    -- And the partner genuinely silent for three days or more.
    and them.last_check_in_date is not null
    and (((now() at time zone coalesce(nullif(them.timezone, ''), 'UTC'))::date)
          - them.last_check_in_date) >= 3
    -- One per silence episode rather than one per day. Her principle is no
    -- nagging, and a three-day gap often becomes a fortnight.
    and not exists (
      select 1 from public.notification_log n
      where n.user_id = me.id
        and n.kind = 'inactive_nudge'
        and n.sent_at > now() - interval '7 days'
    );
$$;

comment on function public.pairs_needing_nudge() is
  'Active users whose partner has been silent 3+ local days, excluding anyone '
  'nudged in the past week. Recipient is the one still showing up.';

revoke all on function public.pairs_needing_nudge() from public, authenticated, anon;

commit;
