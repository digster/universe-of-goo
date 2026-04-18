// -----------------------------------------------------------------------------
// Pointer — unified mouse + touch input.
// -----------------------------------------------------------------------------
// Everything using the canvas (game, sandbox, every doc demo) funnels through
// this tiny event bus. It re-maps pointer coordinates from CSS pixels to the
// canvas' internal resolution so callers can think in game-space.
//
// Event vocabulary:
//   'pickStart'  ({x, y, shift, button})  — pointer went down on the canvas
//   'drag'       ({x, y, dx, dy, shift, button})  — pointer moved while down
//   'pickEnd'    ({x, y, shift, button})  — pointer released
//   'rightClick' ({x, y})                 — right mouse button click
//   'middleClick'({x, y})                 — middle mouse button click
// -----------------------------------------------------------------------------

export class Pointer {
  constructor(canvas) {
    this.canvas = canvas;
    this.listeners = new Map();
    this._active = false;
    this._button = -1;
    this._shift = false;
    this._lastX = 0;
    this._lastY = 0;

    // Disable right-click menu on the canvas so right-click can be used for
    // delete in the sandbox.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    // pointerup / pointercancel / pointerleave on window so a drag that ends
    // outside the canvas still fires pickEnd.
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(cb);
    return this;
  }

  _emit(event, payload) {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    for (const cb of cbs) cb(payload);
  }

  /** Translate browser pointer coords → canvas-internal coords. */
  _toCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  _down(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    const { x, y } = this._toCanvas(e.clientX, e.clientY);
    this._shift = e.shiftKey;
    this._button = e.button;

    // Right and middle click are one-shots — no drag semantics.
    if (e.button === 2) {
      this._emit('rightClick', { x, y });
      return;
    }
    if (e.button === 1) {
      this._emit('middleClick', { x, y });
      return;
    }

    this._active = true;
    this._lastX = x;
    this._lastY = y;
    this._emit('pickStart', { x, y, shift: this._shift, button: this._button });
  }

  _move(e) {
    if (!this._active) return;
    const { x, y } = this._toCanvas(e.clientX, e.clientY);
    const dx = x - this._lastX;
    const dy = y - this._lastY;
    this._lastX = x;
    this._lastY = y;
    this._emit('drag', { x, y, dx, dy, shift: this._shift, button: this._button });
  }

  _up(e) {
    if (!this._active) return;
    this._active = false;
    const { x, y } = this._toCanvas(e.clientX, e.clientY);
    this._emit('pickEnd', { x, y, shift: this._shift, button: this._button });
  }
}
