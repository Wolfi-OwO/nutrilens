import type { Page } from '@playwright/test'

// One account per test file (not per test) — registration is itself covered
// by the auth.spec.ts flow; other specs just need a signed-in user to reach
// their own page, and reusing one account per file keeps runs fast without
// creating a fresh user per assertion.
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

export const TEST_PASSWORD = 'TestPassword123!'

export async function registerAndLogin(page: Page, email: string, displayName: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Name').fill(displayName)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('/')
}

// A fresh account has no diet plan — meal logging 409s until one exists
// (UC-10). Tests that log a meal successfully need this first.
export async function createDefaultPlan(page: Page): Promise<void> {
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Create plan' }).click()
  await page.waitForResponse((response) => response.url().includes('/diet-plans') && response.status() === 201)
}
