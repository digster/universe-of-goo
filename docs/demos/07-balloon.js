// Demo 07 — balloon lift: a chain with a balloon at the top, toggle lift.
import { mountDemo, clearDemo } from './harness.js';
import { World } from '../../src/physics/world.js';
import { makeGooBall, applyPreStepBehaviour } from '../../src/game/gooball.js';
import { makeConstraint } from '../../src/physics/constraint.js';

mountDemo('.demo', ({ ctx, bounds, controls, setOutput, pointer, reset }) => {
  // Demo gravity is softer than the game's 900 so the balloon's fixed
  // liftStrength (420, set in gootypes.js) can clearly overcome it when the
  // toggle is on. At g=100 with a 3-ball chain, net force is ~60 up ON vs
  // ~360 down OFF — a 6× delta that reads plainly on screen.
  const world = new World({ bounds, gravity: { x: 0, y: 100 }, iterations: 8, friction: 0.2 });
  const floorY = bounds.h - 10;
  world.addSegment({ x: 0, y: floorY }, { x: bounds.w, y: floorY });

  const cx = bounds.w * 0.5;
  const anchor = makeGooBall('fixed', cx, floorY - 10, { attached: true, pinned: true });
  world.addParticle(anchor.particle);

  // Chain starts pre-extended at rest length (40 px links), but with sub-pixel
  // x-jitter on each free ball. A perfectly aligned vertical chain under
  // perfectly vertical gravity sits in an unstable equilibrium — gravity
  // cannot tip it when lift is off, and the toggle would appear to do nothing.
  // The jitter seeds the tipping direction, so lift-off collapses the chain
  // toward the floor while lift-on holds it upright. Same trick as 05-tower.
  const jitter = () => (Math.random() - 0.5) * 0.4;
  const chain = [];
  for (let i = 0; i < 3; i++) {
    const b = makeGooBall('basic', cx + jitter(), floorY - 50 - i * 40, { attached: true });
    world.addParticle(b.particle); chain.push(b);
  }
  const balloon = makeGooBall('balloon', cx + jitter(), floorY - 170, { attached: true });
  world.addParticle(balloon.particle);

  const link = (a, b) => world.addConstraint(
    makeConstraint(a.particle, b.particle, { stiffness: 0.9, maxStretch: 2.6 })
  );
  link(anchor, chain[0]);
  for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1]);
  link(chain[chain.length - 1], balloon);

  return (dt) => {
    if (controls.reset.pressed) { reset(); return; }
    const liftOn = controls.lift.value;
    // When lift is off, skip the balloon's pre-step hook so its liftStrength
    // force is not accumulated — gravity alone pulls the chain back down.
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
