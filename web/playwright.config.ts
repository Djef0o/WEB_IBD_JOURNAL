import { defineConfig, devices } from '@playwright/test';

/*
 * End-to-end tests (`npm run e2e`, not part of `npm test`). They run against dist/ served by
 * e2e/serve.mjs, which applies netlify.toml's headers (CSP + Trusted Types are enforced).
 *
 * E2E_BROWSERS=chromium,firefox,webkit selects the engines. Default: chromium and firefox. WebKit is
 * opt-in because its Linux build needs system libraries (`npx playwright install --with-deps webkit`).
 */
const PORT = 4173;
const wanted = (process.env.E2E_BROWSERS ?? 'chromium,firefox').split(',').map((s) => s.trim());

const projects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
].filter((p) => wanted.includes(p.name));

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'en-US',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node e2e/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
  },
  projects,
});
