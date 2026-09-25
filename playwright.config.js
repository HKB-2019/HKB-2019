import { defineConfig, devices } from '@playwright/test';

/* Browser tests: a robot customer and a robot shop owner, clicking through
 * the real site in a real browser.
 *
 *   npm run test:e2e
 *
 * First time on a new machine: npx playwright install chromium
 */

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // One shop, one database: tests take turns rather than trip over each other.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } },
      testIgnore: /phone\.spec\.js/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec\.js/ }
  ],
  webServer: {
    command: 'npm run build && node e2e/serve.js',
    url: `http://localhost:${PORT}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
