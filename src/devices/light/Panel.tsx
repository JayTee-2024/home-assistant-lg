/**
 * A light's panel: on/off, brightness, and (only when the light supports them) shades of
 * white, colours and effects.
 *
 * Colour is chosen from twelve fixed colours, not a colour wheel. A wheel needs fine
 * pointing; twelve buttons work the same with the arrows and with the pointer.
 */

import type { PanelProps } from '../device-type';
import { PanelButton, PanelRow, PanelValue } from '../shared/controls';
import { readableName } from '../shared/predict';
import { setBrightness, setColour, setEffect, setWhite, toggle } from './actions';
import { nextBrightness, readLight, whiteSteps } from './model';

const COLOURS: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: 'Red', rgb: [255, 0, 0] },
  { name: 'Orange', rgb: [255, 110, 0] },
  { name: 'Amber', rgb: [255, 180, 84] },
  { name: 'Yellow', rgb: [255, 230, 0] },
  { name: 'Lime', rgb: [150, 255, 0] },
  { name: 'Green', rgb: [0, 220, 60] },
  { name: 'Teal', rgb: [0, 200, 170] },
  { name: 'Cyan', rgb: [0, 200, 255] },
  { name: 'Blue', rgb: [0, 80, 255] },
  { name: 'Purple', rgb: [140, 60, 255] },
  { name: 'Magenta', rgb: [255, 0, 200] },
  { name: 'Pink', rgb: [255, 120, 170] },
];

const WHITE_NAMES = ['Warm', 'Soft', 'Neutral', 'Cool', 'Daylight'];

export function LightPanel({ entity, run }: PanelProps) {
  const view = readLight(entity);
  const off = !view.isAvailable;

  return (
    <div>
      <PanelRow label={view.isOn ? 'On' : 'Off'}>
        <PanelButton
          label={view.isOn ? 'Turn off' : 'Turn on'}
          isDisabled={off}
          onPress={() => run(toggle(entity))}
        />
      </PanelRow>

      {view.canDim && (
        <PanelRow label="Brightness">
          <PanelButton
            label="−"
            isDisabled={off}
            onPress={() => run(setBrightness(entity, nextBrightness(view.brightnessPercent, -1)))}
          />
          <PanelValue
            text={view.brightnessPercent === null ? 'Off' : view.brightnessPercent + '%'}
          />
          <PanelButton
            label="+"
            isDisabled={off}
            onPress={() => run(setBrightness(entity, nextBrightness(view.brightnessPercent, 1)))}
          />
        </PanelRow>
      )}

      {view.canSetWhite && (
        <PanelRow label="White">
          {whiteSteps(view).map((kelvin, index) => (
            <PanelButton
              key={kelvin}
              label={WHITE_NAMES[index] ?? kelvin + ' K'}
              isSelected={view.whiteKelvin === kelvin}
              isDisabled={off}
              onPress={() => run(setWhite(entity, kelvin))}
            />
          ))}
        </PanelRow>
      )}

      {view.canSetColour && (
        <PanelRow label="Colour">
          {COLOURS.map((colour) => (
            <PanelButton
              key={colour.name}
              label={colour.name}
              swatch={'rgb(' + colour.rgb.join(',') + ')'}
              isDisabled={off}
              onPress={() => run(setColour(entity, colour.rgb))}
            />
          ))}
        </PanelRow>
      )}

      {view.effects.length > 0 && (
        <PanelRow label="Effect">
          {view.effects.map((effect) => (
            <PanelButton
              key={effect}
              label={readableName(effect)}
              isSelected={view.effect === effect}
              isDisabled={off}
              onPress={() => run(setEffect(entity, effect))}
            />
          ))}
        </PanelRow>
      )}
    </div>
  );
}
