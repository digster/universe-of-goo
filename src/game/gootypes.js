// -----------------------------------------------------------------------------
// Goo ball type registry.
// -----------------------------------------------------------------------------
// Each type is a pure config object the game layer consults when spawning a
// ball, forming strands, or applying per-frame forces. Keeping this in a
// single map (rather than a subclass hierarchy) means `4 minimal types` stays
// a ~20-line file and extending to more types is trivially PR-sized.
//
// Mechanics:
//   basic    — default mass; 2 max strands; walks when free (no force).
//   balloon  — constant upward pull; 1 max strand; distinctive color.
//   sticky   — high strand stiffness; 3 max strands; bigger maxStretch.
//   fixed    — pinned (invMass=0); never moves; used as level anchors.
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} GooTypeDef
 * @property {string}  name
 * @property {string}  color
 * @property {number}  mass
 * @property {number}  radius
 * @property {number}  maxStrands
 * @property {number}  strandStiffness   In [0, 1].
 * @property {number}  strandMaxStretch  Ratio; Infinity for unbreakable.
 * @property {number}  liftStrength      Per-frame upward force while attached (0 = none).
 * @property {boolean} walker            Walks along strands when not attached.
 * @property {boolean} pinned            If true, attach with invMass = 0.
 */

/** @type {Record<string, GooTypeDef>} */
export const GOO_TYPES = {
  basic: {
    name: 'basic',
    color: '#60a5fa',
    mass: 1,
    radius: 14,
    maxStrands: 2,
    strandStiffness: 0.9,
    strandMaxStretch: 2.2,
    liftStrength: 0,
    walker: true,
    pinned: false,
  },
  balloon: {
    name: 'balloon',
    color: '#f472b6',
    mass: 0.6,
    radius: 15,
    maxStrands: 1,
    strandStiffness: 0.8,
    strandMaxStretch: 2.4,
    liftStrength: 420,
    walker: false,
    pinned: false,
  },
  sticky: {
    name: 'sticky',
    color: '#34d399',
    mass: 1.3,
    radius: 14,
    maxStrands: 3,
    strandStiffness: 1.0,
    strandMaxStretch: 2.8,
    liftStrength: 0,
    walker: true,
    pinned: false,
  },
  fixed: {
    name: 'fixed',
    color: '#fbbf24',
    mass: 1,
    radius: 14,
    maxStrands: 4,
    strandStiffness: 1.0,
    strandMaxStretch: Infinity,
    liftStrength: 0,
    walker: false,
    pinned: true,
  },
};

export const GOO_TYPE_NAMES = Object.keys(GOO_TYPES);

export function getType(name) {
  const t = GOO_TYPES[name];
  if (!t) throw new Error(`Unknown goo type: ${name}`);
  return t;
}
