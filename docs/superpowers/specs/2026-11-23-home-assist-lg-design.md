# Home Assist LG: design

**Date:** 2026-11-23
**Status:** approved by Simon on 2026-11-23
**Screen mockups:** https://claude.ai/artifact/WEjm2aL8jkdRvpdZCVX4i9 (five screens at 1920×1080; Simon approved these as the baseline)

Lines marked **(my call)** are decisions Claude made that Simon has not explicitly agreed to. Everything else
is Simon's decision or a fact found during the design conversation.

## Intent

An app for LG webOS TVs that controls a Home Assistant home with the TV remote. It is for Simon and for other
Home Assistant users, each on their own TV with their own Home Assistant.

The idea behind it: Home Assistant already sorts every device into a standard type (light, switch, climate and
so on). The app has one control panel per type, so it works with any brand, including devices Simon does not
own. People add devices to Home Assistant in Home Assistant, then choose on the TV which ones to show.

It grew out of the Home Devices screen in `echo-show-assistant`, which does the same job on an Echo Show for
lights, heating, speakers and plugs through Simon's own backend.

## Goals

- Open the app like any other TV app, full screen, and see the chosen devices as cards on a grid.
- Control each device with the remote: one press for the everyday action, a panel for everything else.
- Choose devices on the TV from what Home Assistant already has, grouped by room.
- Arrange the cards: a "Reorganise layout" mode moves each card to a chosen place on the grid.
- Work on any TV size (assume 32 inches as the smallest) by scaling, with no size-specific layouts.
- Work for other people with no server of Simon's and no rooted TV.
- Code a person can read, support and extend without help. See "Readable and extendable code".

## Non-goals (first version)

- Adding devices or integrations to Home Assistant from the TV.
- Voice or microphone input.
- Locks, alarms, and doors or garage doors. They appear in the picker with "Not supported yet".
- Alerts when the app is not open (for example a doorbell pop-up over a programme).
- Live camera video. Cameras show a still picture.
- Renaming devices, resizing cards, or sharing a layout between TVs.
- A generic card for types without a panel **(my call)**: anything outside the supported list shows
  "Not supported yet". A read-only fallback card can come later.
- Languages other than English **(my call)**.
- Submitting to LG's Content Store. The app must not rule it out.

## Anti-goals

- Anything that lets whoever holds the remote unlock a door, open a garage or disarm an alarm.
- Storing the user's Home Assistant password.
- Needing a rooted TV, or any server besides the user's own Home Assistant.

## Constraints

- **Web engine.** webOS TV 4.x (2018 and 2019 models, including Simon's C9 on webOS 4.5) runs Chromium 53,
  per LG's web engine table. It parses JavaScript up to ES2016 and does not have CSS grid layout. The build
  must compile down to that, and the card grid must be positioned by the app's own code.
- **Supported TVs** **(my call)**: webOS TV 4.0 and newer. Tested on the C9.
- **Full screen.** A webOS app takes over the screen. Simon is happy with that.
- **Input.** The Magic Remote pointer, and the arrow keys with OK and Back. Both must work everywhere.
- **Home Assistant sign-in and browsers.** Tested against Simon's Home Assistant on 2026-11-23:
  - `POST /auth/login_flow` from a plain program returns the username and password form, so an app can run
    the sign-in itself.
  - The same request marked as coming from a web page (any `Origin`, including `null` and `file://`) is
    refused by Home Assistant's cross-origin check with HTTP 403.
  - `/auth/token` accepts any origin.
  - webOS 4.5 does not apply the cross-origin check to an installed app (tested on the C9, 2026-11-23).
    Newer webOS versions are untested. See "First step".
- **Tado allowance.** Tado limits API calls per day. Heating changes must be sent sparingly (see Heating).
- **Shared screen.** A TV is used by everyone in the room, including guests.

## Approaches considered

1. **TypeScript with Preact, compiled for Chromium 53. Chosen by Simon.** A small component library that
   still supports old browsers, plus the official Home Assistant connection library and the app's own remote
   focus handling. One codebase covers the C9 and every newer TV. Cost: the remote navigation is written by us.
2. **LG's Enact framework.** Built for TV apps and includes remote focus handling. Rejected: LG's guidance is
   that the current generation is supported on webOS TV 6.0 and higher, and covering webOS 4 needs a
   years-old release. That would exclude the C9 or split the code.
3. **Angular.** Simon's home ground. Rejected: current Angular will not run on Chromium 53, and the versions
   that would are out of support.

A fourth option, plain TypeScript with no component library, was dropped early: the app has many stateful
panels, and hand-written screen updates would be more code for no gain.

## How it connects

```
TV app  ──  HTTP sign-in (once)  ──►  the user's Home Assistant
        ──  WebSocket (always)   ──►  states, registries, service calls
```

The app talks only to the user's Home Assistant. There is no backend.

### Sign-in

Simon chose: sign in on the TV with a Home Assistant username and password, on the app's own screen.

1. **Address.** The app tries `http://homeassistant.local:8123` first **(my call)**. If that fails, it asks
   for the address. "Change" on the sign-in screen opens the same field. Any `http://` or `https://` address
   is accepted.
2. **Credentials.** The app starts a Home Assistant login flow, submits the username and password, and
   handles a further step if Home Assistant asks for one (a two-step login code). Errors from Home Assistant
   ("Invalid username or password") are shown as they are.
3. **Key.** The flow ends with a code that the app exchanges at `/auth/token` for an access token and a
   refresh token. The refresh token is the key the TV keeps. The password is never stored.
4. **Fallback** **(my call)**: an "Advanced" link on the sign-in screen accepts a long-lived access token
   typed or pasted in, for setups where the normal route fails.

The sign-in screen carries the "Before you start" note from the mockup: Home Assistant running on the same
network, a username and password (a separate user for the TV is suggested), and devices already added.

**Sign out** lives in Settings, Connection. It asks Home Assistant to cancel the refresh token, removes it
from the TV and returns to the sign-in screen. Signing in again is how credentials are changed. The layout
is kept and reused if the next sign-in is to the same Home Assistant address; it is cleared if the address
is different **(my call)**.

### First step: test the sign-in route on the TV

Before any other work, build a minimal app, install it on the C9, and have it call `/auth/login_flow`.

- If the call succeeds, the app makes the sign-in requests itself.
- If the TV applies the cross-origin check, the sign-in requests go through a small JavaScript service
  bundled in the app package. A service is not a web page, so Home Assistant accepts it. The screens are
  identical either way.

The same minimal app proves the build chain: compiled for Chromium 53, packaged, installed and launched.

**Result, 2026-11-23, on the C9 (webOS 4.5):** the call succeeded from the installed app, and so did the other
three tests. **Route chosen: `direct`.** The app makes the sign-in requests itself and no helper service is
built. This is proven on webOS 4.5 only, on a rooted TV. If a newer TV, or an unrooted one, turns out to apply
the cross-origin check, the helper service above is the fallback. The build chain worked as well. Details are in `docs/tv-proof-results.md`.

### Live data

After sign-in, everything goes over Home Assistant's WebSocket API, which has no cross-origin restriction:

- entity states, kept current by subscription;
- the device, entity and area registries, to group entities into devices and rooms;
- service calls for every control.

The official `home-assistant-js-websocket` library handles the connection, reconnection and token refresh.

## What appears on screen

### Devices, parts and cards

Simon chose: the picker adds whole devices.

- A **device** is a Home Assistant device: one physical thing, such as a Ring doorbell.
- Its **parts** are its entities: the doorbell's camera, its "pressed" sensor, its battery sensor.
- A **card** shows one device, assembled from the panels for its supported parts.

Rules **(my call)**:

- Disabled and hidden entities are ignored. Diagnostic and configuration entities are left off the card,
  except a battery level.
- The card's main control comes from the device's most significant part, in this order: camera, climate,
  media player, vacuum, light, cover, fan, switch, then the rest.
- Other supported parts appear as secondary readings or buttons on the card where there is room, and all of
  them appear in the device's panel.
- Unsupported parts of an otherwise supported device are left out.
- A device with no supported part shows "Not supported yet" in the picker and cannot be added.
- Things with no device (scenes, scripts, helpers, loose entities) are listed in the picker under their room
  as items of their own, each with its own card.
- When a device has several parts of its main type (a two-channel dimmer, say), the card controls the first
  by name and the panel shows them all.
- Names and rooms come from Home Assistant. Devices with no room are grouped under "No room".
- The picker is a list that scrolls when there are more devices than fit.

### Supported types (first version)

Agreed with Simon: lights, switches and plugs, heating, media players, covers, fans, scenes and scripts,
buttons, sensors, cameras and vacuums. `input_boolean` uses the switch panel **(my call)**.

Each panel shows only the controls the entity says it supports.

| Type | On the card | In the panel | OK on the card |
|---|---|---|---|
| `light` | On/off, brightness | Brightness, colour, white temperature, effects, as supported | Toggle |
| `switch`, `input_boolean` | On/off | Same | Toggle |
| `climate` | Current and target temperature, state | Target − / +, modes and presets the entity lists | Open panel |
| `media_player` | What's playing, play/pause | Volume, previous/next, source, as supported | Play/pause |
| `cover` | Open, closed or position | Open, close, stop, position, as supported | Open panel |
| `fan` | On/off, speed | Speed, oscillate, presets, as supported | Toggle |
| `scene`, `script`, `button` | A button | Same | Run or press |
| `sensor` | The reading and its unit | Same | Nothing |
| `binary_sensor` | The state in words for its kind (Open/Closed, Motion/Clear) | Same | Nothing |
| `camera` | A still picture, refreshed every few seconds | The picture full size | Open panel |
| `vacuum` | Status, battery | Start, pause, stop, return to dock | Open panel |

**Not supported yet:** `lock`, `alarm_control_panel`, covers whose kind is a door, garage or gate, and every
type not in the table.

**Heating.** As in the Echo app: − and + change the shown target at once in the entity's own step, within
its own minimum and maximum, and one change is sent about 1.5 seconds after the last press. The panel never
polls the thermostat.

### Card sizes **(my call)**

Fixed by the device's main part, as in the mockup:

- **Large, 2×2:** cameras, including doorbells.
- **Wide, 2×1:** climate and media players.
- **Small, 1×1:** everything else.

## Screens

The five mockups are the reference for layout and look.

- **Title bar.** "Home Assist LG" on the left. On the right a settings button and a close button. Close
  exits the app completely. The sign-in screen shows only close **(my call)**.
- **Home screen.** The grid of cards. With no devices: "No devices yet" and an "Add devices" button.
- **Settings.** Three sections **(my call)**: Devices (the picker), Reorganise layout, Connection (address,
  signed-in user, Sign out).
- **Device panel.** A large overlay for one device with every control. Back closes it.

### Look **(my call, approved in the mockups)**

Dark background. Amber marks anything that is on. A white outline marks what the remote is focused on.
Type and controls are sized for reading from a sofa. Sizes scale with the screen, from one 1920×1080 design.

### Grid and pages

- The grid is 6 columns by 3 rows **(my call)**.
- Simon chose pages: each page is a full screen, flipped left and right like a phone's home screen. A row
  of dots shows which page is open, and arrow buttons at the left and right edges flip pages with the
  pointer **(my call)**.
- A newly added device goes in the first free place that fits it, on a new page if needed **(my call)**.
- Removing a device in the picker removes its card and leaves the gap.

### Reorganise layout

Reached from Settings. The grid shows every empty place, and each card shows a move marker.

- **Pointer:** point at a card, hold OK and drag.
- **Arrow keys:** OK picks a card up, the arrows move it, OK places it, Back puts it back.
- Moving past the left or right edge carries the card to the neighbouring page; past the last page creates
  a new one **(my call)**.
- A card can be placed where it fits in free cells. Placed on a card of the same size, the two swap.
  Otherwise the place is refused **(my call)**.
- "Done" leaves the mode. Empty pages are removed.

### Using the remote on the home screen

Simon chose "card first, then a panel".

- Arrows move between cards. Moving past the left or right edge flips the page.
- **OK** does the card's main action (see the table).
- **Holding OK** opens the device's panel. For types whose OK already opens the panel, a short press does it.
- **Back** closes a panel, leaves Settings, and on the home screen follows LG's convention for the Back key.
- **Pointer:** every visible control can be clicked directly. Clicking the card body acts like OK. A "more"
  button on the card opens the panel **(my call)**.

## What is saved

On the TV only, in the app's own storage:

- the Home Assistant address and the refresh token;
- the layout: pages, and each card's device and place.

A second TV is set up separately.

## When things go wrong

- **Home Assistant unreachable:** a banner on the home screen; the app keeps retrying; cards show their last
  known state, marked as stale, and controls are disabled **(my call)**.
- **Sign-in no longer accepted:** back to the sign-in screen with a short explanation. The layout is kept.
- **A device is unavailable in Home Assistant:** its card is greyed and says "Unavailable".
- **A device was removed from Home Assistant:** its card says so and offers to remove itself **(my call)**.
- **A command fails:** a short message at the bottom of the screen with Home Assistant's reason; the card
  returns to the real state.
- **Instant feedback:** a press updates the card at once, and the next state from Home Assistant confirms
  or corrects it.

## Privacy and safety

- The password is used once to sign in and is never stored.
- The app contacts nothing except the user's Home Assistant. No analytics.
- Locks, alarms and doors are excluded, as above.
- The suggested separate Home Assistant user means the TV's access can be removed on its own.

## How it is built

- **Language and UI:** TypeScript and Preact 10. Preact 11 needs Chrome 71 or newer, so it cannot be used
  while webOS 4 is supported.
- **Build target:** Chromium 53. The exact bundler and settings are the builder's choice.
- **Layout:** no CSS grid. Cards are placed by the app from their grid coordinates.
- **Structure:** see "Readable and extendable code" below.
- **Development:** in a desktop browser against a real Home Assistant, with regular checks on the C9. The
  desktop browser applies the cross-origin check, so development sign-in uses the token fallback or a local
  proxy.
- **Delivery:** an installable `.ipk` package. Simon's C9 is rooted with Homebrew Channel and has root SSH,
  which is the install route during development.

## Readable and extendable code

Simon's requirement: the code must be easy for a person to read and support, and laid out logically so a
person can extend it. The whole app is TypeScript. The reader to write for is an experienced developer who
is new to this codebase and may be new to TypeScript and Preact; Simon's own background is C# and Angular,
neither of which is used here. The rules below are how the requirement is met **(my call)**; the builder may adjust the
details but not the intent.

### One folder per device type

Adding a device type is the most likely extension, so it gets a fixed recipe. Every supported type is a
folder under `src/devices/`, and every folder has the same files:

```
src/devices/light/
  index.ts        the type's definition: which Home Assistant types it covers, its place in the
                  main-part order, its card size, and what OK does
  model.ts        reads a Home Assistant entity into a typed view of what the card shows and what
                  the entity supports
  actions.ts      turns each user action into a Home Assistant service call
  Card.tsx        the card
  Panel.tsx       the panel
  light.test.ts   tests for model and actions, using sample entities recorded from a real
                  Home Assistant
```

- One registry file lists the device types. Adding a type is: copy a folder, fill it in, add one line to
  the registry. The picker, the card size, the OK action and "Not supported yet" all follow from the
  registry, so nothing else changes.
- A single `DeviceType` interface states what every type must provide, with a comment on each member.
- Tiny types that share a panel (`switch` and `input_boolean`; `scene`, `script` and `button`) share a folder.

### Layers that only depend downwards

```
src/
  core/       Home Assistant data to devices, parts and cards; layout and page rules; focus-movement
              rules. No screen code and no TV code. Fully covered by tests.
  devices/    one folder per device type, as above
  screens/    home, settings, sign-in, the panel overlay, reorganise mode
  platform/   everything specific to the TV or the browser: remote keys, pointer, closing the app,
              storage, the sign-in route. Each behind a small interface.
  app/        start-up and wiring
```

`core` imports nothing from the other folders. `devices` and `screens` use `core`. Only `platform` touches
webOS, so the app runs in a desktop browser by swapping that one folder's implementations.

### Rules for every file

- **Plain over clever.** Straightforward code a newcomer can follow. No metaprogramming, no deep generics,
  no abstractions with a single user.
- **Names say what things are.** Full words, the same word for the same thing everywhere (device, part,
  card, panel, page), matching this document.
- **Small files with one job.** A file that needs scrolling to understand gets split.
- **A header comment on every file** saying what it is for and what it does not do.
- **Comments explain why,** above all for Home Assistant quirks and old-browser workarounds, with a link
  to the relevant Home Assistant documentation.
- **Typed data.** Home Assistant entities and attributes are described in one place. No `any`. Strict
  TypeScript settings.
- **Few dependencies.** Preact and the Home Assistant connection library, plus build and test tools.
  Every addition is something a maintainer must learn.
- **One formatter and one linter,** run by a single command, so style is never a judgement call.

### Documents in the repository

- **README:** what the app is, a map of the folders, and how to build, run in a browser, test, package
  and install on a TV.
- **"Adding a device type":** a step-by-step walkthrough that follows the recipe above with a worked example.
- **This design document,** kept current when a decision changes.

## Order of work **(my call)**

1. **First step:** the sign-in test and build-chain proof on the C9.
2. **Foundation:** sign-in, connection, picker, grid with pages, reorganise, storage, error states, and the
   panels for Simon's own devices: light, switch, climate, camera, sensor, binary sensor, button. The README
   and the "Adding a device type" guide are written here, once the first few types exist to describe.
3. **Remaining panels:** media player, cover, fan, scene and script, vacuum.
4. **For other people:** install instructions and a package others can install through Homebrew Channel or
   developer mode.

The foundation (stage 2) is delivered in two plans, so that a working app reaches the TV sooner:
`docs/superpowers/plans/2026-11-23-sign-in-and-control-devices.md` (sign-in, connection, picker, grid with
pages, storage, and light, switch, button, sensor and binary sensor), then
`docs/superpowers/plans/2026-11-23-heating-camera-and-layout.md` (reorganise mode, climate, camera, the
remaining error states, the Back key, and the guide to adding a device type).

## Decisions made while building **(my calls)**

Added on 2026-11-23, during the first foundation plan. Each refines a rule above without changing its intent.

- **Things with no device in the picker.** Only those of a supported type are listed, plus locks, alarms and
  covers (so they can say "Not supported yet"). Other loose entities, such as automations, zones and people,
  are not listed: they would bury the picker.
- **Battery levels never lead a card.** A battery sensor is ordered after a device's other parts, whatever
  its type, so a thermometer's card leads with the temperature.
- **A device with no name** is named after its first entity.
- **Colours for lights** are twelve fixed colours, and whites are five steps from warm to cool. Both work the
  same with the arrows and the pointer; a colour wheel would need fine pointing.
- **Moving focus.** The arrows move to the nearest thing in that direction, by position, on every screen.
  Inside a row of controls Left and Right stay in the row.
- **"Not supported yet" in the picker.** The row can be chosen, and choosing it shows a short message.
- **When Home Assistant does not answer at start-up,** the app says so, retries every few seconds, and
  offers to sign in again or change the address.
- **Back on the home screen** (and on the sign-in and connecting screens) hands over to the TV: the Home
  launcher on webOS 5 and lower, a "leave the app?" question on webOS 6 and higher, as LG's back-button
  guide asks. Settled in plan 3.

Added during plan 3 (`docs/superpowers/plans/2026-11-23-heating-camera-and-layout.md`):

- **Devices that can unlock or open something** (a lock, an alarm panel, or a door, garage or gate cover)
  are wholly "Not supported yet", including their other parts, so nothing on them can be operated.
- **Camera pictures** refresh every 10 seconds on a card and every 2 seconds in the panel. A failed refresh
  keeps the last picture; "No picture" shows only when none has ever loaded.
- **Reorganise mode.** Back with nothing picked up saves and leaves, like Done, since every move was already
  confirmed with OK. A card carried past the last page starts a new page; empty pages are removed on leaving.
- **Reconnecting.** Cards are dimmed and show their last known state; panels still open, and their controls
  say "Not connected to Home Assistant."
- **Signing out** waits up to 5 seconds for Home Assistant to cancel the sign-in, then forgets it anyway.
- **A card for a removed device** says "Press OK to remove", and OK removes it.

Added during plan 4 (`docs/superpowers/plans/2026-11-23-media-covers-fans-vacuums.md`):

- **Covers are allowed only when known to be safe:** kinds `awning`, `blind`, `curtain`, `damper`, `shade`,
  `shutter` and `window`. A cover of any other kind, or with no kind, might be a door, garage or gate, so it
  and its whole device are "Not supported yet". Stricter than the rule above, on purpose.
- **Volume** − and + move in 5% steps and are sent once, half a second after the last press.
- **Fan speed** − and + move in the fan's own step, but never less than 10%.
- **A vacuum's error** reads "Needs attention"; Return to dock stays available.
- **A non-admin Home Assistant user** can do everything the app needs. Checked by Simon on 2026-11-23.

## Plan 6: live camera view and the Back key (agreed with Simon, 23 November 2026)

**Why:** Simon wants to open a camera and watch it live from the sofa. A doorbell picture that pops up
by itself when someone rings is a "very nice to have" for later, not part of this.

**What a throwaway test on the C9 proved:** Home Assistant offers his Ring doorbell live over WebRTC
only (`camera/capabilities` → `frontend_stream_types: ["web_rtc"]`). The TV's Chromium 53 has WebRTC
under its old name, `webkitRTCPeerConnection`, and plays Ring's H264 and Opus. It works when the offer
asks for audio and video only, waits for the TV's network candidates before sending, and has no data
channel: with a data channel Ring's answer has fewer channels than the offer, and the TV refuses it.

**Decided with Simon:**
- A device whose main part is a camera opens full screen instead of in the popup box. The picture fills
  the screen's height and keeps its shape. A see-through bar across the top holds the name, the room,
  the device's other parts in one line (doorbell, motion, battery), the buttons, and the close button.
- The still picture shows first. **Watch live** starts live video, because each live view wakes a Ring
  doorbell and starts a session with Ring.
- Sound starts off; **Sound on** / **Sound off** switches it.
- Closing the view ends the live session at once. When the session ends by itself (Ring cuts it off
  after a few minutes) or the connection fails, the view says so and the button becomes **Watch
  again**.
- **Watch live** appears only for cameras Home Assistant offers WebRTC for. Others keep refreshing stills.
- Back on the sign-in screen steps back a form (two-step code or access token → username and password;
  username and password → address) instead of leaving the app. With the TV keyboard open, Back still
  only closes the keyboard.

**Approaches considered for live video:** WebRTC through Home Assistant (chosen: the only route Ring
offers, and proven on the TV); HLS through Home Assistant with a JavaScript player (only for cameras
with a plain video stream, so not Ring; could be added later for cameras without WebRTC); Home
Assistant's MJPEG stream (for Ring it repeats the same old snapshot, so not live).

**Left to the builder:** how the session is timed out when no picture arrives; exact wording and layout
details within the sketch above.

## Left to the builder

- The app's ID, icon and version scheme.
- The bundler, test runner and polyfills needed for Chromium 53.
- The fixed `client_id` address the app presents to Home Assistant at sign-in.
- Exact Home Assistant message names, and checking each against the current Home Assistant developer
  documentation. In particular: that a non-admin user can read the registries, and the call that cancels a
  refresh token.
- The colour panel's design for lights, usable with both the pointer and the arrow keys.
- How often the camera picture refreshes on a card and in the panel.
- Animation, kept light for TV hardware.
