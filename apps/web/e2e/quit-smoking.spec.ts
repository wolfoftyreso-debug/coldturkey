import { expect, test } from '@playwright/test';
import { newEmail, signUp } from './helpers';

/**
 * The journey the quit-smoking page sends people on.
 *
 * `/sluta-roka` answers the question and then offers the product. This is what
 * happens next, and it is the one flow where the numbers have to be right the
 * first time: somebody who types their pack price and is shown a figure that
 * is obviously wrong has learned that the app does not know what it is talking
 * about, on the screen where it was supposed to earn their attention.
 */
test.describe('somebody quitting smoking', () => {
  test('prices a pack, not a cigarette, and sees a year worth of it', async ({ page }) => {
    await signUp(page, newEmail('smoker'));
    await page.goto('/plan');

    // Nicotine is the second chip.
    const chips = page.locator('button.chip');
    await expect(chips.first()).toBeVisible();
    await chips.nth(1).click();

    // The label names the unit. It used to render "Ungefär vad kostade ett ?"
    // — the interpolation was stripped rather than filled.
    await expect(page.locator('label[for="units"]')).not.toContainText('{');
    // Either language: the suite runs against an English-negotiating browser,
    // and what matters is that the label names the pack rather than a unit.
    await expect(page.locator('label[for="cost"]')).toContainText(/paket|pack/i);

    // The pack-size field only exists for substances bought by the pack, and
    // it arrives pre-filled with twenty.
    const size = page.locator('#size');
    await expect(size).toHaveValue('20');

    await page.fill('#units', '20');
    await page.fill('#cost', '75');
    await page.locator('.card button.btn.primary.wide').first().click();

    await page.goto('/home');
    await expect(page.locator('.daycount')).toBeVisible();

    // 20 a day at 75 kr a pack is 27 375 kr a year. The projection on the
    // screen has to be that number and not, say, twenty times it — which is
    // what a per-cigarette price of 75 kr would have produced.
    // Locale-agnostic on the thousands separator: sv-SE uses a non-breaking
    // space, en-GB a comma, and which the browser negotiates is not what this
    // test is about.
    const body = await page.locator('main').innerText();
    expect(body).toMatch(/27[\s,.\u00a0\u202f]?375/);
  });

  test('is not warned about medical detox, the way somebody quitting drinking is', async ({
    page,
  }) => {
    // Getting this wrong in either direction matters. A detox warning here is
    // noise that teaches people to ignore the one that saves a life.
    await signUp(page, newEmail('nodetox'));
    await page.goto('/plan');
    await page.locator('button.chip').nth(1).click();
    await page.locator('.card button.btn.primary.wide').first().click();

    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/livsfarlig|kramper|life-threatening|seizure/i);
  });

  test('the public page hands them a working way in', async ({ page }) => {
    await page.goto('/sluta-roka');
    // Every claim about a body names who established it.
    // The public pages are Swedish regardless of the browser: a signed-out
    // visitor has told us nothing and this deployment is Swedish-first.
    await expect(page.getByText('Källa: NHS').first()).toBeVisible();
    await expect(page.getByText('Källa: CDC').first()).toBeVisible();
    // And the honest half is on the page, not just the benefits.
    await expect(page.getByText('Det som inte står på tidslinjen')).toBeVisible();

    await page.getByRole('link', { name: /Vad Cleat är/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
