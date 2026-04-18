// -----------------------------------------------------------------------------
// Verlet integration step.
// -----------------------------------------------------------------------------
// For each particle, the update rule is:
//
//   temp   = (x, y)
//   (x, y) += (x - oldX, y - oldY) * (1 - damping) + accel * dt * dt
//   (old)  = temp
//
// Where `accel = force * invMass + gravity`. No explicit velocity field.
// `damping` is a fraction of implicit velocity to discard each step (0 = no
// damping, 1 = immediate stop). A value of ~0.01 produces a nicely settled
// but still springy feel at 60Hz.
//
// This function is intentionally a pure helper on a single particle so the
// docs can import it standalone for the "particle & Verlet" demo.
// -----------------------------------------------------------------------------

/**
 * Advance a single particle by one Verlet step.
 *
 * @param {import('./particle.js').Particle} p
 * @param {number} dt                 Fixed timestep (seconds).
 * @param {number} gx                 Gravity x (world-level).
 * @param {number} gy                 Gravity y.
 * @param {number} damping            Implicit velocity damping in [0, 1].
 */
export function verletStep(p, dt, gx, gy, damping) {
  if (p.invMass === 0) {
    // Pinned: clear accumulator and bail. Keeping oldX/oldY in sync with x/y
    // guarantees zero implicit velocity next frame.
    p.fx = 0; p.fy = 0;
    p.oldX = p.x; p.oldY = p.y;
    return;
  }

  // acceleration = force / mass + gravity
  const ax = p.fx * p.invMass + gx;
  const ay = p.fy * p.invMass + gy;

  // implicit velocity * (1 - damping)
  const vx = (p.x - p.oldX) * (1 - damping);
  const vy = (p.y - p.oldY) * (1 - damping);

  // record current as "old" BEFORE mutating x/y
  p.oldX = p.x;
  p.oldY = p.y;

  // integrate
  p.x += vx + ax * dt * dt;
  p.y += vy + ay * dt * dt;

  // forces are per-step; the next step will re-accumulate
  p.fx = 0;
  p.fy = 0;
}
