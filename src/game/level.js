// -----------------------------------------------------------------------------
// Level loader + validator.
// -----------------------------------------------------------------------------
// A level is a static JSON file in `public/levels/`. It describes:
//   • world bounds and gravity
//   • static geometry (line segments)
//   • initial goo balls (type, position, attached/pinned flags)
//   • initial strands between those balls (by index)
//   • a goal pipe with required delivery count
//
// The loader instantiates physics + game objects into a fresh `World`,
// validates indices and ball types, and returns a populated game scene.
// -----------------------------------------------------------------------------

import { World } from '../physics/world.js';
import { makeGooBall } from './gooball.js';
import { makeConstraint } from '../physics/constraint.js';
import { getType } from './gootypes.js';

/** Validate a level spec; throws on malformed input with a readable message. */
export function validateLevel(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('level: missing spec');
  for (const key of ['id', 'name', 'gravity', 'bounds', 'balls', 'goal']) {
    if (!(key in spec)) throw new Error(`level: missing required key "${key}"`);
  }
  if (!Array.isArray(spec.balls)) throw new Error('level: balls must be array');
  for (let i = 0; i < spec.balls.length; i++) {
    const b = spec.balls[i];
    if (!b || typeof b.type !== 'string') throw new Error(`level: balls[${i}].type missing`);
    try { getType(b.type); } catch (e) { throw new Error(`level: balls[${i}].${e.message}`); }
    if (typeof b.x !== 'number' || typeof b.y !== 'number') {
      throw new Error(`level: balls[${i}] needs numeric x/y`);
    }
  }
  const strands = spec.initialStrands || [];
  for (let i = 0; i < strands.length; i++) {
    const [a, b] = strands[i];
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error(`level: initialStrands[${i}] must be [intA, intB]`);
    }
    if (a < 0 || a >= spec.balls.length || b < 0 || b >= spec.balls.length) {
      throw new Error(`level: initialStrands[${i}] index out of range`);
    }
    if (a === b) throw new Error(`level: initialStrands[${i}] self-loop`);
  }
  if (!spec.goal || typeof spec.goal.x !== 'number') {
    throw new Error('level: goal.{x,y,radius,required} required');
  }
  return true;
}

/**
 * Build a live scene from a level spec.
 * @param {Object} spec
 * @returns {{
 *   world: World,
 *   balls: Array,
 *   goal: { x:number, y:number, radius:number, required:number, count:number },
 *   name: string, id: string,
 *   freeWalkerCount: number,
 * }}
 */
export function buildLevel(spec) {
  validateLevel(spec);

  const world = new World({
    bounds: spec.bounds,
    gravity: { x: spec.gravity[0], y: spec.gravity[1] },
    iterations: spec.iterations ?? 8,
  });

  for (const s of spec.static || []) {
    if (s.type !== 'segment') throw new Error(`level: only segment static supported, got "${s.type}"`);
    world.addSegment({ x: s.a[0], y: s.a[1] }, { x: s.b[0], y: s.b[1] });
  }

  const balls = spec.balls.map((b) => {
    const ball = makeGooBall(b.type, b.x, b.y, {
      attached: b.attached,
      pinned: b.pinned,
    });
    world.addParticle(ball.particle);
    return ball;
  });

  for (const [ai, bi] of spec.initialStrands || []) {
    const A = balls[ai];
    const B = balls[bi];
    const typeA = getType(A.type);
    const typeB = getType(B.type);
    const c = makeConstraint(A.particle, B.particle, {
      stiffness: Math.min(typeA.strandStiffness, typeB.strandStiffness),
      maxStretch: Math.min(typeA.strandMaxStretch, typeB.strandMaxStretch),
      userData: { kind: 'strand', a: A, b: B },
    });
    world.addConstraint(c);
    A.strands.push(c);
    B.strands.push(c);
  }

  const goal = {
    x: spec.goal.x,
    y: spec.goal.y,
    radius: spec.goal.radius,
    required: spec.goal.required ?? 1,
    count: 0,
  };

  const freeWalkerCount = balls.filter((b) => !b.attached && !b.pinned).length;

  return { world, balls, goal, name: spec.name, id: spec.id, freeWalkerCount };
}

/**
 * Fetch a level JSON relative to the current document. Works for:
 *   • `npm run dev`          — Vite serves `public/levels/*.json` at `/levels/*.json`
 *   • `npm run preview`      — static server, same layout
 *   • Opening `dist/index.html` from a local static server
 * Does NOT work over `file://` because browsers block `fetch()` for local
 * files. That's why README notes the game requires a server in dev.
 */
export async function fetchLevel(name) {
  const res = await fetch(`./levels/${name}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`level: fetch failed for ${name} (${res.status})`);
  return res.json();
}
