/**
 * A vacuum's panel: start, pause, stop, send it home, and find it, as it supports them.
 * Return to dock stays available when it needs attention, which is when it is most useful.
 */

import type { PanelProps } from '../device-type';
import { PanelButton, PanelRow } from '../shared/controls';
import { locate, pause, returnHome, start, stop } from './actions';
import { readVacuum } from './model';

export function VacuumPanel({ entity, run }: PanelProps) {
  const view = readVacuum(entity);
  const off = !view.isAvailable;
  const isCleaning = view.activity === 'cleaning';

  return (
    <div>
      <PanelRow label={view.words}>
        {view.canStart && !isCleaning && (
          <PanelButton label="Start" isDisabled={off} onPress={() => run(start(entity))} />
        )}
        {view.canPause && isCleaning && (
          <PanelButton label="Pause" isDisabled={off} onPress={() => run(pause(entity))} />
        )}
        {view.canStop && (
          <PanelButton label="Stop" isDisabled={off} onPress={() => run(stop(entity))} />
        )}
        {view.canReturnHome && (
          <PanelButton
            label="Return to dock"
            isDisabled={off}
            onPress={() => run(returnHome(entity))}
          />
        )}
      </PanelRow>

      {view.canLocate && (
        <PanelRow label="Find it">
          <PanelButton label="Beep" isDisabled={off} onPress={() => run(locate(entity))} />
        </PanelRow>
      )}
    </div>
  );
}
