// Playwright smoke tests for the docs site.
// We walk every demo page, assert the canvas renders non-blank pixels, and
// confirm at least one control (input[data-key] or button[data-key]) is present
// — the harness binds those, so a missing control would mean broken markup.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Pages in reading order. Each row: [url, title fragment].
const PAGES = [
  ['/docs/index.html', /Universe of Goo/i],
  ['/docs/pages/01-particle.html', /Particle/i],
  ['/docs/pages/02-spring.html', /spring/i],
  ['/docs/pages/03-chain.html', /Chain/i],
  ['/docs/pages/04-cloth.html', /Cloth/i],
  ['/docs/pages/05-tower.html', /Tower/i],
  ['/docs/pages/06-gooball.html', /goo ball/i],
  ['/docs/pages/07-balloon.html', /Balloon/i],
];

test.describe('docs site', () => {
  for (const [url, title] of PAGES) {
    test(`loads ${url}`, async ({ page }) => {
      await page.goto(url);
      // Scoped to .docs-main — the sidebar h1 is always "Universe of Goo".
      await expect(page.locator('.docs-main h1').first()).toContainText(title);
      await expect(page.locator('.docs-sidebar')).toBeVisible();
    });
  }

  // Each demo page has a <canvas> inside .demo, plus at least one bound control.
  for (const [url] of PAGES.slice(1)) {
    test(`demo on ${url} renders and has controls`, async ({ page }) => {
      await page.goto(url);
      const canvas = page.locator('.demo canvas');
      await expect(canvas).toBeVisible();

      // At least one control must have data-key (the harness binds those).
      const controlCount = await page.locator('.demo [data-key]').count();
      expect(controlCount).toBeGreaterThan(0);

      // Give the RAF loop a few frames to paint.
      await page.waitForTimeout(600);
      const nonBlank = await page.evaluate(canvasPaintedCheck);
      expect(nonBlank).toBe(true);
    });
  }
});

// Stringified so it can be passed to page.evaluate without `this`-binding
// tricks. Returns true iff the demo canvas has drawn at least some non-bg
// pixels. See the inline comment for the stride logic.
function canvasPaintedCheck() {
  const c = document.querySelector('.demo canvas');
  const ctx = c.getContext('2d');
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  // Dense stride: bg is #070a13 (7,10,19); demo content (particles,
  // constraints, text) is much brighter. One bright channel anywhere is
  // enough. Stride 4*37 samples ~every 37th pixel across the whole canvas.
  let hits = 0;
  for (let i = 0; i < data.length; i += 4 * 37) {
    if (data[i] > 40 || data[i + 1] > 40 || data[i + 2] > 50) hits++;
  }
  return hits > 0;
}

// -----------------------------------------------------------------------------
// file:// smoke test — the promise the README makes: after `npm run build`,
// double-clicking a built docs page must run. This only works because
// scripts/build-docs.js inlines all JS + CSS into each HTML. If a regression
// re-introduces external <script src> or cross-chunk imports, the browser
// will refuse them over a file:// origin and the demo canvas stays blank.
// -----------------------------------------------------------------------------
test.describe('docs via file://', () => {
  // Spot-check two pages: the simplest (01) and a heavier one (04 cloth).
  const PAGES = [
    'dist/docs/pages/01-particle.html',
    'dist/docs/pages/04-cloth.html',
  ];
  for (const rel of PAGES) {
    test(`runs ${rel} from disk`, async ({ page }) => {
      // Collect any console errors — module-import failures over file:// show
      // up here before they manifest as a blank canvas.
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      const fileUrl = pathToFileURL(resolve(rel)).href;
      await page.goto(fileUrl);
      await expect(page.locator('.demo canvas')).toBeVisible();
      await page.waitForTimeout(600);
      const nonBlank = await page.evaluate(canvasPaintedCheck);
      expect(nonBlank, `canvas blank; console errors: ${errors.join(' | ')}`).toBe(true);
      expect(errors, `unexpected console errors: ${errors.join(' | ')}`).toEqual([]);
    });
  }
});
