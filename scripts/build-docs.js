// -----------------------------------------------------------------------------
// scripts/build-docs.js — build the 8 docs HTML entries as self-contained files
// -----------------------------------------------------------------------------
// vite-plugin-singlefile forces `output.inlineDynamicImports: true`, which
// Rollup disallows when a single build has multiple inputs. So we run eight
// small Vite builds in series — one per HTML entry — all writing into the
// same `dist/` folder with `emptyOutDir: false`. Each produces exactly one
// fully self-contained HTML file under `dist/docs/...` with all JS and CSS
// inlined, suitable for opening via file:// from a built tree.
//
// Invoked from package.json `build` script after the main vite build. See
// vite.docs.config.js for the shared per-entry config.
// -----------------------------------------------------------------------------

import { build } from 'vite';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const docsDir = resolve(repoRoot, 'docs');

// Each entry: the source HTML path relative to repoRoot.
// Rollup emits HTMLs at paths mirroring their position under repoRoot, so
// docs/index.html → dist/docs/index.html and docs/pages/01-…html →
// dist/docs/pages/01-…html. That is the structure the README promises.
const entries = [
  resolve(docsDir, 'index.html'),
  resolve(docsDir, 'pages/01-particle.html'),
  resolve(docsDir, 'pages/02-spring.html'),
  resolve(docsDir, 'pages/03-chain.html'),
  resolve(docsDir, 'pages/04-cloth.html'),
  resolve(docsDir, 'pages/05-tower.html'),
  resolve(docsDir, 'pages/06-gooball.html'),
  resolve(docsDir, 'pages/07-balloon.html'),
];

for (const entry of entries) {
  const rel = relative(repoRoot, entry);
  process.stdout.write(`\n[docs-build] ${rel}\n`);
  // Single-input build per entry so inlineDynamicImports: true is legal.
  // The plugin handles inlining JS + CSS + modulepreload into the HTML.
  await build({
    configFile: false,
    root: repoRoot,
    base: './',
    plugins: [viteSingleFile()],
    logLevel: 'warn',
    build: {
      target: 'es2020',
      outDir: 'dist',
      emptyOutDir: false,
      // Preserve the full `docs/...` path structure in the output. Without
      // a named-key input the HTML lands at `dist/<filename>.html`; with
      // a plain-path array Rollup mirrors the source path — exactly what
      // we want.
      rollupOptions: { input: entry },
    },
  });
}

process.stdout.write('\n[docs-build] done.\n');
