# Changelog

## 1.2.1

- A heating card now shows as on whenever the heating is switched on, in the same colour as other
  active cards. Before, it only lit while the room was actually being heated.
- After you switch heating on or off, or change the temperature, the card updates straight away instead
  of showing the old state until Home Assistant next reports.

## 1.2.0

- **PIN lock** (optional, off by default): in Settings, set a 4-digit PIN and the app asks for it when
  it opens and when you come back to it. Forgotten PIN: sign out from the lock screen.
- From a security review:
  - The app no longer says nothing on the TV can open your home. Locks, alarms and doors are hidden, but
    the app cannot know what a switch, button, script or scene does.
  - A camera's picture is only ever fetched from your Home Assistant.
  - Signing out with a long-lived access token says the token keeps working until you delete it.
  - The install guide has a "Keeping it safe" section.

## 1.1.1

- A Ring camera's picture is the first frame of its last recording, not a current view (that is what
  Home Assistant serves for Ring). It is now labelled **Last recording**.
- Ring records a live view as an event too. After watching live, the picture says **Updating
  picture…** until Ring's recording arrives (usually within a minute), then shows it.

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
