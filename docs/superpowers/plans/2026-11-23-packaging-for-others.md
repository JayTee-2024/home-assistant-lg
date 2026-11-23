# Packaging for Other People Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anyone with an LG webOS TV can install Home Assist LG, either from Homebrew Channel (rooted TVs) or with webOS Dev Manager (developer mode), by following one written guide.

**Architecture:** `npm run release` builds a package without source maps, then writes the Homebrew Channel manifest and a one-app repository index (`webosbrew/apps.json`) from that exact package. The package and manifest are attached to a GitHub release; the committed `webosbrew/apps.json` is the address people add to Homebrew Channel. Manifest and index are made by small pure functions in `scripts/lib/release-files.mjs`, tested on their own.

**Tech Stack:** Node scripts (ESM), `node:crypto` for the SHA-256, Vitest, existing `ares-package` packaging.

**Spec:** `docs/superpowers/specs/2026-11-23-home-assist-lg-design.md` (the app is "for Simon and for other people"; no backend; each TV talks to its own Home Assistant).

## Global Constraints

- App id stays `net.badacid.homeassistlg`. The version is set only in `package.json`.
- Repository: `https://github.com/JayTee-2024/home-assistant-lg`, branch `main`.
- Homebrew Channel manifest fields: `id`, `version`, `type`, `title`, `appDescription`, `iconUri`, `sourceUrl`, `rootRequired`, `ipkUrl`, `ipkSize`, `ipkHash.sha256`.
- `rootRequired` is `false`: the app needs nothing root gives.
- Minimum webOS is 4.0 (`requirements.webosRelease: ">=4.0"`), because the build targets Chromium 53, webOS 4's engine.
- Nothing is published (GitHub release, pushed tag, PR to webosbrew/apps-repo) without Simon's yes.
- No licence file is added without Simon choosing one; the webosbrew `main` pool needs an open-source licence.
- Guides are written for someone who has never used a terminal: numbered steps, plain words.

## Review Focus

1. A manifest whose size or hash does not match the uploaded package: Homebrew Channel refuses the install. The manifest must be computed from the very bytes written to `dist/release/`.
2. A version mismatch between `package.json`, the package file name, the manifest and the download URL: the URL 404s. One version value feeds all four.
3. A stale `dist/release/` holding an older package next to the new one: someone uploads the wrong file. The release folder is emptied first.
4. Developer-mode installs vanish when developer mode lapses (about 50 hours): the guide must say so and how to renew.
5. Someone signing in with their Home Assistant owner account: the guide recommends a separate non-admin user, which plan 4 proved works.

---

### Task 1: Release build without source maps

**Files:**
- Modify: `scripts/lib/build-options.mjs`, `scripts/build.mjs`, `scripts/dev.mjs`
- Test: `scripts/lib/build-options.test.mjs`

**Interfaces:**
- Produces: `releaseBuildOptions` (shared options + `minify: true`, `sourcemap: false`) and `devBuildOptions` (shared options + `sourcemap: 'linked'`), both exported from `build-options.mjs`. `buildOptions` is no longer exported.

- [ ] **Step 1: Write the failing test** — `releaseBuildOptions.sourcemap` is `false` and `.minify` is `true`; `devBuildOptions.sourcemap` is `'linked'`; both have `target: ['chrome53']` and `format: 'iife'`.
- [ ] **Step 2: Run** `npx vitest run scripts/lib/build-options.test.mjs` — Expected: FAIL (exports missing).
- [ ] **Step 3: Implement** the two exports; `build.mjs` uses `releaseBuildOptions`, `dev.mjs` uses `devBuildOptions`.
- [ ] **Step 4: Run** the test, then `npm run build && ls dist/app` — Expected: PASS; no `app.js.map` in `dist/app`.
- [ ] **Step 5: Commit** `build: release package without source maps`.

### Task 2: Manifest and repository index

**Files:**
- Create: `scripts/lib/release-files.mjs`
- Test: `scripts/lib/release-files.test.mjs`

**Interfaces:**
- Produces:
  - `REPOSITORY_URL = 'https://github.com/JayTee-2024/home-assistant-lg'`
  - `packageFileName(appId: string, version: string): string` → `'<appId>_<version>_all.ipk'` (the name `ares-package` writes)
  - `downloadUrl(version: string, fileName: string, baseUrl?: string): string` → `<REPOSITORY_URL>/releases/download/v<version>/<fileName>`, or `<baseUrl>/<fileName>` when a base URL is given (used for the local TV check)
  - `makeManifest(appInfo, ipkBytes: Uint8Array, ipkUrl: string): object`
  - `makeRepositoryIndex(manifest: object, manifestUrl: string): object`

- [ ] **Step 1: Write the failing tests:**
  - `packageFileName('net.badacid.homeassistlg', '1.0.0')` is `'net.badacid.homeassistlg_1.0.0_all.ipk'`.
  - `downloadUrl('1.0.0', 'a.ipk')` is `'https://github.com/JayTee-2024/home-assistant-lg/releases/download/v1.0.0/a.ipk'`; with base `'http://192.168.1.10:8080'` (and with a trailing slash) it is `'http://192.168.1.10:8080/a.ipk'`.
  - `makeManifest` with appInfo `{id, version: '1.0.0', type: 'web', title: 'Home Assist LG'}` and bytes `new TextEncoder().encode('abc')` gives `ipkSize: 3`, `ipkHash: {sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}`, `rootRequired: false`, `sourceUrl: REPOSITORY_URL`, `iconUri` = `https://raw.githubusercontent.com/JayTee-2024/home-assistant-lg/main/webos/largeIcon.png`, and copies id, version, type, title.
  - `makeRepositoryIndex` gives `{paging: {page: 1, count: 1, maxPage: 1, itemsTotal: 1, prevUrl: null, nextUrl: null}, packages: [entry]}` where entry has the manifest's id, title, iconUri, the given `manifestUrl`, `manifest` (the whole manifest), `pool: 'main'`, `requirements: {webosRelease: '>=4.0'}` and `shortDescription` equal to the manifest's `appDescription`.
- [ ] **Step 2: Run** `npx vitest run scripts/lib/release-files.test.mjs` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** with `createHash('sha256')` from `node:crypto`. `appDescription` is the fixed text `'Control your Home Assistant home with the TV remote.'`.
- [ ] **Step 4: Run** the tests — Expected: PASS.
- [ ] **Step 5: Commit** `build: Homebrew Channel manifest and repository index`.

### Task 3: `npm run release`

**Files:**
- Create: `scripts/release.mjs`, `webosbrew/apps.json` (generated, committed)
- Modify: `package.json` (script `"release": "npm run package && node scripts/release.mjs"`), `.prettierignore` if needed so the generated JSON is left as written

**Interfaces:**
- Consumes: Task 2's functions; the `.ipk` that `npm run package` leaves in `dist/`.
- Produces: `dist/release/` holding exactly the package and `net.badacid.homeassistlg.manifest.json`; `webosbrew/apps.json` in the repo. With `--base-url <url>`, all URLs point at that address and the index goes to `dist/release/apps.json` instead of the repo (so a local check never changes the committed index).

- [ ] **Step 1: Implement** `scripts/release.mjs`: empty and recreate `dist/release/`; find the single `.ipk` in `dist/` and check its name equals `packageFileName(appInfo.id, version)` (stop with a clear message if not); copy it in; write the manifest (manifest URL `<REPOSITORY_URL>/releases/latest/download/<manifest file>`, or the base-URL form); write the index. Print the next steps (where to upload what).
- [ ] **Step 2: Run** `npm run release` — Expected: `dist/release/` has two files; `sha256sum` of the package equals `ipkHash.sha256` in the manifest; `webosbrew/apps.json` changed.
- [ ] **Step 3: Run** `node scripts/release.mjs --base-url http://192.168.1.10:8080` — Expected: three files in `dist/release/`, every URL starts with `http://192.168.1.10:8080/`, `webosbrew/apps.json` unchanged by this run.
- [ ] **Step 4: Run** `npm run check` — Expected: green.
- [ ] **Step 5: Commit** `build: npm run release writes the package, manifest and index`.

### Task 4: Guides, version 1.0.0

**Files:**
- Create: `docs/install.md`, `docs/releasing.md`, `CHANGELOG.md`
- Modify: `README.md` (status, Commands, link to the install guide; the existing "Install on a TV" becomes "Install from your own folder (developers)"), `package.json` version `1.0.0`, `webos/appinfo.json` version `1.0.0`

- [ ] **Step 1: Write `docs/install.md`:** what you need (Home Assistant on the same network, its address, a Home Assistant user — recommend making a separate non-admin user for the TV, with the steps); Route A, rooted TV: Homebrew Channel → Settings → Add repository → `https://raw.githubusercontent.com/JayTee-2024/home-assistant-lg/main/webosbrew/apps.json` → install; updates arrive the same way. Route B, developer mode: LG developer account, Developer Mode app, webOS Dev Manager, install the `.ipk` from the Releases page; developer mode lapses after about 50 hours and the app is removed with it, so renew in the Developer Mode app (or Dev Manager). First run: sign in, pick devices, reorganise; what is not supported (locks, alarms, doors and garage doors); how to sign out or change the address. Troubleshooting: "Could not reach" (address, port 8123, TV on the same network), sign-in refused.
- [ ] **Step 2: Write `docs/releasing.md`:** bump the version in `package.json`, add a CHANGELOG entry, `npm run release`, create GitHub release `v<version>` and attach both files from `dist/release/`, then commit and push `webosbrew/apps.json` (after the release exists, so the index never points at a missing file); optional submission to webosbrew/apps-repo with the `packages/net.badacid.homeassistlg.yml` fields; the local TV check with `--base-url` and `npx http-server dist/release -p 8080`.
- [ ] **Step 3: Write `CHANGELOG.md`** with 1.0.0 summarising plans 1–4, bump both versions, update README.
- [ ] **Step 4: Run** `npm run release && npm run check` — Expected: green; `webosbrew/apps.json` says 1.0.0.
- [ ] **Step 5: Commit** `docs: install and release guides; version 1.0.0`.

### Task 5: TV check through Homebrew Channel (needs Simon)

**Files:**
- Create: `docs/tv-checks/2026-11-plan-5.md`

- [ ] **Step 1:** On Simon's PC: `node scripts/release.mjs --base-url http://<PC address>:8080` and `npx http-server dist/release -p 8080`.
- [ ] **Step 2:** Simon adds `http://<PC address>:8080/apps.json` in Homebrew Channel, sees Home Assist LG 1.0.0 with its icon, installs, launches, signs in with the non-admin user. Expected: the app runs as installed by deploy did.
- [ ] **Step 3:** Record the result, remove the local repository from Homebrew Channel, commit `docs: plan 5 TV check`.
