# Universe of Goo

A browser game inspired by **World of Goo**, built as a *teaching codebase*:
hand-rolled Verlet-integration physics, constraint relaxation, soft structures
that can bend and break, and a full interactive documentation site that
teaches the implementation step by step.

- **Game** — drag goo balls to build structures that reach the goal pipe.
- **Sandbox** — free-form physics playground; spawn, connect, delete, save.
- **Docs** — seven deep-linked pages, each with a live interactive canvas
  demo, teaching Verlet integration, springs, chains, cloth, towers, full
  goo balls, and balloon lift. Every demo imports the *same* physics modules
  that power the game — so the docs teach the real code, not a copy.

## Quickstart

```bash
npm install
npx playwright install chromium   # one-time, for the e2e suite
npm run dev                       # dev server, http://localhost:5173
```

Then visit:

- `http://localhost:5173/`              — the playable game
- `http://localhost:5173/sandbox.html`  — the sandbox
- `http://localhost:5173/docs/`         — the documentation

## Controls

### Game
- **Left-drag** a free (walking) goo ball → snap it onto the nearest
  attached balls to extend your structure.
- **R** reset the level.
- **D** toggle debug overlay (particle positions, constraint stress,
  FPS, counts).

### Sandbox
- **Left-drag** empty space → spawn a ball of the selected type on release.
- **Left-drag** a ball → move it (temporarily pinned to cursor).
- **Shift-drag** between two balls → create a manual strand.
- **Right-click** ball or strand → delete.
- **Middle-click** ball → toggle pin.
- Keys: `1`–`4` select basic / balloon / sticky / fixed; `G` toggles
  gravity; `P` pause; `D` debug overlay; `S` save snapshot; `R` restore
  snapshot; `C` clear; `+` / `−` tune constraint iteration count live.

## Running the docs offline (no dev server)

ES-module `import` statements do not load over `file://`, so during
development the dev server is required. After `npm run build`, however,
`vite.config.js` emits fully relative asset paths (`base: './'`) so
`dist/docs/index.html` and each `dist/docs/pages/*.html` file can be
double-clicked open directly from the filesystem — no server needed.

```bash
npm run build
open dist/docs/index.html
```

## Project layout

```
src/
  physics/   # Verlet integrator, constraints, collision — DOM-free
  game/      # goo ball types, strand attachment, levels, goal pipe
  render/    # canvas 2D rendering (reads world, writes pixels)
  input/     # unified mouse + touch pointer, HUD bindings
public/levels/   # three hand-authored sample levels (JSON)
docs/      # multi-page documentation site
tests/     # vitest unit tests (physics + game logic)
e2e/       # Playwright smoke tests (game, sandbox, docs)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layer diagram and data-flow
rationale. See [LEARNINGS.md](./LEARNINGS.md) for implementation gotchas worth
reading before editing physics code.

## Tests

```bash
npm test             # vitest — physics + game unit tests
npm run e2e          # playwright smoke tests (builds, previews, then tests)
```

## License

MIT © digster
