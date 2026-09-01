-- ============================================================================
-- Alyne — migration 0020: one notification per event, not one per cron run
--
-- 0010 capped reminders at one per local day and left the event notifications
-- uncapped, on the reasoning that "the partner drives them". That reasoning is
-- wrong, because the cron does not see events — it sees a WINDOW. The job runs
-- every 5 minutes and looks back 15, so a single check-in is inside the window
-- for three consecutive runs, and the sender's only defence against a duplicate
-- is the insert into this table failing. With no index covering
-- partner_checked_in, nothing failed, and Kane's one check-in reached Salomeh's
-- lock screen three times, ten minutes apart. Confirmed in the live log: 23
-- (user, kind, local_date) groups with 2-3 sends each, going back to 2 August.
--
-- The overlapping window is deliberate and stays: a missed run is worse than an
-- overlapping one. What was missing is a key to dedupe against.
--
-- The local day is the wrong key for these. It is right for a reminder, whose
-- natural identity IS the day, but an event notification is about one specific
-- check-in or one specific pairing, and the day is only a proxy for it — one
-- that breaks in both directions. It over-suppresses when a recipient's local
-- date spans two of the actor's days, and it under-suppresses on a rematch,
-- where a second genuine pairing on the same day must still be announced.
--
-- So dedupe on the source row itself. Deliberately NOT keyed on kind as well:
-- her spec says notification 4 takes precedence over notification 1, never
-- both, so a second push about a check-in already announced is a bug whatever
-- it is labelled.
-- ============================================================================

begin;

alter table public.notification_log
  add column if not exists source_id uuid;

comment on column public.notification_log.source_id is
  'The row that caused this notification: check_ins.id for partner_checked_in '
  'and partner_returned, matches.id for matched. Null for streak_reminder and '
  'inactive_nudge, which are driven by a date rather than by an event, and for '
  'every row written before this migration.';

-- Partial, so the historical rows (all null) need no backfill and no deletion.
-- The duplicates already logged are left in place: they are the evidence of
-- what was actually sent, and rewriting a delivery log to look tidier is not
-- this migration's business.
create unique index if not exists one_notification_per_source_event
  on public.notification_log (user_id, source_id)
  where source_id is not null;

commit;
