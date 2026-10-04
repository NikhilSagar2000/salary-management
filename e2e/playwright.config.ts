import { defineConfig, devices } from '@playwright/test';
import { AUTH_STATE, E2E_PORT } from './env.ts';

const root = new URL('..', import.meta.url).pathname;

export default defineConfig({
  testDir: '.',
  outputDir: `${root}test-results`,
  // One server and one database: tests run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `${root}playwright-report` }]],
  use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${E2E_PORT}`, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /signin\.setup\.ts/ },
    { name: 'chromium', testMatch: /\.spec\.ts$/, dependencies: ['setup'], use: { storageState: AUTH_STATE } },
  ],
  webServer: {
    command: 'npm run build -w web && node e2e/server.ts',
    cwd: root,
    url: `http://localhost:${E2E_PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'pipe',
  },
});
