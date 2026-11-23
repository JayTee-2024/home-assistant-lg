# Changelog

## 1.1.1

- A Ring camera's picture is the first frame of its last recording, not a current view (that is what
  Home Assistant serves for Ring). It is now labelled **Last recording**.
- After watching a camera like that live, its card and full-screen view keep the last frame of the
  live video, labelled with the time (for example **Live at 16:42**), until the camera records
  something newer. The frame is kept while the app is open.

## 1.1.0

- Cameras open full screen: the picture fills the screen's height, with the name, the room and the
  device's other parts (such as a doorbell's motion sensor and battery) in a bar across the top.
- **Watch live** plays a camera live, where Home Assistant offers live video for it (WebRTC). Tested
  with a Ring doorbell. Sound starts off; **Sound on** switches it on. Closing the view ends the live
  session, and **Watch again** starts a new one after Ring ends it.
- Back on the sign-in screen steps back a form instead of leaving the app.

## 1.0.0 — 2026-11-23

The first version for other people. Install it with [docs/install.md](docs/install.md).

- Sign in with a Home Assistant username and password (with two-step codes), or with a long-lived
  access token. The TV never stores the password. Sign out or change address from Settings.
- Choose which Home Assistant devices to show; each becomes a card on a grid with pages. Rooms and names
  come from Home Assistant.
- Reorganise the layout: move cards, add and remove pages.
- Device types: lights (brightness and colour), switches and plugs, buttons, scenes and scripts, sensors
  and binary sensors, heating, media players (such as Sonos), blinds and other safe covers, fans, robot
  vacuums, and cameras as refreshing still pictures.
- Locks, alarms, and doors, garage doors and gates are deliberately left out, together with every other
  part of the same device, so nothing on the TV can open your home.
- The app's version is shown at the bottom of the Settings screen, and an About section says what the
  app is, where to get help, and a word about Games Unleashed.
- A new icon: a house with a cog.
- Works on webOS 4.0 and newer; tested on an LG C9 (webOS 4.5).
- Installs through Homebrew Channel on rooted TVs, or with webOS Dev Manager in developer mode.
