// Builds the two files Homebrew Channel reads to offer the app on a TV:
//  - the manifest: what the package is and exactly which bytes to expect (size and SHA-256),
//  - the repository index (apps.json): a list of apps, here just this one, each with its manifest.
// The field names follow webosbrew's publishing guide and repo.webosbrew.org's own index.

import { createHash } from 'node:crypto';

export const REPOSITORY_URL = 'https://github.com/JayTee-2024/home-assistant-lg';

const ICON_URL =
  'https://raw.githubusercontent.com/JayTee-2024/home-assistant-lg/main/webos/largeIcon.png';
const DESCRIPTION = 'Control your Home Assistant home with the TV remote.';

/** The oldest webOS the app supports: the build targets Chromium 53, the engine of webOS 4. */
const OLDEST_WEBOS = '>=4.0';

/** The file name ares-package gives the package. */
export function packageFileName(appId, version) {
  return appId + '_' + version + '_all.ipk';
}

/**
 * Where a release file can be downloaded. Normally the GitHub release for that version;
 * a base address (such as a computer on the home network) replaces it for local testing.
 */
export function downloadUrl(version, fileName, baseUrl) {
  if (baseUrl) return baseUrl.replace(/\/$/, '') + '/' + fileName;
  return REPOSITORY_URL + '/releases/download/v' + version + '/' + fileName;
}

/** The manifest for one exact package. Make a new one for every package: the size and hash change. */
export function makeManifest(appInfo, ipkBytes, ipkUrl) {
  return {
    id: appInfo.id,
    version: appInfo.version,
    type: appInfo.type,
    title: appInfo.title,
    appDescription: DESCRIPTION,
    iconUri: ICON_URL,
    sourceUrl: REPOSITORY_URL,
    // The app needs nothing root gives, so it also installs on a TV in developer mode.
    rootRequired: false,
    ipkUrl,
    ipkSize: ipkBytes.length,
    ipkHash: { sha256: createHash('sha256').update(ipkBytes).digest('hex') },
  };
}

/** A repository index holding just this app, in the same shape as repo.webosbrew.org's. */
export function makeRepositoryIndex(manifest, manifestUrl) {
  return {
    paging: { page: 1, count: 1, maxPage: 1, itemsTotal: 1, prevUrl: null, nextUrl: null },
    packages: [
      {
        id: manifest.id,
        title: manifest.title,
        iconUri: manifest.iconUri,
        manifestUrl,
        manifest,
        pool: 'main',
        requirements: { webosRelease: OLDEST_WEBOS },
        shortDescription: manifest.appDescription,
      },
    ],
  };
}
