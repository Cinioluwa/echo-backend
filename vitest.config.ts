import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**/*'],
    setupFiles: ['tests/integration/setupHooks.ts'],
    hookTimeout: 120_000,
    testTimeout: 60_000,
    isolate: true,
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});
