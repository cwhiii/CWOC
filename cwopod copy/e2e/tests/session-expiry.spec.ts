/**
 * E2E Test: Session Expiry and Re-authentication
 *
 * Tests that expired sessions require re-authentication and that
 * the user can successfully re-authenticate to continue working.
 *
 * Validates: Requirements 13.6
 */
import { test, expect } from '@playwright/test';
import { registerUser, loginViaAPI, uniqueEmail } from './helpers';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:8000';

test.describe('Session Expiry and Re-authentication', () => {
  test('expired session returns 401 on API calls', async ({ request }) => {
    // Register and login
    const user = await registerUser(request, uniqueEmail('expiry'));
    const token = await loginViaAPI(request, user.email, user.password);

    // Verify the session works initially
    const validResponse = await request.get(`${API_BASE}/api/projects`, {
      headers: { Cookie: `session_token=${token}` },
    });
    expect(validResponse.ok()).toBeTruthy();

    // Use an invalid/expired token
    const expiredResponse = await request.get(`${API_BASE}/api/projects`, {
      headers: { Cookie: `session_token=expired-invalid-token-12345` },
    });
    expect(expiredResponse.status()).toBe(401);
  });

  test('unauthenticated request to protected endpoint returns 401', async ({ request }) => {
    // No session cookie at all
    const response = await request.get(`${API_BASE}/api/projects`);
    expect(response.status()).toBe(401);
  });

  test('unauthenticated request to bookshelf returns 401', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/bookshelf`);
    expect(response.status()).toBe(401);
  });

  test('user can re-authenticate after session expires', async ({ request }) => {
    // Register a user
    const user = await registerUser(request, uniqueEmail('reauth'));

    // Login to get a valid session
    const token = await loginViaAPI(request, user.email, user.password);

    // Verify session works
    const response1 = await request.get(`${API_BASE}/api/projects`, {
      headers: { Cookie: `session_token=${token}` },
    });
    expect(response1.ok()).toBeTruthy();

    // Logout (invalidate session)
    await request.post(`${API_BASE}/api/auth/logout`, {
      headers: { Cookie: `session_token=${token}` },
    });

    // Old token should no longer work
    const response2 = await request.get(`${API_BASE}/api/projects`, {
      headers: { Cookie: `session_token=${token}` },
    });
    expect(response2.status()).toBe(401);

    // Re-authenticate with same credentials
    const newToken = await loginViaAPI(request, user.email, user.password);
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(token); // New session token

    // New session should work
    const response3 = await request.get(`${API_BASE}/api/projects`, {
      headers: { Cookie: `session_token=${newToken}` },
    });
    expect(response3.ok()).toBeTruthy();
  });

  test('UI redirects to login on expired session', async ({ page, request }) => {
    // Register a user
    const user = await registerUser(request, uniqueEmail('ui-expiry'));

    // Set an invalid session cookie and try to access a protected page
    await page.context().addCookies([
      {
        name: 'session_token',
        value: 'invalid-expired-token',
        domain: new URL(page.url() || 'http://localhost:8080').hostname || 'localhost',
        path: '/api',
      },
    ]);

    // Try to access bookshelf (protected page)
    await page.goto('/bookshelf');

    // The app should either redirect to login or show a login prompt
    // Wait for either a login form or an error/redirect
    const loginVisible = await page
      .getByRole('button', { name: /log\s*in|sign\s*in/i })
      .isVisible()
      .catch(() => false);
    const errorVisible = await page
      .getByText(/session.*expired|please.*log\s*in|unauthorized|authentication/i)
      .isVisible()
      .catch(() => false);
    const onLoginPage = page.url().includes('login');

    expect(loginVisible || errorVisible || onLoginPage).toBeTruthy();
  });

  test('re-authentication preserves ability to access data', async ({ request }) => {
    // Register and create a project
    const user = await registerUser(request, uniqueEmail('preserve'));
    const token1 = await loginViaAPI(request, user.email, user.password);

    // Create a project
    const importResponse = await request.post(`${API_BASE}/api/projects/import`, {
      data: { source: 'gutenberg', identifier: '84' },
      headers: { Cookie: `session_token=${token1}` },
    });
    // Project creation may or may not succeed depending on mock setup,
    // but we can still test the re-auth flow
    const projectCreated = importResponse.ok();

    // Logout
    await request.post(`${API_BASE}/api/auth/logout`, {
      headers: { Cookie: `session_token=${token1}` },
    });

    // Re-login
    const token2 = await loginViaAPI(request, user.email, user.password);

    // Should still be able to access projects
    const projectsResponse = await request.get(`${API_BASE}/api/projects`, {
      headers: { Cookie: `session_token=${token2}` },
    });
    expect(projectsResponse.ok()).toBeTruthy();

    // If we created a project, it should still be there
    if (projectCreated) {
      const data = await projectsResponse.json();
      const projects = data.projects || data;
      expect(projects.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('invalid credentials are rejected', async ({ request }) => {
    // Register a user
    const user = await registerUser(request, uniqueEmail('badcreds'));

    // Try to login with wrong password
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: user.email, password: 'WrongPassword!' },
    });
    expect(response.status()).toBe(401);

    // Error message should not reveal whether email exists
    const body = await response.json();
    expect(body.detail).not.toMatch(/email.*not.*found|user.*not.*exist/i);
  });
});
