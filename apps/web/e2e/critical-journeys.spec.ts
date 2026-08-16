import { expect, test } from '@playwright/test';
import {
  expectNoConsoleErrors,
  failOnConsoleErrors,
  newEmail,
  PASSWORD,
  signIn,
  signUp,
} from './helpers';

/**
 * The journeys this product cannot get wrong, from the browser inwards.
 *
 * Each of these crosses every layer — browser, CSP, network, API, business
 * logic, Postgres, and back to the screen. That whole-chain coverage is the
 * point: every one of these layers had passing tests while the app was
 * completely unusable in the shipped configuration.
 */

test.describe('crisis surface', () => {
  test('the crisis page works with no account and no JavaScript', async ({ browser }) => {
    // Somebody in crisis must not have to sign up, and must not depend on a
    // bundle loading. This is the single most important page in the product,
    // so it is tested with scripting switched off entirely.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/kris');

    const body = await page.textContent('body');
    expect(body).toContain('112');

    // Every emergency number must be a real tel: link — one tap, no typing, by
    // somebody whose hands may not be steady.
    const telephone = page.locator('a[href^="tel:"]');
    expect(await telephone.count()).toBeGreaterThanOrEqual(3);
    await context.close();
  });

  test('the landing page offers help before it offers features', async ({ page }) => {
    const errors = failOnConsoleErrors(page);
    await page.goto('/');
    const body = (await page.textContent('body')) ?? '';
    expect(body).toContain('112');
    expectNoConsoleErrors(errors);
  });
});

test.describe('first run', () => {
  test('sign up, make a plan, and see it on the home screen', async ({ page }) => {
    const errors = failOnConsoleErrors(page);
    await signUp(page, newEmail('firstrun'));

    // A brand new account is told what to do, not shown an empty dashboard.
    await expect(page.getByRole('link', { name: /start here|börja här/i })).toBeVisible();

    await page.goto('/plan');
    const chips = page.locator('button.chip');
    await expect(chips.first()).toBeVisible();
    await chips.nth(1).click();
    await page.locator('.card button.btn.primary.wide').first().click();

    await page.goto('/home');
    // The plan exists, so the day counter replaced the prompt.
    await expect(page.locator('.daycount')).toBeVisible();

    // Day zero is not an achievement. The badge only appears once an earlier
    // streak has actually been beaten.
    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toMatch(/längre än du någonsin|longer than you have ever/i);

    expectNoConsoleErrors(errors);
  });

  test('the craving flow asks about danger before anything else', async ({ page }) => {
    const errors = failOnConsoleErrors(page);
    await signUp(page, newEmail('craving'));
    await page.goto('/craving');
    // Works with no plan and no history — the state a person is most likely to
    // be in the first time they need it.
    const body = (await page.textContent('body')) ?? '';
    expect(body).toMatch(/omedelbar fara|immediate danger/i);
    expectNoConsoleErrors(errors);
  });
});

test.describe('a failed save says so', () => {
  test('an unreachable API produces an error, not a silent no-op', async ({ page }) => {
    // Every mutation handler was written as try/finally with no catch: the
    // request failed, the spinner stopped, and what the person wrote was gone
    // with nothing on screen to say so.
    const errors = failOnConsoleErrors(page);
    await signUp(page, newEmail('savefail'));
    await page.goto('/plan');
    await expect(page.locator('button.chip').first()).toBeVisible();

    await page.route('**/v1/me/profile', (route) => route.abort('failed'));

    const why = page.locator('textarea').first();
    await why.fill('Detta får inte försvinna tyst.');
    await page.getByRole('button', { name: /^(spara|save)$/i }).first().click();

    await expect(page.locator('.error-banner')).toBeVisible();
    // And what they wrote is still on screen, which is what the message promises.
    await expect(why).toHaveValue('Detta får inte försvinna tyst.');

    expectNoConsoleErrors(errors, [
      // The aborted request is the point of the test.
      /Failed to load resource/,
      /net::ERR_FAILED/,
      /ERR_FAILED/,
    ]);
  });
});

test.describe('data rights', () => {
  /**
   * Export and erasure, through the buttons rather than through the endpoints.
   *
   * The delete button sent the confirmation word and nothing else, while the
   * endpoint has always required the password too — so the one control in the
   * product that exercises the right to erasure failed on every press. The API
   * tests never saw it, because they called the endpoint the way it was
   * documented instead of the way the app called it. Only a browser can tell
   * those two apart.
   */
  test('a person can export their data and then really delete the account', async ({ page }) => {
    const errors = failOnConsoleErrors(page);
    const email = newEmail('erasure');
    await signUp(page, email);

    await page.goto('/settings');
    await page.getByRole('button', { name: /exportera allt|export everything/i }).click();
    await expect(page.getByText(/export klar|export complete/i)).toBeVisible();

    const deleteWord = page.locator('#delete-confirm');
    const deleteButton = page.getByRole('button', { name: /^(radera|delete)$/i });

    // The word alone must not be enough to arm the button — that was the shape
    // of the request that could never succeed. Taken from the placeholder
    // rather than hard-coded, so the test does not depend on the locale a new
    // account happens to start in.
    await deleteWord.fill((await deleteWord.getAttribute('placeholder')) ?? 'DELETE');
    await expect(deleteButton).toBeDisabled();

    // A wrong password must say so, and must delete nothing.
    await page.locator('#delete-password').fill('not-the-right-password');
    await deleteButton.click();
    await expect(page.locator('.error-banner')).toBeVisible();
    await expect(page).toHaveURL(/\/settings/);

    await page.locator('#delete-password').fill(PASSWORD);
    await deleteButton.click();
    await page.waitForURL('**/login', { timeout: 20_000 });

    // Gone means gone: the credentials that worked a moment ago no longer do.
    await signIn(page, email);
    await expect(page.locator('.error-banner')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    expectNoConsoleErrors(errors, [
      // The two deliberate failures above are 401s, and the browser logs every
      // one of them as a console error.
      /Failed to load resource/,
      /401/,
    ]);
  });
});

test.describe('session', () => {
  test('a signed-out visitor cannot reach a private page', async ({ page }) => {
    await page.goto('/home');
    await page.waitForURL('**/login', { timeout: 20_000 });
  });

  test('signing out clears the session', async ({ page }) => {
    await signUp(page, newEmail('signout'));
    await page.goto('/settings');
    await page.getByRole('button', { name: /^(logga ut|sign out)$/i }).click();
    await page.waitForURL('**/login', { timeout: 20_000 });
    await page.goto('/home');
    await page.waitForURL('**/login', { timeout: 20_000 });
  });
});
