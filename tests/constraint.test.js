import { describe, it, expect } from 'vitest';
import { makeParticle } from '../src/physics/particle.js';
import { makeConstraint, solveConstraint, stressRatio } from '../src/physics/constraint.js';
import { World } from '../src/physics/world.js';

describe('distance constraint / relaxation', () => {
  it('rest-length pair stays at rest length after a single solve', () => {
    const a = makeParticle(0, 0);
    const b = makeParticle(100, 0);
    const c = makeConstraint(a, b);
    solveConstraint(c);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(100, 6);
  });

  it('stretched pair converges to rest length with stiffness=1 and enough iterations', () => {
    const a = makeParticle(0, 0);
    const b = makeParticle(200, 0); // 2x rest
    const c = makeConstraint(a, b, { restLength: 100, stiffness: 1 });
    for (let i = 0; i < 10; i++) solveConstraint(c);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(100, 4);
  });

  it('a pinned particle receives no correction; the other takes the full delta', () => {
    const a = makeParticle(0, 0, { pinned: true });
    const b = makeParticle(200, 0);
    const c = makeConstraint(a, b, { restLength: 100, stiffness: 1 });
    for (let i = 0; i < 10; i++) solveConstraint(c);
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(b.x).toBeCloseTo(100, 3);
  });

  it('breaks when stretch exceeds maxStretch', () => {
    const a = makeParticle(0, 0);
    const b = makeParticle(301, 0);
    const c = makeConstraint(a, b, { restLength: 100, maxStretch: 3 });
    solveConstraint(c);
    expect(c.broken).toBe(true);
  });

  it('lower stiffness converges more slowly (softer spring)', () => {
    const mk = (k) => {
      const a = makeParticle(0, 0);
      const b = makeParticle(200, 0);
      const c = makeConstraint(a, b, { restLength: 100, stiffness: k });
      for (let i = 0; i < 3; i++) solveConstraint(c);
      return Math.hypot(b.x - a.x, b.y - a.y);
    };
    const stiff = mk(1);
    const soft = mk(0.2);
    // After a fixed number of iterations, the soft spring is still further
    // from rest than the stiff one.
    expect(Math.abs(soft - 100)).toBeGreaterThan(Math.abs(stiff - 100));
  });

  it('stressRatio is 1 at rest, > 1 when stretched, < 1 when compressed', () => {
    const a = makeParticle(0, 0);
    const b = makeParticle(100, 0);
    const c = makeConstraint(a, b); // rest = 100
    expect(stressRatio(c)).toBeCloseTo(1);
    b.x = 150; expect(stressRatio(c)).toBeCloseTo(1.5);
    b.x = 50; expect(stressRatio(c)).toBeCloseTo(0.5);
  });

  it('World prunes broken constraints at end of step', () => {
    const w = new World({ gravity: { x: 0, y: 0 }, iterations: 2 });
    const a = makeParticle(0, 0);
    const b = makeParticle(500, 0);
    w.addParticle(a); w.addParticle(b);
    const c = makeConstraint(a, b, { restLength: 100, maxStretch: 2 });
    w.addConstraint(c);
    w.step(1 / 60);
    expect(w.constraints).not.toContain(c);
  });
});
