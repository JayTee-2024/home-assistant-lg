# Heating, camera and layout: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Finish the design's foundation stage: heating and camera device types, the "Reorganise layout"
mode, the remaining error states, the Back key, and the guide to adding a device type.

**Architecture:** As plan 2. New logic goes in `src/core` with tests first; new types follow the device-type
recipe; screens are checked in headless Chrome against the stand-in Home Assistant and then on the C9.

**Tech stack:** unchanged (TypeScript 6, Preact 10, esbuild for Chromium 53, Vitest).

**Spec:** `docs/superpowers/specs/2026-11-23-home-assist-lg-design.md`. Earlier results:
`docs/tv-proof-results.md`, `docs/tv-checks/2026-11-plan-2.md`.

**Where this sits:** plan 3 of 5. Plan 4 adds media player, cover, fan and vacuum. Plan 5 packages the app
for other people.

## Global constraints

- Everything in plan 2's Global constraints still holds.
- Heating: − and + change the shown target at once, in the entity's own step, within its own minimum and
  maximum; one change is sent 1.5 seconds after the last press; the panel never polls the thermostat.
- Card sizes: camera large (2×2), climate wide (2×1).
- Covers whose kind is door, garage or gate, locks and alarm panels stay unsupported, and make their whole
  device unsupported (plan 2's ruling).
- No new dependencies.

## Review focus

1. A thermostat whose target is missing, `null`, or outside its own range, or that reports no step, must
   still give working − and + (Task 1).
2. Pressing − or + many times quickly must send one change, with the last value (Task 1).
3. A move in reorganise mode onto a place that does not fit, off the grid, or onto a card of another size
   must be refused without changing the layout (Task 3).
4. A camera whose picture cannot be loaded (Home Assistant down, picture address missing) must show a plain
   placeholder, not a broken-image icon (Task 2).
5. Leaving reorganise mode must remove empty pages without moving any card relative to the others on its
   page (Task 3).

---

### Task 1: The heating type (climate)

**Files:** `src/core/debounce.ts`, `src/core/debounce.test.ts`, `src/devices/climate/` (recipe files),
`src/devices/registry.ts`, `src/devices/registry.test.ts`

**Interfaces:**
- `createDebouncer(run: () => void, ms: number, setTimer, clearTimer): { trigger(): void; flush(): void; cancel(): void }`
  — `trigger` restarts the wait; `run` happens once, `ms` after the last trigger. Timers passed in, as in
  `long-press.ts`.
- `climate/model.ts`: `readClimate(entity): ClimateView` with `isAvailable`, `hvacMode` (the state),
  `hvacAction: string | null`, `currentTemperature`, `targetTemperature`, `minTemp` (default 7),
  `maxTemp` (default 35), `step` (`target_temp_step`, default 0.5), `unit` (`°`), `hvacModes`,
  `presetModes`, `presetMode`, `canSetTarget` (feature bit 1); `stepTarget(view, target: number | null, direction: -1 | 1): number`
  — from the shown target (or current temperature, or the minimum) one step, kept within the range and
  rounded to the step.
- `climate/actions.ts`: `setTarget(entity, temperature)`, `setHvacMode(entity, mode)`,
  `setPreset(entity, preset)`.
- Type: id `climate`, label "Heating", `mainOrder` 20, wide, OK opens the panel, active when `hvac_action`
  is `heating` or `cooling` (else when the mode is not `off`). Summary: "20.5° → 21°".
- Panel: target row (− value +) using the debouncer at 1.5 s, a mode row, a preset row. Card: current
  temperature large, target and mode below.

- [ ] Tests first for the debouncer (once after the last trigger; flush; cancel), the model (Review focus 1),
  `stepTarget`, the actions, and the registry (Tado device now leads with climate, size wide). See them fail;
  implement; `npm run check`; commit `feat: heating type`.

### Task 2: The camera type

**Files:** `src/devices/camera/` (recipe files), `src/devices/device-type.ts`, `src/devices/registry.ts`,
screens that render `Card` and `Panel`

**Interfaces:**
- `CardProps` and `PanelProps` gain `homeAddress: string` (the Home Assistant address), passed down by the
  screens from the saved sign-in.
- `camera/model.ts`: `readCamera(entity): { isAvailable: boolean; picturePath: string | null }` (from
  `entity_picture`); `pictureUrl(homeAddress, picturePath, refreshCount): string | null` — joins them and
  adds `&_=<refreshCount>` (or `?_=`) so the TV fetches a fresh still.
- Type: id `camera`, label "Camera", `mainOrder` 10, large, OK opens the panel, never active, summary null.
- Card: the still, refreshed every 10 seconds; panel: the still full size, refreshed every 2 seconds
  **(my call; the design leaves the interval to the builder)**. A picture that fails to load is replaced
  with a "No picture" placeholder (Review focus 4).
- The stand-in Home Assistant serves `/api/camera_proxy/<entity>` with a small generated image so the screens
  can be checked.

- [ ] Tests first for `readCamera` and `pictureUrl` (no picture; address with and without `?`), the registry
  (doorbell leads with the camera, size large), and the stand-in's picture. Implement; commit
  `feat: camera type`.

### Task 3: Moving cards (core)

**Files:** `src/core/layout.ts`, `src/core/layout.test.ts`

**Interfaces:**
- `moveCard(layout, deviceId, to: { page; column; row }): Layout | null` — the card moves when it fits in free
  cells (its own cells count as free); when the place holds exactly one card of the same size whose top-left
  is that place, the two swap; anything else gives `null` (Review focus 3).
- `removeEmptyPages(layout): Layout` — pages with no cards are dropped and later pages renumbered; positions
  on a page do not change (Review focus 5).

- [ ] Tests first, implement, commit `feat: moving cards between places and pages`.

### Task 4: Reorganise layout mode

**Files:** `src/screens/reorganise/ReorganiseScreen.tsx`, `reorganise.css`, `src/core/reorganise.ts`,
`src/core/reorganise.test.ts`, `src/app/App.tsx`, `src/screens/settings/SettingsScreen.tsx`

- `core/reorganise.ts`: `stepPlace(place, size, direction, pageCount): { page; column; row } | 'new-page'`
  — one cell in the direction; past the left or right edge goes to the neighbouring page (the far edge of
  it); past the last page gives a new page; up and down stop at the grid's edges.
- Reached from Settings ("Reorganise layout" is no longer "Coming soon"). Shows the grid with every empty
  cell outlined and a move marker on each card. Arrows move focus between cards; OK picks the focused card
  up; arrows move it (refused places are shown in red and cannot be dropped on); OK places it; Back puts it
  back. Pointer: press on a card and drag it to a cell, release to drop. "Done" saves and leaves; empty pages
  are removed.

- [ ] Tests first for `stepPlace`. Build the screen. Check in headless Chrome: pick up, move across a page,
  drop, swap two cards, refuse a bad place, drag with the mouse, Done removes an empty page. Commit
  `feat: reorganise layout mode`.

### Task 5: Error states and the Back key

**Files:** `src/screens/home/DeviceCard.tsx`, `home.css`, `src/app/App.tsx`, `src/platform/back.ts`

- While reconnecting: cards dimmed and marked "Last known", OK and panels refuse with the existing message.
- Main part unavailable: the card is greyed and reads "Unavailable"; OK does nothing.
- A card whose device is no longer in Home Assistant reads "No longer in Home Assistant" and "Press OK to
  remove"; OK removes the card.
- Back on the home screen calls the platform's back function (`webOSSystem.platformBack`, or
  `PalmSystem.platformBack`), which shows the Home launcher on webOS 5 and lower and an exit question on 6
  and higher. In a desktop browser it does nothing.

- [ ] Build; check in headless Chrome (stand-in stopped and restarted; an unavailable plug; a removed device);
  commit `feat: error states and the Back key`.

### Task 6: Small fixes carried from plan 2

- Enter (the TV keyboard's Done) submits the sign-in form it is in.
- A wrong long-lived token keeps the token form and what was typed.
- Sign out has a 5-second limit and shows "Signing out…" while it waits.

- [ ] Build; check in headless Chrome; commit `fix: sign-in and sign-out details`.

### Task 7: Documents and the TV run

**Files:** `docs/adding-a-device-type.md`, `README.md`, design document, versions 0.3.0,
`docs/tv-checks/2026-11-plan-3.md`

- The guide walks through the recipe with the climate type as the worked example.
- **Needs Simon:** deploy, then on the TV try heating − and +, the doorbell picture, reorganising, and Back.
- [ ] Commit docs; deploy; record the run; fix what it finds.
