// Demo 04 — cloth grid: structural (cardinal) + shear (diagonal) constraints.
import { mountDemo, clearDemo } from './harness.js';
import { World } from '../../src/physics/world.js';
import { makeParticle, pin, warpTo } from '../../src/physics/particle.js';
import { makeConstraint } from '../../src/physics/constraint.js';

mountDemo('.demo', ({ ctx, bounds, controls, setOutput, pointer, reset }) => {
  const world = new World({ bounds, gravity: { x: 0, y: 600 }, iterations: 4, friction: 0 });

  const cols = 14, rows = 10;
  const sp = Math.min((bounds.w - 60) / (cols - 1), (bounds.h - 60) / (rows - 1));
  const offX = (bounds.w - sp * (cols - 1)) / 2;
  const offY = 30;
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const p = makeParticle(offX + x * sp, offY + y * sp, { radius: 2 });
      if (y === 0 && (x === 0 || x === cols - 1 || x % 3 === 0)) pin(p);
      world.addParticle(p); row.push(p);
    }
    grid.push(row);
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (x + 1 < cols) world.addConstraint(makeConstraint(grid[y][x], grid[y][x + 1], { stiffness: 1 }));
      if (y + 1 < rows) world.addConstraint(makeConstraint(grid[y][x], grid[y + 1][x], { stiffness: 1 }));
      if (controls.shear.value && x + 1 < cols && y + 1 < rows) {
        world.addConstraint(makeConstraint(grid[y][x], grid[y + 1][x + 1], { stiffness: 0.5 }));
        world.addConstraint(makeConstraint(grid[y + 1][x], grid[y][x + 1], { stiffness: 0.5 }));
      }
    }
  }

  let dragging = null;
  pointer.on('down', ({ x, y }) => {
    for (const row of grid) for (const p of row) {
      if (Math.hypot(p.x - x, p.y - y) < 14) { dragging = p; return; }
    }
  });
  pointer.on('move', ({ x, y }) => { if (dragging) warpTo(dragging, x, y); });
  pointer.on('up', () => { dragging = null; });

  return (dt) => {
    if (controls.reset.pressed) { reset(); return; }
    world.step(dt);

    clearDemo(ctx, bounds);
    ctx.strokeStyle = 'rgba(96,165,250,0.75)';
    ctx.lineWidth = 1;
    for (const c of world.constraints) {
      ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); ctx.lineTo(c.b.x, c.b.y); ctx.stroke();
    }
    for (const row of grid) for (const p of row) {
      if (p.invMass === 0) {
        ctx.fillStyle = '#f87171';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    setOutput('links', world.constraints.length);
  };
});
