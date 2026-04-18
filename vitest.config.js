import { defineConfig } from 'vitest/config';

// Physics tests run in pure Node — no DOM needed since the physics layer is
// framework- and canvas-agnostic by design. This is the same separation the
// docs highlight: physics modules are pure math over plain data.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    reporters: 'default',
  },
});
