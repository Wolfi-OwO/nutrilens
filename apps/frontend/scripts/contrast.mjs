#!/usr/bin/env node
// Re-verifies the WCAG contrast ratios documented as comments next to each
// custom property in ../src/index.css. That file used to be checked with a
// throwaway script that was never committed, so a token edit had no way to
// prove it still passes AA. This is the committed replacement: no
// dependency, just hex parsing and the sRGB relative-luminance formula
// (WCAG 2.1 sections 1.4.3 / 1.4.11).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '..', 'src', 'index.css');
const css = readFileSync(cssPath, 'utf8')
    // Strip comments first so prose that happens to mention a token name
    // (e.g. "--primary-strong measures...") can never be mistaken for a
    // declaration by the property regex below.
    .replace(/\/\*[\s\S]*?\*\//g, '');

// Custom properties are declared exactly once per block; grab the FIRST
// :root {...} (the token block) and the .dark {...} block. A second, later
// :root block holds unrelated motion-duration tokens and is intentionally
// not read.
function extractBlock(source, selector) {
    // Match the selector immediately followed by its opening brace, not
    // just the substring anywhere — `.dark` also appears inside
    // `@custom-variant dark (&:is(.dark *));`, and a plain indexOf() on
    // that string locks onto the wrong `{`, silently pulling light-mode
    // values into what should be the dark block.
    const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{`);
    const match = re.exec(source);
    if (!match) throw new Error(`block not found: ${selector}`);
    const open = match.index + match[0].length - 1;
    const close = source.indexOf('}', open);
    return source.slice(open + 1, close);
}

function parseTokens(block) {
    const tokens = {};
    // Only hex values matter here; --accent-glow is rgba(...) and other
    // tokens are clamp()/font strings, so they're simply never looked up.
    const re = /--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
    let m;
    while ((m = re.exec(block))) tokens[m[1]] = m[2];
    return tokens;
}

const light = parseTokens(extractBlock(css, ':root'));
const dark = parseTokens(extractBlock(css, '.dark'));

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]) {
    const lin = (c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratioOf(rgbA, rgbB) {
    const lA = relativeLuminance(rgbA);
    const lB = relativeLuminance(rgbB);
    const [hi, lo] = lA >= lB ? [lA, lB] : [lB, lA];
    return (hi + 0.05) / (lo + 0.05);
}

// Standard alpha compositing, per channel: what a `bg-x/10` tint actually
// renders as once it sits over a solid page/card background.
function composite(fgHex, alpha, bgHex) {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
}

function buildPairs(t) {
    const primaryOnBg = composite(t.primary, 0.1, t.background);
    const primaryOnCard = composite(t.primary, 0.1, t.card);
    const destructiveOnBg = composite(t.destructive, 0.1, t.background);
    const destructiveOnCard = composite(t.destructive, 0.1, t.card);

    return [
        { name: 'foreground/background', fg: t.foreground, bg: t.background, floor: 4.5 },
        { name: 'card-foreground/card', fg: t['card-foreground'], bg: t.card, floor: 4.5 },
        { name: 'popover-foreground/popover', fg: t['popover-foreground'], bg: t.popover, floor: 4.5 },
        { name: 'muted-foreground/background', fg: t['muted-foreground'], bg: t.background, floor: 4.5 },
        { name: 'muted-foreground/card', fg: t['muted-foreground'], bg: t.card, floor: 4.5 },
        { name: 'primary-foreground/primary', fg: t['primary-foreground'], bg: t.primary, floor: 4.5 },
        { name: 'primary-foreground/primary-hover', fg: t['primary-foreground'], bg: t['primary-hover'], floor: 4.5 },
        { name: 'destructive-foreground/destructive', fg: t['destructive-foreground'], bg: t.destructive, floor: 4.5 },
        { name: 'destructive-foreground/destructive-hover', fg: t['destructive-foreground'], bg: t['destructive-hover'], floor: 4.5 },
        { name: 'primary-strong on primary/10 tint over background', fg: t['primary-strong'], bgRgb: primaryOnBg, floor: 4.5 },
        { name: 'primary-strong on primary/10 tint over card', fg: t['primary-strong'], bgRgb: primaryOnCard, floor: 4.5 },
        { name: 'destructive-strong on destructive/10 tint over background', fg: t['destructive-strong'], bgRgb: destructiveOnBg, floor: 4.5 },
        { name: 'destructive-strong on destructive/10 tint over card', fg: t['destructive-strong'], bgRgb: destructiveOnCard, floor: 4.5 },
        { name: 'chart-calorie/card', fg: t['chart-calorie'], bg: t.card, floor: 3.0 },
        { name: 'chart-protein/card', fg: t['chart-protein'], bg: t.card, floor: 3.0 },
        { name: 'chart-carb/card', fg: t['chart-carb'], bg: t.card, floor: 3.0 },
        { name: 'chart-fat/card', fg: t['chart-fat'], bg: t.card, floor: 3.0 },
        { name: 'chart-water/card', fg: t['chart-water'], bg: t.card, floor: 3.0 },
        { name: 'accent-foreground/accent', fg: t['accent-foreground'], bg: t.accent, floor: 4.5 },
        { name: 'accent-foreground/accent-hover', fg: t['accent-foreground'], bg: t['accent-hover'], floor: 4.5 },
        { name: 'success-foreground/success', fg: t['success-foreground'], bg: t.success, floor: 4.5 },
        // --input is a control boundary (WCAG 1.4.11), not text, so it is
        // held to the 3:1 non-text floor rather than the 4.5:1 text floor
        // used everywhere above. --border is the decorative hairline this
        // rule does NOT apply to and is deliberately never checked here.
        { name: 'input/card', fg: t.input, bg: t.card, floor: 3.0 },
    ];
}

let failures = [];

for (const [themeName, tokens] of [['light', light], ['dark', dark]]) {
    console.log(`\n-- ${themeName} --`);
    for (const pair of buildPairs(tokens)) {
        const fgRgb = hexToRgb(pair.fg);
        const bgRgb = pair.bgRgb ?? hexToRgb(pair.bg);
        const ratio = ratioOf(fgRgb, bgRgb);
        const pass = ratio >= pair.floor;
        const label = `${themeName}: ${pair.name}`;
        console.log(`${pass ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2)}:1  (>= ${pair.floor}:1)  ${label}`);
        if (!pass) failures.push(`${label} — ${ratio.toFixed(2)}:1 < ${pair.floor}:1`);
    }
}

if (failures.length) {
    console.log('\nFAILING PAIRS:');
    for (const f of failures) console.log(`  ${f}`);
    process.exit(1);
}
process.exit(0);
