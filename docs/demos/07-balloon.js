// Demo 07 — balloon lift: a chain with a balloon at the top, toggle lift.
import { mountDemo, clearDemo } from './harness.js';
import { World } from '../../src/physics/world.js';
import { makeGooBall, applyPreStepBehaviour } from '../../src/game/gooball.js';
import { makeConstraint } from '../../src/physics/constraint.js';

mountDemo('.demo', ({ ctx, bounds, controls, setOutput, pointer, reset }) => {
  const world = new World({ bounds, gravity: { x: 0, y: 900 }, iterations: 8, friction: 0.2 });
  const floorY = bounds.h - 10;
  world.addSegment({ x: 0, y: floorY }, { x: bounds.w, y: floorY });

  const anchor = makeGooBall('fixed', bounds.w * 0.5, floorY - 10, { attached: true, pinned: true });
  world.addParticle(anchor.particle);
  const chain = [];
  for (let i = 0; i < 5; i++) {
    const b = makeGooBall('basic', bounds.w * 0.5, floorY - 60 - i * 40, { attached: true });
    world.addParticle(b.particle); chain.push(b);
  }
  const balloon = makeGooBall('balloon', bounds.w * 0.5, floorY - 280, { attached: true });
  world.addParticle(balloon.particle);

  const link = (a, b) => world.addConstraint(
    makeConstraint(a.particle, b.particle, { stiffness: 0.9, maxStretch: 2.6 })
  );
  link(anchor, chain[0]);
  for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1]);
  link(chain[chain.length - 1], balloon);

  return (dt) => {
    if (controls.reset.pressed) { reset(); return; }
    // Temporarily mute lift when the checkbox is off.
    const liftOn = controls.lift.value;
    const prev = balloon._liftMask;
    // Override: zero out balloon force contribution by toggling `attached`
    // semantics. Simpler: don't run pre-step behaviour when lift is off.
    for (const b of [anchor, ...chain, balloon]) {
      if (b === balloon && !liftOn) continue;
      applyPreStepBehaviour(b, world, null);
    }
    world.step(dt);

    clearDemo(ctx, bounds);
    for (const c of world.constraints) {
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); ctx.lineTo(c.b.x, c.b.y); ctx.stroke();
    }
    for (const b of [anchor, ...chain, balloon]) {
      ctx.fillStyle = b.color; ctx.strokeStyle = '#0b0f1c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.particle.x, b.particle.y, b.particle.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = '#2a3347'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(bounds.w, floorY); ctx.stroke();

    setOutput('lift', liftOn ? 'on' : 'off');
    setOutput('top', `${(floorY - balloon.particle.y).toFixed(0)} px`);
  };
});
