// ============================================================================
// POST /api/send-notifications
//
// The push sender. Scans for anything due, sends it, and records what was sent.
//
// Called on a schedule rather than fired from a database trigger. Postgres
// cannot make an outbound HTTP request without pg_net, and the events that
// matter belong to the OTHER user: when Ada checks in, it is Bo who must be
// told, so the acting client cannot be the one to send. A short interval is a
// deliberate trade — "immediate" in the spec becomes "within a couple of
// minutes", which is the right cost for not depending on a network extension
// inside the database.
//
// Protected by CRON_SECRET, because anything that can make the app send push
// notifications to arbitrary users must not be open to the internet.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import {
  partnerCheckedIn, streakReminder, matched, partnerReturned,
  type PushPayload, type NotificationKind,
} from './_notifications.js';
import { GOAL_LABELS } from './_email.js';

type Req = { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (body: unknown) => void };

/** How far back to look. Comfortably wider than the schedule, since the log
 *  prevents duplicates and a missed run is worse than an overlapping one. */
const LOOKBACK_MINUTES = 15;

type Subscription = { endpoint: string; p256dh: string; auth: string };

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim();
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const vapidPublic =
    process.env.VITE_VAPID_PUBLIC_KEY?.trim() ||
    'BDRFWAE0GPW30lA8d1eSwO1ZKRfwsocZdyzox-JB7tjTI0tNV0Y5htaQjlVsC35R8dPPm-MoJQbRWub2ugKNdLg';
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@joinalyne.com';
  const cronSecret = process.env.CRON_SECRET?.trim();

  // Vercel cron issues GET, not POST. Handlers that only accept POST are a
  // recurring way to ship a cron that silently never runs.
  const auth = req.headers.authorization;
  const provided = typeof auth === 'string' ? auth.replace(/^Bearer /, '') : null;
  if (cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase service credentials are not configured' });
  }
  if (!vapidPrivate) {
    return res.status(503).json({ error: 'VAPID_PRIVATE_KEY is not configured' });
  }

  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();

  const sent: Record<string, number> = {};
  const record = (kind: string) => { sent[kind] = (sent[kind] ?? 0) + 1; };

  /** Send to every live device for a user, and log it once. */
  async function notify(userId: string, kind: NotificationKind, payload: PushPayload, localDate: string) {
    // Claim first. The unique index on (user_id, local_date) for reminders means
    // a second concurrent run loses the insert and sends nothing, rather than
    // both runs sending and only then noticing.
    const { error: logError } = await db
      .from('notification_log')
      .insert({ user_id: userId, kind, local_date: localDate });
    if (logError) return; // already sent, or capped

    const { data: subs } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
      .is('failed_at', null);

    for (const sub of (subs ?? []) as Subscription[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        record(kind);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404 and 410 mean the browser has discarded this subscription. Retrying
        // for ever would be pointless, so retire it.
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions')
            .update({ failed_at: new Date().toISOString() })
            .eq('endpoint', sub.endpoint);
        } else {
          console.error('[push] send failed', status, (err as Error).message);
        }
      }
    }
  }

  const localDateFor = (timezone: string | null) =>
    new Date().toLocaleDateString('en-CA', { timeZone: timezone || 'UTC' });

  // ── 1 and 4: a partner checked in, or came back after a silence ────────────
  const { data: recentCheckIns } = await db
    .from('check_ins')
    .select('user_id, created_at, local_date')
    .gte('created_at', since);

  for (const checkIn of recentCheckIns ?? []) {
    const { data: match } = await db
      .from('matches')
      .select('user_a, user_b')
      .eq('status', 'active')
      .or(`user_a.eq.${checkIn.user_id},user_b.eq.${checkIn.user_id}`)
      .maybeSingle();
    if (!match) continue;

    const recipientId = match.user_a === checkIn.user_id ? match.user_b : match.user_a;

    const { data: people } = await db
      .from('profiles')
      .select('id, display_name, timezone, current_streak, last_check_in_date')
      .in('id', [checkIn.user_id, recipientId]);

    const actor = people?.find((p) => p.id === checkIn.user_id);
    const recipient = people?.find((p) => p.id === recipientId);
    if (!actor || !recipient) continue;

    // Notification 4 takes precedence over 1: someone returning after a silence
    // is the more meaningful event, and sending both would be two pushes about
    // one check-in.
    const previous = actor.last_check_in_date;
    const gapDays = previous
      ? Math.round(
          (Date.parse(checkIn.local_date) - Date.parse(previous)) / 86_400_000,
        )
      : 99;

    const payload =
      gapDays >= 3
        ? partnerReturned(actor.display_name ?? 'Your partner')
        : partnerCheckedIn(actor.display_name ?? 'Your partner', actor.current_streak ?? 0);

    await notify(
      recipientId,
      gapDays >= 3 ? 'partner_returned' : 'partner_checked_in',
      payload,
      localDateFor(recipient.timezone),
    );
  }

  // ── 3: newly matched ──────────────────────────────────────────────────────
  const { data: newMatches } = await db
    .from('matches')
    .select('id, goal, user_a, user_b, created_at')
    .eq('status', 'active')
    .gte('created_at', since);

  for (const m of newMatches ?? []) {
    const { data: pair } = await db
      .from('profiles')
      .select('id, display_name, timezone')
      .in('id', [m.user_a, m.user_b]);

    for (const person of pair ?? []) {
      const other = pair?.find((p) => p.id !== person.id);
      await notify(
        person.id,
        'matched',
        matched(other?.display_name ?? 'your partner', GOAL_LABELS[m.goal] ?? 'your goal'),
        localDateFor(person.timezone),
      );
    }
  }

  // ── 2: the 19:00 nudge ────────────────────────────────────────────────────
  const { data: due } = await db.rpc('users_due_streak_reminder');

  for (const person of (due ?? []) as
    { user_id: string; local_date: string; streak: number; partner_name: string | null }[]) {
    // Her rule: a match today is the day's touch, so the nudge is dropped.
    const { data: matchedToday } = await db
      .from('notification_log')
      .select('id')
      .eq('user_id', person.user_id)
      .eq('kind', 'matched')
      .eq('local_date', person.local_date)
      .maybeSingle();
    if (matchedToday) continue;

    await notify(
      person.user_id,
      'streak_reminder',
      streakReminder(person.streak ?? 0, person.partner_name ?? 'Your partner'),
      person.local_date,
    );
  }

  return res.status(200).json({ ok: true, sent });
}
