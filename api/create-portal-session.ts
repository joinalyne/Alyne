// ============================================================================
// POST /api/create-portal-session
//
// Sends a paying user to Stripe's Customer Portal to change card details or
// cancel. Salomeh configured it to return to /settings with plan switching
// disabled, so cancelling and updating payment are the only actions available.
//
// Nothing here writes billing state. Whatever the user does in the portal comes
// back as a webhook, which is the single writer. That is deliberate: if this
// endpoint also wrote, the two could disagree and the portal would be the one
// without a signature to prove it.
// ============================================================================

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { stripeModeFault } from './_stripe';

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};
type Res = { status: (code: number) => Res; json: (body: unknown) => void };

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() ?? process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  const appUrl = process.env.APP_URL?.trim() || 'https://app.joinalyne.com';

  if (!secretKey) return res.status(503).json({ error: 'Stripe is not configured' });

  // A customer id belongs to one Stripe account. Opening the portal with a key
  // from the other one fails as "no such customer", which reads like a missing
  // subscription rather than a misconfigured deployment.
  const modeFault = stripeModeFault(secretKey, process.env.VERCEL_ENV);
  if (modeFault) {
    console.error('[stripe] refusing to open the billing portal:', modeFault);
    return res.status(503).json({ error: 'Billing management is temporarily unavailable' });
  }

  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ error: 'Supabase env vars are not configured' });
  }

  const authHeader = req.headers.authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer /, '') : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return res.status(401).json({ error: 'Not signed in' });

  // Read the customer id under the caller's own RLS, so this cannot be used to
  // open somebody else's billing portal by guessing an id.
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return res.status(409).json({ error: 'No subscription to manage' });
  }

  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[stripe] portal session failed:', (err as Error).message);
    return res.status(502).json({ error: 'Could not open the billing portal' });
  }
}
