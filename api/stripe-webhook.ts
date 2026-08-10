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
  /** Present when Vercel has already parsed the body. */
  body?: unknown;
  /** Some Vercel runtimes expose the untouched bytes here. */
  rawBody?: Buffer | string;
};
type Res = { status: (code: number) => Res; json: (body: unknown) => void };

/**
 * Stripe signs the raw bytes, so the body must arrive untouched.
 *
 * Three sources, in order of trustworthiness, because `config.api.bodyParser`
 * is a NEXT.JS convention and this is a Vite project: it may simply be ignored,
 * in which case the stream is already consumed and yields nothing.
 *
 * The last resort re-serialises the parsed body, which will only verify if the
 * JSON round-trips byte for byte. It usually does not, so it warns loudly rather
 * than pretending to be equivalent.
 */
async function readRawBody(req: Req): Promise<Buffer> {
  if (req.rawBody) {
    return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody);
  }

  const streamed = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk as Buffer)));
    req.on('end', () => { settled = true; resolve(Buffer.concat(chunks)); });
    req.on('error', (err) => { if (!settled) reject(err as unknown as Error); });
  });

  if (streamed.length > 0) return streamed;

  if (req.body !== undefined) {
    console.warn(
      '[stripe] the request body was already parsed, so the raw bytes are gone. ' +
      'Falling back to re-serialising, which will usually fail signature ' +
      'verification. config.api.bodyParser is a Next.js option and does not ' +
      'apply here.',
    );
    return Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  }

  return streamed;
}

/** Stripe timestamps are seconds; Postgres wants an ISO string. */
function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * The end of the current billing period, in seconds, or undefined.
 *
 * Stripe moved `current_period_end` OFF the subscription and onto each
 * subscription item in API version 2025-03-31.basil. On the SDK we use (v22)
 * `Stripe.Subscription` has no such property at all — only `cancel_at` and
 * `cancel_at_period_end` remain at the top level. Reading `sub.current_period_end`
 * therefore always produced `undefined`, which stored NULL, which is why:
 *
 *   - every paid profile had current_period_end NULL, and
 *   - "Paid — cancels 6 Sept" could never render, because the flag was set but
 *     the date it needs was missing. Salomeh reported the missing date; the flag
 *     was never the problem.
 *
 * The old top-level field is still read first so that an older pinned API
 * version, and the hand-built fixtures in the tests, keep working. Items can bill
 * on different schedules, so the LATEST item end is used: that is the date access
 * genuinely runs to. `cancel_at` is the last resort, because when a cancellation
 * is scheduled it equals the period end by definition.
 */
export function periodEndSeconds(sub: unknown): number | undefined {
  const s = sub as {
    current_period_end?: number;
    cancel_at?: number | null;
    items?: { data?: Array<{ current_period_end?: number }> };
  };

  if (typeof s.current_period_end === 'number') return s.current_period_end;

  const itemEnds = (s.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((end): end is number => typeof end === 'number');

  if (itemEnds.length > 0) return Math.max(...itemEnds);

  return typeof s.cancel_at === 'number' ? s.cancel_at : undefined;
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
  //
  // ONLY a unique violation means "already seen". The first version returned 200
  // on ANY insert error, which turned a configuration problem into a silent
  // success: Stripe recorded five 200s with a 0% error rate while nothing was
  // written and no plan was ever upgraded. Anything other than 23505 is a real
  // failure and must be visible, and must make Stripe retry.
  const { error: seenError } = await db
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });

  if (seenError?.code === '23505') {
    return res.status(200).json({ received: true, duplicate: true });
  }
  if (seenError) {
    console.error('[stripe] could not record event', event.id, seenError.code, seenError.message);
    return res.status(500).json({
      error: 'Could not record event',
      // Surfaced in Stripe's dashboard response body, which is the only place
      // either of us can see it without production log access.
      detail: `${seenError.code ?? 'unknown'}: ${seenError.message}`,
    });
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
        let userId: string | null = sub.metadata?.user_id ?? null;
        if (!userId) {
          const lookup = await db.rpc('user_for_stripe_customer', { p_customer_id: customerId });
          if (lookup.error) throw new Error(`customer lookup failed: ${lookup.error.message}`);
          userId = lookup.data as string | null;
        }

        if (!userId) {
          // Genuinely unresolvable rather than a failure. Throwing makes Stripe
          // retry, which will not help, so this is reported and accepted.
          console.error('[stripe] no user for customer', customerId, 'event', event.id);
          break;
        }

        // A deleted subscription has no meaningful status for our purposes.
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;

        const applied = await db.rpc('apply_subscription_state', {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: sub.id,
          p_status: status,
          p_current_period_end: toIso(periodEndSeconds(sub)),
          // A cancellation scheduled from the portal arrives as `updated` with
          // this set, while the status stays active until the period ends. Salomeh
          // cancelled and Settings said nothing, because this was never read.
          p_cancel_at_period_end:
            event.type === 'customer.subscription.deleted'
              ? false
              : ((sub as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end ?? false),
        });
        // Unchecked before, which is how a subscription could go live in Stripe
        // while the app still said Free.
        if (applied.error) throw new Error(`apply_subscription_state: ${applied.error.message}`);
        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const lookup = await db.rpc('user_for_stripe_customer', { p_customer_id: customerId });
        if (lookup.error) throw new Error(`customer lookup failed: ${lookup.error.message}`);
        const userId = lookup.data as string | null;
        if (!userId) {
          console.error('[stripe] no user for customer', customerId, 'event', event.id);
          break;
        }

        // Deliberately re-reading the subscription rather than inferring from the
        // invoice. Stripe has already decided whether a failure means past_due
        // or canceled, and duplicating that judgement here would drift from it.
        const subscriptionId =
          (invoice as unknown as { subscription?: string | { id: string } }).subscription;
        const id = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId?.id;
        if (!id) break;

        const sub = await stripe.subscriptions.retrieve(id);
        const applied = await db.rpc('apply_subscription_state', {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: sub.id,
          p_status: sub.status,
          p_current_period_end: toIso(periodEndSeconds(sub)),
          p_cancel_at_period_end:
            (sub as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end ?? false,
        });
        if (applied.error) throw new Error(`apply_subscription_state: ${applied.error.message}`);
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
    const message = (err as Error).message;
    console.error('[stripe] handler failed:', message);
    return res.status(500).json({ error: 'Handler failed', detail: message });
  }

  return res.status(200).json({ received: true });
}
