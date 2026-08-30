import { expect, test } from '@playwright/test'
import { registerAdminAndLogin, registerAndLogin, restoreAdmin, suspendOtherActiveAdmins, uniqueEmail } from './helpers.ts'

test.describe('admin dashboard (#105-108)', () => {
  test('a regular user has no admin link and is redirected away from /admin', async ({ page }) => {
    const email = uniqueEmail('admin-nonadmin')
    await registerAndLogin(page, email, 'Not An Admin')

    // The testid replaces an `exact: true` name match that existed only to
    // stop 'Admin' matching the topbar profile link (whose accessible name is
    // the display name) — a testid on the shield link makes that impossible
    // rather than merely unlikely.
    await expect(page.getByTestId('nav-admin')).toHaveCount(0)

    await page.goto('/admin')
    await expect(page).toHaveURL('/')
  })

  test('an admin sees the admin link, opens the overview, and it shows real stats', async ({ page }) => {
    const email = uniqueEmail('admin-overview')
    await registerAdminAndLogin(page, email, 'Dash Admin')

    await page.getByTestId('nav-admin').click()
    await page.waitForURL('/admin')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('admin-stat-total-users')).toBeVisible()
    await expect(page.getByTestId('admin-stat-admins')).toBeVisible()
  })

  test('an admin searches, promotes a user to coach, and it is reflected + audited', async ({ page, browser }) => {
    const adminEmail = uniqueEmail('admin-promoter')
    await registerAdminAndLogin(page, adminEmail, 'Promoter Admin')

    // A separate browser context registers the target — the admin's own
    // page session must not need to know that account's password, only
    // its email, matching how a real admin would operate.
    const targetContext = await browser.newContext()
    const targetPage = await targetContext.newPage()
    const targetEmail = uniqueEmail('promote-target')
    await registerAndLogin(targetPage, targetEmail, 'Promotable User')
    await targetContext.close()

    await page.goto('/admin/users')
    await page.getByTestId('user-search-input').fill(targetEmail)
    await page.getByTestId('user-search-submit').click()

    const row = page.getByRole('row', { name: new RegExp(targetEmail) })
    await expect(row).toBeVisible()

    // Wait for the role change API request to complete before navigating away.
    // The promotion changes the user's role via PATCH /users/{id} API and updates the audit log.
    const roleChangePromise = page.waitForResponse((response) =>
      response.url().includes('/users/') && response.request().method() === 'PATCH' && response.status() === 200
    )
    await row.getByTestId('role-select').selectOption('coach')
    await roleChangePromise

    // The row's role <select> reflects the change without a full reload.
    await expect(row.getByTestId('role-select')).toHaveValue('coach')

    await page.goto('/admin/audit')
    // Wait for the audit log API response before checking for the entry.
    // The audit page uses React Query which loads data asynchronously.
    await page.waitForResponse((response) => response.url().includes('/admin/audit-log') && response.status() === 200)

    // Give the page time to render the data. The audit log is ordered
    // created_at DESC (admin-audit-log.repository.ts), so the promotion just
    // made is the first entry — assert on that row rather than on the page,
    // which also removes a real fragility: matching the "Role changed" label
    // anywhere on the page failed with a strict-mode violation as soon as a
    // second role_change entry existed from an earlier run.
    //
    // data-audit-action is the raw enum, not the ACTION_LABELS display copy;
    // "user → coach" is two role enum values, which are not copy either.
    const newest = page.getByTestId('audit-entry').first()
    await expect(newest).toBeVisible({ timeout: 10000 })
    await expect(newest).toHaveAttribute('data-audit-action', 'role_change')
    await expect(newest).toContainText('user → coach')
  })

  test('the last-admin guard surfaces a readable inline error, not raw JSON', async ({ page }) => {
    const email = uniqueEmail('admin-lastguard')
    await registerAdminAndLogin(page, email, 'Solo Admin')
    await suspendOtherActiveAdmins(email)

    try {
      await page.goto('/admin/users')
      await page.getByTestId('user-search-input').fill(email)
      await page.getByTestId('user-search-submit').click()

      const ownRow = page.getByRole('row', { name: new RegExp(email) })
      // The self-suspend guard disables this admin's own Suspend button
      // client-side — the more interesting guard to exercise via the UI is
      // demoting the sole admin account, refused with a readable message.
      // The guard's message is the API's own (`error.body.message`, passed
      // through by users.tsx), so matching /last active admin/ was matching
      // copy. Three locale-independent facts replace it and between them say
      // everything the regex did: the PATCH was refused with 409 — the
      // conflict the guard raises, not a validation or auth failure — the
      // page rendered that inline as an alert rather than as raw JSON, and the
      // demotion did not take. Registered via Promise.all, for the reason in
      // helpers.ts's createDefaultPlan.
      const [refusal] = await Promise.all([
        page.waitForResponse(
          (response) => response.url().includes('/users/') && response.request().method() === 'PATCH',
        ),
        ownRow.getByTestId('role-select').selectOption('user'),
      ])
      expect(refusal.status()).toBe(409)

      await expect(page.getByRole('alert')).toBeVisible()
      await expect(ownRow.getByTestId('role-select')).toHaveValue('admin')
    } finally {
      // Clean up: restore the test-created admin so it doesn't interfere
      // with the next test run. The seeded admin is always excluded from
      // suspendOtherActiveAdmins, so no need to restore it.
      await restoreAdmin(email)
    }
  })
})
