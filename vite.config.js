import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// -----------------------------------------------------------------------------
// Vite configuration — game + sandbox
// -----------------------------------------------------------------------------
// Universe of Goo ships THREE browser entry points from the same codebase:
//   1. /                      — the playable game (index.html)          ← here
//   2. /sandbox.html          — the free-form sandbox mode              ← here
//   3. /docs/index.html       — the documentation site and its 7 pages
//                               (built separately via scripts/build-docs.js
//                               using vite-plugin-singlefile, which inlines
//                               all JS and CSS into each HTML file so the
//                               docs can be double-clicked open from the
//                               filesystem — no server needed.)
//
// `base: './'` is critical: it tells Rollup to emit RELATIVE asset paths
// (e.g. "./assets/foo.js") instead of absolute ones ("/assets/foo.js"). That
// means the built `dist/` tree can be served from any subpath. In
// `npm run dev` ES modules still require Vite to serve them over HTTP
// because the browser refuses to fetch `import` URLs over `file://`.
//
// `npm run build` runs this config first, then vite.docs.config.js, both
// writing into dist/. The docs config uses `emptyOutDir: false` so the
// game/sandbox output from this pass survives.
// -----------------------------------------------------------------------------

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: '/',
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        game: resolve(__dirname, 'index.html'),
        sandbox: resolve(__dirname, 'sandbox.html'),
      },
    },
  },
});
