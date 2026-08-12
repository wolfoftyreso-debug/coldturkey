import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, in a real browser, against a real API and a real database.
 *
 * This suite exists because two of the worst defects this codebase has shipped
 * were invisible to every other kind of test:
 *
 *   F11 — the Content-Security-Policy blocked every API call in the deployed
 *         configuration. Pods healthy, probes green, nothing in any log.
 *   F12 — two-factor authentication had no interface at all, and would have
 *         locked out anyone who enabled it out of band.
 *
 * Both were found by driving a browser by hand. Neither could have been found
 * by a unit test, because in both cases every layer was individually correct
 * and the defect lived in the gap between them. That is the gap this file
 * covers, and it is why these tests assert on what a person sees rather than on
 * what a function returns.
 *
 * Console errors fail the run. In an app whose failure mode is "the screen
 * looks fine and nothing works", a clean console is a load-bearing assertion.
 */
const PORT = Number(process.env.E2E_WEB_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  // Serial by default: the tests register real accounts against one database,
  // and the login rate limiter is shared. Parallelism here buys seconds and
  // costs flakes.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // A phone profile, because that is what this is used on — but a
    // Chromium-based one. `devices['iPhone 13']` forces WebKit, which is a
    // second browser download in every CI run and every container, for a suite
    // whose job is to catch integration defects rather than rendering
    // differences between engines.
    ...devices['Pixel 5'],
    // `channel: 'chromium'` uses the full browser rather than the separate
    // chrome-headless-shell build. Environments that pre-install browsers
    // (containers, locked-down CI) commonly ship one and not the other, and the
    // shell adds nothing for a suite that is exercising application behaviour.
    channel: 'chromium',
    // An escape hatch for images that place the browser somewhere Playwright
    // does not look. Unset in normal CI, where `playwright install` handles it.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'mobile-web' }],
});
