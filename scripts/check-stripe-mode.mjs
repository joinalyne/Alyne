// Which Stripe mode is a DEPLOYMENT actually in?
//
//   npm run check:stripe                         # app.joinalyne.com
//   npm run check:stripe -- <origin> [email]     # any deployment
//
// This exists because "I set the variable correctly" cannot be verified after
// the fact: Vercel will not return a sensitive value, and `vercel env pull`
// returns an empty string for one. So on 15 August the sandbox key was confirmed
// on Preview and the live key was ASSUMED on Production, which had in fact been
// overwritten with sandbox values two days earlier. Production opened sandbox
// Checkout sessions for two days, and the only visible sign was a badge on
// Stripe's own page saying "Alyne sandbox".
//
// The mode IS observable from outside: a Checkout Session id is cs_test_... in
// test or sandbox mode and cs_live_... in live mode. So ask the deployment to
// open one and read the prefix. That is a fact about what is deployed rather
// than a claim about what was typed.
//
// Creates an abandoned Checkout Session, which charges nothing: no subscription
// exists until a session is completed. Run it against production after any
// change to STRIPE_SECRET_KEY.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const env = Object.fromEntries(
  readFileSync(join(repoRoot, '.env'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      // .trim(): a pasted secret routinely carries a trailing newline, and an
      // invisible character in an env var has broken this project before.
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const origin = (process.argv[2] ?? 'https://app.joinalyne.com').replace(/\/$/, '');
// A demo account by default. Its plan is free and nothing about it is real, so
// opening a session in its name costs nothing.
const email = process.argv[3] ?? 'jerome-a@demo.alyne';
const password = process.env.DEMO_PASSWORD ?? 'AlyneDemo2026!';

const auth = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const session = await auth.json();
if (!session.access_token) {
  console.error(`could not sign in as ${email}: ${session.error_description ?? session.msg ?? auth.status}`);
  process.exit(1);
}

const res = await fetch(`${origin}/api/create-checkout-session`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ billing: 'monthly' }),
});
const body = await res.json().catch(() => ({}));

console.log(`${origin}  ->  HTTP ${res.status}`);

if (res.status === 503) {
  // The mode guard in api/_stripe.ts. The detail is deliberately not returned to
  // the client, so the reason is in the deployment's logs.
  console.log(`  ${body.error}`);
  console.log('  The deployment is refusing to transact. Check the function logs');
  console.log('  for [stripe]: the key and the environment disagree.');
  process.exit(1);
}

if (!body.url) {
  console.log(' ', body);
  process.exit(1);
}

const id = body.url.match(/cs_(test|live)_[A-Za-z0-9]+/)?.[0];
const mode = id?.startsWith('cs_live') ? 'LIVE' : id?.startsWith('cs_test') ? 'TEST / SANDBOX' : 'UNKNOWN';
const expected = origin.includes('app.joinalyne.com') ? 'LIVE' : 'TEST / SANDBOX';

console.log(`  session: ${id ? id.slice(0, 20) + '...' : '(no session id in the URL)'}`);
console.log(`  mode:    ${mode}${mode === expected ? '' : `   <-- EXPECTED ${expected}`}`);
process.exit(mode === expected ? 0 : 1);
