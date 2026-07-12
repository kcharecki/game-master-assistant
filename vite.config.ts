import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // GitHub Pages serves this project under /<repo>/; the CI build sets
  // GITHUB_PAGES so asset URLs get the subpath prefix. Local dev, e2e, and
  // root-domain hosts (Cloudflare/Netlify) stay at '/'.
  base: process.env.GITHUB_PAGES === 'true' ? '/game-master-assistant/' : '/',
  plugins: [svelte()],
  // Fixed, unlikely-used port so the boot-time auto-start server is stable.
  // strictPort: fail loudly instead of wandering to another port.
  server: { port: 42710, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        broadcast: fileURLToPath(new URL('broadcast.html', import.meta.url)),
        // Dev-only component preview harness (see CLAUDE.md). Harmless if shipped.
        preview: fileURLToPath(new URL('preview.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['src/**/*.{test,spec}.ts', 'tests/unit/**/*.{test,spec}.ts'],
  },
});
