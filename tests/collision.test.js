import { describe, it, expect } from 'vitest';
import { makeParticle } from '../src/physics/particle.js';
import { resolveSegment } from '../src/physics/collision.js';
import { World } from '../src/physics/world.js';

describe('particle vs segment collision', () => {
  it('pushes a particle out along the normal when penetrating', () => {
    // y+ is down. Start particle ABOVE segment with its bottom penetrating:
    // center at y=95, radius 10 → bottom at y=105 (segment at y=100).
    const p = makeParticle(50, 95, { radius: 10 });
    const seg = { a: { x: 0, y: 100 }, b: { x: 100, y: 100 } };
    const hit = resolveSegment(p, seg, 0);
    expect(hit).toBe(true);
    expect(p.y).toBeCloseTo(90, 5); // center moved up by overlap (5) → 90
  });

  it('is a no-op when the particle is already clear of the segment', () => {
    const p = makeParticle(50, 50, { radius: 10 });
    const seg = { a: { x: 0, y: 100 }, b: { x: 100, y: 100 } };
    const hit = resolveSegment(p, seg, 0);
    expect(hit).toBe(false);
    expect(p.y).toBe(50);
  });

  it('does not move pinned particles', () => {
    const p = makeParticle(50, 105, { radius: 10, pinned: true });
    const seg = { a: { x: 0, y: 100 }, b: { x: 100, y: 100 } };
    const hit = resolveSegment(p, seg, 0);
    expect(hit).toBe(false);
    expect(p.y).toBe(105);
  });

  it('dropping a particle onto a floor settles within its radius of the floor', () => {
    const w = new World({ gravity: { x: 0, y: 900 }, iterations: 8, friction: 0.2 });
    const p = makeParticle(100, 0, { radius: 10 });
    w.addParticle(p);
    w.addSegment({ x: 0, y: 200 }, { x: 400, y: 200 });
    for (let i = 0; i < 240; i++) w.step(1 / 60); // 4 seconds
    expect(p.y).toBeGreaterThan(190 - 0.1);
    expect(p.y).toBeLessThanOrEqual(190.001);
  });

  it('angled segment deflects a falling particle sideways', () => {
    const w = new World({ gravity: { x: 0, y: 900 }, iterations: 8, friction: 0 });
    const p = makeParticle(100, 0, { radius: 10 });
    w.addParticle(p);
    // 45° slope descending to the right
    w.addSegment({ x: 0, y: 80 }, { x: 400, y: 260 });
    const x0 = p.x;
    for (let i = 0; i < 120; i++) w.step(1 / 60);
    expect(p.x).toBeGreaterThan(x0);
  });
});
