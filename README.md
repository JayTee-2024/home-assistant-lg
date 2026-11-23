# Home Assist LG

An app for LG webOS TVs that controls a Home Assistant home with the TV remote. People add devices to
Home Assistant as usual, then choose on the TV which ones to show as cards on a grid.

The full design is in
[docs/superpowers/specs/2026-11-23-home-assist-lg-design.md](docs/superpowers/specs/2026-11-23-home-assist-lg-design.md).
Read "Readable and extendable code" there before changing anything.

**Status:** early. The project builds a proof screen that tests the TV's browser engine and its route to
Home Assistant. The real app comes next.

## Folder map

```
docs/           the design and the build plans
scripts/        build, development server, packaging, and installing on a TV
src/app/        where the app starts, and the base styles
src/core/       logic with no screen code and no TV code; fully tested
src/platform/   everything specific to the browser or the TV: polyfills, remote keys, network
src/proof/      THROWAWAY: the TV proof screen and its tests, removed when the real app starts
webos/          what the TV needs to know about the app: its ID, name and icons
```

This list grows as folders are added. Every source file starts with a comment saying what it is for.

## Commands

You need [Node.js](https://nodejs.org) 22 or newer.

| Command                | What it does                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm install`          | Downloads the tools. Run once after cloning.                                                                            |
| `npm run check`        | Runs the formatting check, the linter, the type check and the tests. Run before every commit.                           |
| `npm run test`         | Runs the tests only.                                                                                                    |
| `npm run format`       | Rewrites files to the project's formatting.                                                                             |
| `npm run dev`          | Builds the app, rebuilds on every change, and serves it at http://localhost:5173.                                       |
| `npm run build`        | Builds the app once into `dist/app`, the folder that goes on the TV.                                                    |
| `npm run check:bundle` | Confirms the built JavaScript uses no syntax newer than the oldest supported TV understands. Run after `npm run build`. |
| `npm run package`      | Builds the app, runs `check:bundle`, and wraps the app into a `.ipk` file in `dist/`, the format webOS TVs install.     |
| `npm run deploy`       | Runs `npm run package`, then installs the package on a rooted TV and launches it. See "Install on a TV".                |

In a desktop browser the proof screen reports "Sign-in route: helper-service". That is expected: desktop
browsers block the sign-in request that the TV may allow. Only the result on a TV counts.

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
