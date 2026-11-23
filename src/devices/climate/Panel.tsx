/**
 * A heating panel: the target temperature with − and +, the modes, and the presets.
 *
 * − and + change the target on screen at once. Home Assistant is told once, 1.5 seconds
 * after the last press (see src/core/debounce.ts), and straight away if the panel closes
 * first. The panel never asks the thermostat for anything: it shows what Home Assistant
 * reports.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { createDebouncer, type Debouncer } from '../../core/debounce';
import type { PanelProps } from '../device-type';
import { PanelButton, PanelRow, PanelValue } from '../shared/controls';
import { readableName } from '../shared/predict';
import { setHvacMode, setPreset, setTarget } from './actions';
import { formatTemperature, readClimate, stepTarget } from './model';

const SEND_DELAY_MS = 1500;

export function ClimatePanel({ entity, run }: PanelProps) {
  const view = readClimate(entity);
  const off = !view.isAvailable;

  // The target being chosen, before it is sent. null when nothing is waiting. Kept in a ref
  // as well as in state, so quick presses each build on the one before, even between redraws.
  const [chosen, setChosen] = useState<number | null>(null);
  const chosenRef = useRef<number | null>(null);
  const latest = useRef({ entity, run });
  latest.current = { entity, run };

  const debouncer = useRef<Debouncer | null>(null);
  if (debouncer.current === null) {
    debouncer.current = createDebouncer(
      () => {
        const target = chosenRef.current;
        if (target !== null) latest.current.run(setTarget(latest.current.entity, target));
        chosenRef.current = null;
        setChosen(null);
      },
      SEND_DELAY_MS,
      (send, ms) => setTimeout(send, ms),
      (id) => clearTimeout(id),
    );
  }

  // Send anything still waiting when the panel closes.
  useEffect(() => () => debouncer.current?.flush(), []);

  const shownTarget = chosen ?? view.targetTemperature;
  const press = (direction: -1 | 1) => {
    const next = stepTarget(view, chosenRef.current ?? view.targetTemperature, direction);
    chosenRef.current = next;
    setChosen(next);
    debouncer.current?.trigger();
  };

  return (
    <div>
      <PanelRow label="Room">
        <PanelValue text={formatTemperature(view.currentTemperature)} />
      </PanelRow>

      {view.canSetTarget && (
        <PanelRow label="Target">
          <PanelButton label="−" isDisabled={off} onPress={() => press(-1)} />
          <PanelValue text={formatTemperature(shownTarget)} />
          <PanelButton label="+" isDisabled={off} onPress={() => press(1)} />
        </PanelRow>
      )}

      {view.hvacModes.length > 0 && (
        <PanelRow label="Mode">
          {view.hvacModes.map((mode) => (
            <PanelButton
              key={mode}
              label={readableName(mode)}
              isSelected={view.hvacMode === mode}
              isDisabled={off}
              onPress={() => run(setHvacMode(entity, mode))}
            />
          ))}
        </PanelRow>
      )}

      {view.presetModes.length > 0 && (
        <PanelRow label="Preset">
          {view.presetModes.map((preset) => (
            <PanelButton
              key={preset}
              label={readableName(preset)}
              isSelected={view.presetMode === preset}
              isDisabled={off}
              onPress={() => run(setPreset(entity, preset))}
            />
          ))}
        </PanelRow>
      )}
    </div>
  );
}
