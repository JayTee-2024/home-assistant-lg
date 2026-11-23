// Turns the built app in dist/app into a .ipk file, the package format webOS TVs install.
// Run with: npm run package   (which builds first)

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { OUTPUT_FOLDER } from './lib/build-options.mjs';

const PACKAGE_FOLDER = 'dist';
const appInfoPath = OUTPUT_FOLDER + '/appinfo.json';

if (!existsSync(appInfoPath)) {
  console.error('Nothing to package. Run npm run build first.');
  process.exit(1);
}

// The version is set in one place, package.json, and copied into the TV metadata here.
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const appInfo = JSON.parse(readFileSync(appInfoPath, 'utf8'));
appInfo.version = version;
writeFileSync(appInfoPath, JSON.stringify(appInfo, null, 2) + '\n');

// Remove earlier packages so dist/ only ever holds the one just made.
for (const file of readdirSync(PACKAGE_FOLDER)) {
  if (file.endsWith('.ipk')) rmSync(PACKAGE_FOLDER + '/' + file);
}

// ares-package is LG's packaging tool. --no-minify because the bundle is already minified
// for Chromium 53 and must not be reprocessed by a tool that does not know that target.
execFileSync('npx', ['ares-package', '--no-minify', OUTPUT_FOLDER, '--outdir', PACKAGE_FOLDER], {
  stdio: 'inherit',
  // On Windows npx is a .cmd file, which can only be started through a shell.
  shell: process.platform === 'win32',
});
