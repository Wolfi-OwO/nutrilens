import { expect, test } from '@playwright/test'
import { dismissTutorial, TEST_PASSWORD, uniqueEmail } from './helpers.ts'

test.describe('registration and login', () => {
  test('registers a new account and lands on the dashboard', async ({ page }) => {
    const email = uniqueEmail('register')
    await page.goto('/register')

    await page.getByLabel('Name').fill('E2E Tester')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL('/')
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()
  })

  test('rejects an existing email with a clear error, not a silent failure', async ({ page }) => {
    const email = uniqueEmail('dupe')
    await page.goto('/register')
    await page.getByLabel('Name').fill('First Signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.waitForURL('/')
    await dismissTutorial(page)

    // Log out, then try registering the same email again.
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.goto('/register')
    await page.getByLabel('Name').fill('Second Signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText(/already|exists|taken/i)).toBeVisible()
  })

  test('logs in an existing account and logs out again', async ({ page }) => {
    const email = uniqueEmail('login')
    await page.goto('/register')
    await page.getByLabel('Name').fill('Login Tester')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.waitForURL('/')
    await dismissTutorial(page)

    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('/login')

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await page.waitForURL('/')
    await expect(page.getByText('Login Tester')).toBeVisible()
  })

  test('shows an error on wrong credentials without navigating away', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(uniqueEmail('nonexistent'))
    await page.getByLabel('Password').fill('WrongPassword123!')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('alert')).toBeVisible()
  })
})