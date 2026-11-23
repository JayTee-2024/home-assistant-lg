// The esbuild settings shared by the one-off build (build.mjs) and the development
// server (dev.mjs), so the two can never drift apart.

/** Where the built app goes. Everything in this folder ends up on the TV. */
export const OUTPUT_FOLDER = 'dist/app';

export const buildOptions = {
  entryPoints: ['src/app/main.tsx'],
  outfile: OUTPUT_FOLDER + '/app.js',
  bundle: true,

  // One classic script. Chromium 53 (webOS TV 4.x) cannot load ES modules.
  format: 'iife',

  // Rewrites newer JavaScript and CSS syntax into what Chromium 53 understands.
  // This handles syntax only. Missing functions are added in src/platform/polyfills.ts.
  target: ['chrome53'],

  jsx: 'automatic',
  jsxImportSource: 'preact',
  sourcemap: 'linked',
  logLevel: 'info',
};
