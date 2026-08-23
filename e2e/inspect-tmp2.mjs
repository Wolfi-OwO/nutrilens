import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8080/register');
const email = `a11y-inspect2-${Date.now()}@example.com`;
await page.getByLabel('Name').fill('Inspect Tester');
await page.getByLabel('Email').fill(email);
await page.getByLabel('Password').fill('TestPassword123!');
await page.getByRole('button', { name: 'Create account' }).click();
await page.waitForURL('http://localhost:8080/');

const guide = page.getByRole('dialog', { name: /Welcome to NutriLens/i });
const shown = await guide.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
if (shown) {
  await page.getByRole('button', { name: 'Close guide' }).click();
  await guide.waitFor({ state: 'hidden' });
}

await page.goto('http://localhost:8080/log-meal');
await page.getByRole('button', { name: 'Enter it manually' }).click();
await page.waitForTimeout(400); // let the .page-enter 0.2s fade-in settle

const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
console.log('violations after settling:', JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length, msgs: v.nodes.map(n => n.failureSummary) })), null, 2));

await browser.close();
