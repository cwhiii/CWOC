/**
 * E2E Test: User Isolation
 *
 * Tests that user A cannot see user B's projects, configurations, or data.
 *
 * Validates: Requirements 13.1, 13.5
 */
import { test, expect } from '@playwright/test';
import { registerUser, loginViaAPI, createProjectViaAPI, uniqueEmail } from './helpers';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:8000';

test.describe('User Isolation', () => {
  test('user A cannot see user B projects via API', async ({ request }) => {
    // Register two users
    const userA = await registerUser(request, uniqueEmail('userA'));
    const userB = await registerUser(request, uniqueEmail('userB'));

    // Log in as user A and create a project
    const tokenA = await loginViaAPI(request, userA.email, userA.password);
    const projectA = await createProjectViaAPI(request, tokenA);

    // Log in as user B and create a project
    const tokenB = await loginViaAPI(request, userB.email, userB.password);
    const projectB = await createProjectViaAPI(request, tokenB);

    // User A should only see their own project
    const responseA = await request.get(`${API_BASE}/api/projects`, {
      headers: { Cookie: `session_token=${tokenA}` },
    });
    expect(responseA.ok()).toBeTruthy();
    const dataA = await responseA.json();
    const projectIdsA = (dataA.projects || dataA).map((p: any) => p.id);
    expect(projectIdsA).toContain(projectA.id);
    expect(projectIdsA).not.toContain(projectB.id);

    // User B should only see their own project
    const responseB = await request.get(`${API_BASE}/api/projects`, {
      headers: { Cookie: `session_token=${tokenB}` },
    });
    expect(responseB.ok()).toBeTruthy();
    const dataB = await responseB.json();
    const projectIdsB = (dataB.projects || dataB).map((p: any) => p.id);
    expect(projectIdsB).toContain(projectB.id);
    expect(projectIdsB).not.toContain(projectA.id);
  });

  test('user A cannot access user B project by direct ID', async ({ request }) => {
    // Register two users
    const userA = await registerUser(request, uniqueEmail('userA'));
    const userB = await registerUser(request, uniqueEmail('userB'));

    // User B creates a project
    const tokenB = await loginViaAPI(request, userB.email, userB.password);
    const projectB = await createProjectViaAPI(request, tokenB);

    // User A tries to access user B's project directly
    const tokenA = await loginViaAPI(request, userA.email, userA.password);
    const response = await request.get(`${API_BASE}/api/projects/${projectB.id}`, {
      headers: { Cookie: `session_token=${tokenA}` },
    });

    // Should be 404 (not found) — not 403 (which would reveal existence)
    expect(response.status()).toBe(404);
  });

  test('user A cannot see user B projects in bookshelf', async ({ request }) => {
    // Register two users
    const userA = await registerUser(request, uniqueEmail('userA'));
    const userB = await registerUser(request, uniqueEmail('userB'));

    // User B creates a project
    const tokenB = await loginViaAPI(request, userB.email, userB.password);
    await createProjectViaAPI(request, tokenB);

    // User A checks their bookshelf
    const tokenA = await loginViaAPI(request, userA.email, userA.password);
    const response = await request.get(`${API_BASE}/api/bookshelf`, {
      headers: { Cookie: `session_token=${tokenA}` },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // User A's bookshelf should be empty (they haven't created any projects)
    expect(data.items).toHaveLength(0);
    expect(data.total_count).toBe(0);
  });

  test('user A cannot modify user B project', async ({ request }) => {
    // Register two users
    const userA = await registerUser(request, uniqueEmail('userA'));
    const userB = await registerUser(request, uniqueEmail('userB'));

    // User B creates a project
    const tokenB = await loginViaAPI(request, userB.email, userB.password);
    const projectB = await createProjectViaAPI(request, tokenB);

    // User A tries to typeset user B's project
    const tokenA = await loginViaAPI(request, userA.email, userA.password);
    const typesetResponse = await request.post(
      `${API_BASE}/api/projects/${projectB.id}/typeset`,
      { headers: { Cookie: `session_token=${tokenA}` } }
    );
    expect(typesetResponse.status()).toBeGreaterThanOrEqual(400);

    // User A tries to delete user B's project
    const deleteResponse = await request.delete(
      `${API_BASE}/api/projects/${projectB.id}`,
      { headers: { Cookie: `session_token=${tokenA}` } }
    );
    expect(deleteResponse.status()).toBeGreaterThanOrEqual(400);
  });

  test('user A cannot see user B orders', async ({ request }) => {
    // Register two users
    const userA = await registerUser(request, uniqueEmail('userA'));
    const userB = await registerUser(request, uniqueEmail('userB'));

    // User A checks orders — should be empty
    const tokenA = await loginViaAPI(request, userA.email, userA.password);
    const response = await request.get(`${API_BASE}/api/print/orders`, {
      headers: { Cookie: `session_token=${tokenA}` },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.orders).toHaveLength(0);
  });

  test('user isolation in UI - bookshelf shows only own projects', async ({ page, request, browser }) => {
    // Register user A and create a project via API
    const userA = await registerUser(request, uniqueEmail('userA'));
    const tokenA = await loginViaAPI(request, userA.email, userA.password);
    await createProjectViaAPI(request, tokenA);

    // Register user B
    const userB = await registerUser(request, uniqueEmail('userB'));

    // Open a new browser context for user B (clean cookies)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Log in as user B via UI
    await pageB.goto('/');
    const loginLink = pageB.getByRole('link', { name: /log\s*in|sign\s*in/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
    }
    await pageB.getByPlaceholder(/email/i).fill(userB.email);
    await pageB.getByPlaceholder(/password/i).fill(userB.password);
    await pageB.getByRole('button', { name: /log\s*in|sign\s*in/i }).click();
    await pageB.waitForURL((url) => !url.pathname.includes('login'), { timeout: 10_000 });

    // Navigate to bookshelf
    await pageB.goto('/bookshelf');

    // User B should see empty bookshelf (user A's project not visible)
    await expect(pageB.getByText(/empty|no books|get started/i)).toBeVisible({ timeout: 5_000 });

    await contextB.close();
  });
});
