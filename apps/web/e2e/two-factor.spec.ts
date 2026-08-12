import { expect, test } from '@playwright/test';
import {
  expectNoConsoleErrors,
  failOnConsoleErrors,
  newEmail,
  signIn,
  signUp,
  totp,
} from './helpers';

/**
 * The whole two-factor lifecycle, through the interface a person actually uses.
 *
 * The server side of this was fully tested and completely unusable: there was
 * no way to switch it on, and an account that had it on could never sign in
 * again because the login screen assumed tokens were always present. Every API
 * test passed throughout. Only a browser could see it.
 */
test('enrol, sign in with a code, and sign in with a recovery code', async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  const email = newEmail('totp');
  await signUp(page, email);

  await page.goto('/settings');
  await page.getByRole('button', { name: /slå på tvåstegsinloggning|turn on two-step/i }).click();

  const secret = ((await page.locator('.totp-secret').innerText()) ?? '').replace(/\s/g, '');
  expect(secret.length).toBeGreaterThanOrEqual(16);

  // A wrong code must not switch anything on.
  await page.locator('#totp-code').fill('000000');
  await page.getByRole('button', { name: /bekräfta och slå på|confirm and turn on/i }).click();
  await expect(page.locator('.error-banner')).toBeVisible();

  await page.locator('#totp-code').fill(totp(secret));
  await page.getByRole('button', { name: /bekräfta och slå på|confirm and turn on/i }).click();

  // The recovery codes appear exactly once, so they had better appear.
  const codeElements = page.locator('.recovery-codes code');
  await expect(codeElements.first()).toBeVisible();
  const recoveryCodes = await codeElements.allInnerTexts();
  expect(recoveryCodes.length).toBe(10);
  await page.getByRole('button', { name: /jag har sparat dem|i've saved them/i }).click();

  // Sign out and back in — the flow that was broken.
  await page.getByRole('button', { name: /^(logga ut|sign out)$/i }).click();
  await page.waitForURL('**/login', { timeout: 20_000 });
  await signIn(page, email);

  // Challenged, not stranded. Before the fix the client wrote `undefined` as
  // its access token and sat on a screen that looked signed in.
  await expect(page.locator('#code')).toBeVisible();

  // A wrong code must not throw the person back to the password. The server
  // allows five attempts and the screen has to let them use them.
  await page.locator('#code').fill('000000');
  await page.getByRole('button', { name: /^(logga in|sign in)$/i }).click();
  await expect(page.locator('.error-banner')).toBeVisible();
  await expect(page.locator('#code')).toBeVisible();

  await page.locator('#code').fill(totp(secret));
  await page.getByRole('button', { name: /^(logga in|sign in)$/i }).click();
  await page.waitForURL('**/home', { timeout: 20_000 });

  // A recovery code works as a second factor, once.
  await page.goto('/settings');
  await page.getByRole('button', { name: /^(logga ut|sign out)$/i }).click();
  await page.waitForURL('**/login', { timeout: 20_000 });
  await signIn(page, email);
  await page.locator('#code').fill(recoveryCodes[0]!);
  await page.getByRole('button', { name: /^(logga in|sign in)$/i }).click();
  await page.waitForURL('**/home', { timeout: 20_000 });

  // And is refused the second time.
  await page.goto('/settings');
  await page.getByRole('button', { name: /^(logga ut|sign out)$/i }).click();
  await page.waitForURL('**/login', { timeout: 20_000 });
  await signIn(page, email);
  await page.locator('#code').fill(recoveryCodes[0]!);
  await page.getByRole('button', { name: /^(logga in|sign in)$/i }).click();
  await expect(page.locator('.error-banner')).toBeVisible();
  expect(page.url()).toContain('/login');

  expectNoConsoleErrors(errors, [
    // The deliberately wrong codes and the replayed recovery code.
    /Failed to load resource/,
    /401/,
    /400/,
  ]);
});
