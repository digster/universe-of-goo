// -----------------------------------------------------------------------------
// Game bootstrap.
// -----------------------------------------------------------------------------
// Responsibilities:
//   1. Load `level-01` via `fetchLevel()` → `buildLevel()`.
//   2. Wire up the Renderer, Pointer input, HUD DOM elements.
//   3. Run a fixed-step game loop (requestAnimationFrame with an accumulator
//      so physics is deterministic regardless of render rate).
//   4. On pointer drag: temporarily pin a free ball to the cursor. On
//      release: try to attach via `strandRules` — if successful, the ball
//      becomes part of the structure.
//   5. Each frame: tick goal, check win/lose transitions, re-render.
// -----------------------------------------------------------------------------

import { fetchLevel, buildLevel } from './game/level.js';
import { Renderer } from './render/renderer.js';
import { Pointer } from './input/pointer.js';
import { applyPreStepBehaviour } from './game/gooball.js';
import { attachFreeBall, pickAttachmentCandidates } from './game/strandRules.js';
import { tickGoal, isWon } from './game/goal.js';
import { createGameState, setState } from './game/gameState.js';
import { warpTo, pin, unpin } from './physics/particle.js';
import { getType } from './game/gootypes.js';

const LEVELS = ['01-first-tower', '02-chasm', '03-balloon-lift'];
const DT = 1 / 60;

boot();

async function boot() {
  const canvas = document.getElementById('stage');
  const renderer = new Renderer(canvas);
  const pointer = new Pointer(canvas);
  const gs = createGameState();

  const hud = {
    level: document.getElementById('hud-level'),
    count: document.getElementById('hud-count'),
    fps: document.getElementById('hud-fps'),
  };
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayBody = document.getElementById('overlay-body');
  const overlayNext = document.getElementById('overlay-next');

  let scene = null;
  let levelIndex = 0;
  let cursor = null;

  // --- drag state ----------------------------------------------------------
  // When the player picks a free walker, we remember the original mass so we
  // can restore it on release. While held, invMass is set to 0 and the
  // particle is warped to follow the cursor each pointermove.
  let dragging = null; // { ball, originalMass }

  // --- level load / reset ---------------------------------------------------
  async function loadLevel(idx) {
    setState(gs, 'loading');
    const name = LEVELS[idx];
    const spec = await fetchLevel(name);
    scene = buildLevel(spec);
    hud.level.textContent = scene.name;
    hud.count.textContent = `${scene.goal.count} / ${scene.goal.required}`;
    overlay.hidden = true;
    setState(gs, 'playing');
  }

  overlayNext.addEventListener('click', async () => {
    levelIndex = (levelIndex + 1) % LEVELS.length;
    await loadLevel(levelIndex);
  });

  window.addEventListener('keydown', async (e) => {
    if (e.key === 'r' || e.key === 'R') await loadLevel(levelIndex);
    if (e.key === 'd' || e.key === 'D') renderer.toggleDebug();
  });

  // --- input wiring --------------------------------------------------------
  pointer.on('pickStart', ({ x, y }) => {
    if (!scene || gs.state !== 'playing') return;
    cursor = { x, y };
    // Prefer unattached free walkers, but allow repositioning an attached
    // ball only if it's NOT pinned (quality-of-life for stuck structures).
    const hit = pickNearestBall(scene.balls, x, y, 40);
    if (!hit) return;
    if (hit.pinned) return;
    dragging = { ball: hit };
    const type = getType(hit.type);
    // If it was attached, temporarily detach so the player can re-position.
    // Keep strand references — release will re-evaluate attachment.
    pin(hit.particle); // invMass=0 during drag
    warpTo(hit.particle, x, y);
  });

  pointer.on('drag', ({ x, y }) => {
    cursor = { x, y };
    if (!dragging) return;
    warpTo(dragging.ball.particle, x, y);
  });

  pointer.on('pickEnd', ({ x, y }) => {
    if (!dragging || !scene) return;
    const ball = dragging.ball;
    const type = getType(ball.type);
    unpin(ball.particle, type.mass);
    warpTo(ball.particle, x, y);
    dragging = null;

    // If the ball already had strands, keep them (reposition). Otherwise try
    // to attach by proximity rules.
    if (ball.strands.length === 0) {
      const attached = attachFreeBall(ball, scene.world, scene.balls);
      ball.attached = attached;
    } else {
      ball.attached = true;
    }
  });

  // --- main loop -----------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  requestAnimationFrame(function frame(now) {
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (scene && gs.state === 'playing') acc += delta;

    // Fixed-step simulation — run as many physics steps as needed to catch
    // up to real time, capped so a tab-hidden pause doesn't spiral-of-death.
    let steps = 0;
    while (acc >= DT && steps < 5) {
      stepOnce();
      acc -= DT;
      steps++;
    }

    if (scene) {
      // Build drag indicators. The first entry is the cursor-to-ball rubber
      // band (existing behaviour). If the dragged ball is a free walker, we
      // also preview the strands that would form on release — honest because
      // we call the same `pickAttachmentCandidates` that `attachFreeBall` uses
      // internally, with matching `radius: 160` and `maxCount = type.maxStrands`.
      // CRITICAL: if `attachFreeBall`'s params in strandRules.js ever change,
      // update the preview params here too. tests/preview.test.js guards this.
      let drags = null;
      if (dragging) {
        drags = [{ from: cursor, to: dragging.ball.particle, attachable: true }];
        if (dragging.ball.strands.length === 0) {
          const type = getType(dragging.ball.type);
          const candidates = pickAttachmentCandidates(
            dragging.ball.particle,
            scene.balls,
            scene.world.segments,
            { maxCount: type.maxStrands, radius: 160 }
          );
          for (const cand of candidates) {
            drags.push({
              from: dragging.ball.particle,
              to: cand.particle,
              attachable: true,
              preview: true,
            });
          }
        }
      }
      renderer.draw(scene.world, { goal: scene.goal, drags });
      hud.fps.textContent = `${renderer.fps.toFixed(0)} fps`;
      hud.count.textContent = `${scene.goal.count} / ${scene.goal.required}`;
    }
    requestAnimationFrame(frame);
  });

  function stepOnce() {
    if (!scene) return;

    // Per-ball pre-step behaviour (balloon lift, gaze).
    for (const b of scene.balls) applyPreStepBehaviour(b, scene.world, cursor);

    scene.world.step(DT);

    // Goal + win/lose.
    tickGoal(scene.goal, scene.balls, scene.world);

    // Prune strand references on balls whose constraint was broken and
    // removed upstream. (world.step prunes `world.constraints`; we need to
    // mirror that on the ball side.)
    const live = new Set(scene.world.constraints);
    for (const b of scene.balls) {
      if (b.strands.some((c) => !live.has(c))) {
        b.strands = b.strands.filter((c) => live.has(c));
        if (b.strands.length === 0 && !b.pinned) b.attached = false;
      }
    }

    if (isWon(scene.goal)) {
      setState(gs, 'won');
      overlayTitle.textContent = 'Level complete';
      overlayBody.textContent = `You delivered ${scene.goal.required} goo balls.`;
      overlayNext.textContent = levelIndex + 1 < LEVELS.length ? 'Next level' : 'Replay';
      overlay.hidden = false;
    } else if (
      scene.balls.filter((b) => !b.attached && !b.pinned).length === 0 &&
      scene.goal.count < scene.goal.required
    ) {
      setState(gs, 'lost');
      overlayTitle.textContent = 'No walkers left';
      overlayBody.textContent = 'Press R to restart and try again.';
      overlayNext.textContent = 'Restart';
      overlay.hidden = false;
      // Clicking "Restart" on the overlay should reload the same level.
      overlayNext.onclick = () => loadLevel(levelIndex);
    }
  }

  await loadLevel(0);
}

// --- helpers ---------------------------------------------------------------

function pickNearestBall(balls, x, y, maxDist) {
  let best = null;
  let bestD2 = maxDist * maxDist;
  for (const b of balls) {
    const dx = b.particle.x - x;
    const dy = b.particle.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; best = b; }
  }
  return best;
}
