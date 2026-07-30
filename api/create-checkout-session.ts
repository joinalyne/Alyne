// ============================================================================
// POST /api/create-checkout-session   { billing: 'monthly' | 'annual' }
//
// Starts a Stripe Checkout Session with the 7 day trial Salomeh specified.
//
// Server-side because the price IDs and secret key must not reach the browser,
// and because the customer must be tied to the authenticated user rather than to
// whatever the client claims. The user id travels in metadata AND
// client_reference_id, so the webhook can resolve it even on the very first
// event, before any customer id is stored against the profile.
// ============================================================================

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

type Req = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type Res = { status: (code: number) => Res; json: (body: unknown) => void };

const TRIAL_DAYS = 7;

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const monthly = process.env.STRIPE_PRICE_MONTHLY?.trim();
  const annual = process.env.STRIPE_PRICE_ANNUAL?.trim();
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() ?? process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  const appUrl = process.env.APP_URL?.trim() || 'https://app.joinalyne.com';

  if (!secretKey || !monthly || !annual) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }
  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ error: 'Supabase env vars are not configured' });
  }

  const authHeader = req.headers.authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer /, '') : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  // Act as the caller, so the identity comes from their token rather than the
  // request body. Nobody can start a subscription in someone else's name.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return res.status(401).json({ error: 'Not signed in' });

  const billing = (req.body as { billing?: string } | undefined)?.billing;
  if (billing !== 'monthly' && billing !== 'annual') {
    return res.status(400).json({ error: "billing must be 'monthly' or 'annual'" });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, plan, email')
    .eq('id', auth.user.id)
    .maybeSingle();

  // Already paying. Sending them to Checkout again would create a second
  // subscription and bill them twice.
  if (profile?.plan === 'paid') {
    return res.status(409).json({ error: 'Already subscribed', alreadyPaid: true });
  }

  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: billing === 'monthly' ? monthly : annual, quantity: 1 }],
      // Reuse the existing customer if there is one, so a returning user does
      // not accumulate duplicate customers in Stripe.
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: profile?.email ?? auth.user.email ?? undefined }),
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        // On metadata, not just the session: subscription events carry the
        // subscription, and this is the only way the webhook can identify the
        // user before a customer id has been stored.
        metadata: { user_id: auth.user.id },
      },
      client_reference_id: auth.user.id,
      // Returns into Settings, per Salomeh's portal decision, so both routes
      // back from Stripe land in the same place.
      success_url: `${appUrl}/settings?checkout=success`,
      cancel_url: `${appUrl}/upgrade?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[stripe] checkout session failed:', (err as Error).message);
    return res.status(502).json({ error: 'Could not start checkout' });
  }
}
