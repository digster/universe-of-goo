// Playwright smoke tests for the sandbox.
// Drives the sandbox through: pressing shortcut buttons, spawning a ball via
// canvas click, and clearing. Assertions read the HUD chips so they reflect
// *observable* state a user would see — not private module fields.
import { test, expect } from '@playwright/test';

test.describe('sandbox', () => {
  test('toolbar buttons wire to actions', async ({ page }) => {
    await page.goto('/sandbox.html');

    await expect(page.locator('#stage')).toBeVisible();
    await expect(page.locator('#hud-gravity')).toContainText(/gravity:\s*on/i);

    // Toggle gravity off via the toolbar button — HUD chip should flip.
    await page.click('button[data-action="toggle-gravity"]');
    await expect(page.locator('#hud-gravity')).toContainText(/gravity:\s*off/i);

    // Selecting a different type should flip the type chip.
    await page.click('button[data-action="spawn-balloon"]');
    await expect(page.locator('#hud-type')).toContainText(/type:\s*balloon/i);
  });

  test('spawns balls by canvas click and clears them', async ({ page }) => {
    await page.goto('/sandbox.html');

    // Start with the seed scene already counted.
    const initial = await page.locator('#hud-count').textContent();
    const initialBalls = parseInt(initial.match(/(\d+)\s*balls/)[1], 10);

    // Spawn three balls by clicking empty areas of the canvas.
    const stage = page.locator('#stage');
    const box = await stage.boundingBox();
    for (const [fx, fy] of [[0.15, 0.25], [0.2, 0.3], [0.25, 0.35]]) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
      await page.mouse.down();
      await page.mouse.up();
      // Small beat between clicks — release dispatches the "spawn" gesture.
      await page.waitForTimeout(40);
    }
    // Ball count should have increased.
    await expect(page.locator('#hud-count')).not.toContainText(`${initialBalls} balls`);

    // Clear should zero out both counts.
    await page.click('button[data-action="clear"]');
    await expect(page.locator('#hud-count')).toContainText(/0\s*balls\s*\/\s*0\s*strands/i);
  });
});
