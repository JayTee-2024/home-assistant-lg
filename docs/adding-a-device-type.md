# Adding a device type

A device type teaches the app one kind of Home Assistant entity: how to read it, what each control sends,
and how its card and panel look. This guide walks through adding one, using the heating type
(`src/devices/climate/`) as the worked example.

Read the README's "Layers" section first. A device type lives in `src/devices` and may import only from
`src/core`. It never talks to Home Assistant or the TV directly: it describes what to send, and the app
sends it.

## Before you start

1. **Find the Home Assistant entity type** ("domain") you want to support, such as `climate` or `fan`, and
   read its page in Home Assistant's developer documentation
   (`https://developers.home-assistant.io/docs/core/entity/<domain>`). Note:
   - which **attributes** it reports (`current_temperature`, `hvac_modes` ...);
   - its **`supported_features`** bits, which say what this particular entity can do;
   - which **services** change it (`climate.set_temperature` ...) and their settings.
2. **Decide the four things the app needs to know** (see `src/devices/device-type.ts`):
   - `mainOrder`: how important it is when a device has several parts. Lower leads the card. The current
     values are camera 10, heating 20, light 50, switch 80, button 90, sensor 100, binary sensor 110.
   - `cardSize`: `small` (1×1), `wide` (2×1) or `large` (2×2).
   - What **OK** on the card does: an everyday action (switch a light), `'open-panel'`, or `'nothing'`.
   - When it counts as **"on"**, which the card marks in amber.
3. **Check it is safe.** Nothing that can unlock a door, disarm an alarm, or open a door, garage or gate
   may ever be controllable. `src/core/devices.ts` makes a whole device unsupported if it has such an
   entity, and a registry test checks no type claims `lock` or `alarm_control_panel`. Keep it that way.

## The files

Copy an existing folder that is close to what you need, rename it, and fill it in. Every folder has the
same files:

```
src/devices/climate/
  index.ts        the type itself: id, label, icon, domains, mainOrder, cardSize, OK, "on", summary
  model.ts        reads an entity into a typed view (ClimateView) of what the card and panel show
  actions.ts      one function per control, each returning an Action: what to send, and the
                  state to show straight away
  Card.tsx        the inside of the card
  Panel.tsx       every control, for the device's panel
  climate.test.ts tests for model.ts, actions.ts and index.ts
```

A type that only reports (sensor, camera) still has `actions.ts`, holding a comment that says why it is
empty, so every folder looks the same.

## Step by step

### 1. Write the tests first: `climate.test.ts`

Use the sample home (`fixtures/sample-home.json`) through `src/test-support/sample-home.ts`. If the sample
has no entity of your type, add one there first: give it the attributes Home Assistant's documentation
lists, and a registry entry and device if it belongs to one.

```ts
const tado = sampleEntity('climate.living_room');

it('reads a thermostat', () => {
  expect(readClimate(tado).targetTemperature).toBe(21);
});

it('fills in a range and a step when the thermostat reports none', () => {
  const view = readClimate(changed(tado, { min_temp: null, target_temp_step: null }));
  expect(view.minTemp).toBe(7);
});
```

Always test an entity with attributes missing, and one whose state is `unavailable`. Home Assistant
integrations differ in what they report, and the card must still draw.

Run `npm run test` and watch the new tests fail.

### 2. Read the entity: `model.ts`

Write one function, `readClimate(entity): ClimateView`, and use the readers in `src/core/home-assistant.ts`
(`readNumber`, `readText`, `readTextList`, `hasFeature`, `isAvailable`). They answer `null` or an empty list
for anything missing or of the wrong kind, so the model never throws. Name the `supported_features` bits
you use as constants with a comment.

Put any small calculation here too, as its own tested function. The heating type's `stepTarget` works out
the next temperature for − and +.

### 3. Say what each control sends: `actions.ts`

One function per control. Each returns an `Action`:

```ts
export function setTarget(entity: EntityState, temperature: number): Action {
  return {
    call: { domain: 'climate', service: 'set_temperature', entityId: entity.entity_id, data: { temperature } },
    predicted: predict(entity, entity.state, { temperature }),
  };
}
```

`predicted` is what the entity should look like straight away. The app shows it at once and replaces it
when Home Assistant reports the real state (see `src/core/pending-states.ts`). `predict` from
`../shared/predict` copies an entity with a new state and some attributes changed.

### 4. Draw it: `Card.tsx` and `Panel.tsx`

The card's frame, icon, name and room are drawn by the home screen. Your `Card` draws only the inside: wrap
it in `<div class="face">`, and use `face-state`, `face-big` and `face-detail` from
`src/devices/shared/devices.css`.

The panel is built from `PanelRow`, `PanelButton` and `PanelValue` in `../shared/controls`. They are real
buttons, so the remote's arrows, OK and the pointer all work with no extra code. Show only the controls the
entity says it supports. Run actions with the `run` prop.

If a control should not send on every press (heating's − and +), use `createDebouncer` from
`src/core/debounce.ts` and send once after the presses stop.

### 5. Describe the type: `index.ts`

```ts
export const climateType: DeviceType = {
  id: 'climate',
  label: 'Heating',
  icon: 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
  domains: ['climate'],
  mainOrder: 20,
  cardSize: 'wide',
  supports: () => true,
  okAction: (entity) => (readClimate(entity).isAvailable ? 'open-panel' : 'nothing'),
  isActive: (entity) => readClimate(entity).hvacAction === 'heating',
  summary: (entity) => formatTemperature(readClimate(entity).currentTemperature),
  Card: ClimateCard,
  Panel: ClimatePanel,
};
```

The icon is SVG path data on a 24×24 grid, drawn with a 2-unit line, in the style of feathericons.com.
`supports` can refuse some entities of the right type. A future cover type must refuse door, garage and
gate covers there.

### 6. Add one line to the registry

In `src/devices/registry.ts`, import the type and add it to `DEVICE_TYPES`, keeping the list in `mainOrder`.
That is all: the picker, card sizes, OK and "Not supported yet" follow from the list.

Add a line to `src/devices/registry.test.ts` saying which part should lead a sample device now.

### 7. Check it

1. `npm run check` must pass. It formats, lints (including the layer rules), type-checks and runs every
   test.
2. If your type needs a service the stand-in Home Assistant does not know, teach `scripts/lib/fake-home.mjs`
   (test first, in `fake-home.test.mjs`).
3. `npm run dev:home` and `npm run dev`, then try the card and panel in a browser with the arrow keys, Enter
   and Escape.
4. `npm run deploy` and try it on a TV. Chromium 53 is the oldest browser the app supports; the linter
   catches the common newer browser features, but not all of them.
