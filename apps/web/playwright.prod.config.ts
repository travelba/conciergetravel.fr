import { defineConfig, devices } from '@playwright/test';

/** One-off external prod smoke — no local webServer. */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
