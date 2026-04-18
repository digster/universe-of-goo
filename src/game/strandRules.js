// -----------------------------------------------------------------------------
// strandRules — choose which balls to connect a newly-dropped goo ball to.
// -----------------------------------------------------------------------------
// When the player drags a free-walker goo ball onto the structure and
// releases near attached balls, the game needs to decide:
//
//   1. Which existing ATTACHED balls are candidates (within radius R)?
//   2. Of those, which K (bounded by the new ball's maxStrands) should we
//      actually connect to?
//   3. Are any blocked by static geometry (line-of-sight)?
//   4. Do any candidates already have maxStrands on themselves?
//
// This is the game's most game-specific logic; it deserves tests.
// -----------------------------------------------------------------------------

import { makeConstraint } from '../physics/constraint.js';
import { segmentsIntersect } from '../physics/vec2.js';
import { getType } from './gootypes.js';

/**
 * Pick candidate attached balls for a freshly-placed ball at (x, y).
 *
 * @param {{x:number, y:number}} pos                Drop position.
 * @param {Array} balls                             All goo balls in the world.
 * @param {Array<{a:{x,y},b:{x,y}}>} segments       Static geometry.
 * @param {Object} [opts]
 * @param {number} [opts.radius=140]                Search radius (world units).
 * @param {number} [opts.maxCount=2]                Cap candidates returned.
 * @param {boolean}[opts.lineOfSight=true]          If true, reject candidates blocked by a static segment.
 * @param {number} [opts.minDistance=20]            Reject zero-length / overlapping strands.
 * @returns {Array} The accepted candidates (subset of `balls`).
 */
export function pickAttachmentCandidates(pos, balls, segments, opts = {}) {
  const {
    radius = 140,
    maxCount = 2,
    lineOfSight = true,
    minDistance = 20,
  } = opts;

  const r2 = radius * radius;
  const scored = [];

  for (const b of balls) {
    if (!b.attached) continue;

    const dx = b.particle.x - pos.x;
    const dy = b.particle.y - pos.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (d2 < minDistance * minDistance) continue;

    if (lineOfSight && segments.length) {
      let blocked = false;
      for (const s of segments) {
        if (segmentsIntersect(pos, b.particle, s.a, s.b)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
    }

    // Skip balls that have saturated their strand budget.
    const bType = getType(b.type);
    if (b.strands.length >= bType.maxStrands) continue;

    scored.push({ ball: b, d2 });
  }

  scored.sort((p, q) => p.d2 - q.d2);
  return scored.slice(0, maxCount).map((s) => s.ball);
}

/**
 * Try to attach a free ball to the existing structure by creating up to
 * `type.maxStrands` constraints. Returns true on success.
 *
 * @param {ReturnType<import('./gooball.js').makeGooBall>} freeBall
 * @param {import('../physics/world.js').World} world
 * @param {Array} allBalls   Full goo-ball list.
 * @returns {boolean}
 */
export function attachFreeBall(freeBall, world, allBalls) {
  if (freeBall.attached) return true;

  const type = getType(freeBall.type);
  const candidates = pickAttachmentCandidates(
    freeBall.particle,
    allBalls,
    world.segments,
    { maxCount: type.maxStrands, radius: 160 }
  );

  if (candidates.length === 0) return false;

  for (const other of candidates) {
    const otherType = getType(other.type);
    const stiffness = Math.min(type.strandStiffness, otherType.strandStiffness);
    const maxStretch = Math.min(type.strandMaxStretch, otherType.strandMaxStretch);
    const c = makeConstraint(freeBall.particle, other.particle, {
      stiffness,
      maxStretch,
      userData: { kind: 'strand', a: freeBall, b: other },
    });
    world.addConstraint(c);
    freeBall.strands.push(c);
    other.strands.push(c);
  }

  freeBall.attached = true;
  return true;
}
