/**
 * A button's panel: the one button.
 */

import type { PanelProps } from '../device-type';
import { PanelButton, PanelRow } from '../shared/controls';
import { press } from './actions';
import { readButton } from './model';

export function ButtonPanel({ entity, run }: PanelProps) {
  const view = readButton(entity);

  return (
    <PanelRow label="Action">
      <PanelButton
        label={view.verb}
        isDisabled={!view.canPress}
        onPress={() => run(press(entity))}
      />
    </PanelRow>
  );
}
