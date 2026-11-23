# Home Assist LG

An app for LG webOS TVs that controls a Home Assistant home with the TV remote. People add devices to
Home Assistant as usual, then choose on the TV which ones to show as cards on a grid.

The full design is in
[docs/superpowers/specs/2026-11-23-home-assist-lg-design.md](docs/superpowers/specs/2026-11-23-home-assist-lg-design.md).
Read "Readable and extendable code" there before changing anything.

**Status:** in progress. You can sign in to Home Assistant, choose devices, see them as cards on a paged
grid, and control lights, switches, plugs, buttons, scenes and scripts with the remote; sensors show their
readings. Heating, cameras, the "Reorganise layout" mode and the remaining device types come next.

## Folder map

```
docs/            the design, the build plans, and what was found when the app ran on a real TV
fixtures/        a made-up Home Assistant home, used by the tests and by the stand-in Home Assistant
scripts/         build, development server, the stand-in Home Assistant, packaging, installing on a TV
src/app/         where the app starts, and the one place the other folders are wired together
src/core/        logic with no screen code and no TV code; fully tested
src/devices/     one folder per device type (light, switch, sensor ...), each with the same files
src/platform/    everything specific to the browser or the TV: polyfills, remote keys, network, storage
src/screens/     what is shown: sign-in, the home screen, a device's panel, Settings
src/test-support/  helpers for the tests; never part of the app
webos/           what the TV needs to know about the app: its ID, name and icons
```

Every source file starts with a comment saying what it is for.

### Layers

The folders under `src` form layers, and each may import only from the ones below it:

```
app        wires everything together
screens    uses devices and core
devices    uses core
core       uses nothing else in src
platform   uses core; only app uses platform
```

So a screen never touches the TV or the network directly: `app` hands it what it needs. The linter
enforces these rules, and `scripts/lint-rules.test.mjs` tests that it does.

### Where to look

| To change...                                 | Look in                                                    |
| -------------------------------------------- | ---------------------------------------------------------- |
| what a device type shows or sends            | `src/devices/<type>/`                                      |
| which Home Assistant entities count as parts | `src/core/devices.ts`                                      |
| where cards go on the grid                   | `src/core/layout.ts`                                       |
| how the arrows move between things           | `src/core/spatial-focus.ts`, `src/screens/shared/focus.ts` |
| the sign-in conversation with Home Assistant | `src/core/sign-in.ts`                                      |
| what is saved on the TV                      | `src/core/saved-state.ts`                                  |
| which screen shows when, and what a key does | `src/app/App.tsx`                                          |

## Commands

You need [Node.js](https://nodejs.org) 22 or newer.

| Command                | What it does                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install`          | Downloads the tools. Run once after cloning.                                                                                                     |
| `npm run check`        | Runs the formatting check, the linter, the type check and the tests. Run before every commit.                                                    |
| `npm run test`         | Runs the tests only.                                                                                                                             |
| `npm run format`       | Rewrites files to the project's formatting.                                                                                                      |
| `npm run dev`          | Builds the app, rebuilds on every change, and serves it at http://localhost:5173.                                                                |
| `npm run dev:home`     | Starts a stand-in Home Assistant at http://localhost:8124 with a made-up home (username `tv`, password `tv`), for developing without a real one. |
| `npm run build`        | Builds the app once into `dist/app`, the folder that goes on the TV.                                                                             |
| `npm run check:bundle` | Confirms the built JavaScript uses no syntax newer than the oldest supported TV understands. Run after `npm run build`.                          |
| `npm run package`      | Builds the app, runs `check:bundle`, and wraps the app into a `.ipk` file in `dist/`, the format webOS TVs install.                              |
| `npm run deploy`       | Runs `npm run package`, then installs the package on a rooted TV and launches it. See "Install on a TV".                                         |

## Run it in a browser

No TV and no Home Assistant are needed to work on the app.

1. `npm run dev:home` starts a stand-in Home Assistant with the made-up home from `fixtures/`.
2. `npm run dev` builds the app and serves it at http://localhost:5173.
3. Open that address in Chrome or Edge. The app first looks for `homeassistant.local:8123`; when that
   fails, type `localhost:8124` as the address, then sign in as `tv` with password `tv`.

On a keyboard, the arrow keys and Enter stand in for the remote, and Escape is Back. Hold Enter on a card
to open its panel.

A real Home Assistant refuses the sign-in from a desktop browser (it only accepts it from the TV app, or
from its own pages). To use a real one from the desktop, choose "Advanced: use an access token" on the
sign-in screen and paste a long-lived access token from your Home Assistant profile page.

## Install on a TV

This is the development route. It needs a TV that is rooted with
[Homebrew Channel](https://www.webosbrew.org) and has its SSH server switched on, because it signs in to
the TV as root. Installing on an ordinary TV will be covered separately.

1. Copy `.env.local.example` to `.env.local`.
2. In `.env.local`, set `TV_HOST` to the TV's address and `TV_SSH_KEY` to the full path of the private SSH
   key the TV accepts for root. This file stays on your computer and is never committed.
3. Run `npm run deploy`. It builds and packages the current code first, so the TV always gets what is in
   your folder.

The deploy then copies the package to the TV, asks the TV's own install service to install it, and launches the
app. It finishes with "Installed and launched." If it says it could not reach the TV, check the TV is
switched on: most TVs drop off the network in standby.

## Why some choices look old-fashioned

The oldest TVs this supports (webOS 4, 2018 and 2019 models) run Chromium 53, a browser engine from 2016.
That is why the project uses Preact 10 and not 11, why `tsconfig.json` lists exactly which newer JavaScript
features may be used, and why layouts avoid CSS grid.

Three checks guard this, and each covers one thing only:

- **The type check** rejects JavaScript functions newer than Chromium 53 has (for example `Array.at`), unless
  a polyfill for them is listed in `src/platform/polyfills.ts`.
- **`npm run check:bundle`** rejects newer syntax in the built file.
- **The linter** rejects a list of browser features Chromium 53 lacks, such as `AbortController` and
  `ResizeObserver`. The list is in `eslint.config.mjs` and covers the common traps, not everything.

No check covers every browser feature. Before using one that this project does not use yet, look it up for
Chrome 53 on [caniuse.com](https://caniuse.com) and try it on a TV.
