// -----------------------------------------------------------------------------
// World — the physics container and step orchestrator.
// -----------------------------------------------------------------------------
// Owns the particle, constraint, and static-geometry arrays. On each step:
//
//   1. Apply external forces (e.g. balloon lift added by game code between
//      steps) and integrate every particle (Verlet).
//   2. Run N relaxation passes over constraints. Each pass also resolves
//      static-geometry collisions AFTER the constraint correction so a
//      structure under gravity settles cleanly onto the ground rather than
//      oscillating between the floor and a stretched spring.
//   3. Prune broken constraints (max-stretch) at end of step.
//
// Constants live on the World instance (gravity, damping, iterations) so the
// sandbox and docs can tune them at runtime without reaching into module
// internals.
// -----------------------------------------------------------------------------

import { verletStep } from './integrator.js';
import { solveConstraint } from './constraint.js';
import { resolveSegment } from './collision.js';

export class World {
  constructor(opts = {}) {
    this.particles = [];
    this.constraints = [];
    /** @type {Array<{a:{x:number,y:number},b:{x:number,y:number}}>} */
    this.segments = [];          // static geometry
    this.bounds = opts.bounds || { w: 1280, h: 720 };

    this.gravity = opts.gravity ?? { x: 0, y: 900 };
    this.damping = opts.damping ?? 0.01;
    this.friction = opts.friction ?? 0.18;
    this.iterations = opts.iterations ?? 8;
    this.gravityEnabled = opts.gravityEnabled ?? true;
  }

  addParticle(p) { this.particles.push(p); return p; }
  addConstraint(c) { this.constraints.push(c); return c; }
  addSegment(a, b) { const s = { a, b }; this.segments.push(s); return s; }

  removeParticle(p) {
    const i = this.particles.indexOf(p);
    if (i >= 0) this.particles.splice(i, 1);
    // Drop any constraints that referenced it so solveConstraint never
    // dereferences a stale particle.
    this.constraints = this.constraints.filter((c) => c.a !== p && c.b !== p);
  }

  removeConstraint(c) {
    const i = this.constraints.indexOf(c);
    if (i >= 0) this.constraints.splice(i, 1);
  }

  /**
   * Advance the simulation by a fixed `dt` (seconds).
   * Callers (main loop) typically fix `dt = 1/60` for stable physics.
   */
  step(dt) {
    const gx = this.gravityEnabled ? this.gravity.x : 0;
    const gy = this.gravityEnabled ? this.gravity.y : 0;

    // --- 1. integrate ---
    for (let i = 0; i < this.particles.length; i++) {
      verletStep(this.particles[i], dt, gx, gy, this.damping);
    }

    // --- 2. relax constraints + resolve collisions, N passes ---
    const iters = this.iterations;
    for (let k = 0; k < iters; k++) {
      const cs = this.constraints;
      for (let i = 0; i < cs.length; i++) solveConstraint(cs[i]);

      // After each relaxation pass, re-apply collisions so particles that the
      // constraint pushed through the floor get pushed back out.
      const ps = this.particles;
      const segs = this.segments;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        for (let j = 0; j < segs.length; j++) {
          resolveSegment(p, segs[j], this.friction);
        }
        // Also clamp to the world's axis-aligned bounds. This is more of a
        // safety net than a feature, but it prevents runaway balloons from
        // flying off into undefined territory.
        if (p.x < p.radius) { p.x = p.radius; p.oldX = p.x; }
        else if (p.x > this.bounds.w - p.radius) { p.x = this.bounds.w - p.radius; p.oldX = p.x; }
        if (p.y > this.bounds.h - p.radius) { p.y = this.bounds.h - p.radius; p.oldY = p.y; }
      }
    }

    // --- 3. prune broken constraints ---
    // Done once per step (not per iteration) so a constraint that went
    // transiently over-stretched during one relaxation pass still has a
    // chance to relax back within the same step.
    if (this.constraints.some((c) => c.broken)) {
      this.constraints = this.constraints.filter((c) => !c.broken);
    }
  }
}
