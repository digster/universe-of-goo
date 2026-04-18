// -----------------------------------------------------------------------------
// Sandbox bootstrap.
// -----------------------------------------------------------------------------
// Wires the SandboxController to the canvas, pointer input, keyboard, and
// the toolbar buttons in sandbox.html.
//
// Gestures intentionally mirror the main game (see src/main.js) — the
// sandbox is "game mode without a goal and with unlimited spawn":
//
//   Left-drag empty space → on release, spawn a ball of selectedType.
//   Left-click a ball     → pin + follow cursor; on release auto-attach
//                           via the same strandRules the game uses.
//                           Already-attached balls just reposition.
//   Right-click           → delete ball or strand under cursor.
//   Middle-click          → toggle pinned on ball under cursor.
//
// While dragging a free walker (zero strands), dashed preview strands show
// the candidate attachments — same code path as game mode, guaranteeing
// the preview matches the actual on-release attachment.
//
// Keyboard: see sandbox.html's toolbar, each button has a data-key attribute
// mirrored into this handler.
// -----------------------------------------------------------------------------

import { Renderer } from './render/renderer.js';
import { Pointer } from './input/pointer.js';
import { SandboxController } from './game/sandboxController.js';
import { GOO_TYPE_NAMES, getType } from './game/gootypes.js';
import { attachFreeBall, pickAttachmentCandidates } from './game/strandRules.js';
import { pin, unpin, warpTo } from './physics/particle.js';

const DT = 1 / 60;
const DRAG_MIN = 4; // pixels — below this, pointerdown+up counts as a click

const canvas = document.getElementById('stage');
const renderer = new Renderer(canvas);
const pointer = new Pointer(canvas);
const ctrl = new SandboxController();

const hud = {
  count: document.getElementById('hud-count'),
  type: document.getElementById('hud-type'),
  gravity: document.getElementById('hud-gravity'),
  iters: document.getElementById('hud-iters'),
  fps: document.getElementById('hud-fps'),
};

let cursor = null;

// --- drag state -----------------------------------------------------------
// Two gestures based purely on what's under the cursor at pickStart:
//   'moveBall' — picked a ball; pin + follow cursor; on release auto-attach
//                if it had no strands, else just reposition (mirrors
//                game-mode pickStart/pickEnd at src/main.js).
//   'spawn'    — empty space; release spawns a ball at start position.
// Pinned balls (fixed type or middle-click pinned) are skipped on pickup
// to match game-mode behaviour — to move them, unpin first.
let drag = null; // { kind, ball?, startX, startY, x, y, moved }

pointer.on('pickStart', ({ x, y, button }) => {
  if (button !== 0) return;
  cursor = { x, y };
  const ball = ctrl.pick(x, y);
  if (ball && !ball.pinned) {
    drag = { kind: 'moveBall', ball, startX: x, startY: y, x, y, moved: false };
    // Game-mode-style pickup: pin (invMass=0) so the particle ignores
    // gravity/constraints while held, and warp it to the cursor.
    pin(ball.particle);
    warpTo(ball.particle, x, y);
  } else if (!ball) {
    drag = { kind: 'spawn', startX: x, startY: y, x, y, moved: false };
  }
});

pointer.on('drag', ({ x, y }) => {
  cursor = { x, y };
  if (!drag) return;
  drag.x = x; drag.y = y;
  if (Math.hypot(x - drag.startX, y - drag.startY) > DRAG_MIN) drag.moved = true;
  if (drag.kind === 'moveBall') warpTo(drag.ball.particle, x, y);
});

pointer.on('pickEnd', ({ x, y }) => {
  if (!drag) return;
  if (drag.kind === 'moveBall') {
    const ball = drag.ball;
    const type = getType(ball.type);
    unpin(ball.particle, type.mass);
    warpTo(ball.particle, x, y);
    // Free walker (no strands) → run the same attachment rules as game
    // mode. If the ball was already part of a structure (has strands), we
    // just keep it where the player dropped it.
    if (ball.strands.length === 0) {
      ball.attached = attachFreeBall(ball, ctrl.world, ctrl.balls);
    } else {
      ball.attached = true;
    }
  } else if (drag.kind === 'spawn') {
    // A click (or short drag) in empty space → spawn at the click position.
    ctrl.spawn(ctrl.selectedType, drag.startX, drag.startY);
  }
  drag = null;
});

pointer.on('rightClick', ({ x, y }) => ctrl.deleteAt(x, y));
pointer.on('middleClick', ({ x, y }) => ctrl.togglePinAt(x, y));

// --- toolbar + keyboard ---------------------------------------------------
const actions = {
  'spawn-basic':    () => ctrl.setSelectedType('basic'),
  'spawn-balloon':  () => ctrl.setSelectedType('balloon'),
  'spawn-sticky':   () => ctrl.setSelectedType('sticky'),
  'spawn-fixed':    () => ctrl.setSelectedType('fixed'),
  'toggle-gravity': () => ctrl.toggleGravity(),
  'toggle-pause':   () => ctrl.togglePaused(),
  'toggle-debug':   () => renderer.toggleDebug(),
  'save':           () => ctrl.save(),
  'reset':          () => ctrl.restore(),
  'clear':          () => ctrl.clear(),
  'iters-down':     () => ctrl.changeIterations(-1),
  'iters-up':       () => ctrl.changeIterations(+1),
};

const toolbar = document.getElementById('tools');
toolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  actions[btn.dataset.action]?.();
  updateToolbarActive();
});

function updateToolbarActive() {
  for (const btn of toolbar.querySelectorAll('button[data-action]')) {
    const a = btn.dataset.action;
    let active = false;
    if (a === 'spawn-basic'   && ctrl.selectedType === 'basic') active = true;
    if (a === 'spawn-balloon' && ctrl.selectedType === 'balloon') active = true;
    if (a === 'spawn-sticky'  && ctrl.selectedType === 'sticky') active = true;
    if (a === 'spawn-fixed'   && ctrl.selectedType === 'fixed') active = true;
    if (a === 'toggle-gravity' && ctrl.world.gravityEnabled) active = true;
    if (a === 'toggle-pause'   && ctrl.paused) active = true;
    if (a === 'toggle-debug'   && renderer.debug) active = true;
    btn.classList.toggle('active', active);
  }
}
updateToolbarActive();

const keyMap = {
  '1': 'spawn-basic', '2': 'spawn-balloon', '3': 'spawn-sticky', '4': 'spawn-fixed',
  'g': 'toggle-gravity', 'G': 'toggle-gravity',
  'p': 'toggle-pause',   'P': 'toggle-pause',
  'd': 'toggle-debug',   'D': 'toggle-debug',
  's': 'save',           'S': 'save',
  'r': 'reset',          'R': 'reset',
  'c': 'clear',          'C': 'clear',
  '-': 'iters-down', '_': 'iters-down',
  '+': 'iters-up',   '=': 'iters-up',
};

window.addEventListener('keydown', (e) => {
  // Ignore if the user is typing in an input (future-proof; sandbox has none today).
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const act = keyMap[e.key];
  if (!act) return;
  actions[act]?.();
  updateToolbarActive();
});

// --- seed a tiny starter scene so the sandbox opens to something visible --
(function seed() {
  const anchor = ctrl.spawn('fixed', 640, 400);
  const a = ctrl.spawn('basic', 600, 460);
  const b = ctrl.spawn('basic', 680, 460);
  const c = ctrl.spawn('basic', 640, 520);
  ctrl.linkBetween(anchor, a);
  ctrl.linkBetween(anchor, b);
  ctrl.linkBetween(a, b);
  ctrl.linkBetween(a, c);
  ctrl.linkBetween(b, c);
})();

// --- main loop ------------------------------------------------------------
let last = performance.now();
let acc = 0;
requestAnimationFrame(function frame(now) {
  const delta = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += delta;
  let steps = 0;
  while (acc >= DT && steps < 5) {
    ctrl.tick(cursor, DT);
    acc -= DT;
    steps++;
  }

  // Build drag indicators for the renderer.
  //   - moveBall:  rubber-band from cursor to held ball PLUS, if it's a
  //                free walker (zero strands), dashed preview strands to
  //                each attachment candidate. Same parameters as
  //                attachFreeBall (radius:160, maxCount:type.maxStrands)
  //                so the preview is honest — see tests/preview.test.js.
  //   - spawn:     a faint line from click-down to current cursor while
  //                the user drags before releasing to spawn.
  const drags = [];
  if (drag && drag.kind === 'moveBall') {
    drags.push({
      from: cursor,
      to: drag.ball.particle,
      attachable: true,
    });
    if (drag.ball.strands.length === 0) {
      const type = getType(drag.ball.type);
      const candidates = pickAttachmentCandidates(
        drag.ball.particle,
        ctrl.balls,
        ctrl.world.segments,
        { maxCount: type.maxStrands, radius: 160 }
      );
      for (const cand of candidates) {
        drags.push({
          from: drag.ball.particle,
          to: cand.particle,
          attachable: true,
          preview: true,
        });
      }
    }
  } else if (drag && drag.kind === 'spawn' && drag.moved) {
    drags.push({
      from: { x: drag.startX, y: drag.startY },
      to:   { x: drag.x, y: drag.y },
      attachable: true,
    });
  }

  renderer.draw(ctrl.world, {
    drags,
    selectedType: ctrl.selectedType,
    gravityEnabled: ctrl.world.gravityEnabled,
    iterations: ctrl.world.iterations,
  });

  hud.count.textContent = `${ctrl.balls.length} balls / ${ctrl.world.constraints.length} strands`;
  hud.type.textContent = `type: ${ctrl.selectedType}`;
  hud.gravity.textContent = `gravity: ${ctrl.world.gravityEnabled ? 'on' : 'off'}`;
  hud.iters.textContent = `iters: ${ctrl.world.iterations}`;
  hud.fps.textContent = `${renderer.fps.toFixed(0)} fps`;

  requestAnimationFrame(frame);
});

// Expose types once for future toolbar customisation without hard-coding.
export { GOO_TYPE_NAMES };
