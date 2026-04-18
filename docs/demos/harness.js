// -----------------------------------------------------------------------------
// Demo harness — shared boilerplate for every interactive doc page.
// -----------------------------------------------------------------------------
// Each demo page imports `mountDemo(selector, setup)`. `setup` is called once
// with `{ ctx, bounds, controls, pointer }` and returns a `step(dt)` function.
// The harness handles:
//
//   • sizing the canvas to its CSS box at devicePixelRatio for crispness
//   • running a fixed-step RAF loop
//   • dispatching canvas pointer events to the demo
//   • binding <input type="range"> / <button> controls to setup via the
//     `controls` helper (auto-updates <output> elements)
//
// The goal is that each demo's logic file stays under ~60 lines so readers
// can study it top-to-bottom alongside the prose explanation.
// -----------------------------------------------------------------------------

const DT = 1 / 60;

/**
 * @param {string} selector            e.g. '.demo' — the wrapper element.
 * @param {(ctx: {
 *   ctx: CanvasRenderingContext2D,
 *   bounds: { w:number, h:number },
 *   controls: Record<string, {value:number}>,
 *   setOutput: (name:string, val:string) => void,
 *   pointer: { on: (e:string, cb:Function) => void },
 *   reset: () => void,
 * }) => ((dt:number, now:number) => void)} setup
 */
export function mountDemo(selector, setup) {
  const root = document.querySelector(selector);
  if (!root) throw new Error(`mountDemo: no element matches "${selector}"`);
  const canvas = root.querySelector('canvas');
  if (!canvas) throw new Error('mountDemo: demo root needs a <canvas>');

  const ctx = canvas.getContext('2d');

  // --- size canvas to CSS box * DPR ---------------------------------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  // --- controls -----------------------------------------------------------
  const controls = {};
  const outputs = {};
  for (const input of root.querySelectorAll('input[type="range"][data-key], input[type="checkbox"][data-key], button[data-key]')) {
    const key = input.dataset.key;
    if (input.tagName === 'BUTTON') {
      controls[key] = { pressed: false };
      input.addEventListener('click', () => {
        controls[key].pressed = true;
        // Cleared next frame so demos see a single-tick pulse.
        setTimeout(() => { controls[key].pressed = false; }, 0);
      });
    } else if (input.type === 'checkbox') {
      controls[key] = { value: input.checked };
      input.addEventListener('input', () => { controls[key].value = input.checked; });
    } else {
      controls[key] = { value: parseFloat(input.value) };
      input.addEventListener('input', () => { controls[key].value = parseFloat(input.value); });
    }
  }
  for (const out of root.querySelectorAll('output[data-key]')) outputs[out.dataset.key] = out;
  function setOutput(name, val) { if (outputs[name]) outputs[name].textContent = val; }

  // --- pointer ------------------------------------------------------------
  const listeners = { down: [], move: [], up: [] };
  const toLocal = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top),
      shift: e.shiftKey,
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    listeners.down.forEach((f) => f(toLocal(e)));
  });
  window.addEventListener('pointermove', (e) => listeners.move.forEach((f) => f(toLocal(e))));
  window.addEventListener('pointerup', (e) => listeners.up.forEach((f) => f(toLocal(e))));
  const pointer = { on: (ev, cb) => listeners[ev]?.push(cb) };

  // --- setup --------------------------------------------------------------
  // Demos call this to clear & rebuild state (e.g. when a "Reset" button is pressed).
  let step = null;
  function boot() {
    const bounds = { w: canvas.clientWidth, h: canvas.clientHeight };
    step = setup({ ctx, bounds, controls, setOutput, pointer, reset: boot });
  }
  boot();

  // --- RAF loop -----------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  requestAnimationFrame(function frame(now) {
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += delta;
    let n = 0;
    while (acc >= DT && n < 5) {
      step?.(DT, now);
      acc -= DT;
      n++;
    }
    requestAnimationFrame(frame);
  });
}

/** Shared background clear. Handy utility for demos. */
export function clearDemo(ctx, bounds, color = '#070a13') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, bounds.w, bounds.h);
  // light grid
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= bounds.w; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, bounds.h); ctx.stroke();
  }
  for (let y = 0; y <= bounds.h; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bounds.w, y); ctx.stroke();
  }
  ctx.restore();
}
