/**
 * E2E Test: Full Happy Path
 *
 * Tests the complete workflow: register → search → select → typeset → cover → order
 *
 * Validates: Requirements 13.1, 14.1, 14.6
 */
import { test, expect } from '@playwright/test';
import { registerViaUI, uniqueEmail } from './helpers';

test.describe('Happy Path: Register → Search → Select → Typeset → Cover → Order', () => {
  test('completes the full book creation workflow', async ({ page }) => {
    // Step 1: Register a new user
    const { email } = await registerViaUI(page);
    await expect(page).toHaveURL('/');

    // Verify we're logged in (nav should show user-specific links)
    await expect(page.getByRole('link', { name: /bookshelf/i })).toBeVisible();

    // Step 2: Navigate to search and find a book
    await page.getByRole('link', { name: /search|find a book/i }).first().click();
    await expect(page).toHaveURL('/search');

    // Search for a public domain book
    await page.getByPlaceholder(/search/i).fill('Frankenstein');
    await page.getByRole('button', { name: /search/i }).click();

    // Wait for results to appear
    await expect(page.locator('.result-item').first()).toBeVisible({ timeout: 15_000 });

    // Step 3: Select a book from results
    await page.locator('.result-item').first().click();

    // Should navigate to the project workflow page
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 });

    // Verify project loaded with title
    await expect(page.locator('h1')).toContainText(/frankenstein/i, { timeout: 10_000 });

    // Step 4: Progress through the workflow - skip typo correction
    const skipButton = page.getByRole('button', { name: /skip/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    } else {
      // Advance past source step
      const continueButton = page.getByRole('button', { name: /continue/i });
      if (await continueButton.isVisible()) {
        await continueButton.click();
      }
      // Then skip typo correction
      await page.getByRole('button', { name: /skip/i }).click();
    }

    // Step 5: Typeset - generate interior PDF
    await expect(page.getByText(/typeset/i)).toBeVisible();
    await page.getByRole('button', { name: /generate pdf/i }).click();

    // Wait for typesetting to complete (may take time with Celery task)
    await expect(page.getByText(/cover/i).first()).toBeVisible({ timeout: 120_000 });

    // Step 6: Cover creation
    // Either open cover builder or use default
    const coverBuilderLink = page.getByRole('link', { name: /cover builder/i });
    const generateCoverButton = page.getByRole('button', { name: /generate|create cover/i });

    if (await coverBuilderLink.isVisible()) {
      await coverBuilderLink.click();
      // In cover builder, wait for images to generate
      await expect(page.locator('[data-testid="cover-preview"], .cover-preview, canvas')).toBeVisible({ timeout: 120_000 });
      // Use default/first generated cover
      const confirmButton = page.getByRole('button', { name: /confirm|save|done|use this/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    } else if (await generateCoverButton.isVisible()) {
      await generateCoverButton.click();
      await expect(page.getByText(/print/i)).toBeVisible({ timeout: 120_000 });
    }

    // Step 7: Print submission
    await expect(page.getByText(/print|order/i).first()).toBeVisible({ timeout: 30_000 });
    const orderButton = page.getByRole('button', { name: /order|print|submit/i });
    if (await orderButton.isVisible()) {
      await orderButton.click();
    }

    // Verify order confirmation or success message
    await expect(
      page.getByText(/order.*submitted|confirmation|success|ordered/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('can resume workflow from last completed step', async ({ page }) => {
    // Register and start a workflow
    await registerViaUI(page);

    // Navigate to search and select a book
    await page.getByRole('link', { name: /search|find a book/i }).first().click();
    await page.getByPlaceholder(/search/i).fill('Pride and Prejudice');
    await page.getByRole('button', { name: /search/i }).click();
    await expect(page.locator('.result-item').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('.result-item').first().click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 });

    // Get the project URL
    const projectUrl = page.url();

    // Navigate away (simulate leaving the workflow)
    await page.goto('/bookshelf');
    await expect(page).toHaveURL('/bookshelf');

    // Navigate back to the project
    await page.goto(projectUrl);

    // Verify we can resume - project data should still be loaded
    await expect(page.locator('h1')).not.toBeEmpty();
    // The workflow step indicator should show progress
    await expect(page.locator('.steps, .step, [data-testid="workflow-steps"]')).toBeVisible();
  });
});
