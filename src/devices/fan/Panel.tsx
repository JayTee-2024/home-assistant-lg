/**
 * A fan's panel: on/off, speed − and +, oscillation and presets, as the fan supports them.
 */

import type { PanelProps } from '../device-type';
import { PanelButton, PanelRow, PanelValue } from '../shared/controls';
import { readableName } from '../shared/predict';
import { oscillate, setPreset, setSpeed, toggle } from './actions';
import { nextSpeed, readFan } from './model';

export function FanPanel({ entity, run }: PanelProps) {
  const view = readFan(entity);
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

      {view.canSetSpeed && (
        <PanelRow label="Speed">
          <PanelButton
            label="−"
            isDisabled={off}
            onPress={() => run(setSpeed(entity, nextSpeed(view.speedPercent, view.step, -1)))}
          />
          <PanelValue
            text={!view.isOn || view.speedPercent === null ? 'Off' : view.speedPercent + '%'}
          />
          <PanelButton
            label="+"
            isDisabled={off}
            onPress={() =>
              run(setSpeed(entity, nextSpeed(view.isOn ? view.speedPercent : 0, view.step, 1)))
            }
          />
        </PanelRow>
      )}

      {view.canOscillate && (
        <PanelRow label="Oscillate">
          <PanelButton
            label={view.isOscillating ? 'On' : 'Off'}
            isSelected={view.isOscillating}
            isDisabled={off}
            onPress={() => run(oscillate(entity, !view.isOscillating))}
          />
        </PanelRow>
      )}

      {view.presets.length > 0 && (
        <PanelRow label="Preset">
          {view.presets.map((preset) => (
            <PanelButton
              key={preset}
              label={readableName(preset)}
              isSelected={view.preset === preset}
              isDisabled={off}
              onPress={() => run(setPreset(entity, preset))}
            />
          ))}
        </PanelRow>
      )}
    </div>
  );
}
