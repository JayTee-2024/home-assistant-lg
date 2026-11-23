// Builds the app once into dist/app, ready to package for the TV.
// Run with: npm run build

import { rmSync } from 'node:fs';
import { build } from 'esbuild';
import { OUTPUT_FOLDER, releaseBuildOptions } from './lib/build-options.mjs';
import { copyStaticFiles } from './lib/copy-static.mjs';

// Start from an empty folder so a deleted source file cannot linger in the package.
rmSync(OUTPUT_FOLDER, { recursive: true, force: true });

await build(releaseBuildOptions);
copyStaticFiles();
