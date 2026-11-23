# Project Skeleton and TV Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A repository that builds, tests, packages and installs a webOS app for Chromium 53, plus a proof
screen run on Simon's C9 that settles whether Home Assistant sign-in works directly or needs a helper service.

**Architecture:** TypeScript and Preact bundled by esbuild into one classic script for Chromium 53. Logic
lives in plain tested modules (`src/core`, `src/proof`); only `src/platform` touches the browser or TV.
Packaging uses LG's `ares-package`; installing copies the package to the rooted TV over SSH and asks the TV's
install service to install it.

**Tech Stack:** TypeScript, Preact 10, esbuild, Vitest, ESLint, Prettier, es-check, core-js (selected
polyfills), `@webos-tools/cli`.

**Spec:** `docs/superpowers/specs/2026-11-23-home-assist-lg-design.md` ("First step" and "Readable and
extendable code"). This is plan 1 of 4, matching the spec's "Order of work". Plans 2 to 4 are written after
this one's result is known, because the sign-in route decides part of plan 2.

## Global Constraints

- Build target is Chromium 53: output must parse as ES2016, load as a classic script (no ES modules), and use
  no CSS grid.
- Preact must be version 10.x. Preact 11 needs Chrome 71 or newer.
- The app must not need a rooted TV. Root is used only by the deploy script on Simon's own TV.
- The app contacts nothing except the Home Assistant address the user types.
- Strict TypeScript, no `any`.
- Every source file starts with a header comment: what the file is for and what it does not do.
- Comments explain why, above all for Home Assistant quirks and old-browser workarounds.
- Full-word names. Plain code over clever code. Small files with one job.
- Runtime dependencies are Preact and core-js only in this plan. Anything else is a build or test tool.
- One command, `npm run check`, runs formatting check, lint, type check and tests.
- Commit after every task, on the branch `skeleton-and-tv-proof`. Commit messages end with the two
  attribution lines this session uses.
- `src/proof/` is throwaway. Plan 2 deletes it. `src/core`, `src/platform`, `scripts/` and `webos/` are kept.

## Review Focus

Conditions the spec implies but does not spell out, most likely first. Each has a test in the task named.

1. An address typed with a scheme but no port, or with a path or trailing slash, must not gain `:8123` or
   keep the path (Task 1).
2. A request that never completes, as when the TV is on another network, must end as `timeout` after 8
   seconds, not hang the screen (Task 2).
3. Something other than Home Assistant answering at the address (a router page, a different web server) must
   be reported as `unexpected-answer`, not as success (Task 2).
4. A WebSocket that opens and then closes, or sends something other than `auth_required`, must not count as
   reached (Task 2).
5. Running the deploy script with settings missing must name each missing setting and change nothing on the
   TV (Task 4).

## File Structure

```
package.json, tsconfig.json, vitest.config.mjs, eslint.config.mjs, .prettierrc.json, .prettierignore,
.gitignore
.env.local.example            deploy settings template (the real .env.local is never committed)
README.md                     what this is, folder map, build / test / run / install commands
webos/appinfo.json            app metadata for the TV
webos/icon.png                80x80
webos/largeIcon.png           130x130
scripts/build.mjs             src -> dist/app
scripts/dev.mjs               build, watch and serve on http://localhost:5173
scripts/package.mjs           dist/app -> dist/*.ipk
scripts/deploy.mjs            copy the .ipk to the TV, install, launch
scripts/lib/deploy-config.mjs reads and validates deploy settings
scripts/lib/deploy-config.test.mjs
src/index.html
src/app/main.tsx              entry point
src/app/app.css               scaling and base colours
src/core/address.ts           turns what the user typed into a Home Assistant base URL
src/core/address.test.ts
src/platform/polyfills.ts     the features Chromium 53 lacks
src/platform/keys.ts          remote key codes to names
src/platform/keys.test.ts
src/platform/http.ts          the real HttpSend, built on fetch
src/proof/probe.ts            HTTP and WebSocket probes, and the sign-in route decision
src/proof/probe.test.ts
src/proof/ProofScreen.tsx     the screen shown on the TV
docs/tv-proof-results.md      written in Task 5
```

---

### Task 1: Tooling skeleton and the address rule

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`,
  `.prettierignore`, `.gitignore`, `README.md`
- Create: `src/core/address.ts`
- Test: `src/core/address.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AddressResult =
    | { ok: true; url: string }
    | { ok: false; reason: 'empty' | 'invalid' };
  export const DEFAULT_ADDRESS = 'homeassistant.local:8123';
  export function normaliseAddress(input: string): AddressResult;
  ```
- Produces npm scripts: `test`, `typecheck`, `lint`, `format`, `format:check`, `check`.

- [ ] **Step 1: Create `package.json` and install the tools**

`package.json`: `"name": "home-assist-lg"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`.

Run:
```bash
npm install preact@^10 core-js
npm install --save-dev esbuild vitest es-check eslint typescript-eslint prettier @webos-tools/cli
npm view typescript-eslint peerDependencies
npm install --save-dev typescript@<newest version inside the peer range just printed>
```
Expected: `npm ls preact` shows a 10.x version.

Scripts:
```json
{
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "check": "npm run format:check && npm run lint && npm run typecheck && npm run test"
}
```

- [ ] **Step 2: Write the configuration files**

- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noEmit`, `skipLibCheck`, `module: "ESNext"`,
  `moduleResolution: "Bundler"`, `jsx: "react-jsx"`, `jsxImportSource: "preact"`, `include: ["src"]`, and
  `lib` set to exactly what Chromium 53 has plus what Task 3 polyfills, so the compiler rejects anything else:
  `["ES2016", "DOM", "ES2017.Object", "ES2017.String", "ES2018.Promise", "ES2019.Array", "ES2019.Object", "ES2020.Promise"]`.
- `eslint.config.mjs`: the typescript-eslint recommended set, `@typescript-eslint/no-explicit-any` as an
  error, ignoring `dist/` and `node_modules/`.
- `.prettierrc.json`: `{ "singleQuote": true, "printWidth": 100 }`.
- `.prettierignore` and `.gitignore`: `node_modules/`, `dist/`, `.env.local`, `.sync.bundle`,
  `.superpowers/`. `.prettierignore` also lists `package-lock.json`.
- `vitest.config.mjs`: `test.include` of `["src/**/*.test.ts", "scripts/**/*.test.mjs"]`, environment `node`.

- [ ] **Step 3: Write the failing test** in `src/core/address.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { normaliseAddress } from './address';

const url = (input: string) => normaliseAddress(input);

describe('normaliseAddress', () => {
  it('adds http and port 8123 when neither is typed', () => {
    expect(url('192.168.1.100')).toEqual({ ok: true, url: 'http://192.168.1.100:8123' });
  });
  it('keeps a typed port', () => {
    expect(url('homeassistant.local:8123')).toEqual({ ok: true, url: 'http://homeassistant.local:8123' });
    expect(url('192.168.1.100:8080')).toEqual({ ok: true, url: 'http://192.168.1.100:8080' });
  });
  it('trims spaces and lower-cases the host', () => {
    expect(url('  HomeAssistant.LOCAL  ')).toEqual({ ok: true, url: 'http://homeassistant.local:8123' });
  });
  it('does not add a port when the scheme was typed', () => {
    expect(url('http://192.168.1.100')).toEqual({ ok: true, url: 'http://192.168.1.100' });
    expect(url('https://example.ui.nabu.casa/')).toEqual({ ok: true, url: 'https://example.ui.nabu.casa' });
  });
  it('drops any path, query and trailing slash', () => {
    expect(url('http://192.168.1.100:8123/lovelace/0?x=1')).toEqual({
      ok: true,
      url: 'http://192.168.1.100:8123',
    });
  });
  it('reports empty input', () => {
    expect(url('')).toEqual({ ok: false, reason: 'empty' });
    expect(url('   ')).toEqual({ ok: false, reason: 'empty' });
  });
  it('reports input that is not an http or https address', () => {
    for (const bad of ['http://', 'a b', 'ftp://host', 'ht!tp://x']) {
      expect(url(bad)).toEqual({ ok: false, reason: 'invalid' });
    }
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npm run test`
Expected: FAIL, cannot find `./address`.

- [ ] **Step 5: Implement `normaliseAddress` in `src/core/address.ts`**

Use the built-in `URL` class to parse. "Scheme was typed" means the trimmed input starts with `http://` or
`https://`, compared without regard to case.

- [ ] **Step 6: Run the tests**

Run: `npm run test`
Expected: PASS, 7 tests.

- [ ] **Step 7: Write `README.md`**

Sections: what the app is (two sentences, linking the design document); "Folder map" (the tree above, kept
to folders that exist); "Commands" (`npm install`, `npm run check`). Later tasks add their commands.

- [ ] **Step 8: Run the full check and commit**

Run: `npm run format && npm run check`
Expected: all four stages pass.

```bash
git add -A
git commit -m "chore: project tooling and the address rule"
```

---

### Task 2: Proof logic and remote keys

**Files:**
- Create: `src/proof/probe.ts`, `src/platform/keys.ts`
- Test: `src/proof/probe.test.ts`, `src/platform/keys.test.ts`

**Interfaces:**
- Produces, in `src/proof/probe.ts`:
  ```ts
  export const PROBE_TIMEOUT_MS = 8000;
  /** The fixed address the app presents to Home Assistant as its identity. It is never fetched. */
  export const CLIENT_ID = 'https://jaytee-2024.github.io/home-assistant-lg/';

  export type ProbeOutcome =
    | 'reached'
    | 'refused-by-server'
    | 'unexpected-answer'
    | 'blocked-or-unreachable'
    | 'timeout';

  export interface ProbeResult {
    name: string;
    outcome: ProbeOutcome;
    httpStatus: number | null;
    detail: string;
  }

  export interface HttpRequest {
    method: 'GET' | 'POST';
    url: string;
    jsonBody?: unknown;
    /** True: only find out whether the server answers; the answer itself cannot be read. */
    opaque?: boolean;
  }
  /** Resolves with the answer. Rejects when the browser blocks the request or nothing answers. */
  export type HttpSend = (request: HttpRequest) => Promise<{ status: number; body: string }>;

  export interface ProbePlan {
    reach: HttpRequest;
    providers: HttpRequest;
    startSignIn: HttpRequest;
    webSocketUrl: string;
  }
  export function buildProbes(baseUrl: string): ProbePlan;

  export function runHttpProbe(
    name: string,
    request: HttpRequest,
    send: HttpSend,
    isExpected: (body: string) => boolean,
    timeoutMs?: number,
  ): Promise<ProbeResult>;

  export interface SocketLike {
    onopen: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    onerror: (() => void) | null;
    onclose: (() => void) | null;
    close(): void;
  }
  export function runWebSocketProbe(
    url: string,
    openSocket: (url: string) => SocketLike,
    timeoutMs?: number,
  ): Promise<ProbeResult>;

  export type SignInRoute = 'direct' | 'helper-service' | 'unreachable';
  export function decideSignInRoute(reach: ProbeResult, startSignIn: ProbeResult): SignInRoute;
  ```
- Produces, in `src/platform/keys.ts`:
  ```ts
  export type RemoteKey =
    | 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'
    | 'red' | 'green' | 'yellow' | 'blue' | 'channelUp' | 'channelDown';
  export function remoteKeyFromCode(keyCode: number): RemoteKey | null;
  ```

- [ ] **Step 1: Write the failing tests**

`src/platform/keys.test.ts`:
```ts
import { expect, it } from 'vitest';
import { remoteKeyFromCode } from './keys';

it('names the remote keys', () => {
  const expected: Array<[number, string]> = [
    [37, 'left'], [38, 'up'], [39, 'right'], [40, 'down'], [13, 'ok'],
    [461, 'back'], [403, 'red'], [404, 'green'], [405, 'yellow'], [406, 'blue'],
    [33, 'channelUp'], [34, 'channelDown'],
  ];
  for (const [code, name] of expected) expect(remoteKeyFromCode(code)).toBe(name);
});
it('treats Backspace and Escape as back, for desktop development', () => {
  expect(remoteKeyFromCode(8)).toBe('back');
  expect(remoteKeyFromCode(27)).toBe('back');
});
it('returns null for any other key', () => {
  expect(remoteKeyFromCode(65)).toBeNull();
});
```

`src/proof/probe.test.ts` (imports from `vitest` and `./probe` omitted here; `fakeSocket()` is a small helper
written in the test file):
```ts
const base = 'http://192.168.1.100:8123';
const get: HttpRequest = { method: 'GET', url: base + '/auth/providers' };
const anything = () => true;

describe('buildProbes', () => {
  it('builds the four probes for an http address', () => {
    const plan = buildProbes(base);
    expect(plan.reach).toEqual({ method: 'GET', url: base + '/manifest.json', opaque: true });
    expect(plan.providers).toEqual({ method: 'GET', url: base + '/auth/providers' });
    expect(plan.startSignIn).toEqual({
      method: 'POST',
      url: base + '/auth/login_flow',
      jsonBody: { client_id: CLIENT_ID, handler: ['homeassistant', null], redirect_uri: CLIENT_ID },
    });
    expect(plan.webSocketUrl).toBe('ws://192.168.1.100:8123/api/websocket');
  });
  it('uses wss for an https address', () => {
    expect(buildProbes('https://example.ui.nabu.casa').webSocketUrl).toBe(
      'wss://example.ui.nabu.casa/api/websocket',
    );
  });
});

describe('runHttpProbe', () => {
  it('reports reached for an expected answer', async () => {
    const result = await runHttpProbe('p', get, async () => ({ status: 200, body: '{}' }), anything);
    expect(result).toMatchObject({ name: 'p', outcome: 'reached', httpStatus: 200 });
  });
  it('reports reached with no status for an opaque answer', async () => {
    const result = await runHttpProbe('p', { ...get, opaque: true }, async () => ({ status: 0, body: '' }), anything);
    expect(result).toMatchObject({ outcome: 'reached', httpStatus: null });
  });
  it('reports refused-by-server for a 4xx or 5xx status, with the start of the body', async () => {
    const result = await runHttpProbe('p', get, async () => ({ status: 403, body: 'CORS preflight failed' }), anything);
    expect(result).toMatchObject({ outcome: 'refused-by-server', httpStatus: 403 });
    expect(result.detail).toContain('CORS preflight failed');
  });
  it('reports unexpected-answer when the body is not what Home Assistant sends', async () => {
    const result = await runHttpProbe('p', get, async () => ({ status: 200, body: '<html>router</html>' }), () => false);
    expect(result).toMatchObject({ outcome: 'unexpected-answer', httpStatus: 200 });
  });
  it('reports blocked-or-unreachable when the request is rejected', async () => {
    const result = await runHttpProbe('p', get, async () => { throw new Error('Failed to fetch'); }, anything);
    expect(result).toMatchObject({ outcome: 'blocked-or-unreachable', httpStatus: null, detail: 'Failed to fetch' });
  });
  it('reports timeout after 8 seconds when nothing comes back', async () => {
    vi.useFakeTimers();
    const pending = runHttpProbe('p', get, () => new Promise(() => {}), anything);
    vi.advanceTimersByTime(PROBE_TIMEOUT_MS);
    expect(await pending).toMatchObject({ outcome: 'timeout' });
    vi.useRealTimers();
  });
});

describe('runWebSocketProbe', () => {
  // fakeSocket() returns a SocketLike plus helpers to fire open, message, error and close.
  it('reports reached when the first message is auth_required', async () => {
    const socket = fakeSocket();
    const pending = runWebSocketProbe('ws://x/api/websocket', () => socket);
    socket.fireOpen();
    socket.fireMessage('{"type":"auth_required","ha_version":"2026.11.1"}');
    expect(await pending).toMatchObject({ outcome: 'reached', detail: 'Home Assistant 2026.11.1' });
    expect(socket.closed).toBe(true);
  });
  it('reports unexpected-answer for any other first message', async () => {
    const socket = fakeSocket();
    const pending = runWebSocketProbe('ws://x/api/websocket', () => socket);
    socket.fireMessage('hello');
    expect(await pending).toMatchObject({ outcome: 'unexpected-answer' });
  });
  it('reports blocked-or-unreachable when the socket errors or closes first', async () => {
    const errored = fakeSocket();
    const first = runWebSocketProbe('ws://x', () => errored);
    errored.fireError();
    expect(await first).toMatchObject({ outcome: 'blocked-or-unreachable' });

    const closed = fakeSocket();
    const second = runWebSocketProbe('ws://x', () => closed);
    closed.fireOpen();
    closed.fireClose();
    expect(await second).toMatchObject({ outcome: 'blocked-or-unreachable' });
  });
  it('reports timeout after 8 seconds of silence', async () => {
    vi.useFakeTimers();
    const pending = runWebSocketProbe('ws://x', () => fakeSocket());
    vi.advanceTimersByTime(PROBE_TIMEOUT_MS);
    expect(await pending).toMatchObject({ outcome: 'timeout' });
    vi.useRealTimers();
  });
});

describe('decideSignInRoute', () => {
  const result = (outcome: ProbeOutcome): ProbeResult => ({ name: 'p', outcome, httpStatus: null, detail: '' });
  it('is unreachable when Home Assistant did not answer at all', () => {
    expect(decideSignInRoute(result('timeout'), result('timeout'))).toBe('unreachable');
    expect(decideSignInRoute(result('blocked-or-unreachable'), result('reached'))).toBe('unreachable');
  });
  it('is direct when the sign-in request got through', () => {
    expect(decideSignInRoute(result('reached'), result('reached'))).toBe('direct');
  });
  it('is helper-service when Home Assistant answers but the sign-in request does not get through', () => {
    for (const outcome of ['blocked-or-unreachable', 'refused-by-server', 'unexpected-answer', 'timeout'] as const) {
      expect(decideSignInRoute(result('reached'), result(outcome))).toBe('helper-service');
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test`
Expected: FAIL, cannot find `./probe` and `./keys`.

- [ ] **Step 3: Implement `src/platform/keys.ts` and `src/proof/probe.ts`**

`detail` for a refused answer is the first 200 characters of the body. An `opaque` request cannot be read,
so it counts as reached as soon as it resolves and `isExpected` is not called. Each probe settles exactly
once: the first of answer, rejection or timeout wins, and the WebSocket probe closes its socket when it
settles.

- [ ] **Step 4: Run the tests, then the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: sign-in route probes and remote key names"
```

---

### Task 3: Build for Chromium 53 and the proof screen

**Files:**
- Create: `scripts/build.mjs`, `scripts/dev.mjs`, `src/index.html`, `src/app/main.tsx`, `src/app/app.css`,
  `src/platform/polyfills.ts`, `src/platform/http.ts`, `src/proof/ProofScreen.tsx`
- Modify: `package.json` (scripts), `README.md` (commands)

**Interfaces:**
- Consumes: everything Task 1 and Task 2 produce.
- Produces: `export const fetchSend: HttpSend` in `src/platform/http.ts`; npm scripts `build`,
  `check:bundle`, `dev`; the folder `dist/app/` holding `index.html`, `app.js`, `app.css`.

- [ ] **Step 1: Write `scripts/build.mjs`**

Deletes `dist/app`, then runs esbuild with: entry `src/app/main.tsx`, `bundle: true`, `format: 'iife'`,
`target: ['chrome53']`, `outfile: 'dist/app/app.js'`, `minify: true`, `sourcemap: 'linked'`,
`jsx: 'automatic'`, `jsxImportSource: 'preact'`. Then copies `src/index.html` to `dist/app/`, and every file
in `webos/` to `dist/app/` when that folder exists. CSS imported from TypeScript lands in `dist/app/app.css`.

Add scripts: `"build": "node scripts/build.mjs"`, `"check:bundle": "es-check es2016 dist/app/app.js"`.

- [ ] **Step 2: Write `src/index.html`**

A classic script, never `type="module"`, because Chromium 53 cannot load modules:
`<link rel="stylesheet" href="app.css">`, `<div id="app"></div>`, `<script src="app.js" defer></script>`.

- [ ] **Step 3: Write `src/platform/polyfills.ts`**

Imports exactly these core-js entries, matching the `lib` list in `tsconfig.json`, with a comment naming the
Chrome version that added each: `es.object.entries`, `es.object.values`,
`es.object.get-own-property-descriptors`, `es.string.pad-start`, `es.string.pad-end`, `es.promise.finally`,
`es.array.flat`, `es.array.flat-map`, `es.object.from-entries`, `es.promise.all-settled`.

- [ ] **Step 4: Write `src/platform/http.ts`**

`fetchSend` uses `fetch`. For `opaque` requests it passes `mode: 'no-cors'` and resolves with
`{ status: 0, body: '' }`. For a `jsonBody` it sends `Content-Type: application/json`.

- [ ] **Step 5: Write `src/app/app.css` and `src/proof/ProofScreen.tsx`**

`app.css`: `html { font-size: calc(100vw / 120); }` so 1rem is 16px at 1920 wide and everything scales; all
sizes in rem; background `#0E1116`, text `#F2F4F7`, muted `#A7B0BD`, accent `#FFB454`, focus outline
`0.25rem solid #F2F4F7`. Flexbox only.

`ProofScreen` shows, top to bottom:
1. The heading "Home Assist LG: TV proof".
2. "Browser engine:" and `navigator.userAgent`.
3. "CSS grid:" and "supported" or "not supported", from `CSS.supports('display', 'grid')`.
4. A text field labelled "Home Assistant address", starting as `DEFAULT_ADDRESS`.
5. A "Run tests" button. It normalises the address (showing "Enter an address" or "That is not a valid
   address" on failure), then runs, in order, "Reach Home Assistant" (`reach`), "Read sign-in options"
   (`providers`, expected when the body parses as JSON with a `providers` array), "Start sign-in"
   (`startSignIn`, expected when the body parses as JSON with `type` equal to `"form"`), and "Live
   connection" (the WebSocket probe).
6. One line per probe: name, outcome, HTTP status when there is one, and detail.
7. "Sign-in route:" and the `decideSignInRoute` result, once the probes finish.
8. "Last key:" and the name and code of the last key pressed, for example `ok (13)` or `unknown (65)`.
9. A "Close app" button that calls `window.close()`.

Up and down move focus between the field and the two buttons, using `remoteKeyFromCode`. Every control is
also clickable with the pointer.

- [ ] **Step 6: Write `src/app/main.tsx` and `scripts/dev.mjs`**

`main.tsx` imports the polyfills first, then `app.css`, then renders `ProofScreen` into `#app`.
`dev.mjs` runs the same esbuild options without `minify`, in watch mode, serving `dist/app` on port 5173.
Add `"dev": "node scripts/dev.mjs"`.

- [ ] **Step 7: Build and check the output**

Run: `npm run check && npm run build && npm run check:bundle && ls dist/app`
Expected: check passes; es-check reports no errors; the listing shows `app.css`, `app.js`, `app.js.map`,
`index.html`.

- [ ] **Step 8: Check it in a desktop browser**

Run: `npm run dev`, open `http://localhost:5173`, type `192.168.1.100:8123`, press "Run tests".
Expected on a desktop browser: "Reach Home Assistant" reached; "Start sign-in" blocked-or-unreachable;
"Live connection" reached with the Home Assistant version; "Sign-in route: helper-service". This is the
known desktop result and proves the screen works. The TV result is what Task 5 finds out.

- [ ] **Step 9: Add the commands to `README.md` and commit**

```bash
git add -A
git commit -m "feat: Chromium 53 build and the TV proof screen"
```

---

### Task 4: Package and deploy

**Files:**
- Create: `webos/appinfo.json`, `webos/icon.png`, `webos/largeIcon.png`, `scripts/package.mjs`,
  `scripts/deploy.mjs`, `scripts/lib/deploy-config.mjs`, `.env.local.example`
- Test: `scripts/lib/deploy-config.test.mjs`
- Modify: `package.json` (scripts), `README.md` ("Install on a TV")

**Interfaces:**
- Consumes: `dist/app/` from Task 3.
- Produces:
  ```js
  // scripts/lib/deploy-config.mjs
  /** @returns {{ ok: true, host: string, keyPath: string, user: string, port: number }
   *          | { ok: false, problems: string[] }} */
  export function readDeployConfig(env);
  export const APP_ID = 'net.badacid.homeassistlg';
  ```
  npm scripts `package` and `deploy`; the file `dist/net.badacid.homeassistlg_0.1.0_all.ipk`.

- [ ] **Step 1: Write the failing test** in `scripts/lib/deploy-config.test.mjs`

```js
it('lists every missing setting', () => {
  expect(readDeployConfig({})).toEqual({
    ok: false,
    problems: ['TV_HOST is not set', 'TV_SSH_KEY is not set'],
  });
});
it('uses root and port 22 unless told otherwise', () => {
  expect(readDeployConfig({ TV_HOST: '192.168.1.65', TV_SSH_KEY: '/keys/tv' })).toEqual({
    ok: true, host: '192.168.1.65', keyPath: '/keys/tv', user: 'root', port: 22,
  });
});
it('accepts a user and port', () => {
  expect(
    readDeployConfig({ TV_HOST: 'tv', TV_SSH_KEY: '/k', TV_SSH_USER: 'prisoner', TV_SSH_PORT: '9922' }),
  ).toMatchObject({ ok: true, user: 'prisoner', port: 9922 });
});
it('rejects a port that is not a whole number from 1 to 65535', () => {
  for (const bad of ['abc', '0', '70000', '22.5']) {
    expect(readDeployConfig({ TV_HOST: 'tv', TV_SSH_KEY: '/k', TV_SSH_PORT: bad })).toEqual({
      ok: false, problems: ['TV_SSH_PORT must be a whole number from 1 to 65535'],
    });
  }
});
it('treats blank values as not set', () => {
  expect(readDeployConfig({ TV_HOST: '  ', TV_SSH_KEY: '' })).toMatchObject({ ok: false });
});
```

- [ ] **Step 2: Run it to see it fail, implement `readDeployConfig`, run it to see it pass**

Run: `npm run test`
Expected: FAIL (module missing), then PASS after implementing.

- [ ] **Step 3: Write `webos/appinfo.json` and the icons**

```json
{
  "id": "net.badacid.homeassistlg",
  "version": "0.1.0",
  "vendor": "Simon",
  "type": "web",
  "main": "index.html",
  "title": "Home Assist LG",
  "icon": "icon.png",
  "largeIcon": "largeIcon.png",
  "resolution": "1920x1080",
  "disableBackHistoryAPI": true
}
```
`disableBackHistoryAPI` makes the Back key arrive as key code 461 instead of navigating history.
Icons: `icon.png` 80x80 and `largeIcon.png` 130x130, an amber `#FFB454` rounded square on `#0E1116`.

- [ ] **Step 4: Write `scripts/package.mjs`**

Copies the `version` from `package.json` into `dist/app/appinfo.json`, so the version is set in one place,
then runs `npx ares-package --no-minify dist/app --outdir dist`. `--no-minify` because the bundle is already
minified for Chromium 53 and must not be reprocessed. Add `"package": "npm run build && node scripts/package.mjs"`.

- [ ] **Step 5: Write `scripts/deploy.mjs` and `.env.local.example`**

`.env.local.example` lists `TV_HOST=`, `TV_SSH_KEY=`, and commented `TV_SSH_USER=root`, `TV_SSH_PORT=22`.

`deploy.mjs`:
1. Loads `.env.local` if present, calls `readDeployConfig(process.env)`. On problems, prints each on its own
   line, then "Copy .env.local.example to .env.local and fill it in.", and exits with code 1 before
   touching the TV.
2. Finds the single `.ipk` in `dist/`. None: prints "Run npm run package first." and exits with code 1.
3. Every `ssh` call uses: `-i <keyPath> -p <port> -o BatchMode=yes -o StrictHostKeyChecking=accept-new
   -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa -o ConnectTimeout=8`. The two
   algorithm options are needed because the TV's SSH server is old.
4. Copies the package by piping the file into `ssh ... "cat > /tmp/home-assist-lg.ipk"`. This avoids `scp`,
   which newer versions run over SFTP, and the TV has no SFTP server. If `ssh` fails here, prints
   "Could not reach the TV at <host>. Is it switched on?" and exits with code 1.
5. Installs with
   `luna-send -i -f luna://com.webos.appInstallService/dev/install '{"id":"com.ares.defaultName","ipkUrl":"/tmp/home-assist-lg.ipk","subscribe":true}'`,
   reading the output as it arrives. Success is a line containing `"state": "installed"` (ignoring spaces).
   Failure is a line containing `"returnValue": false` or `FAILED`. On either, or after 60 seconds, it ends
   the `ssh` process. On failure or timeout it prints the last output it saw and exits with code 1.
6. Launches with
   `luna-send -n 1 -f luna://com.webos.service.applicationManager/launch '{"id":"net.badacid.homeassistlg"}'`
   and prints "Installed and launched." when the reply contains `"returnValue": true`.

Add `"deploy": "node scripts/deploy.mjs"`.

- [ ] **Step 6: Package and check**

Run: `npm run check && npm run package && ls dist/*.ipk && node scripts/deploy.mjs`
Expected: check passes; `dist/net.badacid.homeassistlg_0.1.0_all.ipk` exists; with no `.env.local`, deploy
prints the two "is not set" lines and the copy instruction, and exits with code 1.

- [ ] **Step 7: Add "Install on a TV" to `README.md` and commit**

Covers: the TV must be rooted with Homebrew Channel and have SSH on (this script is for development; plan 4
covers installing without root); creating `.env.local`; `npm run package`; `npm run deploy`.

```bash
git add -A
git commit -m "feat: package the app and deploy it to a rooted TV"
```

---

### Task 5: Run the proof on the C9 and record the result

**Files:**
- Create: `docs/tv-proof-results.md`
- Modify: `docs/superpowers/specs/2026-11-23-home-assist-lg-design.md` ("First step" section)

**Needs Simon:** the TV switched on, and a way for the deploy to reach it. Either Simon runs
`npm run deploy` on his PC with his own key, or he authorises a separate deploy key for the session.

- [ ] **Step 1: Deploy**

Run: `npm run package && npm run deploy`
Expected: "Installed and launched.", and the proof screen on the TV.

- [ ] **Step 2: Run the tests on the TV**

On the TV: set the address to `192.168.1.100:8123`, press "Run tests". Then press OK, Back, each arrow,
each colour key and channel up and down, noting what "Last key" shows. Then press "Close app".

- [ ] **Step 3: Record what the TV showed** in `docs/tv-proof-results.md`

Date, TV model and firmware, then: the browser engine line; CSS grid supported or not; each of the four
probe lines exactly as shown; the "Sign-in route" line; the key name and code seen for each key pressed,
with any that showed `unknown`; whether "Close app" exited to the TV's home screen; and whether the on-screen
keyboard appeared for the address field and could type a full address.

- [ ] **Step 4: Record the decision**

In the design document's "First step" section, add a dated line stating the result and the route chosen:
`direct`, or `helper-service` (then do Task 6). If the result is `unreachable`, stop and investigate the
network before deciding anything.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: TV proof results and the sign-in route decision"
```

---

### Task 6: Helper service proof (only if Task 5 chose `helper-service`)

**Files:**
- Create: `service/package.json`, `service/services.json`, `service/service.js`,
  `src/platform/helper-http.ts`
- Modify: `scripts/build.mjs`, `scripts/package.mjs`, `src/proof/ProofScreen.tsx`,
  `docs/tv-proof-results.md`

**Interfaces:**
- Consumes: `HttpSend`, `HttpRequest` from Task 2.
- Produces: `export const helperSend: HttpSend` in `src/platform/helper-http.ts`; a service named
  `net.badacid.homeassistlg.service` with one method, `http`.

- [ ] **Step 1: Write the service**

Check LG's JavaScript service guide for the current file shapes before writing. `service/service.js` is
plain JavaScript for the TV's own Node (version 8 on webOS 4.x), with no build step and no dependencies
beyond the platform's `webos-service` module and Node's `http` and `https`.

Method `http` takes `{ method, url, jsonBody }` and answers `{ returnValue: true, status, body }`, or
`{ returnValue: false, errorText }`. It is not a general proxy: it accepts only `GET` and `POST`, and only
URLs whose path is `/auth/providers`, `/auth/token`, `/auth/login_flow` or `/auth/login_flow/<flow id>`.
Anything else answers `{ returnValue: false, errorText: 'Not allowed' }`. It gives up after 8 seconds.

- [ ] **Step 2: Write `helperSend`**

Calls `luna://net.badacid.homeassistlg.service/http` through the TV's `PalmServiceBridge`, resolving with
`{ status, body }` and rejecting with `errorText`. Where `PalmServiceBridge` does not exist (a desktop
browser), it rejects with "The helper service is only available on the TV."

- [ ] **Step 3: Package the service with the app**

`build.mjs` copies `service/` to `dist/service/`. `package.mjs` passes both folders:
`npx ares-package --no-minify dist/app dist/service --outdir dist`.

- [ ] **Step 4: Add a second button to the proof screen**

"Run tests through the helper" runs the "Read sign-in options" and "Start sign-in" probes with `helperSend`
and shows their lines under a "Through the helper" heading.

- [ ] **Step 5: Deploy, run on the TV, record and commit**

Run: `npm run check && npm run package && npm run deploy`
Expected on the TV: both helper probes show `reached`.

Add the two lines to `docs/tv-proof-results.md` and a dated line to the design document saying the helper
route works (or does not, with what was seen).

```bash
git add -A
git commit -m "feat: helper service proof for Home Assistant sign-in"
```

---

## When this plan is done

- `npm run check`, `npm run build`, `npm run check:bundle`, `npm run package` and `npm run deploy` all work.
- The proof screen has run on the C9 and `docs/tv-proof-results.md` holds what it showed.
- The design document states which sign-in route the app uses.
- Plan 2 (the foundation) can be written against known facts: the route, the real key codes, and whether
  the TV's keyboard is usable for typing an address.
