import { describe, it, expect } from 'vitest';
import { makeParticle, applyForce, warpTo, pin, unpin } from '../src/physics/particle.js';
import { verletStep } from '../src/physics/integrator.js';

describe('particle + Verlet integrator', () => {
  it('pinned particle does not drift under gravity', () => {
    const p = makeParticle(100, 100, { pinned: true });
    for (let i = 0; i < 1000; i++) verletStep(p, 1 / 60, 0, 900, 0);
    expect(p.x).toBe(100);
    expect(p.y).toBe(100);
  });

  it('free particle under gravity follows 0.5 * g * t² to good precision', () => {
    const g = 900;
    const dt = 1 / 60;
    const p = makeParticle(0, 0);
    const steps = 120; // 2 seconds
    for (let i = 0; i < steps; i++) verletStep(p, dt, 0, g, 0);
    const t = steps * dt;
    const expected = 0.5 * g * t * t;
    // Verlet under-estimates slightly vs the exact closed form by ~0.5*g*dt*t,
    // so we allow a 1% tolerance. Tight enough to catch sign errors.
    expect(Math.abs(p.y - expected) / expected).toBeLessThan(0.01);
  });

  it('damping > 0 causes a free-falling particle to reach lower terminal-ish velocity', () => {
    const noDamp = makeParticle(0, 0);
    const damp = makeParticle(0, 0);
    for (let i = 0; i < 200; i++) {
      verletStep(noDamp, 1 / 60, 0, 900, 0);
      verletStep(damp,   1 / 60, 0, 900, 0.2);
    }
    expect(damp.y).toBeLessThan(noDamp.y);
  });

  it('applyForce accumulates, and is cleared after a step', () => {
    const p = makeParticle(0, 0, { mass: 1 });
    applyForce(p, 10, 0);
    applyForce(p, 5, 0);
    expect(p.fx).toBe(15);
    verletStep(p, 1 / 60, 0, 0, 0);
    expect(p.fx).toBe(0);
    expect(p.x).toBeGreaterThan(0);
  });

  it('warpTo zeroes implicit velocity', () => {
    const p = makeParticle(0, 0);
    for (let i = 0; i < 10; i++) verletStep(p, 1 / 60, 0, 900, 0);
    warpTo(p, 500, 500);
    expect(p.x - p.oldX).toBe(0);
    expect(p.y - p.oldY).toBe(0);
  });

  it('pin and unpin round-trip preserves identity fields', () => {
    const p = makeParticle(10, 20, { mass: 2 });
    pin(p);
    expect(p.invMass).toBe(0);
    unpin(p, 2);
    expect(p.invMass).toBeCloseTo(0.5);
  });
});
