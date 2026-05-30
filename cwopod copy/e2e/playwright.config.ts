import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for C.W.'s O-POD E2E tests.
 *
 * Tests run against the Docker Compose test stack with mocked external APIs.
 * Start the stack with: docker compose -f docker-compose.yml -f docker-compose.test.yml up
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60_000,

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
