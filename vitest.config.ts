import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exclude E2E tests (should be run with Playwright test runner)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/*.spec.ts', // Playwright test files use .spec.ts
      'packages/**', // Packages have their own test runners
      'apps/**' // Apps have their own test runners
    ],
    // Include only .test.ts files in root's tests directory
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts']
  }
});
