import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The credit on this page is an ODbL §4.3 / OSMF-attribution obligation, not
// copy. It has to survive refactors of the legal pages, so it gets a test that
// fails loudly if the credit or its licence link disappears.
//
// No login: legal pages must render while logged out.
test.describe('Datenquellen', () => {
    test('credits OpenStreetMap with a link to the licence', async ({ page }) => {
        await page.goto('/datenquellen');

        const credit = page.getByRole('link', { name: '© OpenStreetMap-Mitwirkende' });
        await expect(credit).toBeVisible();
        await expect(credit).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    });

    test('is reachable from the footer on any page', async ({ page }) => {
        await page.goto('/login');

        await page
            .getByRole('navigation', { name: 'Rechtliches' })
            .getByRole('link', { name: 'Datenquellen' })
            .click();
        await page.waitForURL('**/datenquellen');
        await expect(page.getByRole('heading', { level: 1, name: 'Datenquellen' })).toBeVisible();
    });

    test('has no WCAG AA violations', async ({ page }) => {
        await page.goto('/datenquellen');
        // Same tag set as accessibility.spec.ts — WCAG AA, no best-practice noise.
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
        const summary = results.violations
            .map((v) => `${v.id} (${v.impact}): ${v.description} — ${v.nodes.length} node(s)`)
            .join('\n');
        expect(results.violations, summary).toEqual([]);
    });
});
