import path from 'path';
import { test as setup, expect } from '@playwright/test';

/**
 * Global authentication setup.
 *
 * Runs once before the test suite, logs in with the admin account, and saves
 * the resulting localStorage state (JWT token + expiry) so all spec files can
 * reuse the authenticated session without repeating the login flow.
 *
 * Credentials come from the seeded admin user (see `make seed`).
 */

const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

const EMAIL = process.env.E2E_EMAIL ?? 'admin@admin.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'your-secure-password';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  /* Fill the login form */
  await page.getByLabel('Email address').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  /* Wait until we land on the dashboard — confirms auth succeeded */
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: 'Health Dashboard' })
  ).toBeVisible();

  /* Persist the localStorage tokens for every subsequent test */
  await page.context().storageState({ path: AUTH_FILE });
});
