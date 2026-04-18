import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// -----------------------------------------------------------------------------
// Vite configuration
// -----------------------------------------------------------------------------
// Universe of Goo ships THREE browser entry points from the same codebase:
//   1. /                      — the playable game (index.html)
//   2. /sandbox.html          — the free-form sandbox mode
//   3. /docs/index.html       — the documentation landing page, which links
//                               out to /docs/pages/*.html — each doc page is a
//                               separate HTML entry so it can be deep-linked
//                               and loads only the code it needs.
//
// `base: './'` is critical: it tells Rollup to emit RELATIVE asset paths
// (e.g. "./assets/foo.js") instead of absolute ones ("/assets/foo.js"). That
// means the built `dist/` tree can be opened directly from the filesystem —
// double-clicking `dist/docs/index.html` works without running a web server.
// In `npm run dev` ES modules still require Vite to serve them over HTTP
// because the browser refuses to fetch `import` URLs over `file://`.
// -----------------------------------------------------------------------------

const docsDir = resolve(__dirname, 'docs');

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
        docsIndex: resolve(docsDir, 'index.html'),
        docs01: resolve(docsDir, 'pages/01-particle.html'),
        docs02: resolve(docsDir, 'pages/02-spring.html'),
        docs03: resolve(docsDir, 'pages/03-chain.html'),
        docs04: resolve(docsDir, 'pages/04-cloth.html'),
        docs05: resolve(docsDir, 'pages/05-tower.html'),
        docs06: resolve(docsDir, 'pages/06-gooball.html'),
        docs07: resolve(docsDir, 'pages/07-balloon.html'),
      },
    },
  },
});
