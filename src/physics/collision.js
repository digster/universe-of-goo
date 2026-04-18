// -----------------------------------------------------------------------------
// Collision: particle (circle) vs static line segments.
// -----------------------------------------------------------------------------
// The world's static geometry is a list of line segments (floors, walls,
// slopes). For each particle we:
//
//   1. Find the closest point on the segment.
//   2. If it's inside the particle's radius, push the particle along the
//      outward normal until it rests on the segment edge.
//   3. Dampen the tangential component of the implied velocity so balls
//      don't frictionlessly slide forever (friction coefficient).
//
// Pinned particles (invMass = 0) are skipped — they shouldn't move in
// response to collisions.
// -----------------------------------------------------------------------------

import { closestPointOnSegment } from './vec2.js';

/**
 * Resolve collision between a particle and a single segment in place.
 * Returns true if a collision was applied (useful for tests).
 *
 * @param {import('./particle.js').Particle} p
 * @param {{a: {x:number,y:number}, b:{x:number,y:number}}} seg
 * @param {number} friction  In [0, 1]. 0 = frictionless, 1 = stick.
 */
export function resolveSegment(p, seg, friction = 0.15) {
  if (p.invMass === 0) return false;
  const cp = closestPointOnSegment(p, seg.a, seg.b);
  const dx = p.x - cp.x;
  const dy = p.y - cp.y;
  const d2 = dx * dx + dy * dy;
  const r = p.radius;
  if (d2 >= r * r) return false;

  const d = Math.sqrt(d2) || 1e-6;
  const nx = dx / d;
  const nyv = dy / d;
  const overlap = r - d;

  // Push the particle out along the collision normal.
  p.x += nx * overlap;
  p.y += nyv * overlap;

  // Tangential friction: dampen the component of implied velocity
  // perpendicular to the normal. We edit `oldX/oldY` because in Verlet,
  // changing old positions changes implicit velocity without phantom teleports.
  const vx = p.x - p.oldX;
  const vy = p.y - p.oldY;
  const vn = vx * nx + vy * nyv;          // normal component (usually <= 0 after push-out)
  const tx = vx - vn * nx;
  const tyv = vy - vn * nyv;              // tangential components
  const keep = 1 - friction;
  const newVx = tx * keep + 0 * nx;       // bounce=0: kill normal velocity (goo balls are squishy)
  const newVy = tyv * keep + 0 * nyv;
  p.oldX = p.x - newVx;
  p.oldY = p.y - newVy;

  return true;
}
