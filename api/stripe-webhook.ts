// ============================================================================
// POST /api/stripe-webhook
//
// The single writer for the billing columns on `profiles`. The app only ever
// reads them; a user cannot write them at all, because 0004 grants no column
// privilege for plan or the stripe_* fields. That is what makes this endpoint
// the authority on who has paid.
//
// Registered by Salomeh against five events:
//   customer.subscription.created   a subscription begins, including in trial
//   customer.subscription.updated   trial converts, renewal moves the date,
//                                   payment recovers, cancellation scheduled
//   customer.subscription.deleted   it ends
//   invoice.payment_succeeded       a charge cleared
//   invoice.payment_failed          a charge did not
//
// She added `updated` herself and asked whether it was needed. It is the most
// important of the five: without it a 7 day trial converting to a paid
// subscription would go entirely unnoticed, because Stripe does not send
// `created` again.
// ============================================================================

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel parses JSON bodies by default. Stripe signs the RAW bytes, so a parsed
 * and re-serialised body produces a different signature and every event is
 * rejected as invalid. Disabling the parser is not optional here, and getting it
 * wrong fails 100% of events while looking like a credentials problem.
 */
export const config = { api: { bodyParser: false } };

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on: (event: string, listener: (chunk?: unknown) => void) => void;
};
type Res = { status: (code: number) => Res; json: (body: unknown) => void };

function readRawBody(req: Req): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk as Buffer)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Stripe timestamps are seconds; Postgres wants an ISO string. */
function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!secretKey || !webhookSecret) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase service credentials are not configured' });
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
  } catch (err) {
    // A bad signature means the request did not come from Stripe. 400 tells
    // Stripe not to retry, which is right: a forged request will never verify.
    console.error('[stripe] signature verification failed:', (err as Error).message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Idempotency before anything else. Stripe retries on any non-2xx and can
  // deliver the same event twice even after a success, so a duplicated
  // payment_failed could otherwise downgrade someone who had already recovered.
  const { error: seenError } = await db
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });
  if (seenError) {
    // Primary key conflict: already handled. 200 so Stripe stops retrying.
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        // metadata first, because on the very first event the customer id may
        // not yet be stored against the profile.
        const userId =
          sub.metadata?.user_id ??
          (await db.rpc('user_for_stripe_customer', { p_customer_id: customerId })).data;

        if (!userId) {
          console.error('[stripe] no user for customer', customerId);
          break;
        }

        // A deleted subscription has no meaningful status for our purposes.
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;

        await db.rpc('apply_subscription_state', {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: sub.id,
          p_status: status,
          p_current_period_end: toIso(
            (sub as unknown as { current_period_end?: number }).current_period_end,
          ),
        });
        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const { data: userId } = await db.rpc('user_for_stripe_customer', {
          p_customer_id: customerId,
        });
        if (!userId) break;

        // Deliberately re-reading the subscription rather than inferring from the
        // invoice. Stripe has already decided whether a failure means past_due
        // or canceled, and duplicating that judgement here would drift from it.
        const subscriptionId =
          (invoice as unknown as { subscription?: string | { id: string } }).subscription;
        const id = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId?.id;
        if (!id) break;

        const sub = await stripe.subscriptions.retrieve(id);
        await db.rpc('apply_subscription_state', {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: sub.id,
          p_status: sub.status,
          p_current_period_end: toIso(
            (sub as unknown as { current_period_end?: number }).current_period_end,
          ),
        });
        break;
      }

      default:
        // Registered but unhandled. Logged rather than ignored, so an event she
        // adds later is visible rather than silently dropped.
        console.log('[stripe] unhandled event type', event.type);
    }
  } catch (err) {
    // Remove the idempotency marker so Stripe's retry can genuinely reprocess.
    // Leaving it would make a transient failure permanent.
    await db.from('stripe_events').delete().eq('id', event.id);
    console.error('[stripe] handler failed:', (err as Error).message);
    return res.status(500).json({ error: 'Handler failed' });
  }

  return res.status(200).json({ received: true });
}
