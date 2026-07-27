// Alyne — seed script: fills a fresh database with realistic demo data
// so every screen (and /admin) has something to show during QA.
//
// Prereqs:
//   1. The schema from Alyne-Schema-Proposal.md has been applied in Supabase.
//   2. Env vars (never commit the service key):
//        SUPABASE_URL          — project URL
//        SUPABASE_SERVICE_KEY  — service_role key (Dashboard → Settings → API)
//
// Run:    node scripts/seed.mjs          # create demo data
// Reset:  node scripts/seed.mjs --reset  # delete all demo users + their data
//
// All demo users share the password below and use @seed.alyne emails so
// they're easy to spot and safe to bulk-delete.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = 'alyne-demo-1234';
const TZ = 'America/Vancouver';

// name, goal, current streak, days since last check-in (0 = today)
const USERS = [
  ['Dana',   'fitness',     9,  0],
  ['Chris',  'fitness',     0,  4],   // ← inactive: makes pair 1 show in /admin flagged
  ['Sam',    'writing',    12,  0],
  ['Lee',    'writing',    12,  1],
  ['Alex',   'mindfulness', 5,  0],
  ['Jamie',  'mindfulness',12,  0],
  ['Jordan', 'fitness',     0, -1],   // -1 = never checked in; waiting in queue
  ['Robin',  'quitting',    0, -1],   // waiting in queue
];
const PAIRS = [[0, 1], [2, 3], [4, 5]]; // indexes into USERS
const QUEUE = [6, 7];

const email = (name) => `${name.toLowerCase()}@seed.alyne`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const localDate = (d) => d.toISOString().slice(0, 10); // good enough for seeding

async function reset() {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const demo = data.users.filter((u) => u.email?.endsWith('@seed.alyne'));
  for (const u of demo) {
    await db.auth.admin.deleteUser(u.id); // cascades through profiles → everything
    console.log('deleted', u.email);
  }
  console.log(`reset done (${demo.length} demo users removed)`);
}

async function seed() {
  // 1) auth users + profiles
  const ids = [];
  for (const [name, goal, streak, silentDays] of USERS) {
    const { data, error } = await db.auth.admin.createUser({
      email: email(name),
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${name}: ${error.message}`);
    const id = data.user.id;
    ids.push(id);
    const lastCheckIn = silentDays >= 0 ? localDate(daysAgo(silentDays)) : null;
    const { error: pErr } = await db.from('profiles').upsert({
      id,
      email: email(name),
      display_name: name,
      timezone: TZ,
      current_goal: goal,
      plan: 'free',
      current_streak: streak,
      last_check_in_date: lastCheckIn,
    });
    if (pErr) throw new Error(`profile ${name}: ${pErr.message}`);
    console.log('user', name, '→', id.slice(0, 8));
  }

  // 2) matches
  for (const [a, b] of PAIRS) {
    const { error } = await db.from('matches').insert({
      goal: USERS[a][1],
      user_a: ids[a],
      user_b: ids[b],
      status: 'active',
    });
    if (error) throw new Error(`match ${USERS[a][0]}/${USERS[b][0]}: ${error.message}`);
    console.log('match', USERS[a][0], '↔', USERS[b][0]);
  }

  // 3) check-in history — one text check-in per streak day, ending at their last active day
  const { data: matches } = await db.from('matches').select('id, user_a, user_b');
  const matchOf = (id) => matches.find((m) => m.user_a === id || m.user_b === id)?.id ?? null;
  for (let i = 0; i < USERS.length; i++) {
    const [name, , streak, silentDays] = USERS[i];
    if (silentDays < 0) continue; // queue-only users have no history
    const history = Math.max(streak, 1); // broken-streak users still get 1 old check-in
    const rows = [];
    for (let d = 0; d < history; d++) {
      rows.push({
        user_id: ids[i],
        match_id: matchOf(ids[i]),
        type: 'text',
        body: `Day ${history - d} — showed up. (seed)`,
        local_date: localDate(daysAgo(silentDays + d)),
      });
    }
    const { error } = await db.from('check_ins').insert(rows);
    if (error) throw new Error(`check_ins ${name}: ${error.message}`);
    console.log('check-ins', name, `×${rows.length}`);
  }

  // 4) waiting queue (FIFO — Jordan enqueued before Robin)
  for (let q = 0; q < QUEUE.length; q++) {
    const i = QUEUE[q];
    const { error } = await db.from('match_queue').insert({
      user_id: ids[i],
      goal: USERS[i][1],
      status: 'waiting',
      enqueued_at: daysAgo(2 - q).toISOString(),
    });
    if (error) throw new Error(`queue ${USERS[i][0]}: ${error.message}`);
    console.log('queued', USERS[i][0]);
  }

  console.log('\nseed complete ✓');
  console.log(`log in as any demo user, e.g. dana@seed.alyne / ${PASSWORD}`);
  console.log('pair Dana/Chris should appear FLAGGED in /admin (Chris silent 4 days)');
}

process.argv.includes('--reset') ? await reset() : await seed();
