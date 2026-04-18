// -----------------------------------------------------------------------------
// SandboxController — the sandbox-mode game brain.
// -----------------------------------------------------------------------------
// Owns a World and a list of GooBalls (no goal, no win condition). Exposes
// operations that the HUD and pointer handlers call:
//
//   spawn(type, x, y) → add a ball at (x,y); fixed type starts attached,
//                       all other types start as free walkers
//   pick(x, y)        → nearest ball within grab radius, or null
//   pickConstraint()  → nearest strand to (x, y), or null
//   deleteAt(x, y)    → remove ball OR strand under the cursor
//   togglePinAt(x, y) → flip ball.pinned
//   linkBetween(a, b) → create a strand programmatically (used by the seed
//                       scene and snapshot restore — NOT a user gesture
//                       any more; sandbox mirrors game-mode auto-attach)
//   clear()           → remove all balls and strands
//   save() / restore()→ localStorage snapshot
//   tick(cursor, dt)  → per-frame pre-step behaviour + physics step
//
// State is kept flat: the controller does not subclass anything, so the
// sandbox boot file reads top-to-bottom.
// -----------------------------------------------------------------------------

import { World } from '../physics/world.js';
import { makeGooBall, applyPreStepBehaviour } from './gooball.js';
import { makeConstraint } from '../physics/constraint.js';
import { pin, unpin } from '../physics/particle.js';
import { getType } from './gootypes.js';
import { closestPointOnSegment } from '../physics/vec2.js';

const STORAGE_KEY = 'universe-of-goo.sandbox.v1';
const GRAB_RADIUS = 24;

export class SandboxController {
  constructor() {
    this.world = new World({
      bounds: { w: 1280, h: 720 },
      gravity: { x: 0, y: 900 },
      iterations: 8,
    });
    // A ground segment to land on. Without it balls tunnel out the bottom.
    this.world.addSegment({ x: 0, y: 700 }, { x: 1280, y: 700 });

    this.balls = [];
    this.selectedType = 'basic';
    this.paused = false;
    this.snapshot = null;
  }

  // --- type + gravity + iteration controls -------------------------------
  setSelectedType(name) { getType(name); this.selectedType = name; }
  toggleGravity() { this.world.gravityEnabled = !this.world.gravityEnabled; }
  togglePaused() { this.paused = !this.paused; }
  changeIterations(delta) {
    this.world.iterations = Math.max(1, Math.min(32, this.world.iterations + delta));
  }

  // --- entity operations -------------------------------------------------
  // Spawn semantics mirror the game: `fixed` balls are anchors (attached =
  // true, pinned), so they're immediately valid attachment candidates.
  // All other types spawn as free walkers (attached = false) — they fall
  // and only attach when the player drags + releases them near other balls,
  // exactly like dragging a free walker in game mode. We rely on the
  // `attached: opts.attached ?? pinned` default in makeGooBall().
  spawn(typeName, x, y) {
    const ball = makeGooBall(typeName, x, y);
    this.balls.push(ball);
    this.world.addParticle(ball.particle);
    return ball;
  }

  /** Find the ball whose particle is closest to (x, y) within GRAB_RADIUS. */
  pick(x, y) {
    let best = null, bestD2 = GRAB_RADIUS * GRAB_RADIUS;
    for (const b of this.balls) {
      const dx = b.particle.x - x, dy = b.particle.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = b; }
    }
    return best;
  }

  /** Find the constraint whose line passes nearest (x, y), within pickR px. */
  pickConstraint(x, y, pickR = 8) {
    let best = null, bestD2 = pickR * pickR;
    for (const c of this.world.constraints) {
      const cp = closestPointOnSegment({ x, y }, c.a, c.b);
      const dx = x - cp.x, dy = y - cp.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = c; }
    }
    return best;
  }

  // Programmatic strand creation between two balls. Used by the seed scene
  // and by load() to restore snapshots — NOT exposed as a user gesture
  // (sandbox no longer has shift-drag manual linking). Once linked, both
  // balls are considered "attached" so they're valid candidates for further
  // proximity-based attachment via strandRules.
  linkBetween(a, b) {
    if (!a || !b || a === b) return null;
    const typeA = getType(a.type);
    const typeB = getType(b.type);
    const c = makeConstraint(a.particle, b.particle, {
      stiffness: Math.min(typeA.strandStiffness, typeB.strandStiffness),
      maxStretch: Math.min(typeA.strandMaxStretch, typeB.strandMaxStretch),
      userData: { kind: 'strand', a, b },
    });
    this.world.addConstraint(c);
    a.strands.push(c);
    b.strands.push(c);
    a.attached = true;
    b.attached = true;
    return c;
  }

  /** Delete a ball (+ all its strands) or a strand near (x, y). */
  deleteAt(x, y) {
    const ball = this.pick(x, y);
    if (ball) {
      this._removeBall(ball);
      return 'ball';
    }
    const c = this.pickConstraint(x, y);
    if (c) {
      this.world.removeConstraint(c);
      if (c.userData) {
        c.userData.a.strands = c.userData.a.strands.filter((x) => x !== c);
        c.userData.b.strands = c.userData.b.strands.filter((x) => x !== c);
      }
      return 'strand';
    }
    return null;
  }

  _removeBall(ball) {
    const i = this.balls.indexOf(ball);
    if (i >= 0) this.balls.splice(i, 1);
    this.world.removeParticle(ball.particle);
    // strands the ball participated in were already dropped by removeParticle;
    // mirror on peer balls.
    for (const peer of this.balls) {
      peer.strands = peer.strands.filter((c) => this.world.constraints.includes(c));
    }
  }

  togglePinAt(x, y) {
    const ball = this.pick(x, y);
    if (!ball) return null;
    if (ball.pinned) {
      const type = getType(ball.type);
      unpin(ball.particle, type.mass);
      ball.pinned = false;
    } else {
      pin(ball.particle);
      ball.pinned = true;
    }
    return ball;
  }

  clear() {
    this.balls = [];
    this.world.particles = [];
    this.world.constraints = [];
  }

  // --- serialization -----------------------------------------------------
  serialize() {
    // Encode balls by their array index. Constraints reference indices, not
    // object identity — so the snapshot survives a restore/clear cycle.
    const ballIndex = new Map(this.balls.map((b, i) => [b, i]));
    return {
      gravityEnabled: this.world.gravityEnabled,
      iterations: this.world.iterations,
      balls: this.balls.map((b) => ({
        type: b.type,
        x: b.particle.x,
        y: b.particle.y,
        pinned: b.pinned,
      })),
      strands: this.world.constraints
        .filter((c) => c.userData && ballIndex.has(c.userData.a) && ballIndex.has(c.userData.b))
        .map((c) => [ballIndex.get(c.userData.a), ballIndex.get(c.userData.b)]),
    };
  }

  load(snap) {
    if (!snap) return;
    this.clear();
    this.world.gravityEnabled = snap.gravityEnabled;
    this.world.iterations = snap.iterations ?? 8;
    for (const b of snap.balls) {
      const ball = this.spawn(b.type, b.x, b.y);
      if (b.pinned) { pin(ball.particle); ball.pinned = true; }
    }
    for (const [ai, bi] of snap.strands) {
      this.linkBetween(this.balls[ai], this.balls[bi]);
    }
  }

  save() {
    this.snapshot = this.serialize();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot)); } catch {}
  }

  restore() {
    if (!this.snapshot) {
      try { this.snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { this.snapshot = null; }
    }
    if (this.snapshot) this.load(this.snapshot);
  }

  // --- per-frame tick ----------------------------------------------------
  tick(cursor, dt) {
    if (this.paused) return;
    for (const b of this.balls) applyPreStepBehaviour(b, this.world, cursor);
    this.world.step(dt);

    // Prune dead strands from ball bookkeeping.
    const live = new Set(this.world.constraints);
    for (const b of this.balls) {
      if (b.strands.some((c) => !live.has(c))) {
        b.strands = b.strands.filter((c) => live.has(c));
      }
    }
  }
}
