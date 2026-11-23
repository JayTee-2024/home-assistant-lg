/**
 * A cover's panel: Open, Stop and Close, and set positions when the cover supports them.
 */

import type { PanelProps } from '../device-type';
import { PanelButton, PanelRow } from '../shared/controls';
import { close, open, setPosition, stop } from './actions';
import { coverWords, readCover } from './model';

const POSITIONS = [0, 25, 50, 75, 100];

export function CoverPanel({ entity, run }: PanelProps) {
  const view = readCover(entity);
  const off = !view.isAvailable;

  return (
    <div>
      <PanelRow label={coverWords(view)}>
        {view.canOpen && (
          <PanelButton label="Open" isDisabled={off} onPress={() => run(open(entity))} />
        )}
        {view.canStop && (
          <PanelButton label="Stop" isDisabled={off} onPress={() => run(stop(entity))} />
        )}
        {view.canClose && (
          <PanelButton label="Close" isDisabled={off} onPress={() => run(close(entity))} />
        )}
      </PanelRow>

      {view.canSetPosition && (
        <PanelRow label="Position">
          {POSITIONS.map((position) => (
            <PanelButton
              key={position}
              label={position + '%'}
              isSelected={view.position === position}
              isDisabled={off}
              onPress={() => run(setPosition(entity, position))}
            />
          ))}
        </PanelRow>
      )}
    </div>
  );
}
