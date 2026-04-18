// -----------------------------------------------------------------------------
// Preview honesty tests — "what you see is what you get" for drag previews.
// -----------------------------------------------------------------------------
// The drag-preview feature in src/main.js calls `pickAttachmentCandidates`
// with the SAME args that `attachFreeBall` (in src/game/strandRules.js) uses
// internally — `radius: 160`, `maxCount: type.maxStrands`. These tests lock in
// the invariant that the preview set equals the actual strand set produced on
// release. If someone changes `attachFreeBall`'s params without updating the
// main.js preview call, these tests fail.
//
// Tests mirror the scenarios the player encounters:
//   1. Inside radius → preview lists candidates, attachFreeBall builds strands
//      to exactly those candidates.
//   2. Outside radius → empty preview, no attachment.
//   3. Line-of-sight blocked → empty preview, no attachment.
//   4. Saturated neighbour → excluded from preview AND from attachment.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { pickAttachmentCandidates, attachFreeBall } from '../src/game/strandRules.js';
import { makeGooBall } from '../src/game/gooball.js';
import { warpTo } from '../src/physics/particle.js';
import { getType } from '../src/game/gootypes.js';
import { World } from '../src/physics/world.js';

// Mirror of main.js's preview call — if this drifts from `attachFreeBall`,
// tests here catch it by comparing resulting strand sets.
function previewFor(freeBall, world, allBalls) {
  const type = getType(freeBall.type);
  return pickAttachmentCandidates(
    freeBall.particle,
    allBalls,
    world.segments,
    { maxCount: type.maxStrands, radius: 160 }
  );
}

// Given a strand constraint whose userData links to `free` on one side, return
// the ball on the other side. Used to extract the actual attachment targets.
function otherEnd(strand, free) {
  return strand.userData.a === free ? strand.userData.b : strand.userData.a;
}

function makeScene() {
  const world = new World({ gravity: { x: 0, y: 0 } });
  // Structure of 3 attached balls around (220, 220).
  const anchor = makeGooBall('fixed', 200, 200, { attached: true, pinned: true });
  const a = makeGooBall('basic', 260, 200, { attached: true });
  const b = makeGooBall('basic', 200, 260, { attached: true });
  // Free walker starts far away; we'll warp it to probe different positions.
  const free = makeGooBall('basic', 1000, 1000, { attached: false });
  const balls = [anchor, a, b, free];
  for (const x of balls) world.addParticle(x.particle);
  return { world, balls, free, anchor, a, b };
}

describe('drag preview honesty', () => {
  it('preview set equals actual attachment set when inside radius', () => {
    const { world, balls, free } = makeScene();
    warpTo(free.particle, 230, 230);

    const preview = previewFor(free, world, balls);
    expect(preview.length).toBeGreaterThan(0);

    const ok = attachFreeBall(free, world, balls);
    expect(ok).toBe(true);

    // Each strand's "other" endpoint must be in the preview set.
    const actual = free.strands.map((s) => otherEnd(s, free));
    expect(actual).toHaveLength(preview.length);
    for (const target of actual) expect(preview).toContain(target);
  });

  it('empty preview outside radius — attachFreeBall attaches nothing', () => {
    const { world, balls, free } = makeScene();
    warpTo(free.particle, 900, 900);

    const preview = previewFor(free, world, balls);
    expect(preview).toHaveLength(0);

    const ok = attachFreeBall(free, world, balls);
    expect(ok).toBe(false);
    expect(free.strands).toHaveLength(0);
    expect(world.constraints).toHaveLength(0);
  });

  it('preview excludes candidates blocked by static geometry', () => {
    // Dedicated scene: one target with a wall in between.
    const world = new World({ gravity: { x: 0, y: 0 } });
    const target = makeGooBall('fixed', 300, 200, { attached: true, pinned: true });
    const free = makeGooBall('basic', 200, 200, { attached: false });
    world.addSegment({ x: 250, y: 100 }, { x: 250, y: 300 }); // vertical wall between them
    world.addParticle(target.particle);
    world.addParticle(free.particle);
    const balls = [target, free];

    const preview = previewFor(free, world, balls);
    expect(preview).toHaveLength(0);

    const ok = attachFreeBall(free, world, balls);
    expect(ok).toBe(false);
    expect(free.strands).toHaveLength(0);
  });

  it('preview excludes candidates whose strand budget is saturated', () => {
    const { world, balls, free, a } = makeScene();
    // Saturate ball `a`: basic.maxStrands = 2. Push two dummy strand refs.
    a.strands.push({}, {});
    warpTo(free.particle, 230, 230);

    const preview = previewFor(free, world, balls);
    expect(preview).not.toContain(a);

    const ok = attachFreeBall(free, world, balls);
    if (ok) {
      // If anything did attach, it cannot be `a`.
      for (const s of free.strands) {
        expect(otherEnd(s, free)).not.toBe(a);
      }
    }
  });

  it('preview order matches distance-ranked reality (nearest first)', () => {
    // Nearest-K ordering guarantees that when maxCount limits the set, the
    // preview shows the exact balls that will be picked.
    const world = new World({ gravity: { x: 0, y: 0 } });
    const near = makeGooBall('basic', 220, 200, { attached: true });
    const mid = makeGooBall('basic', 260, 200, { attached: true });
    const far = makeGooBall('basic', 320, 200, { attached: true });
    const free = makeGooBall('basic', 200, 200, { attached: false }); // basic.maxStrands = 2
    const balls = [near, mid, far, free];
    for (const x of balls) world.addParticle(x.particle);

    const preview = previewFor(free, world, balls);
    expect(preview).toHaveLength(2);
    // Should pick the two nearest (near + mid), not far.
    expect(preview).toContain(near);
    expect(preview).toContain(mid);
    expect(preview).not.toContain(far);

    attachFreeBall(free, world, balls);
    const actual = new Set(free.strands.map((s) => otherEnd(s, free)));
    expect(actual.has(near)).toBe(true);
    expect(actual.has(mid)).toBe(true);
    expect(actual.has(far)).toBe(false);
  });
});
