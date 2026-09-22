import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env['PLAYWRIGHT_PORT'] ?? 3101);
const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://127.0.0.1:${PORT}`;
const CI = !!process.env['CI'];

const TEST_PUBLIC_ENV = {
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  NEXT_PUBLIC_SITE_NAME: 'MyConciergeHotel',
  NEXT_PUBLIC_DEFAULT_LOCALE: 'fr',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-not-a-real-jwt',
  NEXT_PUBLIC_ALGOLIA_APP_ID: 'test-app-id',
  NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: 'test-search-key',
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'test-cloud',
  NEXT_PUBLIC_SKIP_ENV_VALIDATION: 'true',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    cwd: '.',
    port: PORT,
    reuseExistingServer: !CI,
    timeout: 240_000,
    env: {
      SKIP_ENV_VALIDATION: 'true',
      NODE_ENV: 'production',
      ...TEST_PUBLIC_ENV,
    },
  },
});
