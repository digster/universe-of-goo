// Playwright smoke tests for the game entry point.
// These don't try to win the game — just prove the bundle boots, the level
// loads, and the canvas is actually drawing pixels.
import { test, expect } from '@playwright/test';

test.describe('game', () => {
  test('loads level-01 and renders canvas content', async ({ page }) => {
    await page.goto('/');

    // Canvas + HUD chips should be present immediately.
    await expect(page.locator('#stage')).toBeVisible();
    await expect(page.locator('#hud-level')).toBeVisible();

    // HUD chip transitions from "Loading…" to the level name after fetch+build.
    await expect(page.locator('#hud-level')).toContainText(/First Tower/i, { timeout: 5000 });

    // Count chip should read "N / M" once the level is ready.
    await expect(page.locator('#hud-count')).toContainText(/\d+\s*\/\s*\d+/);

    // Non-blank pixel check: pull an ImageData sample and confirm the canvas
    // has drawn something other than the solid background colour. We wait one
    // RAF beat so the first frame has definitely rendered.
    await page.waitForTimeout(250);
    const nonBlank = await page.evaluate(() => {
      const c = document.querySelector('#stage');
      const ctx = c.getContext('2d');
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      // Scan a handful of pixels — any departure from the bg colour counts.
      for (let i = 0; i < data.length; i += 4 * 997) {
        if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 40) return true;
      }
      return false;
    });
    expect(nonBlank).toBe(true);
  });

  test('docs and sandbox links resolve from game header', async ({ page }) => {
    await page.goto('/');
    const sandboxLink = page.locator('.hud-links a', { hasText: /sandbox/i });
    await expect(sandboxLink).toHaveAttribute('href', /sandbox\.html$/);
    const docsLink = page.locator('.hud-links a', { hasText: /docs/i });
    await expect(docsLink).toHaveAttribute('href', /docs\/index\.html$/);
  });
});
