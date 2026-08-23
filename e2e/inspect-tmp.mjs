import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8080/register');
const email = `a11y-inspect-${Date.now()}@example.com`;
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

const wFit = page.locator('.w-fit').first();
console.log('--- .w-fit element ---');
console.log(await wFit.evaluate((el) => ({
  outerHTMLStart: el.outerHTML.slice(0, 300),
  className: el.className,
  computedColor: getComputedStyle(el).color,
  computedBg: getComputedStyle(el).backgroundColor,
  computedOpacity: getComputedStyle(el).opacity,
  ancestorsOpacity: (() => {
    const out = [];
    let p = el;
    while (p) { out.push({ tag: p.tagName, cls: typeof p.className === 'string' ? p.className : '', opacity: getComputedStyle(p).opacity }); p = p.parentElement; }
    return out.slice(0, 8);
  })(),
})));

const submitBtn = page.locator('button[type="submit"]').first();
console.log('--- submit button ---');
console.log(await submitBtn.evaluate((el) => ({
  outerHTMLStart: el.outerHTML.slice(0, 300),
  className: el.className,
  computedColor: getComputedStyle(el).color,
  computedBg: getComputedStyle(el).backgroundColor,
  computedOpacity: getComputedStyle(el).opacity,
  disabled: el.disabled,
})));

await browser.close();
