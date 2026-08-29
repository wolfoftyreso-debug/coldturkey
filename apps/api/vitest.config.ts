import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The API suite talks to a real PostgreSQL and shares one schema, so the
    // files must not run concurrently against each other.
    fileParallelism: false,
    // Runs once per test file. See the file for what it clears and why.
    setupFiles: ['./vitest.setup.ts'],
    /**
     * Every suite in here talks to the API from 127.0.0.1, so they all share
     * one per-IP rate-limit bucket — and a full run makes several hundred
     * requests inside a minute. That turned arbitrary assertions into
     * intermittent 429s: a login test failing not because the login logic
     * changed but because a seat-limit suite three files earlier had spent the
     * budget. Observed once as "rejects the wrong password without revealing
     * which part was wrong", which passed on its own and failed in the full
     * run.
     *
     * The limiter is not what these files are testing, and the files that do
     * test it build their own app with explicit settings — see the contact
     * endpoint's flood test. So the shared bucket is opened here.
     */
    env: {
      RATE_LIMIT_MAX: '100000',
      SIGNUP_LIMIT_MAX: '100000',
      COACH_LIMIT_MAX: '100000',
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
