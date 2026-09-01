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

  console.log('\n— /admin overview (M2) —');
  const { error: notAdmin } = await ada.client.rpc('admin_overview');
  check('a normal user cannot read the overview', !!notAdmin, notAdmin?.code);

  // Promote Bo via the service role. is_admin is not writable by the user
  // themselves (0004), which is the point.
  await admin.from('profiles').update({ is_admin: true }).eq('id', bo.id);
  const { data: view, error: viewErr } = await bo.client.rpc('admin_overview');
  check('an admin can read the overview', !viewErr && !!view, viewErr?.message);

  const adaBoMatch = (view?.active ?? []).concat(view?.flagged ?? [])
    .find((p) => [p.a_name, p.b_name].includes('Ada'));
  check('the overview lists the Ada/Bo pairing', !!adaBoMatch,
    adaBoMatch ? `${adaBoMatch.a_name} + ${adaBoMatch.b_name}, ${adaBoMatch.days_silent}d silent` : 'not found');
  check('it reports both streaks and last check-in dates',
    adaBoMatch !== undefined && typeof adaBoMatch.a_streak === 'number',
    adaBoMatch ? `streaks ${adaBoMatch.a_streak}/${adaBoMatch.b_streak}` : '');
  check('counts are present', typeof view?.counts?.active === 'number',
    JSON.stringify(view?.counts));

  // Cy is still queued from the cross-goal check earlier.
  check('the FIFO queue is listed', Array.isArray(view?.queue), `${view?.queue?.length} waiting`);

  // end_match is admin only, and ending a pairing removes it from the overview.
  const { error: endDenied } = await ada.client.rpc('end_match', { match_id: second });
  const { data: stillActive } = await admin
    .from('matches').select('status').eq('id', second).single();
  check('a normal user cannot end a match', stillActive.status === 'active',
    endDenied ? `rejected ${endDenied.code}` : 'no error but unchanged');

  await bo.client.rpc('end_match', { match_id: second });
  const { data: ended } = await admin
    .from('matches').select('status, ended_by, ended_at').eq('id', second).single();
  check('an admin ends the match and it is attributed',
    ended.status === 'ended' && ended.ended_by === 'admin' && !!ended.ended_at,
    `${ended.status} by ${ended.ended_by}`);

  const { data: after } = await bo.client.rpc('admin_overview');
  const stillListed = (after?.active ?? []).concat(after?.flagged ?? [])
    .some((p) => p.id === second);
  check('the ended pairing drops off the overview', !stillListed);

  // Partner visibility must close when the pairing ends.
  const { data: adaSeesNow } = await ada.client.from('profiles').select('display_name');
  check('ending the match closes partner visibility', adaSeesNow?.length === 1,
    `${adaSeesNow?.length} profiles visible`);

  console.log('\n— changing goal (M2) —');
  // Salomeh's decision: changing goal ends the pairing and requeues.
  const one = await makeUser('one', 'One', 'mindfulness');
  const two = await makeUser('two', 'Two', 'mindfulness');
  await one.client.rpc('enqueue_and_match');
  const { data: pairId } = await two.client.rpc('enqueue_and_match');
  check('a pair is set up to change goal from', typeof pairId === 'string');

  // Same goal must NOT destroy a good pairing.
  const { data: sameGoal } = await one.client.rpc('change_goal', { p_goal: 'mindfulness' });
  const { data: untouched } = await admin
    .from('matches').select('status').eq('id', pairId).single();
  check('choosing the goal you already have is a no-op',
    untouched.status === 'active' && sameGoal === pairId, untouched.status);

  const { data: newMatch, error: changeErr } = await one.client
    .rpc('change_goal', { p_goal: 'quitting' });
  check('changing goal succeeds', !changeErr, changeErr?.message);
  check('nobody was waiting on the new goal, so no new match', newMatch === null,
    `returned ${newMatch}`);

  const { data: oldPair } = await admin
    .from('matches').select('status, ended_by').eq('id', pairId).single();
  check('the old pairing is ended and attributed to the system, not an admin',
    oldPair.status === 'ended' && oldPair.ended_by === 'system',
    `${oldPair.status} by ${oldPair.ended_by}`);

  const { data: profileAfter } = await admin
    .from('profiles').select('current_goal').eq('id', one.id).single();
  check('the profile carries the new goal', profileAfter.current_goal === 'quitting',
    profileAfter.current_goal);

  const { data: queued } = await admin
    .from('match_queue').select('goal, status').eq('user_id', one.id).eq('status', 'waiting');
  check('they are requeued for the new goal', queued?.length === 1 && queued[0].goal === 'quitting',
    JSON.stringify(queued));

  // The ex-partner must be free to match again rather than stuck.
  const three = await makeUser('three', 'Three', 'mindfulness');
  const { data: rematch } = await three.client.rpc('enqueue_and_match');
  check('the ex-partner can be matched again', typeof rematch === 'string',
    `match ${String(rematch).slice(0, 8)}`);

  // And someone already waiting on the target goal pairs immediately.
  const four = await makeUser('four', 'Four', 'quitting');
  const { data: instant } = await four.client.rpc('enqueue_and_match');
  check('changing to a goal with someone waiting pairs at once',
    typeof instant === 'string', `match ${String(instant).slice(0, 8)}`);

  console.log('\n— private check-in media —');
  // The partner must be able to play a voice note or see a photo. Storage RLS
  // is the whole mechanism, and a failure here is silent: the card would just
  // show "could not be loaded" with no error anywhere.
  const five = await makeUser('five', 'Five', 'other');
  const six = await makeUser('six', 'Six', 'other');
  await five.client.rpc('enqueue_and_match');
  await six.client.rpc('enqueue_and_match');

  const audio = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' });
  const mediaPath = `${five.id}/${today}-voice.webm`;
  const { error: upErr } = await five.client.storage
    .from('check-ins').upload(mediaPath, audio, { upsert: true, contentType: 'audio/webm' });
  check('a user can upload their own check-in media', !upErr, upErr?.message);

  const { error: wrongFolder } = await six.client.storage
    .from('check-ins')
    .upload(`${five.id}/sneaky.webm`, audio, { upsert: true, contentType: 'audio/webm' });
  check('nobody can write into someone else\'s folder', !!wrongFolder, wrongFolder?.message?.slice(0, 40));

  const { data: ownUrl } = await five.client.storage
    .from('check-ins').createSignedUrl(mediaPath, 60);
  check('the owner can sign a URL for their own media', !!ownUrl?.signedUrl);

  const { data: partnerUrl, error: partnerErr } = await six.client.storage
    .from('check-ins').createSignedUrl(mediaPath, 60);
  check('the PARTNER can sign a URL for it', !!partnerUrl?.signedUrl, partnerErr?.message);

  if (partnerUrl?.signedUrl) {
    const fetched = await fetch(partnerUrl.signedUrl);
    check('and the signed URL actually serves the file', fetched.ok, `HTTP ${fetched.status}`);
  }

  const { data: outsiderUrl } = await cy.client.storage
    .from('check-ins').createSignedUrl(mediaPath, 60);
  check('an outsider cannot sign a URL for it', !outsiderUrl?.signedUrl);

  // Visibility must close with the pairing, exactly as profile visibility does.
  const { data: theirMatch } = await admin
    .from('matches').select('id').eq('status', 'active')
    .or(`user_a.eq.${five.id},user_b.eq.${five.id}`).maybeSingle();
  await admin.from('matches')
    .update({ status: 'ended', ended_at: new Date().toISOString(), ended_by: 'admin' })
    .eq('id', theirMatch.id);
  const { data: afterEnd } = await six.client.storage
    .from('check-ins').createSignedUrl(mediaPath, 60);
  check('an ex-partner loses access once the pairing ends', !afterEnd?.signedUrl);

  console.log('\n— push subscriptions (M4) —');
  const sub = { endpoint: 'https://push.example/endpoint-' + ada.id, p256dh: 'k', auth: 'a' };

  const { error: subErr } = await ada.client.from('push_subscriptions')
    .upsert({ user_id: ada.id, ...sub }, { onConflict: 'endpoint', ignoreDuplicates: false });
  check('a user can register a push subscription', !subErr, subErr?.message);

  // The case 0011 exists for: a browser re-registering the same endpoint.
  const { error: reSubErr } = await ada.client.from('push_subscriptions')
    .upsert({ user_id: ada.id, ...sub, user_agent: 'refreshed' },
            { onConflict: 'endpoint', ignoreDuplicates: false });
  check('re-registering the same endpoint refreshes rather than failing',
    !reSubErr, reSubErr?.message);

  const { data: mine } = await ada.client.from('push_subscriptions').select('endpoint');
  check('a user sees only their own subscriptions', mine?.length === 1, `${mine?.length} rows`);

  const { data: notMine } = await bo.client.from('push_subscriptions').select('endpoint');
  check('a partner cannot see them, unlike check-ins', notMine?.length === 0,
    `${notMine?.length} rows`);

  const { error: stealErr } = await bo.client.from('push_subscriptions')
    .insert({ user_id: ada.id, endpoint: 'https://push.example/steal', p256dh: 'k', auth: 'a' });
  check('nobody can register a subscription for someone else', !!stealErr, stealErr?.code);

  const { error: unsubErr } = await ada.client.from('push_subscriptions')
    .delete().eq('endpoint', sub.endpoint);
  const { data: afterDelete } = await ada.client.from('push_subscriptions').select('endpoint');
  check('a user can turn push off on their own device',
    !unsubErr && afterDelete?.length === 0, unsubErr?.message);

  console.log('\n— quiet hours and reminders (M4) —');
  const { data: quiet } = await admin.rpc('in_quiet_hours', { p_user_id: ada.id });
  check('quiet hours resolve to a boolean for a real user', typeof quiet === 'boolean',
    `currently ${quiet}`);

  const { error: quietDenied } = await ada.client.rpc('in_quiet_hours', { p_user_id: ada.id });
  check('a user cannot probe quiet hours directly', !!quietDenied, quietDenied?.code);

  const { data: due, error: dueErr } = await admin.rpc('users_due_streak_reminder');
  check('the reminder query runs and returns a list', !dueErr && Array.isArray(due),
    dueErr?.message ?? `${due?.length} due right now`);

  const { error: dueDenied } = await ada.client.rpc('users_due_streak_reminder');
  check('a user cannot run the reminder query', !!dueDenied, dueDenied?.code);

  console.log('\n— signing up via the emailed confirmation link —');
  // The path every real user takes, and the one none of these tests covered.
  // They all sign in with a password, which is the only route that used to call
  // ensureProfile, which is why the fresh-signup bug reached Salomeh.
  const confirmEmail = `e2e-confirm${DOMAIN}`;
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'signup', email: confirmEmail, password: PASSWORD,
  });
  check('a confirmation link can be generated', !linkErr, linkErr?.message);

  const followed = await fetch(link.properties.action_link, { redirect: 'manual' });
  const hash = new URLSearchParams(new URL(followed.headers.get('location')).hash.slice(1));
  check('following it returns session tokens in the URL hash',
    !!hash.get('access_token'), `status ${followed.status}`);

  const confirmClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: sess } = await confirmClient.auth.setSession({
    access_token: hash.get('access_token'),
    refresh_token: hash.get('refresh_token'),
  });
  check('a session is established without any password sign-in', !!sess?.session);

  const confirmedId = sess.session.user.id;
  const { data: autoProfile } = await admin
    .from('profiles').select('id, email').eq('id', confirmedId);
  check('the profile row already exists, created by the signup trigger',
    autoProfile?.length === 1, `${autoProfile?.length} rows`);

  // The exact two writes that silently did nothing before.
  const { data: named } = await confirmClient
    .from('profiles').update({ display_name: 'Fresh' }).eq('id', confirmedId).select('id');
  check('setting a name actually writes a row', named?.length === 1, `${named?.length} rows`);

  const { data: goaled } = await confirmClient
    .from('profiles').update({ current_goal: 'learning' }).eq('id', confirmedId).select('id');
  check('choosing a goal actually writes a row', goaled?.length === 1, `${goaled?.length} rows`);

  const { data: finalProfile } = await admin
    .from('profiles').select('display_name, current_goal').eq('id', confirmedId).single();
  check('onboarding persists, so the guard will not bounce them',
    finalProfile.display_name === 'Fresh' && finalProfile.current_goal === 'learning',
    `${finalProfile.display_name} / ${finalProfile.current_goal}`);

  console.log('\n— requeue notice (Salomeh\'s UX gap) —');
  const leaver = await makeUser('leaver', 'Leaver', 'mindfulness');
  const left = await makeUser('left', 'Left', 'mindfulness');
  await leaver.client.rpc('enqueue_and_match');
  await left.client.rpc('enqueue_and_match');

  // Neither should see a notice while happily matched.
  const { data: noneYet } = await left.client.rpc('requeue_notice');
  check('no notice while matched', (noneYet ?? []).length === 0, `${noneYet?.length} rows`);

  // Leaver changes goal, which ends the pairing and requeues both.
  await leaver.client.rpc('change_goal', { p_goal: 'quitting' });

  const { data: leftNotice } = await left.client.rpc('requeue_notice');
  check('the person LEFT BEHIND is told their partner switched goals',
    leftNotice?.[0]?.reason === 'goal_change', JSON.stringify(leftNotice?.[0]?.reason));

  // The important one, which her design did not specify: the person who acted
  // must not read their own decision described as their partner's.
  const { data: leaverNotice } = await leaver.client.rpc('requeue_notice');
  check('the person who CHANGED their own goal gets no notice',
    (leaverNotice ?? []).length === 0 || leaverNotice[0]?.reason === null,
    JSON.stringify(leaverNotice?.[0] ?? 'none'));

  // An admin ending a pair gets different copy, and both sides see it.
  //
  // Queue cleared first: earlier sections leave waiting users on some goals, so
  // without this these two pair with leftovers instead of each other and the
  // assertion fails for reasons unrelated to the notice.
  await admin.from('match_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const admin1 = await makeUser('adm1', 'Adm1', 'other');
  const admin2 = await makeUser('adm2', 'Adm2', 'other');
  await admin1.client.rpc('enqueue_and_match');
  const { data: pairId2 } = await admin2.client.rpc('enqueue_and_match');
  await admin.from('matches')
    .update({ status: 'ended', ended_at: new Date().toISOString(), ended_by: 'admin' })
    .eq('id', pairId2);

  const { data: adminNotice } = await admin1.client.rpc('requeue_notice');
  check('an admin-ended pairing gets the admin wording',
    adminNotice?.[0]?.reason === 'admin', JSON.stringify(adminNotice?.[0]?.reason));

  // Being matched again clears it, with no extra bookkeeping.
  await admin.from('match_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin1.client.rpc('enqueue_and_match');
  const partner3 = await makeUser('adm3', 'Adm3', 'other');
  await partner3.client.rpc('enqueue_and_match');
  const { data: clearedNotice } = await admin1.client.rpc('requeue_notice');
  check('a new match clears the notice', (clearedNotice ?? []).length === 0,
    `${clearedNotice?.length} rows`);

  console.log('\n— billing state (M3) —');
  // No Stripe credentials are needed for any of this. The decisions that matter
  // are what a Stripe status MEANS and whether a redelivered event can be applied
  // twice, and both live in SQL precisely so they can be tested directly.
  const payer = await makeUser('payer', 'Payer', 'fitness');

  const setState = (status, periodEnd = null) =>
    admin.rpc('apply_subscription_state', {
      p_user_id: payer.id,
      p_customer_id: 'cus_test_' + payer.id.slice(0, 8),
      p_subscription_id: 'sub_test_1',
      p_status: status,
      p_current_period_end: periodEnd,
    });
  const planOf = async () => {
    const { data } = await admin
      .from('profiles').select('plan, subscription_status').eq('id', payer.id).single();
    return data;
  };

  // A trial must grant access. That is the point of offering one.
  await setState('trialing');
  let state = await planOf();
  check('trialing counts as paid', state.plan === 'paid', `${state.plan} / ${state.subscription_status}`);

  await setState('active');
  state = await planOf();
  check('active is paid', state.plan === 'paid', state.plan);

  // Stripe retries a failed card for days. Cutting someone off on the first
  // failure would punish an expired card rather than a decision not to pay.
  await setState('past_due');
  state = await planOf();
  check('past_due stays paid while Stripe retries', state.plan === 'paid', state.plan);

  await setState('canceled');
  state = await planOf();
  check('canceled drops to free', state.plan === 'free', state.plan);

  await setState('incomplete_expired');
  state = await planOf();
  check('an unrecognised or failed status is free, not paid', state.plan === 'free', state.plan);

  // A user must never be able to award themselves a plan.
  const { error: selfPlan } = await payer.client.rpc('apply_subscription_state', {
    p_user_id: payer.id, p_customer_id: 'x', p_subscription_id: 'x',
    p_status: 'active', p_current_period_end: null,
  });
  check('a user cannot call the billing writer', !!selfPlan, selfPlan?.code);

  const { error: selfLookup } = await payer.client.rpc('user_for_stripe_customer', {
    p_customer_id: 'cus_test',
  });
  check('a user cannot map customers back to people', !!selfLookup, selfLookup?.code);

  // The customer mapping the webhook depends on for every event after the first.
  await setState('active');
  const { data: mapped } = await admin.rpc('user_for_stripe_customer', {
    p_customer_id: 'cus_test_' + payer.id.slice(0, 8),
  });
  check('a Stripe customer resolves back to the right user', mapped === payer.id);

  // Idempotency. A duplicated payment_failed must not downgrade someone who has
  // already recovered.
  const evt = 'evt_test_' + Date.now();
  const firstEvent = await admin.from('stripe_events').insert({ id: evt, type: 'invoice.payment_failed' });
  const replay = await admin.from('stripe_events').insert({ id: evt, type: 'invoice.payment_failed' });
  check('a redelivered Stripe event is rejected', !firstEvent.error && !!replay.error, replay.error?.code);
  await admin.from('stripe_events').delete().eq('id', evt);

  const { data: eventsVisible } = await payer.client.from('stripe_events').select('id');
  check('event history is not readable by users', (eventsVisible ?? []).length === 0);

  {
    console.log('');
    console.log('--- pending cancellation (M3) ---');
    // Salomeh cancelled her test subscription; Stripe scheduled it correctly but
    // Settings said only "Paid", so it looked as though the cancellation failed.
    const canceller = await makeUser('cancel', 'Canceller', 'other');
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();

    const setBilling = (status, cancelling) =>
      admin.rpc('apply_subscription_state', {
        p_user_id: canceller.id,
        p_customer_id: 'cus_cancel_test',
        p_subscription_id: 'sub_cancel_test',
        p_status: status,
        p_current_period_end: periodEnd,
        p_cancel_at_period_end: cancelling,
      });
    const billing = async () => {
      const { data } = await admin.from('profiles')
        .select('plan, cancel_at_period_end, current_period_end').eq('id', canceller.id).single();
      return data;
    };

    await setBilling('active', false);
    let b = await billing();
    check('an active subscription shows no pending cancellation',
      b.plan === 'paid' && b.cancel_at_period_end === false, b.plan + ' / ' + b.cancel_at_period_end);

    await setBilling('active', true);
    b = await billing();
    check('cancelling keeps access until the period ends', b.plan === 'paid', 'plan is ' + b.plan);
    check('and records that a cancellation is pending', b.cancel_at_period_end === true);
    check('with a date to show the user', !!b.current_period_end, b.current_period_end?.slice(0, 10));

    // A lapsed plan must not leave a stale cancellation notice behind.
    await setBilling('canceled', true);
    b = await billing();
    check('a lapsed plan clears the pending flag',
      b.plan === 'free' && b.cancel_at_period_end === false, b.plan + ' / ' + b.cancel_at_period_end);

    await setBilling('active', false);
    b = await billing();
    check('resubscribing comes back clean',
      b.plan === 'paid' && b.cancel_at_period_end === false);

    const { error: selfCancel } = await canceller.client
      .from('profiles').update({ cancel_at_period_end: true }).eq('id', canceller.id);
    const after = await billing();
    check('a user cannot fake a pending cancellation',
      after.cancel_at_period_end === false, selfCancel ? 'rejected ' + selfCancel.code : 'ignored');

    console.log('');
    console.log('--- clearing test billing state (0019) ---');
    // Salomeh subscribed in SANDBOX while we proved the flow, against her LIVE
    // profile. Clearing the plan alone would not be enough: checkout reuses a
    // stored customer id, and sandbox ids mean nothing to the live account.
    await setBilling('active', true);
    const { data: removed, error: resetErr } = await admin.rpc('reset_billing_state', {
      p_user_id: canceller.id,
    });
    const gone = await admin.from('profiles')
      .select('plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end')
      .eq('id', canceller.id).single();
    const g = gone.data;

    check('the reset runs and reports what it detached',
      !resetErr && removed?.[0]?.removed_customer_id === 'cus_cancel_test',
      resetErr?.message ?? removed?.[0]?.removed_customer_id);
    check('the plan goes back to free', g.plan === 'free', g.plan);
    check('the Stripe customer is forgotten, so a real checkout starts fresh',
      g.stripe_customer_id === null, String(g.stripe_customer_id));
    check('the subscription and its status go with it',
      g.stripe_subscription_id === null && g.subscription_status === null,
      `${g.stripe_subscription_id} / ${g.subscription_status}`);
    check('and no cancellation notice is left stranded on a free plan',
      g.cancel_at_period_end === false && g.current_period_end === null,
      `${g.cancel_at_period_end} / ${g.current_period_end}`);

    // The whole point of a forgotten customer: the mapping must not resolve, or
    // a stray sandbox event would land back on a live profile.
    const { data: orphaned } = await admin.rpc('user_for_stripe_customer', {
      p_customer_id: 'cus_cancel_test',
    });
    check('the old customer no longer maps to anyone', orphaned === null, String(orphaned));

    const { error: selfReset } = await canceller.client.rpc('reset_billing_state', {
      p_user_id: canceller.id,
    });
    check('a user cannot call the reset either', !!selfReset, selfReset?.code);
  }

  console.log('\n— inactive-partner nudge (M4) —');
  const active = await makeUser('active', 'Active', 'quitting');
  const silent = await makeUser('quiet', 'Quiet', 'quitting');
  await admin.from('match_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await active.client.rpc('enqueue_and_match');
  await silent.client.rpc('enqueue_and_match');

  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toLocaleDateString('en-CA');
  };
  const setLastCheckIn = (id, date) =>
    admin.from('profiles').update({ last_check_in_date: date }).eq('id', id);

  // Nobody is due while both are showing up.
  await setLastCheckIn(active.id, daysAgo(0));
  await setLastCheckIn(silent.id, daysAgo(0));
  let { data: nudgeDue } = await admin.rpc('pairs_needing_nudge');
  check('nobody is nudged while both are active',
    !(nudgeDue ?? []).some((r) => r.recipient_id === active.id), `${nudgeDue?.length} due overall`);

  // Two days is not yet three.
  await setLastCheckIn(silent.id, daysAgo(2));
  ({ data: nudgeDue } = await admin.rpc('pairs_needing_nudge'));
  check('two days of silence is not enough',
    !(nudgeDue ?? []).some((r) => r.recipient_id === active.id));

  // Three days is the threshold in her spec.
  await setLastCheckIn(silent.id, daysAgo(3));
  ({ data: nudgeDue } = await admin.rpc('pairs_needing_nudge'));
  const row = (nudgeDue ?? []).find((r) => r.recipient_id === active.id);
  check('three days triggers it', !!row, row ? `${row.days_silent} days silent` : 'not found');
  check('the ACTIVE partner is the recipient, not the silent one',
    row?.recipient_name === 'Active' && row?.partner_name === 'Quiet',
    `${row?.recipient_name} about ${row?.partner_name}`);
  check('it carries an address to send to', !!row?.recipient_email, row?.recipient_email);

  // If the recipient has also gone quiet, nudging them about their partner would
  // be nagging them about their own absence.
  await setLastCheckIn(active.id, daysAgo(4));
  ({ data: nudgeDue } = await admin.rpc('pairs_needing_nudge'));
  check('a recipient who is also absent is not nudged',
    !(nudgeDue ?? []).some((r) => r.recipient_id === active.id));

  // Once nudged, not again this week. Her principle is no nagging.
  await setLastCheckIn(active.id, daysAgo(0));
  await admin.from('notification_log').insert({
    user_id: active.id, kind: 'inactive_nudge', local_date: daysAgo(0),
  });
  ({ data: nudgeDue } = await admin.rpc('pairs_needing_nudge'));
  check('not nudged twice in the same week',
    !(nudgeDue ?? []).some((r) => r.recipient_id === active.id));

  const { error: nudgeDenied } = await active.client.rpc('pairs_needing_nudge');
  check('a user cannot run the nudge query', !!nudgeDenied, nudgeDenied?.code);

  // ---------------------------------------------------------------------------
  // One notification per event (regression, 1 Sept)
  //
  // The send job runs every 5 minutes and looks 15 minutes back, so it meets
  // every check-in three times. Only streak_reminder had an index to lose the
  // race against, so partner_checked_in was inserted afresh on each pass and
  // Kane's single check-in buzzed Salomeh's phone three times, ten minutes
  // apart. 0020 makes the source row the key.
  //
  // Asserted against the database rather than the handler: the claim is only
  // trustworthy if the INDEX refuses it, not if the code remembers to look.
  // ---------------------------------------------------------------------------
  console.log('\n— one notification per source event —');

  const claimDate = daysAgo(0);
  const checkInSource = '11111111-1111-4111-8111-111111111111';
  const otherSource = '22222222-2222-4222-8222-222222222222';
  const claim = (userId, kind, sourceId, localDate = claimDate) =>
    admin.from('notification_log')
      .insert({ user_id: userId, kind, local_date: localDate, source_id: sourceId });

  const { error: firstClaim } = await claim(active.id, 'partner_checked_in', checkInSource);
  check('the first claim on a check-in succeeds', !firstClaim, firstClaim?.message);

  const { error: secondClaim } = await claim(active.id, 'partner_checked_in', checkInSource);
  check('a second run cannot claim the same check-in',
    secondClaim?.code === '23505', secondClaim?.code ?? 'inserted again');

  // The precedence rule: relabelling the same event must not buy a second push.
  const { error: relabelled } = await claim(active.id, 'partner_returned', checkInSource);
  check('nor can it, relabelled as a return',
    relabelled?.code === '23505', relabelled?.code ?? 'inserted again');

  // Both halves of a pairing are told about the same match row.
  const { error: partnerClaim } = await claim(silent.id, 'matched', checkInSource);
  check('the other partner is still told about the same event',
    !partnerClaim, partnerClaim?.message);

  // A rematch after a goal change is a genuine second event on one day, and the
  // local date alone would have suppressed it.
  const { error: secondEvent } = await claim(active.id, 'matched', otherSource);
  check('a genuinely different event on the same day still sends',
    !secondEvent, secondEvent?.message);

  // Reminders and nudges carry no source row, and neither do the rows written
  // before 0020, so the index must not touch them.
  const { error: nullOne } = await claim(active.id, 'inactive_nudge', null, daysAgo(1));
  const { error: nullTwo } = await claim(active.id, 'inactive_nudge', null, daysAgo(1));
  check('rows with no source event are left alone by the new index',
    !nullOne && !nullTwo, `${nullOne?.code ?? 'ok'} / ${nullTwo?.code ?? 'ok'}`);

  // And the original cap is untouched.
  await claim(active.id, 'streak_reminder', null, daysAgo(2));
  const { error: twiceInADay } = await claim(active.id, 'streak_reminder', null, daysAgo(2));
  check('a reminder is still capped at one per local day',
    twiceInADay?.code === '23505', twiceInADay?.code ?? 'inserted again');

  // ---------------------------------------------------------------------------
  // Nobody is stranded (regression, 12 Aug)
  //
  // Enqueueing used to happen only on FindingPartner, a screen you pass through
  // once, straight after picking a goal. Anything interrupting that single
  // moment left a real user with a goal, no match and no queue row, and nothing
  // ever retried: every later visit routed them to HomeEmpty, which promised
  // "Finding your match" while no search existed. Salomeh's Mia account sat in
  // that state for four days and surfaced only when a friend signed up on the
  // same goal and no match happened.
  //
  // Asserted over the WHOLE table rather than a fixture, because the failure was
  // invisible precisely by looking correct on every individual screen.
  // ---------------------------------------------------------------------------
  console.log('\n— nobody stranded (has a goal, but neither matched nor queued) —');

  // Real accounts only. The suite's own fixtures are parked in deliberately odd
  // states while it runs (ended matches, lapsed plans, mid-requeue), so
  // including them would fail this every time for the wrong reason.
  const { data: withGoal } = await admin
    .from('profiles').select('id, email')
    .not('current_goal', 'is', null)
    .not('email', 'like', `%${DOMAIN}`);
  const { data: liveMatches } = await admin
    .from('matches').select('user_a, user_b').eq('status', 'active');
  const { data: waitingRows } = await admin
    .from('match_queue').select('user_id').eq('status', 'waiting');

  const pairedIds = new Set((liveMatches ?? []).flatMap((m) => [m.user_a, m.user_b]));
  const queuedIds = new Set((waitingRows ?? []).map((q) => q.user_id));
  const orphans = (withGoal ?? []).filter((p) => !pairedIds.has(p.id) && !queuedIds.has(p.id));

  check('every user with a goal is either matched or waiting',
    orphans.length === 0,
    orphans.length ? orphans.map((o) => o.email).join(', ') : `${withGoal?.length ?? 0} checked`);

  await wipeTestUsers();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\nTest run threw:', err.message);
  await wipeTestUsers();
  process.exit(1);
});
