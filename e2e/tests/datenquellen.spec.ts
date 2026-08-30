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

    test('is reachable from the footer while logged out', async ({ page }) => {
        await page.goto('/login');

        // ConsentBanner is `fixed inset-x-0 bottom-0 z-50` and mounts in
        // main.tsx, so on a fresh context it sits over the footer on EVERY
        // page until a decision is stored. The footer link is visible and
        // enabled the whole time — it just never receives the pointer event,
        // which is what a 60s `locator.click` timeout on the line below
        // actually was, not a missing footer. Dismiss it the way a visitor
        // does; declining changes nothing else on the page.
        await page
            .getByRole('dialog', { name: 'Cookie-Einstellungen' })
            .getByRole('button', { name: 'Ablehnen' })
            .click();

        await page
            .getByRole('navigation', { name: 'Rechtliches' })
            .getByRole('link', { name: 'Datenquellen' })
            .click();
        await page.waitForURL('**/datenquellen');
        await expect(page.getByRole('heading', { level: 1, name: 'Datenquellen' })).toBeVisible();
    });

    test('has no WCAG AA violations', async ({ page }) => {
        await page.goto('/datenquellen');
        // The route is lazy() in App.tsx, so goto() resolves while Suspense is
        // still showing PageFallback — measured: at +0ms and +100ms the DOM has
        // no <h1> at all, just the spinner, and axe then scans the spinner and
        // reports a clean page. Wait for the real content, or this whole test
        // passes without ever having looked at it.
        await expect(page.getByRole('heading', { level: 1, name: 'Datenquellen' })).toBeVisible();
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
