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
//
// waitForResponse is registered via Promise.all alongside the click, not
// after it resolves — awaiting the click first and only then calling
// waitForResponse is a real race: the POST can round-trip and complete
// before the listener is attached, so the wait then sits on a response
// that already happened and hangs for the full 30s (this is what a
// `page.waitForResponse: Test timeout of 30000ms exceeded` at this line
// actually was: the click itself had already succeeded).
export async function createDefaultPlan(page: Page): Promise<void> {
  await page.goto('/plan')
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/diet-plans') && response.status() === 201),
    page.getByRole('button', { name: 'Create plan' }).click(),
  ])
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
 * from accumulating across the whole sequential run. Suspends other admins
 * immediately before a guard test's assertion, excluding the seeded admin
 * and the test's own admin account. See apps/api/tests/helpers/db.ts.
 *
 * The seeded admin (admin@nutrilens.dev) must always remain active so
 * subsequent test runs can use it. Only suspend test-generated admins.
 */
export async function suspendOtherActiveAdmins(testAdminEmail: string): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.E2E_DATABASE_URL ?? 'postgresql://nutrilens:nutrilens@localhost:5432/nutrilens',
  })
  try {
    // Suspend all active admins EXCEPT:
    // 1. The test's own admin (testAdminEmail)
    // 2. The seeded admin (admin@nutrilens.dev) — must stay active for future test runs
    await pool.query(
      "UPDATE users SET status = 'suspended' WHERE role = 'admin' AND status = 'active' AND email != $1 AND email != 'admin@nutrilens.dev'",
      [testAdminEmail],
    )
  } finally {
    await pool.end()
  }
}

/**
 * Restores a suspended admin to active status. Used to clean up after
 * tests that call suspendOtherActiveAdmins. Must be called in test.afterEach
 * or at the end of a test that suspended admins.
 */
export async function restoreAdmin(email: string): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.E2E_DATABASE_URL ?? 'postgresql://nutrilens:nutrilens@localhost:5432/nutrilens',
  })
  try {
    await pool.query("UPDATE users SET status = 'active' WHERE email = $1", [email])
  } finally {
    await pool.end()
  }
}

// fdc_id range reserved for e2e fixtures, distinct from apps/api/tests'
// own 999xxx range (see apps/api/tests/food-catalog/search.test.ts) so a
// unit-test run and an e2e run against the same Postgres never collide.
const FOOD_CATALOG_FIXTURE_IDS = {
  bananaRaw: 900001,
  eggWhiteOmelet: 900002,
}

// docker compose up alone only runs migrations (apps/api/Dockerfile), which
// create an EMPTY food_catalog table — populating it is a separate, dev-only,
// network-dependent script (apps/api/scripts/import-all-food-datasets.ts)
// that nothing in docker-compose.yml or the CI e2e job ever invokes. Without
// this, GET /food-catalog/search returns 200 with [] (confirmed via curl
// against a fresh stack), so the combobox never renders a
// `[role="option"]` and autocomplete.spec.ts times out waiting for one —
// a real request that resolved fast with no data, not a hang.
//
// Seeded directly here rather than via the import scripts, matching
// apps/api/tests/food-catalog/search.test.ts's own fixture-insert pattern:
// deterministic, offline, and immune to USDA's live dataset changing the
// top-ranked match out from under the spec's assertions.
// "Egg white omelet, with vegetables" is the exact description whose
// word_similarity('omelette', ...) = 0.778 is documented in
// apps/api/src/repository/food-catalog.repository.ts — reused verbatim so
// this fixture exercises the same trigram fallback path that value was
// calibrated against, not a coincidentally-similar string.
export async function seedFoodCatalogFixtures(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.E2E_DATABASE_URL ?? 'postgresql://nutrilens:nutrilens@localhost:5432/nutrilens',
  })
  try {
    await pool.query(
      `INSERT INTO food_catalog (fdc_id, description, category, data_type, calories_kcal, protein_grams, carb_grams, fat_grams)
       VALUES
         ($1, 'Banana, raw', 'Fruits and Fruit Juices', 'sr_legacy', 89, 1.1, 22.8, 0.3),
         ($2, 'Egg white omelet, with vegetables', 'Egg and Egg Substitutes', 'survey_food', 76, 6.5, 3.5, 4.0)
       ON CONFLICT (fdc_id) DO UPDATE SET
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         data_type = EXCLUDED.data_type,
         calories_kcal = EXCLUDED.calories_kcal,
         protein_grams = EXCLUDED.protein_grams,
         carb_grams = EXCLUDED.carb_grams,
         fat_grams = EXCLUDED.fat_grams`,
      [FOOD_CATALOG_FIXTURE_IDS.bananaRaw, FOOD_CATALOG_FIXTURE_IDS.eggWhiteOmelet],
    )
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