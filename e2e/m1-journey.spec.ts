import { test, expect, type BrowserContext } from '@playwright/test';
import {
  admin, createConfirmedUser, wipeTestUsers, clearQueue, signIn, completeOnboarding, PASSWORD,
} from './fixtures';

test.beforeEach(async () => {
  await wipeTestUsers();
  await clearQueue();
});

test.afterAll(async () => {
  await wipeTestUsers();
  await clearQueue();
});

test('signed-out visitors cannot reach the app', async ({ page }) => {
  // Every route was publicly reachable before M1, /admin included.
  for (const path of ['/home', '/settings', '/admin', '/check-in']) {
    await page.goto(path);
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
  }
});

test('a bad password is reported, not swallowed', async ({ page }) => {
  const email = await createConfirmedUser('wrongpw');
  await page.goto('/');
  await page.getByRole('button', { name: /Already have an account/ }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill('definitely-not-the-password');
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
});

test('signing up with an existing address says so instead of hanging', async ({ page }) => {
  // Supabase returns success with an empty identities[] for a duplicate rather
  // than erroring, so without the check the user waits for an email that was
  // never sent.
  const email = await createConfirmedUser('dupe');
  await page.goto('/');
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Get Started' }).click();

  await expect(page.getByRole('alert')).toContainText(/already registered/i);
});

test('onboarding is enforced in order and resumes where it left off', async ({ page }) => {
  const email = await createConfirmedUser('onboard');
  await signIn(page, email);

  // No profile yet, so sign-in lands on profile setup.
  await expect(page.getByPlaceholder('Your name')).toBeVisible();

  // Jumping ahead is not allowed while the profile is incomplete.
  await page.goto('/home');
  await expect(page.getByPlaceholder('Your name')).toBeVisible();

  await page.getByPlaceholder('Your name').fill('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('What are you working on?')).toBeVisible();

  // Named but goal-less: /home now bounces to goal selection, not setup.
  await page.goto('/home');
  await expect(page.getByText('What are you working on?')).toBeVisible();

  // And the name survived, rather than the form starting blank again.
  await page.goto('/profile-setup');
  await expect(page.getByPlaceholder('Your name')).toHaveValue('Ada');
});

test('two people with the same goal are matched and see each other', async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  try {
    const adaEmail = await createConfirmedUser('ada');
    const boEmail = await createConfirmedUser('bo');

    const adaCtx = await browser.newContext();
    const boCtx = await browser.newContext();
    contexts.push(adaCtx, boCtx);
    const ada = await adaCtx.newPage();
    const bo = await boCtx.newPage();

    // Ada goes first and should be left waiting — nobody else is queued.
    await signIn(ada, adaEmail);
    await completeOnboarding(ada, 'Ada', 'Writing');
    await expect(ada.getByText('Finding your person')).toBeVisible();

    // Bo picks the same goal and should pair with her.
    await signIn(bo, boEmail);
    await completeOnboarding(bo, 'Bo', 'Writing');

    await expect(bo.getByText("You've been matched with Ada!")).toBeVisible({ timeout: 20_000 });
    await expect(bo.getByText('Writing')).toBeVisible();

    // Ada is polling, so she should land on Matched without touching anything.
    await expect(ada.getByText("You've been matched with Bo!")).toBeVisible({ timeout: 20_000 });

    // Home shows the real partner, not the old hardcoded "Jamie".
    await ada.getByRole('button', { name: /Say Hello/ }).click();
    // getByText('Bo') would match three nodes and trip strict mode: the name,
    // the activity line and the streak caption.
    await expect(ada.getByText('Bo', { exact: true })).toBeVisible();
    await expect(ada.getByText("Bo's streak")).toBeVisible();
    await expect(ada.getByText(/Bo hasn't checked in yet/)).toBeVisible();
    await expect(ada.getByText('Jamie')).toHaveCount(0);
    await expect(ada.getByText("You haven't checked in yet today.")).toBeVisible();

    // Sign out is only reachable from Home, which needs a match — so it is
    // tested here rather than in its own spec.
    await ada.getByRole('button', { name: 'Sign out' }).click();
    await expect(ada.getByPlaceholder('Email address')).toBeVisible();
    await ada.goto('/home');
    await expect(ada.getByPlaceholder('Email address')).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('a different goal does not cross-pair', async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  try {
    const writerEmail = await createConfirmedUser('writer');
    const lifterEmail = await createConfirmedUser('lifter');

    const c1 = await browser.newContext();
    const c2 = await browser.newContext();
    contexts.push(c1, c2);
    const writer = await c1.newPage();
    const lifter = await c2.newPage();

    await signIn(writer, writerEmail);
    await completeOnboarding(writer, 'Wren', 'Writing');
    await expect(writer.getByText('Finding your person')).toBeVisible();

    await signIn(lifter, lifterEmail);
    await completeOnboarding(lifter, 'Lee', 'Fitness');

    // Both stay waiting: the goals differ, so neither should pair.
    await expect(lifter.getByText('Finding your person')).toBeVisible();
    await writer.waitForTimeout(7_000); // longer than one poll interval
    await expect(writer.getByText('Finding your person')).toBeVisible();

    // Scoped to these two users, not a global count: real accounts may be
    // legitimately matched on the same project, and asserting on global state
    // makes this spec fail for reasons that have nothing to do with it.
    const { data: theseUsers } = await admin
      .from('profiles').select('id').in('email', [writerEmail, lifterEmail]);
    const ids = (theseUsers ?? []).map((u) => u.id);
    const { data: matches } = await admin
      .from('matches').select('id, user_a, user_b').eq('status', 'active');
    const involvingTestUsers = (matches ?? []).filter(
      (m) => ids.includes(m.user_a) || ids.includes(m.user_b),
    );
    expect(involvingTestUsers.length).toBe(0);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('a signed-in user is kept off the sign-up form', async ({ page }) => {
  const email = await createConfirmedUser('signedin');
  await signIn(page, email);
  await page.getByPlaceholder('Your name').fill('Cy');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('What are you working on?')).toBeVisible();

  // Returning to "/" from a bookmark must not show the logged-out form to
  // someone already signed in — it resumes onboarding instead.
  await page.goto('/');
  await expect(page.getByText('What are you working on?')).toBeVisible();
  await expect(page.getByPlaceholder('Email address')).toHaveCount(0);
});
