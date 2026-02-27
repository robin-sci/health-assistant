import { test, expect } from '@playwright/test';

/**
 * Dashboard page E2E tests.
 *
 * Verifies the personal health dashboard renders correctly with seeded data.
 * Requires `make seed` to have been run so the stat cards show non-zero values.
 *
 * Auth state is loaded from e2e/.auth/user.json (created by auth.setup.ts).
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  /* Wait for the main heading to confirm the page has hydrated */
  await expect(
    page.getByRole('heading', { name: 'Health Dashboard' })
  ).toBeVisible({ timeout: 10_000 });
});

test.describe('layout', () => {
  test('shows the page heading and subtitle', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Health Dashboard' })
    ).toBeVisible();
    await expect(
      page.getByText('Your personal health overview at a glance')
    ).toBeVisible();
  });

  test('sidebar is visible with navigation links', async ({ page }) => {
    /* Desktop sidebar — should be rendered */
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Chat' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Symptoms' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Labs' })).toBeVisible();
  });
});

test.describe('stat cards', () => {
  test('shows Symptoms This Week card', async ({ page }) => {
    await expect(page.getByText('Symptoms This Week')).toBeVisible();
    await expect(page.getByText('Logged in the last 7 days')).toBeVisible();
  });

  test('shows Lab Results card', async ({ page }) => {
    await expect(page.getByText('Lab Results')).toBeVisible();
    await expect(page.getByText('Blood test records')).toBeVisible();
  });

  test('shows Documents card', async ({ page }) => {
    await expect(page.getByText('Documents')).toBeVisible();
    await expect(page.getByText('Medical files uploaded')).toBeVisible();
  });

  test('shows Chat Sessions card', async ({ page }) => {
    await expect(page.getByText('Chat Sessions')).toBeVisible();
    await expect(page.getByText('AI health conversations')).toBeVisible();
  });
});

test.describe('weekly trends', () => {
  test('shows Weekly Trends section heading', async ({ page }) => {
    await expect(page.getByText('Weekly Trends')).toBeVisible();
  });

  test('shows trend chart container', async ({ page }) => {
    /* The recharts ResponsiveContainer renders an SVG */
    const chartArea = page.locator('.recharts-responsive-container').first();
    await expect(chartArea).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('daily overview', () => {
  test('shows Recent Symptoms section', async ({ page }) => {
    await expect(page.getByText('Recent Symptoms')).toBeVisible();
  });

  test('shows Latest Labs section', async ({ page }) => {
    await expect(page.getByText('Latest Labs')).toBeVisible();
  });
});

test.describe('quick actions', () => {
  test('shows Quick Actions section', async ({ page }) => {
    await expect(page.getByText('Quick Actions')).toBeVisible();
  });

  test('Log Symptom action navigates to /symptoms', async ({ page }) => {
    const logSymptomLink = page.getByRole('link', { name: /Log Symptom/i });
    await expect(logSymptomLink).toBeVisible();
    await logSymptomLink.click();
    await page.waitForURL('**/symptoms');
    await expect(
      page.getByRole('heading', { name: 'Symptom Tracking' })
    ).toBeVisible();
  });

  test('Upload Document action navigates to /documents', async ({ page }) => {
    const uploadLink = page.getByRole('link', { name: /Upload Document/i });
    await expect(uploadLink).toBeVisible();
    await uploadLink.click();
    await page.waitForURL('**/documents');
  });

  test('Start Chat action navigates to /chat', async ({ page }) => {
    const chatLink = page.getByRole('link', { name: /Start Chat/i });
    await expect(chatLink).toBeVisible();
    await chatLink.click();
    await page.waitForURL('**/chat');
  });
});
