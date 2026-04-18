// -----------------------------------------------------------------------------
// Sandbox bootstrap.
// -----------------------------------------------------------------------------
// Wires the SandboxController to the canvas, pointer input, keyboard, and
// the toolbar buttons in sandbox.html. Mouse gestures:
//
//   Left-drag empty space → on release, spawn a ball of selectedType.
//   Left-drag a ball       → pick + follow cursor; release leaves it there.
//   Shift-drag ball→ball  → on release create a manual strand between them.
//   Right-click           → delete ball or strand under cursor.
//   Middle-click          → toggle pinned on ball under cursor.
//
// Keyboard: see sandbox.html's toolbar, each button has a data-key attribute
// mirrored into this handler.
// -----------------------------------------------------------------------------

import { Renderer } from './render/renderer.js';
import { Pointer } from './input/pointer.js';
import { SandboxController } from './game/sandboxController.js';
import { GOO_TYPE_NAMES } from './game/gootypes.js';

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
// We distinguish three gestures based on what's under the cursor at pickStart
// and whether shift is held:
//   'moveBall'  — pick a ball, drag to reposition, release where it lies
//   'linkBall'  — shift-drag a ball to another ball, release links them
//   'spawn'     — drag empty space, release spawns a ball at end-point
let drag = null; // { kind, ball?, startX, startY, x, y, moved }

pointer.on('pickStart', ({ x, y, shift, button }) => {
  if (button !== 0) return;
  cursor = { x, y };
  const ball = ctrl.pick(x, y);
  if (ball) {
    if (shift) {
      drag = { kind: 'linkBall', ball, startX: x, startY: y, x, y, moved: false };
    } else {
      drag = { kind: 'moveBall', ball, startX: x, startY: y, x, y, moved: false };
      ctrl.grab(ball);
    }
  } else {
    drag = { kind: 'spawn', startX: x, startY: y, x, y, moved: false };
  }
});

pointer.on('drag', ({ x, y }) => {
  cursor = { x, y };
  if (!drag) return;
  drag.x = x; drag.y = y;
  if (Math.hypot(x - drag.startX, y - drag.startY) > DRAG_MIN) drag.moved = true;
  if (drag.kind === 'moveBall') ctrl.drag(drag.ball, x, y);
});

pointer.on('pickEnd', ({ x, y }) => {
  if (!drag) return;
  if (drag.kind === 'moveBall') {
    ctrl.release(drag.ball);
  } else if (drag.kind === 'linkBall') {
    const target = ctrl.pick(x, y);
    if (target && target !== drag.ball) ctrl.linkBetween(drag.ball, target);
  } else if (drag.kind === 'spawn') {
    // A stationary click in empty space → spawn at the cursor.
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

  const drags = [];
  if (drag && drag.kind === 'linkBall') {
    drags.push({
      from: { x: drag.ball.particle.x, y: drag.ball.particle.y },
      to:   { x: drag.x, y: drag.y },
      attachable: !!ctrl.pick(drag.x, drag.y),
    });
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
