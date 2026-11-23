# Sign in and control devices: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** A person can sign in to their Home Assistant on the TV, choose devices, see them as cards on a paged
grid, and control lights, switches, sensors, binary sensors and buttons with the remote.

**Architecture:** Pure logic in `src/core` (Home Assistant data to devices and parts, layout, focus movement,
sign-in steps, saved state), one folder per device type in `src/devices`, screens in `src/screens`, and
everything browser- or TV-specific in `src/platform`. The live connection uses the official
`home-assistant-js-websocket` library behind a small interface, so screens and tests never touch it directly.

**Tech stack:** TypeScript 6, Preact 10, esbuild (target Chromium 53), Vitest, `home-assistant-js-websocket`
9.9, `ws` 8 (development only, for the stand-in Home Assistant).

**Spec:** `docs/superpowers/specs/2026-11-23-home-assist-lg-design.md`. Facts from the TV proof:
`docs/tv-proof-results.md`.

**Where this sits:** the design's stage 2 ("Foundation") is delivered in two plans, so that a working app
reaches the TV sooner. This is plan 2 of 5. Plan 3 finishes the foundation: reorganise mode, climate, camera,
the remaining error states, and the two guides. Plans 4 and 5 are the design's stages 3 and 4.

## Global constraints

- Sign-in route is `direct`: the app makes the sign-in requests itself. No helper service.
- Build target Chromium 53: no CSS grid, no `AbortController`, no pointer events. Flexbox and absolute
  positioning only. The lint rules and `check:bundle` must pass.
- The password is never stored. Only the address, the tokens and the layout are saved, on the TV only.
- Locks, alarms, and covers whose kind is a door, garage or gate are never controllable. They show
  "Not supported yet".
- The app contacts nothing except the user's Home Assistant.
- Layers: `core` imports from no other `src` folder. `devices` imports only `core`. `screens` imports `core`
  and `devices`. Only `platform` touches the browser's network, storage or webOS. `app` wires them together.
- Every file starts with a header comment: what it is for and what it does not do. No `any`. Plain code,
  full-word names, the design's vocabulary (device, part, card, panel, page).
- Grid is 6 columns by 3 rows. Card sizes: large 2×2, wide 2×1, small 1×1.
- Look: background `#0E1116`, amber `#FFB454` for "on", white outline for remote focus, sizes in `rem`
  (1rem = 1/120 of the screen width).
- Commits end with the two attribution lines used throughout this repository.
- `npm run check` passes before every commit.

## Review focus

Conditions the spec implies but does not spell out, most likely first. Each has a test in the task named.

1. Saved data that is corrupt, empty or from another version must lead to the sign-in screen, not a crash
   (Task 6).
2. An entity with attributes missing or in an unexpected form (a light with no brightness, a sensor whose
   state is `unavailable` or `unknown`) must still produce a card (Tasks 10 and 11).
3. A device with no name, with every entity disabled or hidden, or with only unsupported entities, must be
   handled by the picker's rules without error (Task 3).
4. A sign-in flow that Home Assistant has forgotten (it restarts, or the person waits too long) must restart
   with a clear message, not show a raw error (Task 7).
5. A saved layout that refers to a device Home Assistant no longer has, or whose size changed, must not
   break the grid (Tasks 4 and 13).

---

### Task 1: Layer rules, shared HTTP types, and dependencies

**Files:**
- Create: `src/core/http.ts`, `src/core/http.test.ts`
- Modify: `src/platform/http.ts`, `src/platform/keys.ts`, `src/platform/keys.test.ts`, `src/proof/probe.ts`,
  `src/proof/probe.test.ts`, `eslint.config.mjs`, `scripts/lint-rules.test.mjs`, `package.json`,
  `tsconfig.json`

**Interfaces:**
- Produces, in `src/core/http.ts`:
  - `interface HttpRequest { method: 'GET' | 'POST'; url: string; jsonBody?: unknown; formBody?: { [name: string]: string }; opaque?: boolean }`
  - `interface HttpAnswer { status: number; body: string }`
  - `type HttpSend = (request: HttpRequest) => Promise<HttpAnswer>`
  - `function withTimeout(send: HttpSend, timeoutMs: number): HttpSend` — the returned sender rejects with
    `new Error('timeout')` when no answer arrives in time; a late answer is ignored.
- `src/platform/http.ts` keeps `fetchSend`, now importing the types from core, and sends `formBody` as
  `application/x-www-form-urlencoded` (built with `encodeURIComponent`, not `URLSearchParams` as a body).

- [ ] **Step 1: Failing tests**
  - `scripts/lint-rules.test.mjs`: a `src/core/` file importing `'../platform/http'`, `'../devices/x'`,
    `'../screens/x'` or `'../app/x'` breaks `no-restricted-imports`; a `src/devices/` file importing
    `'../../screens/x'`, `'../../platform/x'` or `'../../app/x'` breaks it; a `src/devices/` file importing
    `'../../core/x'` breaks nothing.
  - `src/core/http.test.ts`: `withTimeout` passes an answer through; rejects with `timeout` after the time
    (fake timers, checked at `timeoutMs - 1` and `timeoutMs`); passes a rejection through.
  - `src/platform/keys.test.ts`: key code 8 (Backspace) gives `null`; 27 (Escape) still gives `back`.
- [ ] **Step 2: Run them, see them fail.** `npx vitest run scripts/lint-rules.test.mjs src/core/http.test.ts src/platform/keys.test.ts`
- [ ] **Step 3: Implement.** Move the types, add `withTimeout`, add the two lint blocks, remove key 8 with a
  comment saying why (Backspace in a text field must never mean Back).
- [ ] **Step 4: Dependencies.** `npm install home-assistant-js-websocket@^9.9.0` and
  `npm install --save-dev ws@^8`. Add `"resolveJsonModule": true` to `tsconfig.json`.
- [ ] **Step 5:** `npm run check` → passes. Commit: `chore: layer rules, shared HTTP types, and the connection library`

### Task 2: Home Assistant data types and the sample home

**Files:**
- Create: `src/core/home-assistant.ts`, `src/core/home-assistant.test.ts`, `fixtures/sample-home.json`,
  `fixtures/README.md`

**Interfaces (produces):**
```ts
export interface EntityState { entity_id: string; state: string; attributes: { [name: string]: unknown } }
export interface RegistryEntity {
  entity_id: string; device_id: string | null; area_id: string | null;
  disabled_by: string | null; hidden_by: string | null;
  entity_category: string | null; name: string | null; original_name: string | null;
}
export interface RegistryDevice {
  id: string; name: string | null; name_by_user: string | null;
  area_id: string | null; disabled_by: string | null;
}
export interface RegistryArea { area_id: string; name: string }
export interface HomeSnapshot {
  states: { [entityId: string]: EntityState };
  entities: RegistryEntity[]; devices: RegistryDevice[]; areas: RegistryArea[];
}
export const EMPTY_HOME: HomeSnapshot;
export function domainOf(entityId: string): string;               // 'light.kitchen' → 'light'
export function isAvailable(entity: EntityState): boolean;        // false for 'unavailable' and 'unknown'
export function readNumber(entity: EntityState, name: string): number | null;   // null unless a finite number
export function readText(entity: EntityState, name: string): string | null;     // null unless a string
export function readTextList(entity: EntityState, name: string): string[];      // [] unless an array; keeps strings only
export function hasFeature(entity: EntityState, bit: number): boolean;          // supported_features & bit
```

`fixtures/sample-home.json` has the shape `{ states: EntityState[], entities, devices, areas, user: { name } }`
and mirrors the kinds of device Simon has: two LIFX colour bulbs and a white-only dimmable bulb, two smart
plugs (each with a diagnostic signal-strength sensor), a Tado thermostat (climate, temperature and humidity
sensors, a battery sensor marked diagnostic), a Ring doorbell (camera, a "ding" binary sensor, a motion binary
sensor, a battery sensor), a front-door lock, a garage-door cover, a scene and a script with no device, an
`input_boolean` helper, a disabled entity, a hidden entity, a device with no supported entity, a device with
no name, and three areas plus things with no area. `fixtures/README.md` says the file was written from Home
Assistant's entity documentation, not recorded, and should be replaced by a recording when one exists.

- [ ] **Step 1: Failing tests** for `domainOf`, `isAvailable`, `readNumber` (number, numeric text is not a
  number, missing, `NaN`), `readText`, `readTextList` (mixed array keeps strings only; a string is not a list),
  `hasFeature` (missing attribute means no features), and one test that loads the fixture and checks every
  state has a registry entry or is deliberately loose (the scene, the script).
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: Home Assistant data types and a sample home`

### Task 3: Devices and parts

**Files:**
- Create: `src/core/part-type.ts`, `src/core/devices.ts`, `src/core/devices.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces:
```ts
// part-type.ts
export type CardSize = 'small' | 'wide' | 'large';
/** What the core needs to know about a device type. src/devices adds the card and panel. */
export interface PartType {
  id: string;                    // 'light'
  domains: string[];             // Home Assistant entity types it covers: ['light']
  mainOrder: number;             // lower wins when choosing a device's main part
  cardSize: CardSize;
  supports(entity: EntityState): boolean;   // false for, say, a cover that is a garage door
}
// devices.ts
export interface Part { entityId: string; typeId: string; name: string }
export interface Device {
  id: string;                    // 'device:<registry id>' or 'entity:<entity id>'
  name: string;
  roomName: string | null;
  parts: Part[];                 // supported parts only, main part first
  mainPart: Part | null;         // null when nothing is supported
  cardSize: CardSize | null;
}
export interface Room { name: string; devices: Device[] }
export const NO_ROOM = 'No room';
export function buildDevices(home: HomeSnapshot, partTypes: PartType[]): Device[];
export function groupByRoom(devices: Device[]): Room[];   // rooms by name, 'No room' last; devices by name
export function findDevice(devices: Device[], id: string): Device | null;
```

Rules for `buildDevices`, each with a test:
1. Entities whose registry entry has `disabled_by` or `hidden_by` set are ignored. Devices with `disabled_by`
   set are ignored.
2. Entities with `entity_category` `config` or `diagnostic` are left out, except a `sensor` whose
   `device_class` attribute is `battery`.
3. An entity belongs to a part type when its domain is in `domains` and `supports(entity)` is true. An entity
   in the registry with no state yet is skipped.
4. A registry device becomes one `Device` with its supported parts. Main part: lowest `mainOrder`; ties go
   to the first by name. `cardSize` is the main part's type's size.
5. A registry device with no supported part is still returned, with `parts: []` and `mainPart: null`.
6. An entity with no device (registry `device_id` null, or not in the registry at all) becomes a `Device` of
   its own with id `entity:<entity id>`, but only when its domain belongs to some part type **or** is in
   `ALWAYS_LISTED_DOMAINS = ['lock', 'alarm_control_panel', 'cover']`. Other loose entities (automations,
   zones, people) are not listed. **(my call: listing every unsupported loose entity would bury the picker)**
7. Names: entity = registry `name`, else `original_name`, else the `friendly_name` attribute, else the entity
   id. Device = `name_by_user`, else `name`, else its first part's name, else `'Unnamed device'`.
8. Room: the device's area; for a loose entity, the entity's area. Unknown area ids give `null`.

- [ ] **Step 1: Failing tests**, one per rule, using two small test part types defined in the test file
  (a `light` type, and a `cover` type whose `supports` refuses `device_class: 'garage'`), plus `groupByRoom`
  order and `findDevice`. Include the Review focus 3 cases.
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: devices and parts from Home Assistant data`

### Task 4: Layout and pages

**Files:**
- Create: `src/core/layout.ts`, `src/core/layout.test.ts`

**Interfaces (produces):**
```ts
export const GRID_COLUMNS = 6;
export const GRID_ROWS = 3;
export interface CardPlace { deviceId: string; page: number; column: number; row: number; size: CardSize }
export interface Layout { cards: CardPlace[] }
export const EMPTY_LAYOUT: Layout;
export function cellsOf(size: CardSize): { columns: number; rows: number };   // small 1×1, wide 2×1, large 2×2
export function pageCount(layout: Layout): number;                             // highest page + 1, at least 1
export function cardsOnPage(layout: Layout, page: number): CardPlace[];
export function hasCard(layout: Layout, deviceId: string): boolean;
export function addCard(layout: Layout, deviceId: string, size: CardSize): Layout;
export function removeCard(layout: Layout, deviceId: string): Layout;          // leaves the gap
export function withCurrentSizes(layout: Layout, sizeOf: (deviceId: string) => CardSize | null): Layout;
```
- `addCard` scans pages in order, each page row by row then column by column, and uses the first place where
  the whole card fits in free cells; if no page has room it uses the top-left of a new page. Adding a device
  already present changes nothing. No function mutates its argument.
- `withCurrentSizes` handles Review focus 5: a card whose device's size changed is removed and added again
  at its new size; a card whose `sizeOf` is `null` (device gone or unsupported) is kept as it is.

- [ ] **Step 1: Failing tests:** empty layout has one page; first card at page 0, column 0, row 0; a small
  card fills the gap beside a wide card; a large card that does not fit the remaining cells goes to the next
  place it fits; a full page sends the next card to page 1; removing leaves the gap and a later add fills it;
  adding twice is a no-op; the argument is not mutated; `withCurrentSizes` both cases.
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: card layout on a paged grid`

### Task 5: Focus movement and the long press

**Files:**
- Create: `src/core/spatial-focus.ts`, `src/core/spatial-focus.test.ts`, `src/core/long-press.ts`,
  `src/core/long-press.test.ts`

**Interfaces (produces):**
```ts
// spatial-focus.ts
export type Direction = 'up' | 'down' | 'left' | 'right';
export interface Box { left: number; top: number; width: number; height: number }
/** The index in `candidates` of the best box to move to from `from`, or null when there is none. */
export function nextInDirection(from: Box, candidates: Box[], direction: Direction): number | null;
// long-press.ts
export const LONG_PRESS_MS = 600;
export interface LongPress { keyDown(isRepeat: boolean): void; keyUp(): 'short' | 'long' | 'none'; cancel(): void }
export function createLongPress(onLong: () => void, setTimer: (run: () => void, ms: number) => number, clearTimer: (id: number) => void): LongPress;
```
- `nextInDirection`: a candidate qualifies when its centre lies beyond `from`'s centre in the direction, and
  it is not `from` itself. Among those, prefer candidates that overlap `from` on the other axis (same row for
  left and right, same column for up and down), then the smallest distance along the direction, then the
  smallest distance across it.
- `createLongPress`: the first `keyDown` starts the timer; repeats are ignored. If the timer fires, `onLong`
  runs once and the following `keyUp` returns `'long'`. A `keyUp` before that returns `'short'`. `keyUp` with
  no `keyDown` returns `'none'`.

- [ ] **Step 1: Failing tests.** Focus: a 3×2 arrangement of equal boxes moves as expected in all four
  directions; nothing to the left gives `null`; a box in the same row beats a nearer box in another row; a
  wide box above two small ones is reached from either; `from` in the candidate list is never chosen.
  Long press: short, long (with fake timers passed in), repeat ignored, cancel stops `onLong`, `none`.
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: focus movement by position, and long-press detection`

### Task 6: What is saved

**Files:**
- Create: `src/core/saved-state.ts`, `src/core/saved-state.test.ts`, `src/platform/storage.ts`

**Interfaces (produces):**
```ts
// saved-state.ts
export interface SavedSignIn {
  address: string;                       // 'http://192.168.1.100:8123'
  kind: 'account' | 'long-lived-token';
  accessToken: string;
  refreshToken: string;                  // '' for a long-lived token
  expiresAt: number;                     // milliseconds since 1970; 0 for a long-lived token
}
export interface SavedState { signIn: SavedSignIn | null; layout: Layout; layoutAddress: string | null }
export const EMPTY_SAVED_STATE: SavedState;
export function parseSavedState(text: string | null): SavedState;   // never throws
export function serialiseSavedState(state: SavedState): string;     // JSON with "version": 1
export function afterSignIn(state: SavedState, signIn: SavedSignIn): SavedState;
export function afterSignOut(state: SavedState): SavedState;
// storage.ts
export function readSavedText(): string | null;
export function writeSavedText(text: string): void;
```
- `parseSavedState` returns `EMPTY_SAVED_STATE` for `null`, text that is not JSON, a different `version`, or a
  wrong shape. A layout card with a bad field is dropped; the rest is kept.
- `afterSignIn` keeps the layout when `signIn.address` equals `layoutAddress`, and clears it otherwise; it
  sets `layoutAddress` to the new address. `afterSignOut` removes `signIn` and keeps the layout.
- `storage.ts` uses `localStorage` under the key `home-assist-lg`, inside `try`/`catch`: a read that fails
  gives `null`, a write that fails is ignored. It is not unit-tested (it is three lines around the browser).

- [ ] **Step 1: Failing tests:** round trip; each bad-input case (Review focus 1); bad card dropped;
  `afterSignIn` same address and different address; `afterSignOut`; the password can never be saved (the
  type has no field for it, and the serialised text of a state contains only the documented keys).
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: saved sign-in and layout`

### Task 7: Sign-in steps

**Files:**
- Create: `src/core/sign-in.ts`, `src/core/sign-in.test.ts`

**Interfaces:**
- Consumes: `HttpSend` (Task 1), `CLIENT_ID` (`src/core/client-id.ts`), `SavedSignIn` (Task 6).
- Produces:
```ts
export type SignInStep =
  | { kind: 'credentials'; flowId: string; message: string | null }   // show the username and password form
  | { kind: 'code'; flowId: string; message: string | null }          // show the two-step code form
  | { kind: 'signed-in'; signIn: SavedSignIn }
  | { kind: 'cannot-reach'; message: string }                          // nothing answered at the address
  | { kind: 'not-home-assistant'; message: string }                    // something answered, but not Home Assistant
  | { kind: 'failed'; message: string };                               // Home Assistant refused; message is its reason
export function beginSignIn(send: HttpSend, address: string): Promise<SignInStep>;
export function submitCredentials(send: HttpSend, address: string, flowId: string, username: string, password: string, now: number): Promise<SignInStep>;
export function submitCode(send: HttpSend, address: string, flowId: string, code: string, now: number): Promise<SignInStep>;
export function signInWithToken(address: string, token: string): SavedSignIn;
```
Home Assistant's messages (check against the current developer documentation while implementing):
- `POST <address>/auth/login_flow` with JSON `{ client_id, handler: ['homeassistant', null], redirect_uri: client_id }`
  answers `{ type: 'form', flow_id, step_id: 'init' }`.
- `POST <address>/auth/login_flow/<flow_id>` with JSON `{ client_id, username, password }` or
  `{ client_id, code }` answers one of: `{ type: 'create_entry', result: '<code>' }`;
  `{ type: 'form', step_id: 'init', errors: { base: 'invalid_auth' } }` (stay on credentials);
  `{ type: 'form', step_id: 'mfa', errors? }` (ask for the code; `errors.base: 'invalid_code'` stays on it);
  `{ type: 'abort', reason }`.
- `POST <address>/auth/token` with form fields `grant_type=authorization_code`, `code`, `client_id` answers
  `{ access_token, refresh_token, expires_in }`; `expiresAt = now + expires_in * 1000`.
- Error texts shown to the person: `invalid_auth` → "Invalid username or password"; `invalid_code` →
  "Invalid authentication code"; any other key is shown as it is.
- HTTP 404 on a flow step (Home Assistant forgot the flow) → a new flow is begun and the step returned is
  `credentials` with the message "Sign-in took too long. Please try again." (Review focus 4).
- A rejected `send` → `cannot-reach`. A status below 400 whose body is not the expected JSON →
  `not-home-assistant`. Status 400 or above → `failed` with the body's `message` field when present.

- [ ] **Step 1: Failing tests,** one per bullet above, with a stand-in `send` that records requests: the
  three request shapes are asserted exactly (URL, method, body), then every answer case.
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: Home Assistant sign-in steps`

### Task 8: A stand-in Home Assistant for development

**Files:**
- Create: `scripts/lib/fake-home.mjs`, `scripts/lib/fake-home.test.mjs`, `scripts/fake-home-assistant.mjs`
- Modify: `package.json` (script `"dev:home": "node scripts/fake-home-assistant.mjs"`), `README.md`

**Interfaces (produces):**
```js
// fake-home.mjs — no network in this file
export function createFakeHome(sampleHome)   // returns the object below
//   handleHttp({ method, path, body })      → { status, json }           the three /auth routes
//   openSocket(sendToClient)                → { receive(message) }       one WebSocket session
//   states()                                → current EntityState[]
export const FAKE_USERNAME = 'tv'; export const FAKE_PASSWORD = 'tv';
```
- HTTP: `/auth/providers`, `/auth/login_flow`, `/auth/login_flow/<id>` (wrong password gives
  `invalid_auth`; unknown flow id gives 404), `/auth/token` (authorization code and refresh grants),
  `/auth/revoke`.
- WebSocket, as Home Assistant 2026.11 speaks it: `auth_required` first; `auth` with a valid access token
  gives `auth_ok`, otherwise `auth_invalid`; then `supported_features`, `subscribe_entities` (compressed
  format: first event `{ a: { <entity id>: { s, a, c, lc } } }`, later changes `{ c: { <entity id>: { '+': { s, a } } } }`),
  `config/entity_registry/list`, `config/device_registry/list`, `config/area_registry/list`,
  `auth/current_user`, `subscribe_events`, `ping`, and `call_service` for `turn_on`, `turn_off`, `toggle` on
  lights, switches and input booleans (with `brightness_pct`, `color_temp_kelvin`, `rgb_color`), and `press`
  / `turn_on` for buttons, scenes and scripts. Unknown commands answer `unknown_command`.
- `scripts/fake-home-assistant.mjs` serves it on port 8124 with `node:http` and `ws`, loads
  `fixtures/sample-home.json`, answers CORS preflights so a desktop browser can sign in, and prints the
  address, username and password. It also changes the Tado temperature sensor every 10 seconds so live
  updates can be seen.

- [ ] **Step 1: Failing tests** against `createFakeHome`: sign-in happy path end to end (flow, credentials,
  token); wrong password; unknown flow 404; socket rejects a bad token; `subscribe_entities` sends every
  state once; `call_service` `light.toggle` flips the state and sends a change event to subscribers;
  registries answer with the fixture's lists.
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: a stand-in Home Assistant for development`

### Task 9: The live connection

**Files:**
- Create: `src/core/home-connection.ts`, `src/platform/home-assistant-connection.ts`,
  `scripts/home-connection.test.mjs`

**Interfaces:**
- Produces:
```ts
// core/home-connection.ts — interface only
export interface ServiceCall { domain: string; service: string; entityId: string; data: { [name: string]: unknown } }
export type ConnectionStatus = 'connected' | 'reconnecting' | 'sign-in-rejected';
export interface HomeConnection {
  userName: string;
  onHome(listener: (home: HomeSnapshot) => void): void;      // called at once with the current data, then on every change
  onStatus(listener: (status: ConnectionStatus) => void): void;
  call(call: ServiceCall): Promise<void>;                     // rejects with Error(Home Assistant's reason)
  signOut(): Promise<void>;                                   // cancels the refresh token; never rejects
  close(): void;
}
export type OpenFailure = 'cannot-reach' | 'sign-in-rejected';
// platform/home-assistant-connection.ts
export function openHomeConnection(signIn: SavedSignIn, onTokens: (signIn: SavedSignIn) => void): Promise<HomeConnection>;
// rejects with Error whose message is an OpenFailure
```
- Uses the library's `Auth` (or `createLongLivedTokenAuth`), `createConnection`, `subscribeEntities`,
  `callService`, `getUser`, and `connection.sendMessagePromise` for the three registry lists. The registries
  are fetched again, at most once a second, when `entity_registry_updated`, `device_registry_updated` or
  `area_registry_updated` events arrive.
- `scripts/home-connection.test.mjs` starts the fake home on a free port and drives the bundled connection
  code against it. Because the connection file is TypeScript for the browser, the test builds it with
  esbuild (`platform: 'node'`, `format: 'esm'`, to a temporary file) and imports the result.

- [ ] **Step 1: Failing test:** open with a signed-in account → `userName` is the fixture's user; `onHome`
  delivers states, entities, devices and areas; `call` with `light.toggle` leads to a second `onHome` with
  the light's state changed; a wrong access token with no refresh token rejects with `sign-in-rejected`; an
  address where nothing listens rejects with `cannot-reach`.
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: live connection to Home Assistant`

### Task 10: Device types: the recipe, switch and light

**Files:**
- Create: `src/devices/device-type.ts`, `src/devices/registry.ts`, `src/devices/registry.test.ts`,
  `src/devices/shared/` (`CardFrame.tsx`, `controls.tsx`, `devices.css`),
  `src/devices/switch/` and `src/devices/light/`, each with `index.ts`, `model.ts`, `actions.ts`,
  `Card.tsx`, `Panel.tsx`, `<type>.test.ts`

**Interfaces:**
- Consumes: `PartType`, `EntityState`, `ServiceCall`.
- Produces:
```ts
// device-type.ts
/** One user action: what to send, and what the entity should look like at once, before Home Assistant confirms. */
export interface Action { call: ServiceCall; predicted: EntityState }
export interface CardProps { entity: EntityState; name: string }
export interface PanelProps { entity: EntityState; name: string; run(action: Action): void }
export interface DeviceType extends PartType {
  /** What OK does on the card. null: OK opens the panel. */
  okAction(entity: EntityState): Action | 'open-panel' | 'nothing';
  /** One short line for the card when this type is a secondary part, e.g. '21.5 °C'. null: not shown. */
  summary(entity: EntityState): string | null;
  Card: ComponentType<CardProps>;
  Panel: ComponentType<PanelProps>;
}
// registry.ts
export const DEVICE_TYPES: DeviceType[];
export function deviceTypeFor(typeId: string): DeviceType | null;
```
- `switch` covers `switch` and `input_boolean`; `mainOrder` 80; small; OK toggles.
  `actions.ts`: `toggle(entity): Action` → service `toggle` in the entity's own domain; predicted state is
  the opposite of `on`/`off`.
- `light`: `mainOrder` 50; small; OK toggles.
  `model.ts`: `readLight(entity): LightView` with `isOn`, `brightnessPercent: number | null` (from
  `brightness` 0–255, rounded, at least 1 when on), `canDim`, `canSetWhite`, `canSetColour` (from
  `supported_color_modes`: `brightness` or any colour mode → dim; `color_temp` → white; `hs`, `xy`, `rgb`,
  `rgbw`, `rgbww` → colour), `whiteKelvin`, `minKelvin`, `maxKelvin`, `rgb: [number, number, number] | null`,
  `effects: string[]`, `effect: string | null`.
  `actions.ts`: `toggle`, `setBrightness(entity, percent)` (`light.turn_on` with `brightness_pct`, clamped
  1–100), `setWhite(entity, kelvin)` (`color_temp_kelvin`, clamped to the entity's range),
  `setColour(entity, rgb)` (`rgb_color`), `setEffect(entity, effect)`.
  Panel: on/off, a brightness row (− / +, 10% steps), a white row (warm to cool in five steps) when
  supported, twelve preset colours when supported, an effects list when the entity lists any. Every control
  is a focusable button, so it works with the arrows and the pointer.
- The registry lists the types in `mainOrder`. Its test asserts: ids are unique; no two types claim the same
  domain; `deviceTypeFor` finds each; and, with the sample home, `buildDevices` gives the LIFX bulb a light
  main part and marks the lock and the garage door as having no supported part.

- [ ] **Step 1: Failing tests** in `switch.test.ts`, `light.test.ts`, `registry.test.ts`: model and actions
  for each sample entity, plus Review focus 2 (a light with no `brightness` and no colour modes; an
  `unavailable` light: `okAction` is `'nothing'`).
- [ ] **Step 2:** run, see fail. **Step 3:** implement logic, then the components. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: the device type recipe, with switch and light`

### Task 11: Device types: sensor, binary sensor and button

**Files:**
- Create: `src/devices/sensor/`, `src/devices/binary-sensor/`, `src/devices/button/`, each with the recipe's
  files
- Modify: `src/devices/registry.ts`, `src/devices/registry.test.ts`

- `sensor`: `mainOrder` 100; small; OK does nothing. `readSensor(entity)` gives `{ reading: string, unit: string | null }`;
  numeric readings keep Home Assistant's own text; `unavailable` and `unknown` read "Unavailable" and
  "Unknown". `summary` is reading and unit.
- `binary_sensor`: `mainOrder` 110; small; OK does nothing. `readBinarySensor(entity)` gives
  `{ isOn: boolean, words: string }` from `device_class`: door, window, opening, garage_door → Open/Closed;
  motion, occupancy, presence → Detected/Clear; battery → Low/Normal; connectivity → Connected/Disconnected;
  moisture → Wet/Dry; smoke, gas, problem, safety → Detected/Clear; lock → Unlocked/Locked; anything else →
  On/Off.
- `button` covers `button`, `input_button`, `scene` and `script`; `mainOrder` 90; small; OK presses.
  `press(entity): Action`: `button.press`, `input_button.press`, `scene.turn_on`, `script.turn_on`; the
  predicted state is unchanged.

- [ ] **Step 1: Failing tests** for each model and action, including every word pair and Review focus 2.
- [ ] **Step 2:** run, see fail. **Step 3:** implement. **Step 4:** `npm run check`.
- [ ] **Step 5:** Commit: `feat: sensor, binary sensor and button types`

### Task 12: The app shell and the sign-in screen

**Files:**
- Create: `src/app/App.tsx`, `src/app/app.css` (replace), `src/screens/shared/TitleBar.tsx`,
  `src/screens/shared/focus.ts`, `src/screens/shared/shared.css`, `src/screens/sign-in/SignInScreen.tsx`,
  `src/screens/sign-in/sign-in.css`, `src/platform/close-app.ts`
- Modify: `src/app/main.tsx`, `src/platform/keys.ts` (nothing new expected), `eslint.config.mjs` (screens
  may not import `app`)
- Delete: `src/proof/` and `src/platform/websocket.ts`

**Interfaces:**
- `focus.ts`: `moveFocus(scope: HTMLElement, direction: Direction): boolean` — collects the visible,
  enabled elements matching `button, input, [data-focusable]` inside `scope`, and focuses the one
  `nextInDirection` picks; returns false when there is none. `focusFirst(scope: HTMLElement): void`.
- `close-app.ts`: `closeApp(): void` (`window.close()`, proven on the C9).
- `App.tsx` holds the app's state: `'starting' | 'signed-out' | 'connecting' | 'home'`, the saved state, the
  connection, the latest `HomeSnapshot`, and which overlay is open. It owns the one `keydown` listener:
  arrows call `moveFocus` on the top-most scope; Back closes the top-most overlay.
- Sign-in screen, as in the mockup: the "Before you start" note; the address (shown, with "Change"); username
  and password fields; "Sign in"; an "Advanced" link that swaps the form for a single long-lived token field;
  the two-step code field when Home Assistant asks; errors shown under the form. On start-up with no saved
  sign-in the app tries `DEFAULT_ADDRESS` and, if that cannot be reached, opens the address field with focus.

- [ ] **Step 1:** Add the lint test (a `src/screens/` file importing `'../../app/x'` breaks the rule), see it
  fail, add the rule.
- [ ] **Step 2:** Build the shell, title bar, focus helper and sign-in screen. Delete the proof.
- [ ] **Step 3:** `npm run check`, `npm run build`, `npm run check:bundle`.
- [ ] **Step 4:** With `npm run dev` and `npm run dev:home`, open the app in headless Chrome at 1920×1080,
  sign in to the stand-in home with `tv` / `tv`, and take screenshots of: the sign-in screen, a wrong-password
  error, and the screen after sign-in. Expected: they match the mockup's layout and the error text is
  "Invalid username or password".
- [ ] **Step 5:** Commit: `feat: app shell and sign-in screen`

### Task 13: The home screen

**Files:**
- Create: `src/screens/home/HomeScreen.tsx`, `CardGrid.tsx`, `DeviceCard.tsx`, `PageDots.tsx`, `home.css`,
  `src/screens/panel/PanelOverlay.tsx`, `panel.css`, `src/screens/shared/Toast.tsx`,
  `src/core/pending-states.ts`, `src/core/pending-states.test.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- `pending-states.ts` (instant feedback):
```ts
export interface PendingStates { [entityId: string]: { state: EntityState; since: number } }
export const PENDING_LIMIT_MS = 5000;
export function withPending(pending: PendingStates, predicted: EntityState, now: number): PendingStates;
export function withoutPending(pending: PendingStates, entityId: string): PendingStates;
export function settle(pending: PendingStates, previous: HomeSnapshot, next: HomeSnapshot, now: number): PendingStates;
export function applyPending(home: HomeSnapshot, pending: PendingStates): HomeSnapshot;
```
  `settle` drops a pending entry when Home Assistant's state for that entity changed between `previous` and
  `next`, or when it is older than `PENDING_LIMIT_MS`. `applyPending` returns the home with pending states
  laid over the real ones.
- Home screen: the title bar; the current page's cards placed absolutely from their grid coordinates; page
  dots when there is more than one page; arrow buttons at the left and right edges for the pointer; with no
  cards, "No devices yet" and an "Add devices" button that opens Settings.
- A card shows the device name, the main part's `Card`, and up to two `summary` lines from other parts. A
  card whose device is not in the current data shows the name it was saved without and "Not available"
  (Review focus 5); plan 3 turns this into the proper "removed" card.
- Remote: arrows move between cards by position; left or right with nothing that way flips the page and
  focuses the nearest card on the new page; up from the top row goes to the title bar. A short OK runs the
  main part's `okAction`; a long OK, or OK on a type whose action is `'open-panel'`, opens the panel. Back on
  the home screen does nothing in this plan.
- Panel overlay: the device name and, for each part, its name and `Panel`. Back or the overlay's close
  button closes it. Focus returns to the card.
- A failed command shows a toast at the bottom with Home Assistant's reason for four seconds and removes the
  pending state, so the card returns to the real state.

- [ ] **Step 1: Failing tests** for `pending-states.ts`: add, apply, settle on change, settle on age,
  unrelated entity untouched, remove on failure.
- [ ] **Step 2:** run, see fail; implement; then build the screen and overlay.
- [ ] **Step 3:** `npm run check`, `npm run build`, `npm run check:bundle`.
- [ ] **Step 4:** Headless Chrome against the stand-in home, with a layout saved in advance: screenshots of
  the empty home, a page of cards, a second page, a light's panel, and a card after OK toggled it. Expected:
  as the mockups; the toggled card turns amber.
- [ ] **Step 5:** Commit: `feat: home screen with cards, pages and panels`

### Task 14: Settings: the device picker and the connection

**Files:**
- Create: `src/screens/settings/SettingsScreen.tsx`, `DevicePicker.tsx`, `ConnectionSection.tsx`,
  `settings.css`
- Modify: `src/app/App.tsx`

- Settings is an overlay with two sections in this plan, chosen from a list on the left: **Devices** and
  **Connection**. "Reorganise layout" is listed and marked "Coming soon" until plan 3.
- Devices: rooms as headings (`groupByRoom`), each device a row with its name, its type's name, and a
  switch-like control: "Add" or "On screen ✓". A device with no supported part shows "Not supported yet"
  and cannot be focused for adding. Adding calls `addCard` with the device's size; removing calls
  `removeCard`. The list scrolls to keep the focused row in view (set `scrollTop`; `scrollIntoView` options
  are newer than Chromium 53).
- Connection: the address, the signed-in user's name, and "Sign out". Sign out asks for confirmation, calls
  `connection.signOut()`, applies `afterSignOut`, and returns to the sign-in screen.
- The layout is saved after every change.

- [ ] **Step 1:** Build the screen.
- [ ] **Step 2:** `npm run check`, `npm run build`, `npm run check:bundle`.
- [ ] **Step 3:** Headless Chrome: add three devices in the picker, leave Settings, screenshot the home
  screen; reload and confirm the cards are still there; sign out and confirm the sign-in screen returns and
  the saved text has no tokens. Expected: all three hold; the lock and the garage door show "Not supported
  yet".
- [ ] **Step 4:** Commit: `feat: settings with the device picker and sign out`

### Task 15: Documents, and the first run on the TV

**Files:**
- Modify: `README.md` (folder map, commands, "Run it in a browser" with the stand-in home),
  `docs/superpowers/specs/2026-11-23-home-assist-lg-design.md` (the plan split, and any decision that
  changed), `webos/appinfo.json` (version `0.2.0`), `package.json` (version `0.2.0`)
- Create: `docs/tv-checks/2026-11-plan-2.md`

**Needs Simon:** the TV on, and Simon at it to type his Home Assistant username and password. The password
is typed on the TV and is never seen by anyone else.

- [ ] **Step 1:** Update the documents. `npm run check`. Commit: `docs: plan 2 in the README and the design`
- [ ] **Step 2:** `npm run package`, deploy to the C9.
- [ ] **Step 3:** Simon signs in, adds devices in Settings, and on the home screen: moves with the arrows,
  toggles a light with OK, opens a panel with a long OK, changes brightness, flips pages if there are enough
  cards, closes and reopens the app (the cards and the sign-in must still be there), and signs out.
- [ ] **Step 4:** Record what happened in `docs/tv-checks/2026-11-plan-2.md`, including the Back, colour and
  channel key codes left over from plan 1, whether a non-admin Home Assistant user can read the registries,
  and whether Home Assistant 2026.9's child devices appear and are grouped sensibly. Fix what the run finds.
- [ ] **Step 5:** Commit: `docs: plan 2 TV check`

---

## When this plan is done

- A person can sign in on the TV, pick devices, and control lights, switches and buttons, with sensors and
  binary sensors shown, on a paged grid, with the layout and sign-in kept between runs.
- `src/proof` is gone.
- Plan 3 can be written: reorganise mode, climate, camera, the remaining error states, and the guides.
