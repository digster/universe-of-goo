# Learnings

Notes on non-obvious things we discovered while building this codebase.
Read before changing physics or the build setup.

## Physics

### `invMass = 0` must not appear on both sides of a constraint
If two pinned particles share a constraint, the solver does
`wA = a.invMass / (a.invMass + b.invMass)` and divides by zero. It's
harmless in practice (both endpoints are pinned, so the constraint is
redundant), but it silently produces NaN positions that propagate. The
solver handles this by early-returning when both endpoints are pinned.
Keep that branch — don't "clean it up."

### Broken strand cleanup happens *after* the iteration loop
Do not delete a broken constraint from `world.constraints` in the middle
of `solveConstraint` — it shifts indices and skips adjacent constraints.
`World.step` sets `c.broken = true` during the loop, then
`constraints = constraints.filter(c => !c.broken)` runs exactly once at
the end. Preserve that order.

### Collision test direction (y-down coordinates)
Canvas uses y-down. A particle "above" a horizontal segment has smaller y.
An early collision test placed the particle below the segment and
expected the pushout to move it upward — it moved it further down
instead. The fix is mental discipline: draw the scene on paper with
y-down before writing the assertion. See
[tests/collision.test.js](tests/collision.test.js) for the right pattern.

### The relaxation iteration count is a gameplay lever
- 4 iters: visibly squishy, fine for cloth.
- 8 iters: solid rope, good for goo strands.
- 12+ iters: near-stiff-rod.
The sandbox's `+` / `−` keys retune this live so players can feel the
trade-off. The game ships at 8.

## Build / tooling

### `base: './'` is what makes the built docs work from `file://`
Without it, Rollup emits absolute asset paths like `/assets/foo.js`,
which browsers resolve relative to the origin — meaning `file://` loads
fail with 404. `base: './'` makes every asset URL relative to the HTML
file itself. Double-clicking `dist/docs/index.html` in Finder then
works. **Do not** remove this from `vite.config.js`.

### ES modules don't load over `file://` in any browser
This is a hard browser security rule, not a Vite limitation. It's why
`npm run dev` is required during development even though the built
output opens without a server. A common wrong first instinct is to
add `type="module"` removal or try `<script defer>` — those don't fix
anything. Use the dev server.

### `fetchLevel` uses a plain relative URL, not `import.meta.url`
An early implementation used
`new URL('./levels/01.json', import.meta.url)` — but that resolves
relative to `src/game/level.js`, producing a URL like
`/src/game/levels/01.json` which doesn't exist. The levels live at
`/levels/` because they're in `public/`. The working call is just
`fetch('./levels/${name}.json')` from the page context.

### CSS selector specificity: `[hidden]` doesn't win against `.overlay { display: grid }`
Both are specificity (0, 1, 0) — but `display: grid` came *later* in the
stylesheet, so it won. The overlay stayed visible even with the `hidden`
attribute. Fix is explicit: `.overlay[hidden] { display: none; }`. Keep
that rule; don't delete it "because hidden should just work."

## Testing

### Playwright's `h1` locator can hit the sidebar
Doc pages have two `<h1>` elements: one in `.docs-sidebar`, one in
`.docs-main`. `page.locator('h1').first()` picks the sidebar one —
always "Universe of Goo" — which fails a page-title assertion. Scope
to `.docs-main h1` for content assertions.

### Canvas pixel-check needs a dense sample stride
A naive "non-blank pixel" check that samples every ~500th pixel misses
small draw calls (single particles, short chains). Stride ~37 with a
slightly permissive threshold catches everything the demos draw without
false positives on the `#070a13` background. See
[e2e/docs.spec.js](e2e/docs.spec.js).

### Playwright runs against the built `dist/`, not the dev server
`playwright.config.js` sets `webServer.command` to
`npm run build && npm run preview`. This catches production-only bugs
(broken asset paths, Rollup tree-shaking) that dev mode hides. If a
test fails after touching the build config, try `npm run build` and
`npm run preview` manually to debug.

## Game design

### Balloon lift scales with attached state
Free balloons drift up at half-force; attached balloons apply full
force. This keeps the game readable — a balloon you've placed on a
tower is the one doing the heavy lifting, while strays aren't
launching themselves at terminal velocity. Don't "normalize" this by
giving every balloon full lift: levels break.

### `fixed` is a goo type, not a separate concept
A fixed goo ball is just a ball with `pinned: true` (→ `invMass = 0`)
and `Infinity` maxStretch on its strands. Using the same `GooBall`
shape for pins means rendering, eyes, and gaze all work uniformly.
