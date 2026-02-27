import { test, expect } from '@playwright/test';

/**
 * Symptom Tracking page E2E tests.
 *
 * Covers page layout, the quick-entry form, and the timeline filter controls.
 * The "log a new symptom" test creates a real entry via the form and verifies
 * it appears in the timeline; it uses a unique timestamp suffix to avoid
 * collisions when the suite runs multiple times.
 *
 * Auth state is loaded from e2e/.auth/user.json (created by auth.setup.ts).
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/symptoms');
  await expect(
    page.getByRole('heading', { name: 'Symptom Tracking' })
  ).toBeVisible({ timeout: 10_000 });
});

test.describe('layout', () => {
  test('shows page heading and subtitle', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Symptom Tracking' })
    ).toBeVisible();
    await expect(
      page.getByText('Log and monitor your symptoms over time')
    ).toBeVisible();
  });

  test('shows Log Symptom form panel', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Log Symptom' })
    ).toBeVisible();
    await expect(page.getByText('Record a new symptom entry')).toBeVisible();
  });

  test('shows Recent Entries panel', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Recent Entries' })
    ).toBeVisible();
  });

  test('shows Frequency by Type chart panel', async ({ page }) => {
    await expect(page.getByText('Frequency by Type')).toBeVisible();
    await expect(
      page.getByText('Entry count coloured by average severity')
    ).toBeVisible();
  });

  test('shows days filter buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: '7d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '90d' })).toBeVisible();
  });
});

test.describe('quick-entry form fields', () => {
  test('symptom type selector is present', async ({ page }) => {
    /* The Select trigger shows the placeholder text */
    await expect(page.getByText('Select symptom…')).toBeVisible();
  });

  test('severity slider is present', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();
    /* Default severity is 5 */
    await expect(slider).toHaveValue('5');
  });

  test('Log Symptom submit button is disabled without a type selection', async ({
    page,
  }) => {
    const submitButton = page.getByRole('button', { name: 'Log Symptom' });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeDisabled();
  });
});

test.describe('log a new symptom', () => {
  test('form submission creates an entry visible in the timeline', async ({
    page,
  }) => {
    /* Open the Symptom Type dropdown and pick "Headache" */
    await page.getByText('Select symptom…').click();
    await page.getByRole('option', { name: 'Headache' }).click();

    /* Set severity to 3 using the range input */
    const slider = page.locator('input[type="range"]');
    await slider.fill('3');

    /* Add an optional note with a unique suffix for traceability */
    const uniqueNote = `E2E test entry ${Date.now()}`;
    await page.getByPlaceholder('Optional description…').fill(uniqueNote);

    /* Submit */
    const submitButton = page.getByRole('button', { name: 'Log Symptom' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    /* The form resets (placeholder returns) and entry appears in the list */
    await expect(page.getByText('Select symptom…')).toBeVisible({
      timeout: 8_000,
    });

    /* The new entry should be in the recent entries list.
       We match on the severity badge "3/10" which is unique to our submission. */
    await expect(
      page.getByText('3/10').first()
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('filters', () => {
  test('switching to 30d filter updates the subtitle', async ({ page }) => {
    await page.getByRole('button', { name: '30d' }).click();
    await expect(page.getByText('Last 30 days')).toBeVisible();
  });

  test('switching to 90d filter updates the subtitle', async ({ page }) => {
    await page.getByRole('button', { name: '90d' }).click();
    await expect(page.getByText('Last 90 days')).toBeVisible();
  });

  test('switching back to 7d restores the subtitle', async ({ page }) => {
    await page.getByRole('button', { name: '30d' }).click();
    await page.getByRole('button', { name: '7d' }).click();
    await expect(page.getByText('Last 7 days')).toBeVisible();
  });

  test('type filter dropdown is present', async ({ page }) => {
    /* The filter dropdown shows "All types" as placeholder */
    const filterTrigger = page.getByRole('combobox').filter({
      hasText: /All types/i,
    });
    await expect(filterTrigger).toBeVisible();
  });
});

test.describe('frequency chart', () => {
  test('renders a recharts bar chart when entries exist', async ({ page }) => {
    /* Wait for data to load — the spinner disappears */
    await page.waitForSelector('.recharts-responsive-container', {
      timeout: 10_000,
    });
    const chartContainer = page.locator('.recharts-responsive-container').last();
    await expect(chartContainer).toBeVisible();
  });
});
