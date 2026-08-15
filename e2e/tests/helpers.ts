import type { Page } from '@playwright/test'
import pg from 'pg'

// One account per test file (not per test) — registration is itself covered
// by the auth.spec.ts flow; other specs just need a signed-in user to reach
// their own page, and reusing one account per file keeps runs fast without
// creating a fresh user per assertion.
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

export const TEST_PASSWORD = 'TestPassword123!'

// The one-time onboarding guide auto-opens on first login per browser
// context. A waitForURL('/') resolves the moment the router lands on the
// dashboard, which can precede the guide's useEffect opening the dialog, so
// give that auto-open a short window — and on a re-login within the same
// context the completion flag is already set and nothing appears.
// Modal-less, it costs one short timeout; a fixated wait would stall every
// re-login instead.
export async function dismissTutorial(page: Page): Promise<void> {
  const guide = page.getByRole('dialog', { name: /Welcome to NutriLens/i })
  const guideShown = await guide
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  if (!guideShown) return
  await page.getByRole('button', { name: 'Close guide' }).click()
  await guide.waitFor({ state: 'hidden' })
}

export async function registerAndLogin(page: Page, email: string, displayName: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Name').fill(displayName)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('/')
  await dismissTutorial(page)
}

// A fresh account has no diet plan — meal logging 409s until one exists
// (UC-10). Tests that log a meal successfully need this first.
export async function createDefaultPlan(page: Page): Promise<void> {
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Create plan' }).click()
  await page.waitForResponse((response) => response.url().includes('/diet-plans') && response.status() === 201)
}

// There's no admin-creation API (matches apps/api/tests/helpers/db.ts's own
// promoteToAdmin, same reasoning) — this connects directly to the same
// Postgres the docker-compose stack runs against (exposed on the host at
// 5432, see docker-compose.yml) rather than going through the app.
async function promoteToAdmin(email: string): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.E2E_DATABASE_URL ?? 'postgresql://nutrilens:nutrilens@localhost:5432/nutrilens',
  })
  try {
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
  } finally {
    await pool.end()
  }
}

/**
 * Registers a fresh account, promotes it to admin directly in the
 * database, then logs in again — a role change never updates an
 * already-issued session token, so the re-login is required for the new
 * token to actually carry `role: 'admin'`, same as any real client.
 */
/**
 * The last-active-admin guard (#101) counts every active admin
 * system-wide — other tests in this same spec file also register their
 * own admins via registerAdminAndLogin, and playwright.config.ts's
 * fullyParallel:false only prevents them running *concurrently*, not
 * from accumulating across the whole sequential run. Clears the field
 * immediately before a guard test's assertion — mirrors
 * apps/api/tests/helpers/db.ts's suspendOtherActiveAdmins.
 */
export async function suspendOtherActiveAdmins(exceptEmail: string): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.E2E_DATABASE_URL ?? 'postgresql://nutrilens:nutrilens@localhost:5432/nutrilens',
  })
  try {
    await pool.query("UPDATE users SET status = 'suspended' WHERE role = 'admin' AND status = 'active' AND email != $1", [
      exceptEmail,
    ])
  } finally {
    await pool.end()
  }
}

export async function registerAdminAndLogin(page: Page, email: string, displayName: string): Promise<void> {
  await registerAndLogin(page, email, displayName)
  await promoteToAdmin(email)
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL('/login')
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL('/')
}