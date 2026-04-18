// -----------------------------------------------------------------------------
// GooBall — a Particle + type metadata + runtime state.
// -----------------------------------------------------------------------------
// The physics layer sees only Particles. Everything "game-shaped" (what type
// of goo it is, whether it's attached, how many strands it currently has,
// who it's gazing at) lives here. `userData` on the particle points back at
// the ball so renderer and game code can cross-reference without a map.
//
// Per-frame behaviour (balloon lift, gaze) is applied by calling
// `applyPreStepBehaviour(ball, world)` each tick BEFORE `world.step()`, so
// forces accumulate into `particle.fx/fy` and get consumed by the integrator.
// -----------------------------------------------------------------------------

import { makeParticle, applyForce } from '../physics/particle.js';
import { getType } from './gootypes.js';

let _nextId = 1;

/**
 * @param {string} typeName
 * @param {number} x
 * @param {number} y
 * @param {Object} [opts]
 * @param {boolean} [opts.attached=false]  Already part of a structure.
 * @param {boolean} [opts.pinned]          Force-override (otherwise type.pinned wins).
 */
export function makeGooBall(typeName, x, y, opts = {}) {
  const type = getType(typeName);
  const pinned = opts.pinned ?? type.pinned;
  const particle = makeParticle(x, y, {
    mass: type.mass,
    radius: type.radius,
    pinned,
  });
  const ball = {
    id: _nextId++,
    isGooBall: true,
    type: type.name,
    color: type.color,
    attached: opts.attached ?? pinned,  // pinned balls are always "attached" as anchors
    pinned,
    particle,
    strands: [],          // constraints currently connecting this ball
    gazeX: 0,
    gazeY: 0,
  };
  particle.userData = ball;
  return ball;
}

/**
 * Per-frame behaviour applied BEFORE world.step(). Consumes nothing from the
 * world, just accumulates per-particle forces and nudges the `gaze` vector.
 *
 * @param {ReturnType<typeof makeGooBall>} ball
 * @param {import('../physics/world.js').World} world
 * @param {{x:number,y:number} | null} cursor  Player's pointer position, or null.
 */
export function applyPreStepBehaviour(ball, world, cursor = null) {
  const type = getType(ball.type);
  const p = ball.particle;

  // Balloon lift — opposite direction of gravity, scaled by attachment.
  if (type.liftStrength > 0) {
    const g = world.gravity;
    const glen = Math.hypot(g.x, g.y) || 1;
    const scale = ball.attached ? 1 : 0.5;
    applyForce(p, -g.x / glen * type.liftStrength * scale,
                 -g.y / glen * type.liftStrength * scale);
  }

  // Gaze — look toward cursor if close, else toward the ball's implicit
  // velocity direction. Purely cosmetic; renderer consumes it.
  if (cursor) {
    const dx = cursor.x - p.x;
    const dy = cursor.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 200) {
      ball.gazeX = dx / (d || 1);
      ball.gazeY = dy / (d || 1);
      return;
    }
  }
  const vx = p.x - p.oldX;
  const vy = p.y - p.oldY;
  const vl = Math.hypot(vx, vy);
  if (vl > 0.1) {
    ball.gazeX = vx / vl;
    ball.gazeY = vy / vl;
  } else {
    // ease back toward "look down" for idle balls
    ball.gazeX *= 0.9;
    ball.gazeY = ball.gazeY * 0.9 + 0.05;
  }
}
