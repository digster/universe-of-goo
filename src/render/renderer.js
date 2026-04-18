// -----------------------------------------------------------------------------
// Renderer — composes draw layers for the game and sandbox scenes.
// -----------------------------------------------------------------------------
// Reads world + game state and draws them onto a canvas context. Does not
// mutate either. Draw order (back → front):
//
//   1. background / gradient (already handled by CSS)
//   2. static geometry (floors, walls)
//   3. goal pipe (if any)
//   4. strands (constraints) — drawn with mild sag for the goo look
//   5. goo balls — type-tinted circles with eyes
//   6. dragged indicators (cursor line, attachment preview)
//   7. HUD overlays handled in DOM
//   8. debug overlay (if toggled)
// -----------------------------------------------------------------------------

import { clear, line, circle, saggingStrand, eyes, text } from './drawPrimitives.js';
import { stressRatio } from '../physics/constraint.js';
import { drawDebug } from './debugOverlay.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bounds = { w: canvas.width, h: canvas.height };
    this.debug = false;

    // --- FPS tracker ---
    this._frames = 0;
    this._lastFpsT = performance.now();
    this._fps = 60;
  }

  toggleDebug() { this.debug = !this.debug; }

  /**
   * Draw one frame.
   *
   * @param {import('../physics/world.js').World} world
   * @param {Object} scene
   * @param {Object} [scene.goal]            Goal pipe {x, y, radius, required, count}
   * @param {Array}  [scene.drags]           Active drag indicators [{from:{x,y}, to:{x,y}, attachable:bool}]
   * @param {string} [scene.selectedType]    Sandbox only.
   * @param {boolean}[scene.gravityEnabled]  Sandbox only.
   * @param {number} [scene.iterations]      Sandbox only.
   */
  draw(world, scene = {}) {
    const ctx = this.ctx;
    clear(ctx, this.bounds, '#07090f');

    // --- 1. background gradient grid for depth cue ---
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.bounds.w; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.bounds.h); ctx.stroke();
    }
    for (let y = 0; y <= this.bounds.h; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.bounds.w, y); ctx.stroke();
    }
    ctx.restore();

    // --- 2. static geometry ---
    for (const s of world.segments) {
      line(ctx, s.a, s.b, '#2a3347', 6);
      line(ctx, s.a, s.b, '#465069', 2);
    }

    // --- 3. goal pipe ---
    if (scene.goal) {
      const g = scene.goal;
      // outer ring
      circle(ctx, g.x, g.y, g.radius + 10, null, 'rgba(125,211,252,0.28)', 2);
      // suction ring
      circle(ctx, g.x, g.y, g.radius, 'rgba(125,211,252,0.15)', '#7dd3fc', 2);
      // animated inner glow
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.003);
      circle(ctx, g.x, g.y, g.radius * 0.55 * pulse, 'rgba(125,211,252,0.45)', null);
      if (typeof g.count === 'number' && typeof g.required === 'number') {
        text(ctx, `${g.count} / ${g.required}`, g.x, g.y + g.radius + 18,
          { color: '#e8ecf4', size: 14, align: 'center' });
      }
    }

    // --- 4. strands ---
    const gLen = Math.hypot(world.gravity.x, world.gravity.y) || 1;
    const gUnit = { x: world.gravity.x / gLen, y: world.gravity.y / gLen };
    for (const c of world.constraints) {
      const r = stressRatio(c);
      // Sag is proportional to slack (compression). Stretched strands look taut.
      const sag = r < 1 ? (1 - r) * c.restLength * 0.15 : 0;
      // Colour shifts from goo-yellow at rest → red when dangerously stretched.
      const maxS = isFinite(c.maxStretch) ? c.maxStretch : 2;
      const stretch = Math.max(0, Math.min(1, (r - 1) / Math.max(0.05, maxS - 1)));
      const color = `hsl(${45 - 45 * stretch}, ${70 + 20 * stretch}%, ${55 - 15 * stretch}%)`;
      saggingStrand(ctx, c.a, c.b, sag, gUnit, color, 4);
    }

    // --- 5. goo balls ---
    for (const p of world.particles) {
      const ball = p.userData;
      if (!ball || !ball.isGooBall) continue;
      const fill = ball.color || '#60a5fa';
      const strokeC = ball.pinned ? '#fbbf24' : '#0b0f1c';

      // outer body
      circle(ctx, p.x, p.y, p.radius, fill, strokeC, 2);

      // highlight
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.35, p.radius * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.restore();

      // eyes — gaze toward nearest ball or cursor (approximate: use vx, vy as a tiny hint)
      const dx = ball.gazeX ?? 0;
      const dy = ball.gazeY ?? 0;
      const gd = Math.hypot(dx, dy) || 1;
      eyes(ctx, p.x, p.y, p.radius, { x: dx / gd, y: dy / gd });

      // small balloon lift tail for balloon type
      if (ball.type === 'balloon') {
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + p.radius);
        ctx.lineTo(p.x, p.y + p.radius + 10);
        ctx.stroke();
        ctx.restore();
      }
    }

    // --- 6. drag indicators ---
    if (scene.drags) {
      for (const d of scene.drags) {
        const color = d.attachable ? '#7dd3fc' : '#f87171';
        ctx.save();
        ctx.setLineDash([6, 4]);
        line(ctx, d.from, d.to, color, 2);
        ctx.restore();
      }
    }

    // --- 7. debug overlay on top ---
    if (this.debug) {
      drawDebug(ctx, world, {
        fps: this._fps,
        bounds: this.bounds,
        selectedType: scene.selectedType,
        gravityEnabled: scene.gravityEnabled,
        iterations: scene.iterations,
      });
    }

    // FPS counter ticking
    this._frames++;
    const now = performance.now();
    if (now - this._lastFpsT >= 500) {
      this._fps = (this._frames * 1000) / (now - this._lastFpsT);
      this._frames = 0;
      this._lastFpsT = now;
    }
  }

  get fps() { return this._fps; }
}
