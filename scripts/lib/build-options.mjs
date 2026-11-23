import { readFileSync } from 'node:fs';

// The esbuild settings for the one-off build (build.mjs) and the development server
// (dev.mjs). Both start from the same shared settings, so the two can never drift apart.

/** Where the built app goes. Everything in this folder ends up on the TV. */
export const OUTPUT_FOLDER = 'dist/app';

/** The app's version, set only in package.json. */
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;

/** Settings both builds share. */
const sharedOptions = {
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

  // Replaces __APP_VERSION__ in the source with the version, as text (see src/core/app-version.ts).
  define: { __APP_VERSION__: JSON.stringify(version) },
  logLevel: 'info',
};

/** The build that goes into the TV package: minified, and without source maps to keep the package small. */
export const releaseBuildOptions = { ...sharedOptions, minify: true, sourcemap: false };

/** The development server's build: source maps so browser errors point at the TypeScript files. */
export const devBuildOptions = { ...sharedOptions, sourcemap: 'linked' };
