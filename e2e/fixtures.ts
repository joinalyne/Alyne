import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
) as Record<string, string>;

export const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

export const PASSWORD = 'alyne-e2e-1234';
export const TEST_DOMAIN = '@test.alyne';

/**
 * Create a confirmed user directly.
 *
 * Not via the sign-up form: email confirmation is switched on, so a UI sign-up
 * would sit at /check-email waiting for a link no test can click. Sign-IN is
 * still driven through the real UI, which is the part worth exercising.
 */
export async function createConfirmedUser(handle: string) {
  const email = `e2e-${handle}${TEST_DOMAIN}`;
  await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  return email;
}

export async function wipeTestUsers() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  await Promise.all(
    data.users
      .filter((u) => u.email?.endsWith(TEST_DOMAIN))
      .map((u) => admin.auth.admin.deleteUser(u.id)),
  );
}

/** Clear the queue so a leftover waiting row cannot pair with a fresh test user. */
export async function clearQueue() {
  await admin.from('match_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

/** Sign in through the actual form. */
export async function signIn(page: Page, email: string) {
  await page.goto('/');
  // The form opens in sign-up mode; switch to log in.
  await page.getByRole('button', { name: /Already have an account/ }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
}

/** Complete name and goal, which is where sign-in lands a brand new user. */
export async function completeOnboarding(page: Page, name: string, goalLabel: string) {
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: goalLabel, exact: false }).click();
  await page.getByRole('button', { name: 'Find My Partner' }).click();
}
