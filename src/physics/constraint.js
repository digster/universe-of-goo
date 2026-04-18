// -----------------------------------------------------------------------------
// Distance constraints ("sticks" / "soft springs") solved by relaxation.
// -----------------------------------------------------------------------------
// Given two particles a and b that should stay at `restLength`, we compute
// the delta and push each particle halfway toward satisfying the constraint,
// weighted by their inverse mass so a pinned particle (invMass = 0) takes no
// correction. `stiffness` in [0, 1] scales the correction per iteration:
//
//   1.0  → rigid-ish stick (N iterations → near-perfect length)
//   0.2  → soft spring (converges slowly, perceived springiness)
//
// Calling `solveConstraint` N times per step (see world.js) yields the
// classic Jakobsen relaxation loop: cheap, stable, and easy to reason about.
// If a constraint is stretched beyond `maxStretch * restLength`, we mark it
// broken and the world removes it at end-of-step.
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} Constraint
 * @property {import('./particle.js').Particle} a
 * @property {import('./particle.js').Particle} b
 * @property {number} restLength   Target distance between a and b.
 * @property {number} stiffness    In [0, 1]. Fraction of correction applied per iter.
 * @property {number} maxStretch   Ratio of current/rest length beyond which the constraint breaks. Infinity for unbreakable.
 * @property {boolean} broken      Marked true when `maxStretch` is exceeded; world prunes on next cleanup pass.
 * @property {any} userData
 */

/**
 * @param {import('./particle.js').Particle} a
 * @param {import('./particle.js').Particle} b
 * @param {Object} [opts]
 * @param {number} [opts.restLength]        Defaults to the current a↔b distance.
 * @param {number} [opts.stiffness=1]       In [0, 1].
 * @param {number} [opts.maxStretch=Infinity]
 * @param {any}    [opts.userData]
 */
export function makeConstraint(a, b, opts = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const {
    restLength = Math.hypot(dx, dy),
    stiffness = 1,
    maxStretch = Infinity,
    userData = null,
  } = opts;
  return { a, b, restLength, stiffness, maxStretch, broken: false, userData };
}

/**
 * Apply one relaxation pass to a single constraint. Idempotent on inputs;
 * mutates particle positions in place.
 *
 * @param {Constraint} c
 */
export function solveConstraint(c) {
  if (c.broken) return;
  const a = c.a;
  const b = c.b;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2 === 0) {
    // Particles coincide — no direction to push. Skip this iteration; a later
    // integrate step will usually jitter them apart. (In sandbox the user
    // gets zero-length strands rejected upstream in strandRules.)
    return;
  }
  const dist = Math.sqrt(d2);

  // Break check — once broken, every subsequent pass is a no-op.
  if (c.maxStretch !== Infinity && dist > c.restLength * c.maxStretch) {
    c.broken = true;
    return;
  }

  const diff = (dist - c.restLength) / dist;          // signed: +stretched, -compressed
  const correction = 0.5 * c.stiffness * diff;        // each particle gets half, modulated by stiffness
  const cx = dx * correction;
  const cy = dy * correction;

  // Split the correction by inverse mass so heavier (or pinned) particles
  // move less. If both are pinned (sum = 0) we skip — can happen in levels.
  const inv = a.invMass + b.invMass;
  if (inv === 0) return;
  const wA = a.invMass / inv;
  const wB = b.invMass / inv;

  a.x += cx * wA * 2;
  a.y += cy * wA * 2;
  b.x -= cx * wB * 2;
  b.y -= cy * wB * 2;
}

/** Current stretched length / rest length. Used for stress visualisation. */
export function stressRatio(c) {
  const d = Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y);
  return d / c.restLength;
}
