// ============================================================================
// Alyne — M1 integration tests
//
//   npm run test:m1
//
// Runs against the real Supabase project through the PUBLISHABLE key, exactly
// as the browser does, so RLS and column privileges are genuinely exercised.
// Unit tests with a mocked client would not catch a policy mistake, and policy
// mistakes are the failure mode that actually matters here.
//
// Creates users on @test.alyne and deletes them afterwards. Safe to re-run.
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_KEY (to create/delete test users) and
// VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (the client path) in .env.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  if (!env[key]) {
    console.error(`Missing ${key} in .env`);
    process.exit(1);
  }
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const PASSWORD = 'alyne-e2e-1234';
const DOMAIN = '@test.alyne';

let failures = 0;
function check(label, passed, detail = '') {
  if (!passed) failures++;
  console.log(`${passed ? 'pass' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
}

async function wipeTestUsers() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.email?.endsWith(DOMAIN))) {
    await admin.auth.admin.deleteUser(u.id);
  }
}

/** Sign up and onboard, following exactly the calls the app makes. */
async function makeUser(handle, name, goal) {
  const email = `e2e-${handle}${DOMAIN}`;
  await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });

  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`${name} could not sign in: ${signInError.message}`);

  const { data: { user } } = await client.auth.getUser();

  // ensureProfile(): a do-nothing insert then a plain update. Not an upsert —
  // see migration 0004; ON CONFLICT DO UPDATE needs table-level UPDATE.
  await client.from('profiles').upsert(
    { id: user.id, email, timezone: 'America/Vancouver' },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  await client.from('profiles').update({ timezone: 'America/Vancouver' }).eq('id', user.id);
  await client.from('profiles').update({ display_name: name, current_goal: goal }).eq('id', user.id);

  return { name, id: user.id, client };
}

async function main() {
  await wipeTestUsers();
  await admin.from('match_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const ada = await makeUser('ada', 'Ada', 'writing');
  const bo = await makeUser('bo', 'Bo', 'writing');
  const cy = await makeUser('cy', 'Cy', 'fitness');

  console.log('\n— onboarding —');
  const { data: adaProfile } = await ada.client
    .from('profiles')
    .select('display_name, current_goal, timezone')
    .eq('id', ada.id)
    .single();
  check(
    'onboarding writes persist',
    adaProfile?.display_name === 'Ada' && adaProfile?.current_goal === 'writing',
    `${adaProfile?.display_name} / ${adaProfile?.current_goal} / ${adaProfile?.timezone}`,
  );

  console.log('\n— privilege escalation must fail —');
  for (const [label, column, value] of [
    ['admin', 'is_admin', true],
    ['paid plan', 'plan', 'paid'],
    ['a fake streak', 'current_streak', 999],
  ]) {
    const { error } = await ada.client.from('profiles').update({ [column]: value }).eq('id', ada.id);
    const { data: row } = await admin.from('profiles').select(column).eq('id', ada.id).single();
    check(
      `cannot self-grant ${label}`,
      row[column] !== value,
      error ? `rejected ${error.code}` : `LEAKED — value is now ${row[column]}`,
    );
  }

  const queueAttempt = await ada.client
    .from('match_queue')
    .insert({ user_id: ada.id, goal: 'writing', priority: true });
  check('cannot self-insert a priority queue row', !!queueAttempt.error, queueAttempt.error?.code);

  const matchAttempt = await ada.client
    .from('matches')
    .insert({ goal: 'writing', user_a: ada.id, user_b: bo.id });
  check('cannot self-create a match', !!matchAttempt.error, matchAttempt.error?.code);

  console.log('\n— matching engine —');
  const { data: first } = await ada.client.rpc('enqueue_and_match');
  check('first in queue waits', first === null, `returned ${first}`);

  const { data: second } = await bo.client.rpc('enqueue_and_match');
  check('same goal pairs', typeof second === 'string', `match ${String(second).slice(0, 8)}`);

  const { data: again } = await ada.client.rpc('enqueue_and_match');
  check('repeat call returns the same match, not a second one', again === second);

  const { data: other } = await cy.client.rpc('enqueue_and_match');
  check('a different goal does not cross-pair', other === null);

  const { data: streaks } = await admin
    .from('profiles')
    .select('current_streak')
    .in('id', [ada.id, bo.id]);
  check('streaks reset to 0 on a new match', streaks.every((s) => s.current_streak === 0));

  console.log('\n— partner visibility under RLS —');
  const { data: adaSees } = await ada.client.from('profiles').select('display_name');
  check('matched user sees self + partner only', adaSees?.length === 2,
    adaSees?.map((p) => p.display_name).sort().join(' + '));

  const { data: cySees } = await cy.client.from('profiles').select('display_name');
  check('unmatched user sees only themselves', cySees?.length === 1,
    cySees?.map((p) => p.display_name).join(''));

  const { data: cyCheckIns } = await cy.client.from('check_ins').select('id');
  check('unmatched user sees no check-ins', cyCheckIns?.length === 0, `${cyCheckIns?.length} rows`);

  console.log('\n— check-ins —');
  const today = new Date().toLocaleDateString('en-CA');
  const firstCheckIn = await ada.client
    .from('check_ins')
    .insert({ user_id: ada.id, type: 'text', body: 'Wrote 500 words', local_date: today });
  check('can check in once today', !firstCheckIn.error, firstCheckIn.error?.message);

  const secondCheckIn = await ada.client
    .from('check_ins')
    .insert({ user_id: ada.id, type: 'text', body: 'again', local_date: today });
  check('cannot check in twice on the same day', !!secondCheckIn.error, secondCheckIn.error?.code);

  const asBo = await bo.client
    .from('check_ins')
    .insert({ user_id: ada.id, type: 'text', body: 'not mine', local_date: today });
  check('cannot check in as someone else', !!asBo.error, asBo.error?.code);

  const { data: boSeesCheckIns } = await bo.client.from('check_ins').select('body');
  check("partner can read the other's check-in", boSeesCheckIns?.some((c) => c.body === 'Wrote 500 words'),
    `${boSeesCheckIns?.length} visible`);

  console.log('\n— match-notification claim —');
  // Resend is needed to actually send, but the exactly-once guarantee is pure
  // SQL, and that is the part that can genuinely go wrong.
  const { data: claimA } = await ada.client.rpc('claim_match_email', { p_match_id: second });
  check('a participant can claim the send', Array.isArray(claimA) && claimA.length === 1,
    claimA?.[0] ? `${claimA[0].user_a_name} + ${claimA[0].user_b_name}` : 'no row');

  const { data: claimB } = await bo.client.rpc('claim_match_email', { p_match_id: second });
  check("the partner's claim returns nothing, so only one email goes out",
    Array.isArray(claimB) && claimB.length === 0, `${claimB?.length} rows`);

  const { data: claimC } = await cy.client.rpc('claim_match_email', { p_match_id: second });
  check("an outsider cannot trigger someone else's email",
    Array.isArray(claimC) && claimC.length === 0, `${claimC?.length} rows`);

  await ada.client.rpc('release_match_email', { p_match_id: second });
  const { data: claimD } = await ada.client.rpc('claim_match_email', { p_match_id: second });
  check('releasing after a failed send allows a retry',
    Array.isArray(claimD) && claimD.length === 1, `${claimD?.length} rows`);

  await cy.client.rpc('release_match_email', { p_match_id: second });
  const { data: stampRow } = await admin
    .from('matches').select('match_email_sent_at').eq('id', second).single();
  check('an outsider cannot release the claim either',
    stampRow?.match_email_sent_at !== null,
    stampRow?.match_email_sent_at ? 'stamp intact' : 'STAMP CLEARED');

  console.log('\n— streak accounting (M2) —');
  // A fresh user, because the check-in above already gave Ada a streak.
  const dee = await makeUser('dee', 'Dee', 'learning');
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-CA');
  };
  const streakOf = async (id) => {
    const { data } = await admin
      .from('profiles').select('current_streak, last_check_in_date').eq('id', id).single();
    return data;
  };
  const checkIn = (user, localDate) =>
    user.client.from('check_ins')
      .insert({ user_id: user.id, type: 'text', body: 'seed', local_date: localDate });

  await checkIn(dee, day(-1));
  let s = await streakOf(dee.id);
  check('first check-in sets the streak to 1, not 0', s.current_streak === 1,
    `streak ${s.current_streak}, last ${s.last_check_in_date}`);

  await checkIn(dee, day(0));
  s = await streakOf(dee.id);
  check('a consecutive day extends the streak to 2', s.current_streak === 2,
    `streak ${s.current_streak}`);

  // Backdated correction must not drag last_check_in_date backwards, or a live
  // streak would look lapsed to the nightly sweep.
  await checkIn(dee, day(-5));
  s = await streakOf(dee.id);
  check('a backdated check-in does not move last_check_in_date back',
    s.last_check_in_date === day(0), `last ${s.last_check_in_date}`);

  const gapUser = await makeUser('gap', 'Gap', 'learning');
  await checkIn(gapUser, day(-6));
  await checkIn(gapUser, day(0));
  s = await streakOf(gapUser.id);
  check('a gap restarts the streak at 1', s.current_streak === 1, `streak ${s.current_streak}`);

  // Nightly decay. Vancouver so the tz branch is genuinely exercised.
  const lapsed = await makeUser('lapsed', 'Lapsed', 'learning');
  await checkIn(lapsed, day(-1));
  await admin.rpc('reset_stale_streaks');
  s = await streakOf(lapsed.id);
  check('yesterday survives the sweep, their day is not over', s.current_streak === 1,
    `streak ${s.current_streak}`);

  await admin.from('profiles')
    .update({ last_check_in_date: day(-4), current_streak: 9 }).eq('id', lapsed.id);
  const { data: swept } = await admin.rpc('reset_stale_streaks');
  s = await streakOf(lapsed.id);
  check('a stale streak is zeroed by the sweep', s.current_streak === 0,
    `streak ${s.current_streak}, swept ${swept}`);

  const { error: streakDenied } = await ada.client.rpc('reset_stale_streaks');
  check('a normal user cannot run the sweep', !!streakDenied, streakDenied?.code);

  const { data: cronJobs } = await admin.rpc('reset_stale_streaks');
  check('the sweep is idempotent when nothing is stale', cronJobs === 0, `${cronJobs} rows`);

  await wipeTestUsers();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\nTest run threw:', err.message);
  await wipeTestUsers();
  process.exit(1);
});
