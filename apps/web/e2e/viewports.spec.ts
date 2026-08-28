import { expect, test } from '@playwright/test';

/**
 * The public pages at every width somebody actually holds.
 *
 * The rest of this suite runs at one phone size, which proves the flows work
 * and proves nothing about the layout. Horizontal overflow is the failure that
 * matters here: on a 320-wide screen a page that scrolls sideways puts the
 * crisis numbers off the edge, and the person who needs them is the person
 * least likely to go looking.
 *
 * 320 is not a legacy size to be humoured. It is an iPhone SE in display-zoom
 * mode, and it is any phone with the system font scaled up — which is most
 * phones belonging to people over sixty.
 */
const WIDTHS = [
  { width: 320, label: 'small phone / display zoom' },
  { width: 375, label: 'iPhone SE, iPhone 13 mini' },
  { width: 393, label: 'Pixel 5' },
  { width: 430, label: 'iPhone 15 Pro Max' },
  { width: 768, label: 'tablet portrait' },
  { width: 1280, label: 'desktop' },
];

const PAGES = ['/', '/kris', '/nara', '/medberoende', '/abstinens', '/organisation'];

test.describe('public pages fit the screen', () => {
  for (const { width, label } of WIDTHS) {
    test(`no sideways scrolling at ${width}px (${label})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });

      for (const path of PAGES) {
        await page.goto(path);
        const overflow = await page.evaluate(() => {
          const root = document.scrollingElement ?? document.documentElement;
          return { scroll: root.scrollWidth, client: root.clientWidth };
        });
        // A pixel of slack for sub-pixel rounding; anything more is a layout
        // that does not fit.
        expect(
          overflow.scroll,
          `${path} scrolls sideways at ${width}px (${overflow.scroll} > ${overflow.client})`,
        ).toBeLessThanOrEqual(overflow.client + 1);
      }
    });
  }

  test('the crisis numbers stay tappable on the smallest screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/kris');

    const dialable = page.locator('a[href^="tel:"]');
    const count = await dialable.count();
    expect(count, 'the crisis page must offer numbers to ring').toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const box = await dialable.nth(index).boundingBox();
      expect(box, 'a phone number with no box is a phone number nobody can press').not.toBeNull();
      // Well under the 44px guideline, deliberately: these are inline links in
      // running text, and demanding 44 would mean redesigning the page rather
      // than catching the case that matters — a number rendered at zero size
      // or pushed off the edge.
      expect(box!.width, 'number is off the edge or collapsed').toBeGreaterThan(24);
      expect(box!.x, 'number starts off the left edge').toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, 'number runs off the right edge').toBeLessThanOrEqual(321);
    }
  });

  test('the organisation form is usable at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/organisation');

    for (const label of ['Verksamhet', 'Ditt namn']) {
      const box = await page.getByLabel(label).boundingBox();
      expect(box, `${label} has no box`).not.toBeNull();
      expect(box!.width, `${label} is unusably narrow`).toBeGreaterThan(200);
      expect(box!.x + box!.width, `${label} runs off the edge`).toBeLessThanOrEqual(321);
    }

    const button = await page.getByRole('button', { name: 'Skicka förfrågan' }).boundingBox();
    expect(button).not.toBeNull();
    expect(button!.height, 'the submit target is too small to press').toBeGreaterThanOrEqual(32);
  });
});
