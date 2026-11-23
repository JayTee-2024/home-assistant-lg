/**
 * A switch's panel: one button that turns it on or off.
 */

import type { PanelProps } from '../device-type';
import { PanelButton, PanelRow } from '../shared/controls';
import { toggle } from './actions';
import { readSwitch } from './model';

export function SwitchPanel({ entity, run }: PanelProps) {
  const view = readSwitch(entity);

  return (
    <PanelRow label={view.isOn ? 'On' : 'Off'}>
      <PanelButton
        label={view.isOn ? 'Turn off' : 'Turn on'}
        isDisabled={!view.isAvailable}
        onPress={() => run(toggle(entity))}
      />
    </PanelRow>
  );
}
