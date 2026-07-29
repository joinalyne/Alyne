// ============================================================================
// POST /api/send-match-email   { matchId }
//
// Sends the match notification to both partners, exactly once per pairing.
//
// This is the app's first server-side code — Alyne is otherwise a pure static
// SPA. It exists because Resend's API key must never reach the browser, and
// because sending to *both* users means writing on behalf of someone who is
// not the caller.
//
// Idempotency lives in the database, not here: claim_match_email() stamps
// match_email_sent_at in a single conditional UPDATE, so when both partners
// hit this endpoint at once exactly one of them wins the claim. See 0005.
// ============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
// The .js extension is required, not optional. package.json sets
// "type": "module", so Node ESM will not resolve an extensionless specifier at
// runtime even though TypeScript accepts one. Without it the whole function
// fails to import and every request returns FUNCTION_INVOCATION_FAILED, before
// the handler runs — which looks like a broken endpoint rather than a bad import.
import { render, matchNotificationVars } from './_email.js';

type Req = { method?: string; body?: unknown; headers: Record<string, string | string[] | undefined> };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
};

// Read at runtime, so Vercel's import tracing cannot see it and would not bundle
// `emails/` at all. vercel.json therefore carries `includeFiles: "emails/**"` for
// this function; without it the first real send fails with ENOENT.
//
// That entry cannot be commented in place. vercel.json is validated against a
// strict schema that rejects unknown properties, including a "//" key used as a
// comment — doing so fails every build with "Schema verification failed" while
// local builds stay green, because nothing local reads vercel.json.
const TEMPLATE_PATH = join(process.cwd(), 'emails', 'match-notification.html');

/** Read once per cold start rather than per request. */
let cachedTemplate: string | null = null;
function template(): string {
  if (cachedTemplate === null) cachedTemplate = readFileSync(TEMPLATE_PATH, 'utf8');
  return cachedTemplate;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() ?? process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  // APP_URL and EMAIL_FROM default rather than being required.
  //
  // Neither is secret and both are now settled facts: the app lives at the root
  // of app.joinalyne.com, and mail sends from the verified hello@ address. Only
  // RESEND_API_KEY genuinely has to be configured, because it is the one value
  // that must not sit in the repository.
  //
  // That matters practically. Production environment variables can only be set
  // by a Vercel team Owner or Admin, and I am a Developer, so every required
  // variable is a round trip to Salomeh. Defaulting these takes that from three
  // variables to one. The env var still wins where it is set, which is how
  // preview deployments point at a preview host instead of production.
  const appUrl = process.env.APP_URL?.trim() || 'https://app.joinalyne.com';
  const from = process.env.EMAIL_FROM?.trim() || 'Alyne <hello@joinalyne.com>';

  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ error: 'Supabase env vars are not configured' });
  }
  if (!resendKey) {
    // Explicit rather than a silent success: a missing key must not look like
    // a delivered email.
    return res.status(503).json({ error: 'RESEND_API_KEY is not configured' });
  }

  const authHeader = req.headers.authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer /, '') : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const matchId = (req.body as { matchId?: string } | undefined)?.matchId;
  if (!matchId) return res.status(400).json({ error: 'matchId is required' });

  // Act as the calling user, not the service role. claim_match_email() checks
  // auth.uid() is a participant, so this endpoint cannot be used to make Alyne
  // email arbitrary people.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('claim_match_email', { p_match_id: matchId });
  if (error) {
    console.error('[send-match-email] claim failed:', error.message);
    return res.status(400).json({ error: error.message });
  }

  const claim = Array.isArray(data) ? data[0] : null;
  if (!claim) {
    // Already sent, or the caller is not in this match. Both are fine and both
    // look the same to the client on purpose.
    return res.status(200).json({ sent: false, reason: 'already-sent-or-not-a-participant' });
  }

  const html = template();

  const recipients = [
    { to: claim.user_a_email, name: claim.user_a_name, partner: claim.user_b_name },
    { to: claim.user_b_email, name: claim.user_b_name, partner: claim.user_a_name },
  ].filter((r) => !!r.to);

  try {
    const results = await Promise.all(
      recipients.map(async (r) => {
        const { html: body, missing } = render(
          html,
          matchNotificationVars({
            appUrl,
            recipientName: r.name,
            partnerName: r.partner,
            goal: claim.goal,
          }),
        );

        // Refuse rather than send an email with literal {{placeholders}} in it.
        if (missing.length) {
          throw new Error(`Template variables not supplied: ${missing.join(', ')}`);
        }

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: r.to,
            subject: `You've been matched with ${r.partner ?? 'your partner'}`,
            html: body,
          }),
        });

        if (!response.ok) {
          throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
        }
        return r.to;
      }),
    );

    return res.status(200).json({ sent: true, recipients: results });
  } catch (err) {
    // Hand the claim back so a retry can send, rather than leaving the pairing
    // permanently marked as notified when nothing arrived.
    await supabase.rpc('release_match_email', { p_match_id: matchId });
    const message = err instanceof Error ? err.message : 'Unknown Resend failure';
    console.error('[send-match-email] send failed, claim released:', message);
    return res.status(502).json({ error: message });
  }
}
