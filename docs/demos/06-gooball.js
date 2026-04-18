// Demo 06 — strand-attachment rules with live K (maxCount) and R (radius).
// A seed tower is placed; click to drop a new basic ball; it attaches to the
// nearest K attached balls within R (respecting line-of-sight).
import { mountDemo, clearDemo } from './harness.js';
import { World } from '../../src/physics/world.js';
import { makeGooBall, applyPreStepBehaviour } from '../../src/game/gooball.js';
import { attachFreeBall, pickAttachmentCandidates } from '../../src/game/strandRules.js';

mountDemo('.demo', ({ ctx, bounds, controls, setOutput, pointer, reset }) => {
  const world = new World({ bounds, gravity: { x: 0, y: 700 }, iterations: 8, friction: 0.2 });
  const floorY = bounds.h - 10;
  world.addSegment({ x: 0, y: floorY }, { x: bounds.w, y: floorY });

  const balls = [];
  const addBall = (type, x, y, opts = {}) => {
    const b = makeGooBall(type, x, y, opts);
    world.addParticle(b.particle);
    balls.push(b);
    return b;
  };
  const anchor = addBall('fixed', bounds.w * 0.5, floorY - 10, { pinned: true, attached: true });
  const seed = [
    addBall('basic', bounds.w * 0.5 - 40, floorY - 60, { attached: true }),
    addBall('basic', bounds.w * 0.5 + 40, floorY - 60, { attached: true }),
    addBall('basic', bounds.w * 0.5, floorY - 110, { attached: true }),
  ];
  // Initial strands so the seed is a rigid triangle on the anchor.
  for (const s of seed) attachFreeBall(s, world, [anchor, ...seed]);

  pointer.on('down', ({ x, y }) => {
    const free = makeGooBall('basic', x, y, { attached: false });
    world.addParticle(free.particle);
    balls.push(free);
    const type = { maxStrands: Math.round(controls.maxStrands.value) };
    const candidates = pickAttachmentCandidates(
      free.particle, balls, world.segments,
      { maxCount: type.maxStrands, radius: controls.radius.value, lineOfSight: true }
    );
    for (const other of candidates) {
      world.addConstraint({
        a: free.particle, b: other.particle,
        restLength: Math.hypot(other.particle.x - free.particle.x, other.particle.y - free.particle.y),
        stiffness: 0.9, maxStretch: 2.5, broken: false,
        userData: { kind: 'strand', a: free, b: other },
      });
    }
    free.attached = candidates.length > 0;
  });

  return (dt) => {
    if (controls.reset.pressed) { reset(); return; }
    for (const b of balls) applyPreStepBehaviour(b, world, null);
    world.step(dt);

    clearDemo(ctx, bounds);
    for (const c of world.constraints) {
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); ctx.lineTo(c.b.x, c.b.y); ctx.stroke();
    }
    for (const b of balls) {
      ctx.fillStyle = b.color; ctx.strokeStyle = b.pinned ? '#fbbf24' : '#0b0f1c';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.particle.x, b.particle.y, b.particle.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = '#2a3347'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(bounds.w, floorY); ctx.stroke();

    setOutput('maxStrands', Math.round(controls.maxStrands.value));
    setOutput('radius', controls.radius.value.toFixed(0));
    setOutput('balls', balls.length);
    setOutput('strands', world.constraints.length);
  };
});
