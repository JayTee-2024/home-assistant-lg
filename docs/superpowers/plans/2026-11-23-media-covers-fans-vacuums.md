# Media players, covers, fans and vacuums: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** The design's stage 3: the remaining device types, media player, cover, fan and vacuum.

**Architecture:** Each type follows `docs/adding-a-device-type.md`. The sample home gains one entity of each
type so the tests, the stand-in Home Assistant and the browser checks can use them.

**Spec:** `docs/superpowers/specs/2026-11-23-home-assist-lg-design.md`, "Supported types".

**Where this sits:** plan 4 of 5. Plan 5 packages the app for other people.

## Global constraints

- Everything in the earlier plans' constraints still holds. No new dependencies.
- Each panel shows only the controls the entity says it supports (`supported_features`).
- **Covers (my call, stricter than the design):** only covers whose `device_class` is `awning`, `blind`,
  `curtain`, `damper`, `shade`, `shutter` or `window` are supported. Any other cover, including one with no
  `device_class`, may be a door, garage or gate: it is unsupported and makes its whole device unsupported.
- Card sizes: media player wide; cover, fan and vacuum small. Main-part order: camera 10, climate 20,
  media player 30, vacuum 40, light 50, cover 60, fan 70, switch 80, button 90, sensor 100, binary sensor 110.

## Review focus

1. A cover with no `device_class`, or `door`, `garage` or `gate`, is never controllable, nor is anything on
   its device (Task 1).
2. A media player that is `off`, `unavailable`, or reports no volume or title still draws and gives only
   the controls it supports (Task 2).
3. Pressing volume − or + many times quickly sends one change (Task 2).
4. A fan whose speed is `null` while on, or that has no speed control, still toggles (Task 4).
5. A vacuum in `error` says so and still offers Return to dock (Task 5).

---

### Task 1: The cover safety rule

**Files:** `src/core/devices.ts`, `src/core/devices.test.ts`

- `export const SAFE_COVER_KINDS = ['awning', 'blind', 'curtain', 'damper', 'shade', 'shutter', 'window']`.
- `isProtectedEntity` treats every cover whose `device_class` is not in the list as protected.
- [ ] Tests first: a cover with no kind, and one of kind `garage`, make their device unsupported; a `blind`
  does not. Commit `feat: only covers known to be safe count as supported`.

### Task 2: Media player

**Files:** `src/devices/media-player/` (recipe), registry, sample home, stand-in.

- Features: PAUSE 1, VOLUME_SET 4, VOLUME_MUTE 8, PREVIOUS_TRACK 16, NEXT_TRACK 32, TURN_ON 128,
  TURN_OFF 256, SELECT_SOURCE 2048, PLAY 16384.
- Model: state (`playing`, `paused`, `idle`, `off`, `on`, `standby`, `buffering`), title and artist,
  `volume_level` (0–1) as a percentage, muted, source and source list, what it supports.
- Actions: play/pause (`media_play_pause`), next, previous, `volume_set` (`volume_level`), `volume_mute`,
  `select_source`, `turn_on`, `turn_off`.
- Card: title (or the state in words) and artist. OK: play/pause when supported, else open the panel.
  Active while playing. Volume − and + in 5% steps, sent once 0.5 s after the last press (debouncer).
- Sample home: a Sonos speaker in the living room.

### Task 3: Cover

**Files:** `src/devices/cover/`, registry, sample home, stand-in.

- Features: OPEN 1, CLOSE 2, SET_POSITION 4, STOP 8. `supports` accepts only `SAFE_COVER_KINDS`.
- Model: state (`open`, `closed`, `opening`, `closing`), `current_position` (0–100, null if not reported).
- Actions: `open_cover`, `close_cover`, `stop_cover`, `set_cover_position` (`position`).
- Card: "Open", "Closed", "Opening…", or the position as a percentage. OK opens the panel. Panel: Open, Stop,
  Close, and positions 0, 25, 50, 75, 100 when the position can be set. Active when not closed.
- Sample home: a blind in the living room.

### Task 4: Fan

**Files:** `src/devices/fan/`, registry, sample home, stand-in.

- Features: SET_SPEED 1, OSCILLATE 2, PRESET_MODE 8.
- Model: on/off, `percentage`, `percentage_step` (default 1), oscillating, preset modes and mode.
- Actions: `toggle`, `set_percentage`, `oscillate`, `set_preset_mode`.
- Card: On/Off and the speed. OK toggles. Panel: on/off, speed − and + in the fan's own step (at least 10%),
  oscillate, presets.
- Sample home: a fan in the bedroom (a new area).

### Task 5: Vacuum

**Files:** `src/devices/vacuum/`, registry, sample home, stand-in.

- Features: PAUSE 4, STOP 8, RETURN_HOME 16, LOCATE 512, START 8192.
- Model: activity (`cleaning`, `docked`, `returning`, `idle`, `paused`, `error`) in words.
- Actions: `start`, `pause`, `stop`, `return_to_base`, `locate`.
- Card: the activity in words; its battery comes from the device's battery sensor, shown as an extra line
  as for any device. OK opens the panel. Active while cleaning or returning.
- Sample home: a robot vacuum with a battery sensor.

### Task 6: Documents and the TV run

- README status, design notes, version 0.4.0.
- **Needs Simon:** try the Sonos on the TV (the others are checked against the stand-in, since he has none).
