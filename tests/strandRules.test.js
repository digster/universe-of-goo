import { describe, it, expect } from 'vitest';
import { pickAttachmentCandidates, attachFreeBall } from '../src/game/strandRules.js';
import { makeGooBall } from '../src/game/gooball.js';
import { World } from '../src/physics/world.js';

describe('strandRules.pickAttachmentCandidates', () => {
  const mkAttached = (x, y, type = 'basic') => {
    const b = makeGooBall(type, x, y, { attached: true });
    return b;
  };

  it('returns nearest K candidates within radius', () => {
    // Query point is (50, 100); minDistance default is 20 so candidates must
    // be >20 units away (models "no zero-length strand" rule).
    const balls = [
      mkAttached(100, 100),  // d = 50  — nearest
      mkAttached(140, 100),  // d = 90  — second
      mkAttached(200, 100),  // d = 150 — within radius but third
      mkAttached(500, 500),  // far away
    ];
    const picks = pickAttachmentCandidates(
      { x: 50, y: 100 }, balls, [], { maxCount: 2, radius: 200 }
    );
    expect(picks).toHaveLength(2);
    expect(picks).toContain(balls[0]);
    expect(picks).toContain(balls[1]);
  });

  it('rejects candidates outside radius', () => {
    const balls = [mkAttached(500, 500)];
    const picks = pickAttachmentCandidates(
      { x: 100, y: 100 }, balls, [], { maxCount: 2, radius: 140 }
    );
    expect(picks).toHaveLength(0);
  });

  it('rejects unattached balls', () => {
    const free = makeGooBall('basic', 100, 100, { attached: false });
    const picks = pickAttachmentCandidates(
      { x: 110, y: 100 }, [free], [], { maxCount: 2, radius: 200 }
    );
    expect(picks).toHaveLength(0);
  });

  it('excludes candidates blocked by static geometry (line of sight)', () => {
    const balls = [mkAttached(200, 100)];
    const segments = [{ a: { x: 150, y: 0 }, b: { x: 150, y: 300 } }]; // wall between
    const picks = pickAttachmentCandidates(
      { x: 100, y: 100 }, balls, segments, { maxCount: 2, radius: 200, lineOfSight: true }
    );
    expect(picks).toHaveLength(0);
  });

  it('allows candidates with lineOfSight disabled', () => {
    const balls = [mkAttached(200, 100)];
    const segments = [{ a: { x: 150, y: 0 }, b: { x: 150, y: 300 } }];
    const picks = pickAttachmentCandidates(
      { x: 100, y: 100 }, balls, segments, { maxCount: 2, radius: 200, lineOfSight: false }
    );
    expect(picks).toHaveLength(1);
  });

  it('rejects zero-distance candidates (overlapping)', () => {
    const balls = [mkAttached(100, 100)];
    const picks = pickAttachmentCandidates(
      { x: 100, y: 100 }, balls, [], { maxCount: 2, radius: 200, minDistance: 5 }
    );
    expect(picks).toHaveLength(0);
  });

  it('respects maxStrands on candidates (saturated balls are skipped)', () => {
    const balls = [mkAttached(100, 100, 'basic')];
    // Saturate the candidate: basic has maxStrands=2; fake two dummy strand refs.
    balls[0].strands.push({}, {});
    const picks = pickAttachmentCandidates(
      { x: 120, y: 100 }, balls, [], { maxCount: 2, radius: 200 }
    );
    expect(picks).toHaveLength(0);
  });
});

describe('strandRules.attachFreeBall', () => {
  it('attaches a free ball and creates strands on both sides', () => {
    const world = new World({ gravity: { x: 0, y: 0 } });
    const anchor = makeGooBall('fixed', 200, 200, { attached: true, pinned: true });
    const attached = makeGooBall('basic', 260, 200, { attached: true });
    const free = makeGooBall('basic', 220, 260, { attached: false });
    for (const b of [anchor, attached, free]) world.addParticle(b.particle);

    const ok = attachFreeBall(free, world, [anchor, attached, free]);
    expect(ok).toBe(true);
    expect(free.attached).toBe(true);
    expect(free.strands.length).toBeGreaterThan(0);
    expect(world.constraints.length).toBeGreaterThan(0);
  });

  it('returns false and does nothing if no candidates are in range', () => {
    const world = new World({ gravity: { x: 0, y: 0 } });
    const anchor = makeGooBall('fixed', 100, 100, { attached: true, pinned: true });
    const free = makeGooBall('basic', 1000, 1000, { attached: false });
    for (const b of [anchor, free]) world.addParticle(b.particle);
    const ok = attachFreeBall(free, world, [anchor, free]);
    expect(ok).toBe(false);
    expect(free.attached).toBe(false);
    expect(world.constraints.length).toBe(0);
  });
});
