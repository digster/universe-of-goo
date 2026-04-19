// Demo 02 — two particles + one distance constraint, solved by relaxation.
// Sliders tune stiffness, rest length, and how many relaxation iterations
// run per step. Drag either ball with the mouse to perturb.
import { mountDemo, clearDemo } from './harness.js';
import { makeParticle } from '../../src/physics/particle.js';
import { verletStep } from '../../src/physics/integrator.js';
import { makeConstraint, solveConstraint } from '../../src/physics/constraint.js';

mountDemo('.demo', ({ ctx, bounds, controls, setOutput, pointer, reset }) => {
  const a = makeParticle(bounds.w * 0.5 - 120, bounds.h * 0.5);
  const b = makeParticle(bounds.w * 0.5 + 120, bounds.h * 0.5);
  const c = makeConstraint(a, b, { restLength: 240, stiffness: 0.9 });

  let drag = null;
  pointer.on('down', ({ x, y }) => {
    const da = Math.hypot(a.x - x, a.y - y);
    const db = Math.hypot(b.x - x, b.y - y);
    if (Math.min(da, db) < 20) drag = da < db ? a : b;
  });
  pointer.on('move', ({ x, y }) => {
    if (!drag) return;
    drag.x = x; drag.y = y; drag.oldX = x; drag.oldY = y;
  });
  pointer.on('up', () => { drag = null; });

  return (dt) => {
    if (controls.reset.pressed) { reset(); return; }
    c.restLength = controls.rest.value;
    c.stiffness = controls.stiffness.value;
    const iters = Math.round(controls.iters.value);

    verletStep(a, dt, 0, 600, 0.02);
    verletStep(b, dt, 0, 600, 0.02);
    if (drag) { drag.x = drag.oldX; drag.y = drag.oldY; } // pin dragged during solve
    for (let i = 0; i < iters; i++) solveConstraint(c);

    // Keep both particles inside the canvas. Mirrors demo 01's reflect-with-
    // damping style (see 01-particle.js) rather than a hard clamp, so a
    // dropped pair bounces once or twice before settling instead of sticking.
    // Applied after constraint iterations so a spring that pulled one ball
    // through the floor mid-solve still gets corrected before render.
    const R = 10;
    for (const p of [a, b]) {
      if (p.y > bounds.h - R) { p.y = bounds.h - R; p.oldY = p.y + (p.y - p.oldY) * 0.4; }
      if (p.x < R)            { p.x = R;            p.oldX = p.x + (p.x - p.oldX) * 0.6; }
      if (p.x > bounds.w - R) { p.x = bounds.w - R; p.oldX = p.x + (p.x - p.oldX) * 0.6; }
    }

    clearDemo(ctx, bounds);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const taut = d / c.restLength;
    ctx.strokeStyle = `hsl(${45 - Math.max(0, (taut - 1)) * 180}, 70%, 55%)`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    for (const p of [a, b]) {
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
    }

    setOutput('rest', c.restLength.toFixed(0));
    setOutput('stiffness', c.stiffness.toFixed(2));
    setOutput('iters', iters);
    setOutput('stretch', taut.toFixed(2));
  };
});
