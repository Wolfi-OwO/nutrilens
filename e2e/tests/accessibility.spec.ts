import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { registerAndLogin, uniqueEmail } from './helpers.ts'

// wcag2a/wcag2aa/wcag21aa — matches NFR-A11Y-01's WCAG AA target (issue #59).
// best-practice is excluded: it flags style opinions (heading order nits,
// etc.) that aren't accessibility failures, and would make this suite noisy
// without making the app more accessible.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa']

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations
    .map((v) => `${v.id} (${v.impact}): ${v.description} — ${v.nodes.length} node(s)`)
    .join('\n')
  expect(results.violations, summary).toEqual([])
}

test.describe('accessibility', () => {
  test('login page has no WCAG AA violations', async ({ page }) => {
    await page.goto('/login')
    await expectNoViolations(page)
  })

  test('register page has no WCAG AA violations', async ({ page }) => {
    await page.goto('/register')
    await expectNoViolations(page)
  })

  test('dashboard has no WCAG AA violations', async ({ page }) => {
    await registerAndLogin(page, uniqueEmail('a11y-dash'), 'A11y Tester')
    await expectNoViolations(page)
  })

  test('log meal page has no WCAG AA violations', async ({ page }) => {
    await registerAndLogin(page, uniqueEmail('a11y-meal'), 'A11y Tester')
    await page.goto('/log-meal')
    await expectNoViolations(page)
    // The manual-entry form state is a materially different DOM (inputs,
    // labels, a fieldset per item) — worth scanning separately.
    //
    // Both clicks go through data-testid rather than the button labels, and
    // this spec is the reason the testids exist: a label-based locator that
    // stops matching does not fail here, it silently leaves axe scanning the
    // previous DOM state and reporting it clean. Asserting the next state
    // actually arrived is the guard against that — the same failure mode as
    // the lazy() page where axe scanned the Suspense spinner (see
    // datenquellen.spec.ts).
    await page.getByTestId('manual-entry').click()
    await expect(page.getByTestId('confirm-log')).toBeVisible()
    await expectNoViolations(page)
    // The shop picker's open panel is a third distinct DOM: a filter textbox,
    // two lists of option buttons and a live region, none of which exist while
    // it is collapsed. Scanning only the collapsed row would scan none of it.
    const shopToggle = page.getByTestId('shop-picker-toggle')
    await shopToggle.click()
    await expect(shopToggle).toHaveAttribute('aria-expanded', 'true')
    await expectNoViolations(page)
  })

  test('plan page has no WCAG AA violations', async ({ page }) => {
    await registerAndLogin(page, uniqueEmail('a11y-plan'), 'A11y Tester')
    await page.goto('/plan')
    await expectNoViolations(page)
  })

  test('progress page has no WCAG AA violations', async ({ page }) => {
    await registerAndLogin(page, uniqueEmail('a11y-progress'), 'A11y Tester')
    await page.goto('/progress')
    await expectNoViolations(page)
  })
})