// Copies the files esbuild does not produce into the output folder:
// the HTML page, and the TV metadata and icons from webos/ once that folder exists.

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { OUTPUT_FOLDER } from './build-options.mjs';

export function copyStaticFiles() {
  mkdirSync(OUTPUT_FOLDER, { recursive: true });
  cpSync('src/index.html', OUTPUT_FOLDER + '/index.html');
  if (existsSync('webos')) {
    cpSync('webos', OUTPUT_FOLDER, { recursive: true });
  }
}
