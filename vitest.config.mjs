// Test runner settings. Tests are plain logic tests, so they run in Node with no browser.
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The same version text the build writes into the app (see scripts/lib/build-options.mjs).
  define: {
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version),
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
