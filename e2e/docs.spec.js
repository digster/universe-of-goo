// Playwright smoke tests for the docs site.
// We walk every demo page, assert the canvas renders non-blank pixels, and
// confirm at least one control (input[data-key] or button[data-key]) is present
// — the harness binds those, so a missing control would mean broken markup.
import { test, expect } from '@playwright/test';

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
      const nonBlank = await page.evaluate(() => {
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
      });
      expect(nonBlank).toBe(true);
    });
  }
});
