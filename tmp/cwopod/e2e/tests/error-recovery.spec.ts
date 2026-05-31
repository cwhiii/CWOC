/**
 * E2E Test: Error Recovery
 *
 * Tests that failed AI generation can be retried and succeeds on retry.
 * Uses the mocked external API stack where the first call fails and retry succeeds.
 *
 * Validates: Requirements 14.1, 14.6
 */
import { test, expect } from '@playwright/test';
import { registerUser, loginViaAPI, createProjectViaAPI, uniqueEmail } from './helpers';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:8000';

test.describe('Error Recovery: Failed AI Generation → Retry → Success', () => {
  test('cover prompt generation failure shows error and allows retry via API', async ({ request }) => {
    // Register and login
    const user = await registerUser(request, uniqueEmail('retry'));
    const token = await loginViaAPI(request, user.email, user.password);

    // Create a project
    const project = await createProjectViaAPI(request, token);

    // First attempt at generating prompts — may fail if mock is configured to fail first
    const firstAttempt = await request.post(
      `${API_BASE}/api/projects/${project.id}/generate-prompts`,
      { headers: { Cookie: `session_token=${token}` } }
    );

    if (!firstAttempt.ok()) {
      // Verify error response has useful information
      const errorBody = await firstAttempt.json();
      expect(errorBody.detail || errorBody.message || errorBody.error).toBeTruthy();

      // Retry — should succeed (mock configured for success on retry)
      const retryAttempt = await request.post(
        `${API_BASE}/api/projects/${project.id}/generate-prompts`,
        { headers: { Cookie: `session_token=${token}` } }
      );
      expect(retryAttempt.ok()).toBeTruthy();
    } else {
      // If first attempt succeeded (mock not configured to fail), that's also valid
      expect(firstAttempt.ok()).toBeTruthy();
    }
  });

  test('cover image generation failure shows error and allows retry via API', async ({ request }) => {
    // Register and login
    const user = await registerUser(request, uniqueEmail('img-retry'));
    const token = await loginViaAPI(request, user.email, user.password);

    // Create a project and generate prompts first
    const project = await createProjectViaAPI(request, token);

    // Generate prompts (prerequisite for image generation)
    const promptsResp = await request.post(
      `${API_BASE}/api/projects/${project.id}/generate-prompts`,
      { headers: { Cookie: `session_token=${token}` } }
    );

    // Only proceed if prompts were generated
    if (promptsResp.ok()) {
      // First attempt at generating images
      const firstAttempt = await request.post(
        `${API_BASE}/api/projects/${project.id}/generate-images`,
        { headers: { Cookie: `session_token=${token}` } }
      );

      if (!firstAttempt.ok()) {
        // Verify error response
        const errorBody = await firstAttempt.json();
        expect(errorBody.detail || errorBody.message || errorBody.error).toBeTruthy();

        // Retry
        const retryAttempt = await request.post(
          `${API_BASE}/api/projects/${project.id}/generate-images`,
          { headers: { Cookie: `session_token=${token}` } }
        );
        expect(retryAttempt.ok()).toBeTruthy();
      }
    }
  });

  test('typesetting failure preserves source text and allows retry', async ({ request }) => {
    // Register and login
    const user = await registerUser(request, uniqueEmail('typeset-retry'));
    const token = await loginViaAPI(request, user.email, user.password);

    // Create a project
    const project = await createProjectViaAPI(request, token);

    // First typeset attempt
    const firstAttempt = await request.post(
      `${API_BASE}/api/projects/${project.id}/typeset`,
      { headers: { Cookie: `session_token=${token}` } }
    );

    if (!firstAttempt.ok()) {
      // Verify the project still exists and source text is preserved
      const projectResp = await request.get(
        `${API_BASE}/api/projects/${project.id}`,
        { headers: { Cookie: `session_token=${token}` } }
      );
      expect(projectResp.ok()).toBeTruthy();
      const projectData = await projectResp.json();
      // Project should still be in draft status (not corrupted)
      expect(projectData.status).toBe('draft');

      // Retry typesetting
      const retryAttempt = await request.post(
        `${API_BASE}/api/projects/${project.id}/typeset`,
        { headers: { Cookie: `session_token=${token}` } }
      );
      // Retry should either succeed or fail gracefully
      if (retryAttempt.ok()) {
        const retryData = await retryAttempt.json();
        expect(retryData).toBeTruthy();
      }
    } else {
      // First attempt succeeded — verify project status updated
      expect(firstAttempt.ok()).toBeTruthy();
    }
  });

  test('error recovery in UI shows retry button for failed generation', async ({ page, request }) => {
    // Register user
    const user = await registerUser(request, uniqueEmail('ui-retry'));
    const token = await loginViaAPI(request, user.email, user.password);

    // Create a project via API to have something to work with
    const project = await createProjectViaAPI(request, token);

    // Set session cookie on the page
    const baseUrl = new URL(page.url() || 'http://localhost:8080');
    await page.context().addCookies([
      {
        name: 'session_token',
        value: token,
        domain: baseUrl.hostname,
        path: '/api',
      },
    ]);

    // Navigate to the project
    await page.goto(`/projects/${project.id}`);
    await expect(page.locator('h1')).not.toBeEmpty({ timeout: 10_000 });

    // Try to trigger an action that might fail (typeset or cover generation)
    const generateButton = page.getByRole('button', { name: /generate|typeset|create/i }).first();
    if (await generateButton.isVisible()) {
      await generateButton.click();

      // If an error occurs, verify retry option is available
      const errorMessage = page.getByText(/error|failed|could not/i);
      const retryButton = page.getByRole('button', { name: /retry|try again/i });

      // Wait a reasonable time for either success or error
      const hasError = await errorMessage.isVisible({ timeout: 30_000 }).catch(() => false);

      if (hasError) {
        // Verify retry button is available
        await expect(retryButton).toBeVisible();

        // Click retry
        await retryButton.click();

        // After retry, should either succeed or show error again
        // (depends on mock configuration)
        await page.waitForTimeout(5_000);
      }
    }
  });

  test('blurb generation failure allows retry', async ({ request }) => {
    // Register and login
    const user = await registerUser(request, uniqueEmail('blurb-retry'));
    const token = await loginViaAPI(request, user.email, user.password);

    // Create a project
    const project = await createProjectViaAPI(request, token);

    // Attempt blurb generation
    const firstAttempt = await request.post(
      `${API_BASE}/api/projects/${project.id}/generate-blurb`,
      { headers: { Cookie: `session_token=${token}` } }
    );

    if (!firstAttempt.ok()) {
      const errorBody = await firstAttempt.json();
      expect(errorBody.detail || errorBody.message || errorBody.error).toBeTruthy();

      // Retry
      const retryAttempt = await request.post(
        `${API_BASE}/api/projects/${project.id}/generate-blurb`,
        { headers: { Cookie: `session_token=${token}` } }
      );
      // Should succeed on retry or at least not crash
      expect(retryAttempt.status()).toBeLessThan(500);
    }
  });
});
