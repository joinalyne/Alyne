// Pins the suite's timezone before anything touches a Date, so a test gives the
// same answer in Victoria, in London and on CI.
//
// Its own file, loaded first in setupFiles, for a boring but fatal reason: ES
// imports are hoisted, so this assignment sitting above the imports in
// test-setup.ts would still execute AFTER them, and after anything they format.
//
// Assigned in JavaScript rather than set as a TZ variable on the npm script,
// because `TZ=... <command>` is silently ignored on Windows while assigning
// process.env.TZ works on every platform. Both verified on 2026-09-11, which is
// worth knowing before "just pin TZ in the config" gets suggested again: the
// obvious spelling of that fix works on Salomeh's machine and does nothing on
// Jerome's.
//
// What this buys is determinism, and determinism is NOT coverage. Pinning to UTC
// would by itself hide the class of bug Salomeh was asking about, because
// nothing would ever run behind UTC. So the date logic in src/lib/dates.ts takes
// an explicit `timeZone` and is asserted across North American zones directly.
process.env.TZ = 'UTC';
