// -----------------------------------------------------------------------------
// Particle — the fundamental physics atom.
// -----------------------------------------------------------------------------
// A Verlet particle doesn't store velocity explicitly. Instead it stores the
// current position (x, y) and the previous step's position (oldX, oldY).
// Velocity is implied by `(x - oldX, y - oldY)` per step — which means every
// time a constraint solver nudges `(x, y)` directly, velocity updates for free
// on the NEXT step. This is the single biggest reason Verlet is the right
// integrator for cloth, rope, and soft-body games: constraint projection is
// trivial and stable.
//
// `invMass` (1 / mass) makes pinned particles a single-field special case:
// an anchor just sets `invMass = 0` and the constraint solver naturally won't
// move it. This is Jakobsen's "Advanced Character Physics" trick.
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} Particle
 * @property {number} x          Current x position (game-space).
 * @property {number} y          Current y position.
 * @property {number} oldX       Previous step's x — encodes velocity.
 * @property {number} oldY       Previous step's y.
 * @property {number} fx         Accumulated force x for the current step.
 * @property {number} fy         Accumulated force y for the current step.
 * @property {number} invMass    1/mass. 0 = immovable (pinned / fixed).
 * @property {number} radius     Collision radius (and visual goo ball size).
 * @property {any}    userData   Owner-assigned tag (goo ball ref, etc.).
 */

/**
 * Create a new particle at (x, y) with zero velocity.
 *
 * @param {number} x
 * @param {number} y
 * @param {Object} [opts]
 * @param {number} [opts.mass=1]     Mass. Ignored if `pinned` is true.
 * @param {number} [opts.radius=10]  Collision + render radius.
 * @param {boolean} [opts.pinned=false]  If true, invMass=0 (immovable).
 * @param {any}    [opts.userData]
 */
export function makeParticle(x, y, opts = {}) {
  const { mass = 1, radius = 10, pinned = false, userData = null } = opts;
  return {
    x, y,
    oldX: x, oldY: y, // starting at rest
    fx: 0, fy: 0,
    invMass: pinned ? 0 : 1 / mass,
    radius,
    userData,
  };
}

/** Apply an impulse-like force to be consumed on the next integrate step. */
export function applyForce(p, fx, fy) {
  p.fx += fx;
  p.fy += fy;
}

/** Pin a particle at its current (or a new) position. */
export function pin(p, x = p.x, y = p.y) {
  p.invMass = 0;
  p.x = x; p.y = y;
  p.oldX = x; p.oldY = y;
}

/** Unpin a particle, restoring normal mass. Default mass=1 if no prior value. */
export function unpin(p, mass = 1) {
  p.invMass = 1 / mass;
}

/**
 * Nudge a particle to a new position WITHOUT inducing velocity.
 * Useful when the player drags a ball: we want it to follow the cursor, not
 * accumulate momentum from the teleport.
 */
export function warpTo(p, x, y) {
  p.x = x; p.y = y;
  p.oldX = x; p.oldY = y;
}
