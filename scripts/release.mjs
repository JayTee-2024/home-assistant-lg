// Prepares a release: the package plus the files Homebrew Channel needs to install it.
// Run with: npm run release   (which builds and packages first)
//
// It writes:
//   dist/release/<package>.ipk                          upload to the GitHub release
//   dist/release/net.badacid.homeassistlg.manifest.json upload to the GitHub release
//   webosbrew/apps.json                                 commit and push after the release exists
//
// For a test on your own TV before publishing, give a base address on your network:
//   node scripts/release.mjs --base-url http://192.168.1.10:8080
// Every link then points there, apps.json goes into dist/release/ instead of the repo,
// and `npx http-server dist/release -p 8080` serves the lot. See docs/releasing.md.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  downloadUrl,
  makeManifest,
  makeRepositoryIndex,
  packageFileName,
} from './lib/release-files.mjs';
import { OUTPUT_FOLDER } from './lib/build-options.mjs';

const PACKAGE_FOLDER = 'dist';
const RELEASE_FOLDER = 'dist/release';
const COMMITTED_INDEX = 'webosbrew/apps.json';

const baseUrlFlag = process.argv.indexOf('--base-url');
const baseUrl = baseUrlFlag === -1 ? undefined : process.argv[baseUrlFlag + 1];
if (baseUrlFlag !== -1 && !baseUrl)
  stop('Give an address after --base-url, such as http://192.168.1.10:8080');

if (!existsSync(OUTPUT_FOLDER + '/appinfo.json'))
  stop('Nothing to release. Run npm run package first.');

// package.mjs has already copied package.json's version into the built appinfo.json.
const appInfo = JSON.parse(readFileSync(OUTPUT_FOLDER + '/appinfo.json', 'utf8'));
const expectedName = packageFileName(appInfo.id, appInfo.version);
const packages = readdirSync(PACKAGE_FOLDER).filter((file) => file.endsWith('.ipk'));
if (packages.length !== 1 || packages[0] !== expectedName) {
  stop(
    'Expected exactly ' + expectedName + ' in dist/, found: ' + (packages.join(', ') || 'nothing'),
  );
}

// Start empty, so an older package can never be uploaded by mistake.
rmSync(RELEASE_FOLDER, { recursive: true, force: true });
mkdirSync(RELEASE_FOLDER, { recursive: true });
copyFileSync(PACKAGE_FOLDER + '/' + expectedName, RELEASE_FOLDER + '/' + expectedName);

// The manifest is computed from the copied file, the very bytes that will be uploaded.
const ipkBytes = readFileSync(RELEASE_FOLDER + '/' + expectedName);
const manifest = makeManifest(
  appInfo,
  ipkBytes,
  downloadUrl(appInfo.version, expectedName, baseUrl),
);
const manifestName = appInfo.id + '.manifest.json';
writeJson(RELEASE_FOLDER + '/' + manifestName, manifest);

// GitHub's "latest" link always leads to the newest release's file of that name.
const manifestUrl = baseUrl
  ? downloadUrl(appInfo.version, manifestName, baseUrl)
  : 'https://github.com/JayTee-2024/home-assistant-lg/releases/latest/download/' + manifestName;
const indexPath = baseUrl ? RELEASE_FOLDER + '/apps.json' : COMMITTED_INDEX;
mkdirSync(indexPath.slice(0, indexPath.lastIndexOf('/')), { recursive: true });
writeJson(indexPath, makeRepositoryIndex(manifest, manifestUrl));

console.log('Release ' + appInfo.version + ' ready in ' + RELEASE_FOLDER + ':');
for (const file of readdirSync(RELEASE_FOLDER)) console.log('  ' + file);
if (baseUrl) {
  console.log('Serve it with: npx http-server ' + RELEASE_FOLDER + ' -p <port>');
  console.log(
    'Then add ' + baseUrl.replace(/\/$/, '') + '/apps.json as a repository in Homebrew Channel.',
  );
} else {
  console.log(
    'Next: create GitHub release v' +
      appInfo.version +
      ' with both files, then commit and push ' +
      COMMITTED_INDEX +
      '.',
  );
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function stop(message) {
  console.error(message);
  process.exit(1);
}
