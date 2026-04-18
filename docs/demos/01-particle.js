// Demo 01 — Verlet integration of a single particle.
// Slide `damping` and watch the trail; lower damping = more bounce-around.
// Controls: damping, initialVX, reset.
import { mountDemo, clearDemo } from './harness.js';
import { makeParticle } from '../../src/physics/particle.js';
import { verletStep } from '../../src/physics/integrator.js';

mountDemo('.demo', ({ ctx, bounds, controls, setOutput, pointer, reset }) => {
  let p = makeParticle(bounds.w * 0.5, 40);
  // Seed an initial horizontal velocity by setting oldX behind current x.
  p.oldX = p.x - controls.initialVX.value;
  const trail = [];

  pointer.on('down', ({ x, y }) => {
    // Re-launch from the click location with the current VX.
    p = makeParticle(x, y);
    p.oldX = p.x - controls.initialVX.value;
    trail.length = 0;
  });

  return (dt) => {
    if (controls.reset.pressed) { reset(); return; }
    const damping = controls.damping.value;
    verletStep(p, dt, 0, 900, damping);

    // Floor bounce — naive, just reflect y implicit velocity.
    if (p.y > bounds.h - 10) {
      p.y = bounds.h - 10;
      p.oldY = p.y + (p.y - p.oldY) * 0.4;
    }
    if (p.x < 5 || p.x > bounds.w - 5) {
      p.oldX = p.x + (p.x - p.oldX) * 0.6;
      p.x = Math.max(5, Math.min(bounds.w - 5, p.x));
    }

    trail.push({ x: p.x, y: p.y });
    if (trail.length > 200) trail.shift();

    clearDemo(ctx, bounds);
    // trail
    ctx.strokeStyle = 'rgba(125,211,252,0.35)';
    ctx.beginPath();
    trail.forEach((t, i) => (i ? ctx.lineTo(t.x, t.y) : ctx.moveTo(t.x, t.y)));
    ctx.stroke();
    // particle
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();

    const vx = p.x - p.oldX, vy = p.y - p.oldY;
    setOutput('damping', damping.toFixed(3));
    setOutput('initialVX', controls.initialVX.value.toFixed(2));
    setOutput('velocity', `${Math.hypot(vx, vy).toFixed(2)} px/step`);
  };
});
