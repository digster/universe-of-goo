// Demo 03 — N-particle chain with a pinned head; drag the tail, tear the rope.
import { mountDemo, clearDemo } from './harness.js';
import { World } from '../../src/physics/world.js';
import { makeParticle, pin, warpTo } from '../../src/physics/particle.js';
import { makeConstraint } from '../../src/physics/constraint.js';

mountDemo('.demo', ({ ctx, bounds, controls, setOutput, pointer, reset }) => {
  const world = new World({
    bounds, gravity: { x: 0, y: 900 }, iterations: 8, friction: 0,
  });

  const N = 20;
  const linkLen = (bounds.w * 0.7) / N;
  const originX = bounds.w * 0.15;
  const originY = 40;

  const particles = [];
  for (let i = 0; i < N; i++) {
    const p = makeParticle(originX + i * linkLen, originY, { radius: 4 });
    if (i === 0) pin(p);
    world.addParticle(p);
    particles.push(p);
  }
  const links = [];
  for (let i = 0; i < N - 1; i++) {
    const c = makeConstraint(particles[i], particles[i + 1], {
      stiffness: 1, maxStretch: 2.5,
    });
    world.addConstraint(c);
    links.push(c);
  }

  let dragging = null;
  pointer.on('down', ({ x, y }) => {
    let best = null, bestD2 = 30 * 30;
    for (const p of particles) {
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = p; }
    }
    if (best && best.invMass > 0) dragging = best;
  });
  pointer.on('move', ({ x, y }) => {
    if (!dragging) return;
    warpTo(dragging, x, y);
  });
  pointer.on('up', () => { dragging = null; });

  return (dt) => {
    if (controls.reset.pressed) { reset(); return; }
    for (const c of world.constraints) c.maxStretch = controls.maxStretch.value;

    if (dragging) warpTo(dragging, dragging.x, dragging.y);
    world.step(dt);

    clearDemo(ctx, bounds);
    for (const c of world.constraints) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); ctx.lineTo(c.b.x, c.b.y); ctx.stroke();
    }
    for (const p of particles) {
      ctx.fillStyle = p.invMass === 0 ? '#f87171' : '#60a5fa';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2); ctx.fill();
    }
    setOutput('links', world.constraints.length);
    setOutput('maxStretch', controls.maxStretch.value.toFixed(2));
  };
});
