import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client + profile helpers.
//
// Works as soon as env vars exist (Vercel project settings or .env.local):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// Until then (and until the `profiles` table from Alyne-Schema-Proposal.md is
// created), every helper no-ops gracefully so the UI keeps working with local
// state only.
//
// TODO(Jerome): auth wiring (sign-up/log-in, sessions, verification) lives with
// you — these helpers assume an authenticated user and just touch `profiles`
// and Storage. Swap `DEMO_USER_ID` for the real session user id when auth lands.
// ─────────────────────────────────────────────────────────────────────────────

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/** TODO(Jerome): replace with the authenticated user's id from the session. */
const DEMO_USER_ID = 'demo-user';

async function currentUserId(): Promise<string> {
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) return data.user.id;
  }
  return DEMO_USER_ID;
}

/** Send a password-reset email. The link returns the user to /reset-password. */
export async function requestPasswordReset(email: string): Promise<boolean> {
  if (!supabase) {
    console.info('[supabase] not configured — reset email not sent (demo mode)');
    return true; // let the UI show the confirmation state in demo mode
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) console.error('[supabase] resetPasswordForEmail failed:', error.message);
  return !error;
}

/** Set a new password (valid during the recovery session from the email link). */
export async function updatePassword(newPassword: string): Promise<boolean> {
  if (!supabase) {
    console.info('[supabase] not configured — password not updated (demo mode)');
    return true;
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) console.error('[supabase] updateUser(password) failed:', error.message);
  return !error;
}

/** Update the user's display name on `profiles`. Returns true on success. */
export async function updateDisplayName(name: string): Promise<boolean> {
  if (!supabase) {
    console.info('[supabase] not configured — display name saved locally only');
    return false;
  }
  const id = await currentUserId();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[supabase] updateDisplayName failed:', error.message);
  return !error;
}

/**
 * Upload a new avatar to the `avatars` Storage bucket and save its public URL
 * on `profiles.avatar_url`. Returns the URL to show, or null on failure.
 */
export async function uploadAvatar(file: File): Promise<string | null> {
  if (!supabase) {
    console.info('[supabase] not configured — avatar previewed locally only');
    return null;
  }
  const id = await currentUserId();
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
