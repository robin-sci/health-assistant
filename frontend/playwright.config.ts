import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the live Docker stack.
 * Start the stack before running: docker compose up -d && make seed
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  /* Fail fast in CI — no accidental committed `.only` */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    /* Dark-themed app — capture full viewport screenshots on failure */
    screenshot: 'only-on-failure',
  },
  projects: [
    /* ── Global auth setup (runs once, saves localStorage state) ─────────── */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    /* ── Chromium (all spec files depend on auth setup) ──────────────────── */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
