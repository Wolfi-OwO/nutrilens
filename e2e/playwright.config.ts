import { defineConfig, devices } from '@playwright/test'

// Runs against the real stack (docker compose up --build), not a mocked
// frontend — apps/api serves the built apps/frontend, matching production
// topology exactly (see docker-compose.yml). CI brings the stack up before
// this runs; no webServer here, since a `docker compose up` health-check
// wait is a shell step in the workflow, not something Playwright manages.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // tests share one Postgres; avoid cross-test data races
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
