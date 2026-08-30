import { expect, test } from '@playwright/test'
import { dismissTutorial, TEST_PASSWORD, uniqueEmail } from './helpers.ts'

test.describe('registration and login', () => {
  test('registers a new account and lands on the dashboard', async ({ page }) => {
    const email = uniqueEmail('register')
    await page.goto('/register')

    await page.locator('#displayName').fill('E2E Tester')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByTestId('register-submit').click()

    await page.waitForURL('/')
    // The dashboard's greeting is its h1 and the only h1 on the page, so the
    // level identifies it without matching "Good morning".
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('rejects an existing email with a clear error, not a silent failure', async ({ page }) => {
    const email = uniqueEmail('dupe')
    await page.goto('/register')
    await page.locator('#displayName').fill('First Signup')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByTestId('register-submit').click()
    await page.waitForURL('/')
    await dismissTutorial(page)

    // Log out, then try registering the same email again.
    await page.getByTestId('nav-logout').click()
    await page.goto('/register')
    await page.locator('#displayName').fill('Second Signup')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(TEST_PASSWORD)

    // The old assertion matched /already|exists|taken/ on the rendered message
    // — copy, and the API's copy at that (it is `error.message` passed
    // through). Two locale-independent facts replace it and together say more
    // than the regex did: POST /users answered 409 (the duplicate-email
    // conflict specifically, not any failure), and the form surfaced it inline
    // instead of failing silently. Registered via Promise.all rather than
    // after the click, for the reason recorded in helpers.ts's
    // createDefaultPlan.
    const [conflict] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/users') && response.request().method() === 'POST'),
      page.getByTestId('register-submit').click(),
    ])
    expect(conflict.status()).toBe(409)
    await expect(page.getByTestId('register-error')).toBeVisible()
  })

  test('logs in an existing account and logs out again', async ({ page }) => {
    const email = uniqueEmail('login')
    await page.goto('/register')
    await page.locator('#displayName').fill('Login Tester')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByTestId('register-submit').click()
    await page.waitForURL('/')
    await dismissTutorial(page)

    await page.getByTestId('nav-logout').click()
    await page.waitForURL('/login')

    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByTestId('login-submit').click()

    await page.waitForURL('/')
    // The display name is data this test supplied, not copy — it stays a text
    // match, and still proves the session belongs to this account.
    await expect(page.getByText('Login Tester')).toBeVisible()
  })

  test('shows an error on wrong credentials without navigating away', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(uniqueEmail('nonexistent'))
    await page.locator('#password').fill('WrongPassword123!')
    await page.getByTestId('login-submit').click()

    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('alert')).toBeVisible()
  })
})