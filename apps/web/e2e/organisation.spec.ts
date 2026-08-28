import { expect, test } from '@playwright/test';
import { lastMailTo } from './helpers';

/**
 * The only conversion event the commercial side of this product has.
 *
 * Individuals never pay, so a clinic getting in touch is the whole business.
 * Until recently the page offered a `mailto:` on a domain nobody has
 * registered — every enquiry went into a bounce and nothing recorded that it
 * had happened. These journeys exist so that failure cannot come back
 * unnoticed.
 *
 * Note the budget: the endpoint allows five submissions an hour from one
 * address, which is right for a form a real clinic fills in once. This file
 * spends two of them on purpose.
 */

test.describe('organisation enquiry', () => {
  test('a clinic can ask what it costs, and hears back', async ({ page }) => {
    const email = `klinik-${Date.now()}@cleat.test`;

    await page.goto('/organisation');

    // The pricing CTA has to actually lead somewhere. It used to lead to a
    // mail client and a dead address.
    await page.getByRole('link', { name: /Hör av er/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Kontakta oss' })).toBeVisible();

    await page.getByLabel('Verksamhet').fill('Beroendemottagningen Väst');
    await page.getByLabel('Ditt namn').fill('Anna Lind');
    await page.getByLabel('E-post', { exact: false }).first().fill(email);
    await page.getByLabel(/Ungefär hur många klienter/).fill('ungefär 40');
    await page
      .getByLabel(/Något ni vill att vi vet/)
      .fill('Vi har öppenvård och undrar vad det skulle kosta.');

    await page.getByRole('button', { name: 'Skicka förfrågan' }).click();

    // A real success state, not a silently cleared form.
    await expect(page.getByText('Tack — det kom fram.')).toBeVisible();

    // And a real mail, through the product's own transport, that says so.
    const body = await lastMailTo(email);
    expect(body).toContain('förfrågan');
    // The confirmation must never echo what the sender typed — this endpoint
    // will mail any address it is given.
    expect(body).not.toContain('Beroendemottagningen Väst');
  });

  test('an unreachable API says so instead of spinning', async ({ page }) => {
    await page.goto('/organisation');
    await page.route('**/v1/contact/organisation', (route) => route.abort());

    await page.getByLabel('Verksamhet').fill('Nätverksproblem AB');
    await page.getByLabel('Ditt namn').fill('Bo Berg');
    await page.getByLabel('E-post', { exact: false }).first().fill('bo@cleat.test');
    await page.getByRole('button', { name: 'Skicka förfrågan' }).click();

    // Scoped to the form: the page has other live regions, and the message
    // that matters is the one attached to the thing the person just did.
    const alert = page.locator('form').getByRole('alert');
    await expect(alert).toHaveCount(1);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('ingenting skickades');
    // The button must come back. A form stuck on "Skickar…" is a customer lost.
    await expect(page.getByRole('button', { name: 'Skicka förfrågan' })).toBeEnabled();
  });

  test('the page no longer sends anyone to an address that bounces', async ({ page }) => {
    await page.goto('/organisation');
    const mailtos = await page.locator('a[href^="mailto:"]').count();
    expect(mailtos).toBe(0);
  });

  test('the honeypot is hidden from people and from screen readers', async ({ page }) => {
    await page.goto('/organisation');
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).not.toBeInViewport();
    // Inside an aria-hidden container, so nobody using a screen reader is
    // offered a field that would mark them as a bot.
    await expect(page.locator('[aria-hidden="true"] input[name="website"]')).toHaveCount(1);
  });
});

/**
 * The other half of the same decision.
 *
 * The public deployment has no API behind it — `/v1/contact/organisation`
 * returns Next's 404 there, checked against the live site — so the form is
 * opt-in and this suite turns it on. What must never happen is the form
 * appearing on a deployment that cannot receive it, and the honest copy is
 * what stands in its place.
 */
test('the form is only offered where something can receive it', async ({ page }) => {
  await page.goto('/organisation');
  // This suite runs the whole stack with the form enabled, so it is here.
  await expect(page.getByRole('button', { name: 'Skicka förfrågan' })).toBeVisible();
  await expect(page.getByText('Vi öppnar för förfrågningar inom kort')).toHaveCount(0);
});
