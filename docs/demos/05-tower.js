// Demo 05 — triangulated tower under gravity; constraints colored by stress.
import { mountDemo, clearDemo } from './harness.js';
import { World } from '../../src/physics/world.js';
import { makeParticle, pin } from '../../src/physics/particle.js';
import { makeConstraint, stressRatio } from '../../src/physics/constraint.js';

mountDemo('.demo', ({ ctx, bounds, controls, setOutput, pointer, reset }) => {
  const world = new World({ bounds, gravity: { x: 0, y: 700 }, iterations: 10, friction: 0.2 });
  const floorY = bounds.h - 10;
  world.addSegment({ x: 0, y: floorY }, { x: bounds.w, y: floorY });

  const cx = bounds.w * 0.5;
  const baseY = floorY - 10;
  const sp = 60;
  const levels = 5;
  const cols = []; // array of [leftP, rightP] per level
  // Sub-pixel x-jitter on free particles. A perfectly aligned tower under
  // perfectly vertical gravity sits in an unstable equilibrium — the shear
  // mode is free but never excited. This tiny asymmetry is the analogue of
  // real-world wind/material imperfection that lets the tower topple when
  // diagonals are removed. Diagonals built below capture the jittered rest
  // lengths, so the triangulated tower still reads near-zero stress.
  const jitter = () => (Math.random() - 0.5) * 0.6;
  for (let i = 0; i < levels; i++) {
    const y = baseY - i * sp;
    const jx = i === 0 ? 0 : jitter();
    const L = makeParticle(cx - sp * 0.5 + jx, y, { radius: 6 });
    const R = makeParticle(cx + sp * 0.5 + jx, y, { radius: 6 });
    if (i === 0) { pin(L); pin(R); }
    world.addParticle(L); world.addParticle(R);
    cols.push([L, R]);
  }
  const addC = (a, b, extra = {}) => world.addConstraint(makeConstraint(a, b, { stiffness: 1, ...extra }));
  // Diagonals are built once (so restLength is captured in the pristine grid
  // configuration — keeps stress colours meaningful) but their membership in
  // `world.constraints` is toggled live below via syncDiagonals().
  const diagonals = [];
  const mkDiag = (a, b) => { diagonals.push(makeConstraint(a, b, { stiffness: 1 })); };
  for (let i = 0; i < levels; i++) {
    const [L, R] = cols[i];
    addC(L, R);
    if (i > 0) {
      const [Lp, Rp] = cols[i - 1];
      addC(Lp, L); addC(Rp, R);
      mkDiag(Lp, R); mkDiag(Rp, L);
    }
  }

  // Live add/remove of diagonals on toggle. The `diagonalsActive` guard
  // prevents double-adding (which would duplicate entries in world.constraints
  // since addConstraint just pushes) and makes the per-frame call O(1) when
  // the toggle hasn't changed.
  let diagonalsActive = null;
  const syncDiagonals = () => {
    const want = !!controls.triangulate.value;
    if (want === diagonalsActive) return;
    if (want) diagonals.forEach((c) => world.addConstraint(c));
    else      diagonals.forEach((c) => world.removeConstraint(c));
    diagonalsActive = want;
  };
  syncDiagonals();

  return (dt) => {
    if (controls.reset.pressed) { reset(); return; }
    syncDiagonals();
    world.step(dt);

    clearDemo(ctx, bounds);
    for (const c of world.constraints) {
      const r = stressRatio(c);
      const t = Math.max(0, Math.min(1, Math.abs(r - 1) / 0.5));
      const hue = 120 * (1 - t);
      ctx.strokeStyle = `hsl(${hue}, 80%, 55%)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); ctx.lineTo(c.b.x, c.b.y); ctx.stroke();
    }
    for (const p of world.particles) {
      ctx.fillStyle = p.invMass === 0 ? '#fbbf24' : '#60a5fa';
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#2a3347'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(bounds.w, floorY); ctx.stroke();

    const worstR = world.constraints.reduce((m, c) => Math.max(m, Math.abs(stressRatio(c) - 1)), 0);
    setOutput('stress', worstR.toFixed(3));
    setOutput('triangulate', controls.triangulate.value ? 'on' : 'off');
  };
});
