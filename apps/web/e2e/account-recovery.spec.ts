import { expect, test } from '@playwright/test';
import {
  expectNoConsoleErrors,
  failOnConsoleErrors,
  lastMailTo,
  linkIn,
  newEmail,
  signIn,
  signUp,
} from './helpers';

/**
 * Getting back into an account.
 *
 * Every piece of this existed on the server — token issue, hashing, expiry,
 * single use, session revocation, the mail, and a link pointing at
 * `PUBLIC_WEB_URL/reset` — and no client had a screen for any of it. The link
 * in every password-reset mail this product could send arrived at a 404, so
 * forgetting a password meant permanently losing the streak, the relapse
 * autopsies, the pattern history and the coach transcript.
 *
 * This runs against a real mailbox (`scripts/e2e-smtp.mjs`) because the token
 * is unreachable any other way: it is hashed in the database, and the
 * development mailer logs a digest instead of the link. Both of those are
 * deliberate, and both are why this flow was never exercised.
 */
test('forget the password, follow the mail, and get the account back', async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  const email = newEmail('recovery');
  const newPassword = 'a-different-long-enough-password';

  await signUp(page, email);
  await page.getByRole('link', { name: /inställningar|settings/i }).first().click();
  await page.getByRole('button', { name: /^(logga ut|sign out)$/i }).click();
  await page.waitForURL('**/login', { timeout: 20_000 });

  // The link that did not exist.
  await page.getByRole('link', { name: /glömt lösenordet|forgotten your password/i }).click();
  await expect(page).toHaveURL(/\/forgot/);
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: /skicka länken|send the link/i }).click();

  // The same answer either way — this form must never confirm who has an
  // account here.
  await expect(page.getByText(/finns det ett konto|if there is an account/i)).toBeVisible();

  const resetLink = linkIn(await lastMailTo(email));
  expect(resetLink).toContain('/reset?token=');

  await page.goto(resetLink);
  await page.locator('#password').fill(newPassword);
  await page.getByRole('button', { name: /spara och logga in|save and sign in/i }).click();
  await expect(page.getByText(/logga in med det nya|sign in with the new password/i)).toBeVisible();

  // The old password must be dead, and the new one must work.
  await signIn(page, email);
  await expect(page.locator('.error-banner')).toBeVisible();

  await page.locator('#password').fill(newPassword);
  await page.getByRole('button', { name: /^(logga in|sign in)$/i }).click();
  await page.waitForURL('**/home', { timeout: 20_000 });

  expectNoConsoleErrors(errors, [
    // The deliberate wrong-password attempt above is a 401.
    /Failed to load resource/,
    /401/,
  ]);
});

test('a used reset link cannot be used again', async ({ page }) => {
  const email = newEmail('reused');
  await signUp(page, email);

  await page.goto('/forgot');
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: /skicka länken|send the link/i }).click();
  await expect(page.getByText(/finns det ett konto|if there is an account/i)).toBeVisible();

  const resetLink = linkIn(await lastMailTo(email));
  await page.goto(resetLink);
  await page.locator('#password').fill('first-new-password-long-enough');
  await page.getByRole('button', { name: /spara och logga in|save and sign in/i }).click();
  await expect(page.getByText(/logga in med det nya|sign in with the new password/i)).toBeVisible();

  // Same link, second time. A reset link is a key to an account and is allowed
  // to open the door exactly once.
  await page.goto(resetLink);
  await page.locator('#password').fill('second-new-password-long-enough');
  await page.getByRole('button', { name: /spara och logga in|save and sign in/i }).click();
  await expect(page.locator('.error-banner')).toBeVisible();
});

test('a reset page opened without a link says so instead of failing', async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await page.goto('/reset');
  await expect(page.getByText(/saknar sin nyckel|missing its key/i)).toBeVisible();
  await page.goto('/verify');
  await expect(page.getByText(/förbrukad eller för gammal|been used or has expired/i)).toBeVisible();
  expectNoConsoleErrors(errors);
});

test('the verification link confirms the address', async ({ page }) => {
  const email = newEmail('verify');
  await signUp(page, email);

  // Registration sends it; nothing in the product had a page for it either.
  const verifyLink = linkIn(await lastMailTo(email));
  expect(verifyLink).toContain('/verify?token=');

  await page.goto(verifyLink);
  await expect(page.getByText(/adressen är bekräftad|address is confirmed/i)).toBeVisible();

  // Idempotent: a second click is not an error the person needs to see as a
  // failure, but it must not claim a fresh confirmation either.
  await page.goto(verifyLink);
  await expect(page.getByText(/förbrukad eller för gammal|been used or has expired/i)).toBeVisible();
});
