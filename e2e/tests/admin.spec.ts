import { expect, test } from '@playwright/test'
import { registerAdminAndLogin, registerAndLogin, suspendOtherActiveAdmins, uniqueEmail } from './helpers.ts'

test.describe('admin dashboard (#105-108)', () => {
  test('a regular user has no admin link and is redirected away from /admin', async ({ page }) => {
    const email = uniqueEmail('admin-nonadmin')
    await registerAndLogin(page, email, 'Not An Admin')

    // Substring matching would match the topbar profile link, whose name is
    // the display name 'Not An Admin' — exact keeps assertions on the actual
    // topbar shield icon, which is only rendered for admins.
    await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)

    await page.goto('/admin')
    await expect(page).toHaveURL('/')
  })

  test('an admin sees the admin link, opens the overview, and it shows real stats', async ({ page }) => {
    const email = uniqueEmail('admin-overview')
    await registerAdminAndLogin(page, email, 'Dash Admin')

    await page.getByRole('link', { name: 'Admin', exact: true }).click()
    await page.waitForURL('/admin')

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(page.getByText('Total users')).toBeVisible()
    await expect(page.getByText('Admins')).toBeVisible()
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
    await page.getByPlaceholder('Search by email or name…').fill(targetEmail)
    await page.getByRole('button', { name: 'Search' }).click()

    const row = page.getByRole('row', { name: new RegExp(targetEmail) })
    await expect(row).toBeVisible()
    await row.getByLabel(/Change role/).selectOption('coach')

    // The row's role <select> reflects the change without a full reload.
    await expect(row.getByLabel(/Change role/)).toHaveValue('coach')

    await page.goto('/admin/audit')
    await expect(page.getByText('Role changed').first()).toBeVisible()
    await expect(page.getByText('user → coach').first()).toBeVisible()
  })

  test('the last-admin guard surfaces a readable inline error, not raw JSON', async ({ page }) => {
    const email = uniqueEmail('admin-lastguard')
    await registerAdminAndLogin(page, email, 'Solo Admin')
    await suspendOtherActiveAdmins(email)

    await page.goto('/admin/users')
    await page.getByPlaceholder('Search by email or name…').fill(email)
    await page.getByRole('button', { name: 'Search' }).click()

    const ownRow = page.getByRole('row', { name: new RegExp(email) })
    // The self-suspend guard disables this admin's own Suspend button
    // client-side — the more interesting guard to exercise via the UI is
    // demoting the sole admin account, refused with a readable message.
    await ownRow.getByLabel(/Change role/).selectOption('user')

    await expect(page.getByRole('alert')).toContainText(/last active admin/i)
  })
})
