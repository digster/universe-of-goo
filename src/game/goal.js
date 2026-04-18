// -----------------------------------------------------------------------------
// Goal pipe — the win condition.
// -----------------------------------------------------------------------------
// Any UNATTACHED goo ball within `radius` of the goal's center is "consumed":
// the ball's particle is removed from the world, its constraints drop, and
// the delivery counter ticks up. Once `count >= required`, the level is won.
//
// Attached balls are never consumed — in World of Goo they form the structure
// itself, and pulling them out would be disastrous. Players must *release*
// a ball (detach) before it can reach the pipe.
// -----------------------------------------------------------------------------

/**
 * @param {{x:number,y:number,radius:number,required:number,count:number}} goal
 * @param {Array} balls                   All goo balls in the scene.
 * @param {import('../physics/world.js').World} world
 * @returns {Array} balls that were consumed this tick.
 */
export function tickGoal(goal, balls, world) {
  const eaten = [];
  const r2 = goal.radius * goal.radius;
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.attached || b.pinned) continue;
    const dx = b.particle.x - goal.x;
    const dy = b.particle.y - goal.y;
    if (dx * dx + dy * dy > r2) continue;
    eaten.push(b);
    world.removeParticle(b.particle);
    balls.splice(i, 1);
    goal.count++;
  }
  return eaten;
}

export function isWon(goal) {
  return goal.count >= goal.required;
}
