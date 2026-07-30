import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client + data access.
//
// The pre-M1 version of this file exported `SupabaseClient | null` and had every
// helper no-op when env vars were missing, so the UI kept working on local state
// in "demo mode". That is dangerous now the app is real: a missing or misspelt
// env var in production would look like a working app that silently saves
// nothing. Fail loudly at startup instead.
//
// .trim() because a key pasted or CLI-added into an env store routinely carries
// a trailing newline, which produces a baffling 401 at runtime.
// ─────────────────────────────────────────────────────────────────────────────

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).',
  );
}

export const supabase = createClient(url, anonKey);

/** The six goals, matching the `goal` enum in the database. */
export type Goal =
  | 'fitness'
  | 'writing'
  | 'learning'
  | 'quitting'
  | 'mindfulness'
  | 'other';

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in.');
  return data.user.id;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Send a password-reset email. The link returns the user to /reset-password. */
export async function requestPasswordReset(email: string): Promise<boolean> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) console.error('[supabase] resetPasswordForEmail failed:', error.message);
  return !error;
}

/** Set a new password (valid during the recovery session from the email link). */
export async function updatePassword(newPassword: string): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) console.error('[supabase] updateUser(password) failed:', error.message);
  return !error;
}

// ── Profile ──────────────────────────────────────────────────────────────────

/**
 * Create the profile row if this user does not have one yet.
 *
 * Timezone is captured from the browser because it drives the streak day
 * boundary: `check_ins.local_date` is the user's local date, so a UTC default
 * would roll the streak over at the wrong moment for anyone west of Greenwich
 * — which is most of this user base.
 */
export async function ensureProfile(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // Still called on sign-in even though 0013 creates the row on signup. It
  // repairs anyone who predates that trigger, or whose insert was swallowed by
  // its exception handler, and it is the only place the browser's timezone is
  // known.
  //
  // Two statements rather than one upsert, and that is deliberate.
  //
  // Migration 0004 restricts writes to `profiles` with column-level GRANTs, so
  // a user cannot set their own is_admin or plan. Postgres requires *table*-level
  // UPDATE privilege for `ON CONFLICT DO UPDATE`, and column-level grants do not
  // satisfy it, so a plain upsert fails with 42501. `ignoreDuplicates` compiles
  // to `ON CONFLICT DO NOTHING`, which needs only INSERT.
  const { error: insertError } = await supabase.from('profiles').upsert(
    { id: user.id, email: user.email ?? null, timezone },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (insertError) {
    console.error('[supabase] ensureProfile insert failed:', insertError.message);
    return;
  }

  // Keep the timezone current for a user who has moved, which the
  // do-nothing insert above will not have touched for an existing profile.
  const { error: tzError } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', user.id);
  if (tzError) console.error('[supabase] ensureProfile timezone failed:', tzError.message);
}

/**
 * Update the user's display name. True only if a row was actually written.
 *
 * `.select()` is load-bearing, not decoration. An UPDATE matching zero rows is
 * not an error in Postgres, so without it this returned true when the profile
 * did not exist, the name silently vanished, and the route guard then bounced
 * the user back to profile setup for ever. That was the fresh-signup bug
 * Salomeh hit. Asking for the changed rows back is what makes the failure
 * visible.
 */
export async function updateDisplayName(name: string): Promise<boolean> {
  const id = await requireUserId();
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('[supabase] updateDisplayName failed:', error.message);
    return false;
  }
  if (!data?.length) {
    console.error('[supabase] updateDisplayName matched no profile row for', id);
    return false;
  }
  return true;
}

/** Persist the chosen goal. True only if a row was actually written. */
export async function updateGoal(goal: Goal): Promise<boolean> {
  const id = await requireUserId();
  const { data, error } = await supabase
    .from('profiles')
    .update({ current_goal: goal, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('[supabase] updateGoal failed:', error.message);
    return false;
  }
  if (!data?.length) {
    console.error('[supabase] updateGoal matched no profile row for', id);
    return false;
  }
  return true;
}

/**
 * Upload a new avatar to the `avatars` Storage bucket and save its public URL
 * on `profiles.avatar_url`. Returns the URL to show, or null on failure.
 *
 * The `{user_id}/` prefix is load-bearing: the storage RLS policy checks the
 * first path segment against auth.uid(). Flatten the path and uploads 403.
 */
export async function uploadAvatar(file: File): Promise<string | null> {
  const id = await requireUserId();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) {
    console.error('[supabase] avatar upload failed:', uploadError.message);
    return null;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (profileError) console.error('[supabase] avatar_url save failed:', profileError.message);

  return publicUrl;
}

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * Join the queue and pair with the next waiting user on the same goal.
 * Returns the match id, or null if nobody is available and the caller is now
 * waiting. Safe to call repeatedly: an already-matched user gets their
 * existing match back rather than a second one.
 */
export async function enqueueAndMatch(): Promise<string | null> {
  const { data, error } = await supabase.rpc('enqueue_and_match');
  if (error) {
    console.error('[supabase] enqueue_and_match failed:', error.message);
    throw new Error(error.message);
  }
  return (data as string | null) ?? null;
}

/** Cancel a pending search. */
export async function leaveQueue(): Promise<void> {
  const { error } = await supabase.rpc('leave_queue');
  if (error) console.error('[supabase] leave_queue failed:', error.message);
}

export type PartnerSnapshot = {
  matchId: string;
  goal: Goal;
  matchedSince: string;
  partner: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    currentStreak: number;
    lastCheckInDate: string | null;
  };
  /** The partner's most recent check-in, if they have one. */
  partnerLatestCheckIn: {
    type: 'photo' | 'voice' | 'text';
    body: string | null;
    mediaUrl: string | null;
    createdAt: string;
  } | null;
};

/**
 * Everything Home and Matched need about the current partnership, or null if
 * the user is not currently matched.
 *
 * Deliberately three plain queries rather than PostgREST embeds: embedded joins
 * have a habit of returning stale values straight after a write, and the
 * partner's streak is read immediately after a check-in.
 */
export async function getPartnerSnapshot(): Promise<PartnerSnapshot | null> {
  const me = await requireUserId();

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, goal, user_a, user_b, created_at')
    .eq('status', 'active')
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .maybeSingle();

  if (matchError) {
    console.error('[supabase] match lookup failed:', matchError.message);
    return null;
  }
  if (!match) return null;

  const partnerId = match.user_a === me ? match.user_b : match.user_a;

  const { data: partner, error: partnerError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, current_streak, last_check_in_date')
    .eq('id', partnerId)
    .maybeSingle();

  if (partnerError || !partner) {
    console.error('[supabase] partner lookup failed:', partnerError?.message);
    return null;
  }

  const { data: latest } = await supabase
    .from('check_ins')
    .select('type, body, media_url, created_at')
    .eq('user_id', partnerId)
    .order('local_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    matchId: match.id,
    goal: match.goal as Goal,
    matchedSince: match.created_at,
    partner: {
      id: partner.id,
      displayName: partner.display_name,
      avatarUrl: partner.avatar_url,
      currentStreak: partner.current_streak,
      lastCheckInDate: partner.last_check_in_date,
    },
    partnerLatestCheckIn: latest
      ? {
          type: latest.type,
          body: latest.body,
          mediaUrl: latest.media_url,
          createdAt: latest.created_at,
        }
      : null,
  };
}

/**
 * Ask the server to send the match notification.
 *
 * Called by BOTH partners when they land on /matched. That is deliberate: the
 * match is created inside a Postgres function that cannot send email, and if
 * only the client that created it were responsible, closing that tab would
 * lose the email. Sending twice is prevented in the database rather than here
 * — see migration 0005 — so two callers produce exactly one email.
 *
 * Never throws: a failed notification must not stop someone seeing their new
 * partner.
 */
export async function notifyMatch(matchId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const response = await fetch('/api/send-match-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId }),
    });

    if (response.status === 404) {
      // `vite dev` does not serve Vercel functions, so this is expected locally
      // and must not look like a fault.
      console.info('[match-email] endpoint not available in this environment');
      return;
    }
    if (!response.ok) {
      console.error('[match-email] send failed:', response.status, await response.text());
    }
  } catch (err) {
    console.error('[match-email] request failed:', err);
  }
}

export type CheckInType = 'photo' | 'voice' | 'text';

/**
 * File extension for a recorded blob, from its actual MIME type.
 *
 * Exported so it can be tested directly: browsers disagree about audio
 * containers, and getting this wrong stores a file whose name contradicts its
 * contents, which then fails to play back.
 */
export function extensionForMimeType(mimeType: string, kind: CheckInType): string {
  const type = (mimeType || '').toLowerCase();
  if (type.includes('webm')) return 'webm';
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
  if (type.includes('aac')) return 'aac';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('mpeg')) return 'mp3';
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('heic')) return 'heic';
  // Last resort, by kind rather than a meaningless .bin.
  return kind === 'voice' ? 'webm' : 'jpg';
}

export type CheckInResult =
  | { ok: true }
  | { ok: false; alreadyToday: true }
  | { ok: false; alreadyToday: false; message: string };

/**
 * Save today's check-in.
 *
 * `local_date` is the user's LOCAL date, not UTC. It is the streak day
 * boundary, so using toISOString() here would roll a Vancouver user over seven
 * hours early. en-CA because it formats as ISO.
 *
 * One per local day is enforced by a unique index rather than by checking
 * first, so a double tap cannot slip two rows through. 23505 is that index
 * firing and is reported as a normal outcome, not an error.
 */
export async function saveCheckIn(
  type: CheckInType,
  body: string,
  media?: File | Blob,
): Promise<CheckInResult> {
  try {
    const userId = await requireUserId();
    const localDate = new Date().toLocaleDateString('en-CA');

    let mediaUrl: string | null = null;
    if (media) {
      // The {user_id}/ prefix is load-bearing: storage RLS checks the first
      // path segment against auth.uid().
      // Derived from the blob's own type, not assumed. Safari's MediaRecorder
      // cannot produce webm and returns mp4/aac, so hardcoding webm would store
      // iPhone recordings under a filename that misrepresents their contents.
      const extension =
        media instanceof File
          ? (media.name.split('.').pop() ?? 'bin')
          : extensionForMimeType(media.type, type);
      const path = `${userId}/${localDate}-${type}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('check-ins')
        .upload(path, media, { upsert: true, contentType: media.type || undefined });

      if (uploadError) {
        return { ok: false, alreadyToday: false, message: 'Could not upload that. Please try again.' };
      }
      // A private bucket, so store the path. A signed URL is minted on read.
      mediaUrl = path;
    }

    const { error } = await supabase.from('check_ins').insert({
      user_id: userId,
      match_id: null,
      type,
      body: body.trim() || null,
      media_url: mediaUrl,
      local_date: localDate,
    });

    if (error) {
      if (error.code === '23505') return { ok: false, alreadyToday: true };
      return { ok: false, alreadyToday: false, message: error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      alreadyToday: false,
      message: err instanceof Error ? err.message : 'Something went wrong.',
    };
  }
}

/**
 * A short-lived URL for private check-in media. The bucket is not public, so
 * the stored path cannot be rendered directly.
 */
export async function signedCheckInUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('check-ins')
    .createSignedUrl(path, 60 * 60);
  if (error) {
    console.error('[supabase] could not sign check-in media URL:', error.message);
    return null;
  }
  return data.signedUrl;
}

// ── Admin ────────────────────────────────────────────────────────────────────

export type AdminPair = {
  id: string;
  goal: string;
  created_at: string;
  a_name: string | null;
  a_streak: number;
  a_last: string | null;
  b_name: string | null;
  b_streak: number;
  b_last: string | null;
  days_silent: number;
};

export type AdminQueueEntry = {
  id: string;
  name: string | null;
  goal: string;
  priority: boolean;
  enqueued_at: string;
};

export type AdminOverview = {
  flagged: AdminPair[];
  active: AdminPair[];
  queue: AdminQueueEntry[];
  counts: { active: number; flagged: number; waiting: number };
};

/** Everything /admin shows, in one guarded round trip. Admin only. */
export async function getAdminOverview(): Promise<AdminOverview | null> {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) {
    console.error('[admin] overview failed:', error.message);
    return null;
  }
  return data as AdminOverview;
}

/**
 * End a pairing. Both users' streaks reset when they are NEXT matched, not
 * here, per Salomeh's spec: the reset belongs to the new pairing.
 */
export async function endMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase.rpc('end_match', { match_id: matchId });
  if (error) console.error('[admin] end_match failed:', error.message);
  return !error;
}

/**
 * Switch goal. Ends the current pairing and requeues for the new goal, per
 * Salomeh's decision of 2026-07-28. Returns a match id if someone was already
 * waiting on the new goal, otherwise null.
 *
 * Destructive, so the caller MUST warn first. Streaks reset on the next
 * pairing rather than here, which is why someone who switches and waits keeps
 * their number for now.
 */
export async function changeGoal(goal: Goal): Promise<{ ok: boolean; matchId: string | null }> {
  const { data, error } = await supabase.rpc('change_goal', { p_goal: goal });
  if (error) {
    console.error('[supabase] change_goal failed:', error.message);
    return { ok: false, matchId: null };
  }
  return { ok: true, matchId: (data as string | null) ?? null };
}

export type RequeueNotice = { reason: 'admin' | 'goal_change'; matchId: string };

/**
 * Why this user is back in the queue, if they should be told.
 *
 * Null when they caused it themselves by changing their own goal, or when they
 * have already been matched again. See migration 0014: without the initiator
 * check, the person who changed their goal would read their own action
 * described as their partner's.
 */
export async function getRequeueNotice(): Promise<RequeueNotice | null> {
  const { data, error } = await supabase.rpc('requeue_notice');
  if (error) {
    console.error('[supabase] requeue_notice failed:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.reason || !row?.match_id) return null;
  return { reason: row.reason as 'admin' | 'goal_change', matchId: row.match_id };
}
