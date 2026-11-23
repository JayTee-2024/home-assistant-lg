# Releasing a new version

A release is three files: the package (`.ipk`), its Homebrew Channel manifest, and the repository index
`webosbrew/apps.json`. `npm run release` makes all three from one build.

**The one rule:** upload exactly the files from your last `npm run release`, and commit the
`webosbrew/apps.json` from that same run. Every build of the package comes out slightly different (the
packaging tool stamps the time into it), and Homebrew Channel checks the package against the size and
checksum written into `apps.json`. Files from two different runs do not match, and the install fails with
a checksum error.

Between releases, the committed `webosbrew/apps.json` holds the last real release, or no apps at all
before the first one.

## Before the first release

1. Choose a licence and add a `LICENSE` file. Without one, nobody may legally reuse the code, and
   webosbrew's main list only accepts open-source apps.
2. Make the GitHub repository public (**Settings**, then **General**, then **Change visibility** at the
   bottom). Every link in [install.md](install.md), the app's icon and the downloads only work once it is
   public.

## Steps

1. Set the new version with `npm version 1.1.0 --no-git-tag-version` (with your version number, in
   `major.minor.patch` form). This updates `package.json` and `package-lock.json` together; the build
   copies the version everywhere else, including the Settings screen.
2. Add an entry at the top of [CHANGELOG.md](../CHANGELOG.md).
3. Run `npm run check`. (On a fresh clone, run `npm ci` once first, or nothing will build.)
4. Optional, but worth doing: test on your own TV (next section). Do it now, before step 5.
5. Run `npm run release`. It prints what it made:
   - `dist/release/net.badacid.homeassistlg_<version>_all.ipk`
   - `dist/release/net.badacid.homeassistlg.manifest.json`
   - `webosbrew/apps.json` (changed in your folder, not yet committed)
6. Commit and push everything except `webosbrew/apps.json`.
7. On GitHub, create a release with the tag `v<version>` (for example `v1.1.0`), paste the changelog
   entry as its description, and attach **both** files from `dist/release/`. Publish it.
8. Now commit and push `webosbrew/apps.json`. Doing this last means the index never points at a
   release that does not exist yet.

Do not run `npm run package` or `npm run release` again between steps 5 and 8. If you do, start again
from step 5, and replace the files on the GitHub release with the new ones.

Homebrew Channel reads the manifest copied inside `apps.json`, so step 8 is what delivers the update to
people. The separate manifest file on the release is only used by a listing in webosbrew's own
repository (below).

## Testing on your own TV before publishing

This installs the app through Homebrew Channel exactly as other people will, but served from your
computer, so nothing is published.

1. Find your computer's address on the home network. In PowerShell, run `ipconfig` and look under your
   **Ethernet** or **Wi-Fi** adapter for **IPv4 Address**. It looks like `192.168.1.42`. Use this
   address wherever `<address>` appears below. (Ignore adapters named WSL, Hyper-V, VirtualBox or VPN.)
2. Run these, one at a time:

   ```
   npm run package
   node scripts/release.mjs --base-url http://<address>:8080
   npx http-server dist/release -p 8080 --cors
   ```

   With `--base-url`, every link points at your computer, the icon is served from it too, and the index
   is written into `dist/release/`, so the committed `webosbrew/apps.json` is untouched. The first
   `npx http-server` asks to download it: answer `y`.

3. Check that `http://<address>:8080/apps.json` opens in a browser on your phone. If it does not,
   Windows Firewall is blocking it. Allow Node.js on private networks under **Windows Security**,
   **Firewall & network protection**, **Allow an app through firewall**.
4. In Homebrew Channel on the TV, open **Settings**, choose **Add repository**, and enter
   `http://<address>:8080/apps.json`. Install the app from the list, and check the version at the bottom
   of the app's Settings screen.
5. When done, remove that repository from Homebrew Channel's settings and stop the server (Ctrl+C).

These test files are not the release. The real release is made in step 5 of the steps above.

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
