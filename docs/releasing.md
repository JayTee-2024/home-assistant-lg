# Releasing a new version

A release is three files: the package (`.ipk`), its Homebrew Channel manifest, and the repository index
`webosbrew/apps.json`. `npm run release` makes all three from one build, so their version, size and
checksum always agree. People on Route A of [install.md](install.md) get updates through the index;
people on Route B download the package from the GitHub release.

## Steps

1. Set the new version in `package.json` (only there: the build copies it everywhere else). Use
   `major.minor.patch`, such as `1.1.0`.
2. Add an entry at the top of [CHANGELOG.md](../CHANGELOG.md).
3. Run `npm run check`, then `npm run release`. It prints what it made:
   - `dist/release/net.badacid.homeassistlg_<version>_all.ipk`
   - `dist/release/net.badacid.homeassistlg.manifest.json`
   - `webosbrew/apps.json` (changed in your folder, not yet committed)
4. Commit everything except `webosbrew/apps.json`, and push.
5. On GitHub, create a release with the tag `v<version>` (for example `v1.1.0`), paste the changelog
   entry as its description, and attach **both** files from `dist/release/`. Publish it.
6. Only now commit and push `webosbrew/apps.json`. Doing this last means the index never points at a
   release that does not exist yet.

The manifest's address in the index is GitHub's "latest release" link, so it always finds the newest
manifest; the manifest in turn names the exact package for its version.

## Checking on your own TV before publishing

This installs the release through Homebrew Channel exactly as other people will, but served from your
computer, so nothing is published.

1. Find your computer's address on the home network (on Windows, `ipconfig`; look for "IPv4 Address").
2. Run, with your address:

   ```
   npm run package
   node scripts/release.mjs --base-url http://192.168.1.10:8080
   npx http-server dist/release -p 8080
   ```

   With `--base-url`, every link points at your computer and the index is written into `dist/release/`,
   so the committed `webosbrew/apps.json` is untouched.

3. In Homebrew Channel on the TV, open **Settings**, choose **Add repository**, and enter
   `http://192.168.1.10:8080/apps.json` (with your address). Install the app from the list.
4. When done, remove that repository from Homebrew Channel's settings and stop the server (Ctrl+C).
   Windows may ask whether Node may accept connections: allow it on private networks.

## Listing in the main Homebrew Channel repository (optional)

webosbrew's own repository lists apps so people do not need to add an address. It needs an open-source
licence in this repository. To submit: fork
[webosbrew/apps-repo](https://github.com/webosbrew/apps-repo), add
`packages/net.badacid.homeassistlg.yml`, and open a pull request:

```yaml
title: Home Assist LG
iconUri: https://raw.githubusercontent.com/JayTee-2024/home-assistant-lg/main/webos/largeIcon.png
manifestUrl: https://github.com/JayTee-2024/home-assistant-lg/releases/latest/download/net.badacid.homeassistlg.manifest.json
category: utility
pool: main
shortDescription: Control your Home Assistant home with the TV remote.
requirements:
  webosRelease: '>=4.0'
description: |
  Shows the devices in your Home Assistant as cards and controls them with the remote. The TV
  talks straight to your own Home Assistant. Locks, alarms and doors are deliberately not supported.
  Source and install guide: https://github.com/JayTee-2024/home-assistant-lg
```

Read the repository's own rules before submitting; they may have changed since this was written.
