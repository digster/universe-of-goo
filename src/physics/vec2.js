// -----------------------------------------------------------------------------
// Tiny 2D vector helpers — pure functions over {x, y} plain objects.
// -----------------------------------------------------------------------------
// We intentionally avoid a Vec2 class: particles are hot-path data and the
// JIT inlines field accesses on plain objects reliably. Every helper here
// returns a fresh object when it produces a new vector, so call sites can
// reason about aliasing without surprises.
// -----------------------------------------------------------------------------

export const v = (x = 0, y = 0) => ({ x, y });

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;

export const len = (a) => Math.hypot(a.x, a.y);
export const len2 = (a) => a.x * a.x + a.y * a.y;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const normalize = (a) => {
  const l = Math.hypot(a.x, a.y);
  if (l === 0) return { x: 0, y: 0 };
  return { x: a.x / l, y: a.y / l };
};

// Closest point on a line segment [a, b] to point p. Returns the point plus
// the parametric `t` in [0, 1] along the segment — callers use `t` to clamp
// collision handling to the segment's endpoints. Standard projection math.
export const closestPointOnSegment = (p, a, b) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return { x: a.x, y: a.y, t: 0 };
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  let t = (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return { x: a.x + abx * t, y: a.y + aby * t, t };
};

// True if segments (p1,p2) and (p3,p4) intersect. Used by strandRules for
// line-of-sight checks so strands don't form through walls. Standard 2D
// segment-segment intersection via cross products.
export const segmentsIntersect = (p1, p2, p3, p4) => {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) return false; // parallel (including collinear — treat as no-intersect)
  const sx = p3.x - p1.x, sy = p3.y - p1.y;
  const s = (sx * d2y - sy * d2x) / denom;
  const t = (sx * d1y - sy * d1x) / denom;
  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
};
