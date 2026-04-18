import { describe, it, expect } from 'vitest';
import { validateLevel, buildLevel } from '../src/game/level.js';

const valid = () => ({
  id: 'level-t', name: 'Test',
  gravity: [0, 900],
  bounds: { w: 1280, h: 720 },
  static: [{ type: 'segment', a: [0, 700], b: [1280, 700] }],
  balls: [
    { type: 'basic', x: 100, y: 100 },
    { type: 'fixed', x: 200, y: 200, attached: true, pinned: true },
  ],
  initialStrands: [[0, 1]],
  goal: { x: 1000, y: 200, radius: 40, required: 3 },
});

describe('level.validateLevel', () => {
  it('accepts a minimal valid spec', () => {
    expect(validateLevel(valid())).toBe(true);
  });

  it('rejects missing goal', () => {
    const l = valid(); delete l.goal;
    expect(() => validateLevel(l)).toThrow(/goal/);
  });

  it('rejects out-of-range strand indices', () => {
    const l = valid();
    l.initialStrands = [[0, 99]];
    expect(() => validateLevel(l)).toThrow(/out of range/);
  });

  it('rejects self-loop strands', () => {
    const l = valid();
    l.initialStrands = [[0, 0]];
    expect(() => validateLevel(l)).toThrow(/self-loop/);
  });

  it('rejects unknown goo ball type', () => {
    const l = valid();
    l.balls[0].type = 'lasergoo';
    expect(() => validateLevel(l)).toThrow(/Unknown goo type/);
  });

  it('rejects non-numeric ball position', () => {
    const l = valid();
    l.balls[0].x = 'left';
    expect(() => validateLevel(l)).toThrow(/numeric/);
  });
});

describe('level.buildLevel', () => {
  it('builds a world, ball list, and goal from a valid spec', () => {
    const scene = buildLevel(valid());
    expect(scene.world.particles.length).toBe(2);
    expect(scene.balls.length).toBe(2);
    expect(scene.world.constraints.length).toBe(1);
    expect(scene.goal.required).toBe(3);
    expect(scene.goal.count).toBe(0);
  });

  it('passes through world iteration count', () => {
    const spec = valid();
    spec.iterations = 12;
    const scene = buildLevel(spec);
    expect(scene.world.iterations).toBe(12);
  });

  it('pinned balls have invMass = 0', () => {
    const scene = buildLevel(valid());
    const fixed = scene.balls.find((b) => b.type === 'fixed');
    expect(fixed.particle.invMass).toBe(0);
  });
});
