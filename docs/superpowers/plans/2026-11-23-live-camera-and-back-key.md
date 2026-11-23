# Live Camera View and the Back Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cameras open full screen with a **Watch live** button that plays Home Assistant's WebRTC stream on the TV, and Back on the sign-in screen steps back a form.

**Architecture:** `src/core/live-video.ts` holds the interface the camera type uses (`LiveVideoSource`) and a pure state machine (`nextLiveState`) for connecting → playing → ended/failed. `src/platform/live-video.ts` implements it with `webkitRTCPeerConnection` and Home Assistant's `camera/webrtc/*` messages, following the recipe the throwaway test proved on the C9. `HomeConnection` gains `liveVideo`; the app passes it to panels through `PanelProps`. A device type can ask for a full-screen panel (`panelLayout: 'full-screen'`); the camera does.

**Tech Stack:** TypeScript, Preact, home-assistant-js-websocket, WebRTC (Chromium 53), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-home-assist-lg-design.md`, section "Plan 6: live camera view and the Back key".

## Global Constraints

- Chromium 53: `webkitRTCPeerConnection` (unprefixed missing), `onaddstream` (no `ontrack`), `createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })`, no data channel, wait for ICE gathering `complete` (or 3 s) before sending the offer.
- Home Assistant messages: `camera/capabilities` (`frontend_stream_types` includes `web_rtc`), `camera/webrtc/get_client_config` (`configuration` → RTCPeerConnection config), subscription `camera/webrtc/offer` {entity_id, offer} with events `session`, `answer` {answer}, `candidate` {candidate}, `error` {code, message}.
- Layers: devices import core only; screens never import platform.
- Nothing can unlock, disarm or open (unchanged).
- Sound starts off. Live starts only on **Watch live**. Closing the view stops the session.

## Review Focus

1. Closing the view (Back, close button, or the device vanishing) while connecting must stop the session: no peer connection or Home Assistant subscription left running, no video playing behind the home screen.
2. Pressing **Watch live** twice quickly, or **Watch again** after an end, must never run two sessions at once.
3. A camera whose capabilities request fails or does not include `web_rtc` shows no live button and keeps working as stills.
4. A session that never produces a picture (Home Assistant answers but no media arrives) must end as failed after a time limit, not spin "Connecting…" for ever.
5. Back with the TV keyboard open on a sign-in field must only close the keyboard.

---

### Task 1: Back steps back a sign-in form

**Files:**
- Create: `src/screens/sign-in/back.ts`, `src/screens/sign-in/back.test.ts`
- Modify: `src/screens/sign-in/SignInScreen.tsx`, `src/app/App.tsx`

**Interfaces:**
- Produces: `backFrom(form: Form): 'address' | 'restart' | null` (Form exported from SignInScreen or moved into back.ts): `credentials` → `'address'`; `code` and `token` → `'restart'` (try the address again, which lands on username and password, as the token form's own "Back to username and password" button does); `looking` and `address` → `null` (Back leaves the app as before).
- SignInScreen gains `registerKeys(handler: ((key: RemoteKey) => boolean) | null): void`, used like ReorganiseScreen's. Its handler claims only `back`, only when `backFrom(form)` is not null and `isTypingInField()` is false.

- [ ] **Step 1:** tests for each form's result.
- [ ] **Step 2:** run, expect FAIL (module missing).
- [ ] **Step 3:** implement; App passes `registerKeys` to SignInScreen.
- [ ] **Step 4:** tests pass; browser check: from token form, Back → credentials form; from credentials, Back → address form; from address, Back leaves (calls leaveToTv).
- [ ] **Step 5:** commit `feat: Back steps back a sign-in form`.

### Task 2: Live session states

**Files:**
- Create: `src/core/live-video.ts`, `src/core/live-video.test.ts`

**Interfaces:**
- Produces:
  - `type LiveState = 'idle' | 'connecting' | 'playing' | 'ended' | 'failed'`
  - `type LiveEvent = 'start' | 'picture' | 'connection-lost' | 'refused' | 'timed-out' | 'stop'`
  - `nextLiveState(state: LiveState, event: LiveEvent): LiveState`
  - `LIVE_PICTURE_TIMEOUT_MS = 30000`
  - `interface LiveVideo { stop(): void }`
  - `interface LiveVideoHandlers { onStream(stream: MediaStream): void; onEvent(event: LiveEvent): void }`
  - `interface LiveVideoSource { isSupported(entityId: string): Promise<boolean>; start(entityId: string, handlers: LiveVideoHandlers): LiveVideo }`

- [ ] **Step 1:** tests: idle/ended/failed + start → connecting; connecting + picture → playing; connecting + connection-lost/refused/timed-out → failed; playing + connection-lost/refused → ended; playing + timed-out → playing (the time limit only matters before the picture); any + stop → idle; playing + picture → playing.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat: live video session states`.

### Task 3: WebRTC through Home Assistant

**Files:**
- Create: `src/platform/live-video.ts`
- Modify: `src/core/home-connection.ts` (add `liveVideo: LiveVideoSource`), `src/platform/home-assistant-connection.ts`, `scripts/lib/fake-home.mjs` (+ test), any test stand-ins implementing HomeConnection

**Interfaces:**
- Consumes: Task 2 types.
- Produces: `createLiveVideoSource(connection: Connection): LiveVideoSource`.
  - `isSupported`: `camera/capabilities`; true only when `frontend_stream_types` includes `web_rtc`; false on any error.
  - `start`: as the Global Constraints say. Reports `picture` from `onaddstream` (with `onStream`), `refused` for an `error` event or a rejected subscription/SDP step, `connection-lost` for ICE `failed`/`disconnected`/`closed`, `timed-out` after `LIVE_PICTURE_TIMEOUT_MS` without a stream. `stop()` (idempotent) cancels the timer, unsubscribes, closes the peer connection, and silences further events.
- Fake home: `camera/capabilities` → `{ frontend_stream_types: ['web_rtc'], two_way_audio: false }` for cameras; `camera/webrtc/get_client_config` → `{ configuration: { iceServers: [] } }`; `camera/webrtc/offer` → result then an `error` event `{ type: 'error', code: 'webrtc_offer_failed', message: 'The stand-in home has no live video.' }`.

- [ ] **Step 1:** fake-home tests for the three messages. FAIL, implement, PASS.
- [ ] **Step 2:** implement the platform module (verified on the TV in Task 5; WebRTC cannot run in Node tests).
- [ ] **Step 3:** `npm run check` green; commit `feat: live video over WebRTC through Home Assistant`.

### Task 4: Full-screen camera view with Watch live

**Files:**
- Modify: `src/devices/device-type.ts` (`panelLayout?: 'box' | 'full-screen'`; `PanelProps.liveVideo: LiveVideoSource`), `src/devices/camera/*` (index sets `panelLayout: 'full-screen'`; Panel rewritten; model gains `cameraControls`), `src/screens/panel/PanelOverlay.tsx` + `panel.css` (full-screen variant: top bar with name, room, other parts' summaries, close button), `src/app/App.tsx` (passes `connection.liveVideo`), camera CSS, `docs/adding-a-device-type.md` (mention `panelLayout`)
- Test: `src/devices/camera/camera.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces: `cameraControls(state: LiveState, isMuted: boolean): { liveLabel: 'Watch live' | 'Stop live' | 'Watch again'; soundLabel: 'Sound on' | 'Sound off' | null; status: string | null }`:
  - idle → Watch live, no sound button, no status
  - connecting → Stop live, Sound on/off, "Connecting…"
  - playing → Stop live, Sound on/off, "Live"
  - ended → Watch again, no sound button, "Live view ended"
  - failed → Watch again, no sound button, "Live view did not start"
  - Sound label is "Sound on" when muted, "Sound off" when not.

- [ ] **Step 1:** tests for `cameraControls` (every state, both mute values). FAIL, implement, PASS.
- [ ] **Step 2:** PanelOverlay full-screen variant; CameraPanel: still picture filling the height (`object-fit: contain`), video element over it while connecting/playing (shown once playing), buttons in the top bar area, `isSupported` checked once when the view opens (no live button until it answers true), session stopped on unmount and before any restart, mute toggles `video.muted`.
- [ ] **Step 3:** browser check against `npm run dev:home`: hold OK on Front door → full-screen view, picture fills height, bar shows "Front door · Hallway" and the other parts; Watch live → "Connecting…" then "Live view did not start" (stand-in's error) and Watch again; Back closes; no errors.
- [ ] **Step 4:** `npm run check` green; commit `feat: full-screen camera view with live video`.

### Task 5: Docs, version 1.1.0, TV check (needs Simon)

- [ ] CHANGELOG 1.1.0, version bump with `npm version 1.1.0 --no-git-tag-version`, README status, install guide (camera paragraph), `docs/tv-checks/2026-11-plan-6.md` after Simon's check on the C9 (Watch live, sound, Stop, Back, session end, Back on sign-in forms).
