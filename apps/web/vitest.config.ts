import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment: these tests read the stylesheet as text and compute
    // contrast ratios. Nothing here needs a DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
