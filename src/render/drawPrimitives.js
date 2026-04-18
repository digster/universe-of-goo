// -----------------------------------------------------------------------------
// drawPrimitives — thin wrappers around CanvasRenderingContext2D.
// -----------------------------------------------------------------------------
// Every primitive draw in the game ultimately lands here. Keeping them in
// one file makes it trivial to swap the rendering backend (WebGL, DOM, etc.)
// later, and makes the drawing code in renderer.js read like a declarative
// scene description rather than canvas-state mutation.
// -----------------------------------------------------------------------------

/** Clear the canvas to a solid colour. */
export function clear(ctx, { w, h }, color = '#0a0e1a') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

/** Filled circle. */
export function circle(ctx, x, y, r, fill, stroke, strokeWidth = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Straight line segment. */
export function line(ctx, a, b, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/**
 * A sagging strand rendered as a quadratic bezier with its midpoint offset
 * in the direction of gravity. Purely cosmetic — physics treats the strand
 * as a straight rigid-ish stick. The sag scales with the strand's slack so a
 * tight strand renders almost straight while a loose one droops visibly.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {number} sag         Positive = deeper droop (pixels).
 * @param {{x:number,y:number}} gravityUnit  Unit vector in gravity direction.
 * @param {string} color
 * @param {number} width
 */
export function saggingStrand(ctx, a, b, sag, gravityUnit, color, width = 3) {
  const mx = (a.x + b.x) / 2 + gravityUnit.x * sag;
  const my = (a.y + b.y) / 2 + gravityUnit.y * sag;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx, my, b.x, b.y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Two tiny eyes on a goo ball, gazing in `gaze` direction (unit vector). */
export function eyes(ctx, cx, cy, r, gaze) {
  const spacing = r * 0.45;
  const eyeR = Math.max(1.5, r * 0.24);
  const pupilR = Math.max(1, eyeR * 0.55);
  // Clamp the gaze offset so pupils stay inside the eye whites.
  const offX = gaze.x * (eyeR - pupilR);
  const offY = gaze.y * (eyeR - pupilR);

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - spacing, cy - r * 0.15, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + spacing, cy - r * 0.15, eyeR, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#0b0f1c';
  ctx.beginPath(); ctx.arc(cx - spacing + offX, cy - r * 0.15 + offY, pupilR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + spacing + offX, cy - r * 0.15 + offY, pupilR, 0, Math.PI * 2); ctx.fill();
}

/** Plain text label. */
export function text(ctx, str, x, y, { color = '#e8ecf4', size = 12, align = 'left', baseline = 'top' } = {}) {
  ctx.fillStyle = color;
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}
