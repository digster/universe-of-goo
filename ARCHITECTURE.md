# Architecture

This is a teaching-first codebase. The architectural north star is: **the
physics module that runs the game is the same physics module the docs teach**.
No pedagogical copies, no simplified forks — reading the source *is* reading
the engine.

## The big picture

Four layers with strictly one-way dependencies:

```
input  ─┐
render ─┼─► game ──► physics
docs  ──┘    │
             └── level JSON
```

- **physics** (`src/physics/`) — pure math over plain data. Particles,
  constraints, Verlet integrator, circle-vs-segment collision, small vec2
  helpers. No canvas, no events, no DOM. Imports nothing but `vec2`.
- **game** (`src/game/`) — goo ball types, strand-attachment rules, level
  loader, goal pipe, win condition, sandbox controller. Owns game-specific
  concepts (types, attached/free state, goal counters) but does not know
  about the DOM.
- **render** (`src/render/`) — canvas 2D drawing in a single pass per frame.
  Reads world state; writes only pixels. Never mutates the world.
- **input** (`src/input/`) — unified pointer (mouse + touch), pick radius,
  HUD button wiring. Emits events; never reads from the world directly.

The three browser entry points — `index.html`, `sandbox.html`,
`docs/**/*.html` — each compose the same `src/` modules into a different
shell. The docs pages are the smallest possible such shell: a canvas, some
sliders, and a ~60-line demo file that imports straight from `../../src/`.

## Why hand-roll the physics?

Matter.js, Box2D, Rapier would all do the physics job. But this codebase
exists to *teach the physics*. A third-party engine moves the interesting
code behind an API wall — the user would learn how to call `Engine.run()`,
not how a constraint solver actually converges. Every line of
`src/physics/` is written so it can be read top-to-bottom and pointed at
from a doc page.

## Critical files

| File | Why it matters |
|------|----------------|
| [src/physics/world.js](src/physics/world.js) | Orchestrator. `step(dt)` runs integrate → N×(relax+collide+bounds) → prune broken. Read this first. |
| [src/physics/integrator.js](src/physics/integrator.js) | The Verlet step. Four lines. Every frame in the game goes through it. |
| [src/physics/constraint.js](src/physics/constraint.js) | `solveConstraint()` is the heart of the engine — position-based relaxation, split-by-invMass correction, break-on-overstretch. |
| [src/physics/collision.js](src/physics/collision.js) | Circle-vs-segment pushout with tangential damping (the only collision primitive the game needs). |
| [src/game/gooball.js](src/game/gooball.js) | Wraps a particle with type, color, gaze, strand list. `applyPreStepBehaviour` is where balloon lift lives. |
| [src/game/strandRules.js](src/game/strandRules.js) | Nearest-K-within-R-with-line-of-sight — the defining gameplay rule. |
| [src/game/level.js](src/game/level.js) | JSON schema, validation, and build into a populated `World`. |
| [src/main.js](src/main.js) | Game bootstrap: fetch level → build world → wire input → RAF loop. |
| [src/sandbox.js](src/sandbox.js) | Sandbox bootstrap: gesture dispatch, shortcut map, localStorage snapshot. |
| [docs/demos/harness.js](docs/demos/harness.js) | Shared boilerplate for every doc demo: canvas sizing, control binding, pointer events, fixed-step RAF loop. |

## The two non-obvious design choices

### 1. Verlet over Euler, position-based over force-based

A standard explicit-Euler integrator stores `(position, velocity)` as two
independent fields and steps them with `v += a·dt; x += v·dt`. That makes
constraints awkward: if a solver moves a particle's position directly,
its stored velocity goes stale and has to be patched.

Verlet integration keeps only `(x, y)` and `(oldX, oldY)`. The *difference*
between them is the implicit velocity. A constraint solver that edits `x`
automatically adjusts the effective velocity — no bookkeeping required.
That's why the `solveConstraint` loop can be as simple as "measure offset,
split by inverse mass, adjust positions."

### 2. `invMass = 0` as the pin trick

A pinned particle is not a special type or a branch in the solver — it's a
particle with `invMass = 0`. The integrator skips zero-invMass particles
(dividing acceleration by zero mass is undefined); the constraint solver
splits corrections proportionally to invMass, so a pinned endpoint absorbs
zero correction while its partner absorbs the full amount. One convention
replaces dozens of `if (pinned)` checks throughout the codebase.

## Data flow through a single step

1. `main.js`'s RAF tick calls `world.step(dt)`.
2. `World.step` iterates particles and calls `verletStep(p, dt, gx, gy, damping)`.
3. Then loops `iterations` times:
   - For each constraint, `solveConstraint(c)` — adjust positions, mark
     `c.broken` if overstretched.
   - For each particle × static segment, `resolveSegment(p, seg)` — push
     out of collisions, dampen tangential component.
   - Clamp particles to world bounds.
4. Finally prune `constraints.filter(c => !c.broken)` — deletion never
   happens mid-iteration.

The renderer reads this world and draws the scene. The input layer emits
events that `main.js` / `sandbox.js` translate into mutations of the
world. There is no direct input → render path.

## Level JSON schema

Levels live in `public/levels/*.json` and are loaded by `fetch`. The
minimal schema is forward-compatible: adding new `type` strings or extra
fields to `balls[]` doesn't break older levels, because the validator
checks required keys but tolerates unknown ones at the top level.

```json
{
  "id": "level-01",
  "name": "First Tower",
  "gravity": [0, 900],
  "bounds": { "w": 1280, "h": 720 },
  "static": [{ "type": "segment", "a": [0, 700], "b": [1280, 700] }],
  "balls": [
    { "type": "basic", "x": 640, "y": 650, "attached": false }
  ],
  "initialStrands": [[0, 1]],
  "goal": { "x": 1100, "y": 150, "radius": 40, "required": 5 }
}
```

See [src/game/level.js](src/game/level.js) for the full validator.

## Developer workflows

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server at `http://localhost:5173`. Live module reload. |
| `npm run build` | Emits `dist/` with `base: './'` — docs tree works when double-clicked. |
| `npm run preview` | Serves the built `dist/` on port 4173 (what Playwright targets). |
| `npm test` | Vitest — physics + game unit tests. |
| `npm run e2e` | Playwright smoke tests. Builds and previews internally. |

**Key invariant**: if the Playwright canvas pixel-check fails on a docs
page, the demo JS is probably throwing. Open the page in the browser and
check the console — the harness will have errored out before its first
draw.

## File-system layout

```
src/
  physics/   vec2.js, particle.js, integrator.js, constraint.js, collision.js, world.js
  game/      gootypes.js, gooball.js, strandRules.js, level.js, goal.js, gameState.js, sandboxController.js
  render/    renderer.js, drawPrimitives.js, debugOverlay.js
  input/     pointer.js
  main.js    sandbox.js  style.css
public/levels/    01-first-tower.json, 02-chasm.json, 03-balloon-lift.json
docs/
  index.html          landing page (TOC)
  pages/01-07.html    one page per concept
  demos/*.js          matching demo scripts
  styles.css
tests/       physics + game unit tests
e2e/         Playwright smoke tests
```

The root holds `index.html` (game), `sandbox.html`, and the Vite/Playwright
config — each HTML file is a Rollup entry point registered in
`vite.config.js`.
