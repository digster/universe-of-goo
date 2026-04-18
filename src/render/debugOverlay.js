// -----------------------------------------------------------------------------
// Debug overlay — toggled by the `D` key in game and sandbox.
// -----------------------------------------------------------------------------
// Draws extra information on top of the main scene: particle centers with
// tiny crosshairs, constraint stress colouring (green = slack, yellow = at
// rest, red = near break), FPS + counts, and the gravity vector.
// -----------------------------------------------------------------------------

import { text, line, circle } from './drawPrimitives.js';
import { stressRatio } from '../physics/constraint.js';

export function drawDebug(ctx, world, { fps, bounds, selectedType, gravityEnabled, iterations }) {
  // --- constraints, colored by stress ---
  for (const c of world.constraints) {
    const r = stressRatio(c);
    // Map r in [0.8, maxStretch] to a hue from green(120) to red(0).
    const max = isFinite(c.maxStretch) ? c.maxStretch : 2;
    const t = Math.max(0, Math.min(1, (r - 0.8) / Math.max(0.01, max - 0.8)));
    const hue = 120 * (1 - t);
    line(ctx, c.a, c.b, `hsla(${hue}, 80%, 55%, 0.7)`, 1);
  }

  // --- particle crosshairs ---
  for (const p of world.particles) {
    const color = p.invMass === 0 ? '#f87171' : '#7dd3fc';
    line(ctx, { x: p.x - 4, y: p.y }, { x: p.x + 4, y: p.y }, color, 1);
    line(ctx, { x: p.x, y: p.y - 4 }, { x: p.x, y: p.y + 4 }, color, 1);
  }

  // --- gravity indicator in top-right ---
  const gx = world.gravity.x, gy = world.gravity.y;
  const glen = Math.hypot(gx, gy) || 1;
  const cx = bounds.w - 60, cy = 60;
  circle(ctx, cx, cy, 22, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.2)', 1);
  if (world.gravityEnabled) {
    line(ctx, { x: cx, y: cy }, { x: cx + (gx / glen) * 16, y: cy + (gy / glen) * 16 }, '#fbbf24', 2);
  }

  // --- stats panel ---
  const pad = 10;
  ctx.fillStyle = 'rgba(7, 10, 19, 0.85)';
  ctx.fillRect(pad, pad, 200, 104);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeRect(pad + 0.5, pad + 0.5, 200, 104);

  const lines = [
    `fps       ${fps.toFixed(0).padStart(4)}`,
    `particles ${String(world.particles.length).padStart(4)}`,
    `strands   ${String(world.constraints.length).padStart(4)}`,
    `iters     ${String(iterations ?? world.iterations).padStart(4)}`,
    `gravity   ${gravityEnabled ?? world.gravityEnabled ? 'on' : 'off'}`,
    selectedType ? `type      ${selectedType}` : null,
  ].filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    text(ctx, lines[i], pad + 8, pad + 6 + i * 16, { color: '#b9c4d6', size: 12 });
  }
}
