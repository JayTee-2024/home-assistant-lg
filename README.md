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
scripts/        build and development server (packaging and installing come next)
src/app/        where the app starts, and the base styles
src/core/       logic with no screen code and no TV code; fully tested
src/platform/   everything specific to the browser or the TV: polyfills, remote keys, network
src/proof/      THROWAWAY: the TV proof screen and its tests, removed when the real app starts
```

This list grows as folders are added. Every source file starts with a comment saying what it is for.

## Commands

You need [Node.js](https://nodejs.org) 22 or newer.

| Command                | What it does                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm install`          | Downloads the tools. Run once after cloning.                                                                          |
| `npm run check`        | Runs the formatting check, the linter, the type check and the tests. Run before every commit.                         |
| `npm run test`         | Runs the tests only.                                                                                                  |
| `npm run format`       | Rewrites files to the project's formatting.                                                                           |
| `npm run dev`          | Builds the app, rebuilds on every change, and serves it at http://localhost:5173.                                     |
| `npm run build`        | Builds the app once into `dist/app`, the folder that goes on the TV.                                                  |
| `npm run check:bundle` | Confirms the built JavaScript uses nothing newer than the oldest supported TV understands. Run after `npm run build`. |

In a desktop browser the proof screen reports "Sign-in route: helper-service". That is expected: desktop
browsers block the sign-in request that the TV may allow. Only the result on a TV counts.

## Why some choices look old-fashioned

The oldest TVs this supports (webOS 4, 2018 and 2019 models) run Chromium 53, a browser engine from 2016.
That is why the project uses Preact 10 and not 11, why `tsconfig.json` lists exactly which newer JavaScript
features may be used, and why layouts avoid CSS grid.
