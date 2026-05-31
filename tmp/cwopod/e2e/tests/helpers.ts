/**
 * Shared helpers for C.W.'s O-POD E2E tests.
 */
import { type Page, type APIRequestContext, expect } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:8000';

/** Generate a unique email for test isolation. */
export function uniqueEmail(prefix = 'user'): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `${prefix}-${id}@test.local`;
}

/** Register a new user via the API and return credentials. */
export async function registerUser(
  request: APIRequestContext,
  email?: string,
  password = 'TestPass123!'
): Promise<{ email: string; password: string; id: string }> {
  const userEmail = email || uniqueEmail();
  const response = await request.post(`${API_BASE}/api/auth/register`, {
    data: { email: userEmail, password },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return { email: userEmail, password, id: body.id };
}

/** Log in a user via the UI. */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  // If there's a login form on the page or a redirect to login
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole('button', { name: /log\s*in|sign\s*in/i }).click();
  // Wait for navigation away from login
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 10_000 });
}

/** Register and log in a new user via the UI. */
export async function registerViaUI(page: Page, email?: string, password = 'TestPass123!'): Promise<{ email: string; password: string }> {
  const userEmail = email || uniqueEmail();
  await page.goto('/');
  // Navigate to register if needed
  const registerLink = page.getByRole('link', { name: /register|sign\s*up/i });
  if (await registerLink.isVisible()) {
    await registerLink.click();
  }
  await page.getByPlaceholder(/email/i).fill(userEmail);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole('button', { name: /register|sign\s*up|create/i }).click();
  // Wait for successful registration (redirects to home or dashboard)
  await page.waitForURL((url) => !url.pathname.includes('register') && !url.pathname.includes('login'), { timeout: 10_000 });
  return { email: userEmail, password };
}

/** Log in a user via the API and set the session cookie on the page context. */
export async function loginViaAPI(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const response = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  // Extract session cookie
  const cookies = response.headers()['set-cookie'] || '';
  const match = cookies.match(/session_token=([^;]+)/);
  return match ? match[1] : '';
}

/** Create a book project via the API (import from search). */
export async function createProjectViaAPI(
  request: APIRequestContext,
  sessionToken: string,
  options: { source?: string; identifier?: string } = {}
): Promise<{ id: string; title: string }> {
  const response = await request.post(`${API_BASE}/api/projects/import`, {
    data: {
      source: options.source || 'gutenberg',
      identifier: options.identifier || '84', // Frankenstein
    },
    headers: {
      Cookie: `session_token=${sessionToken}`,
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/** Trigger typesetting for a project via the API. */
export async function typesetProjectViaAPI(
  request: APIRequestContext,
  sessionToken: string,
  projectId: string
): Promise<void> {
  const response = await request.post(`${API_BASE}/api/projects/${projectId}/typeset`, {
    headers: {
      Cookie: `session_token=${sessionToken}`,
    },
  });
  expect(response.ok()).toBeTruthy();
}

/** Generate cover for a project via the API. */
export async function generateCoverViaAPI(
  request: APIRequestContext,
  sessionToken: string,
  projectId: string
): Promise<void> {
  // Generate prompts
  const promptsResp = await request.post(`${API_BASE}/api/projects/${projectId}/generate-prompts`, {
    headers: { Cookie: `session_token=${sessionToken}` },
  });
  expect(promptsResp.ok()).toBeTruthy();

  // Generate images
  const imagesResp = await request.post(`${API_BASE}/api/projects/${projectId}/generate-images`, {
    headers: { Cookie: `session_token=${sessionToken}` },
  });
  expect(imagesResp.ok()).toBeTruthy();

  // Assemble cover with default layout
  const assembleResp = await request.post(`${API_BASE}/api/projects/${projectId}/assemble-cover`, {
    data: { layout_json: {} },
    headers: { Cookie: `session_token=${sessionToken}` },
  });
  expect(assembleResp.ok()).toBeTruthy();
}

/** Wait for a project to reach a specific status (polling). */
export async function waitForProjectStatus(
  request: APIRequestContext,
  sessionToken: string,
  projectId: string,
  expectedStatus: string,
  timeoutMs = 30_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await request.get(`${API_BASE}/api/projects/${projectId}`, {
      headers: { Cookie: `session_token=${sessionToken}` },
    });
    if (response.ok()) {
      const project = await response.json();
      if (project.status === expectedStatus) return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Project ${projectId} did not reach status '${expectedStatus}' within ${timeoutMs}ms`);
}
