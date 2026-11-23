# Fixtures

`sample-home.json` is a small made-up Home Assistant home. The tests use it, and so does the stand-in Home
Assistant that `npm run dev:home` starts.

It was **written by hand from Home Assistant's entity documentation**, not recorded from a real system. It
mirrors the kinds of device the app was first built for: LIFX bulbs, smart plugs, a Tado thermostat and a
Ring doorbell, plus the awkward cases the picker has to handle (a lock, a garage door, a device with no
name, a device with nothing supported, a disabled entity, a hidden entity, and things with no device).

When a recording from a real Home Assistant is available, replace entries here with the real ones. Keep the
awkward cases.

The shape is:

- `states`: what Home Assistant reports for each entity (`entity_id`, `state`, `attributes`).
- `entities`, `devices`, `areas`: the three registries, with the fields the app reads.
- `user`: the signed-in user.

`camera.png` is a small made-up picture that the stand-in Home Assistant serves as every camera's still.
