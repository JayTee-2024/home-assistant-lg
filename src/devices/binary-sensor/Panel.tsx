/**
 * A binary sensor's panel: the same words as the card. There is nothing to control.
 */

import type { PanelProps } from '../device-type';
import { PanelRow, PanelValue } from '../shared/controls';
import { readBinarySensor } from './model';

export function BinarySensorPanel({ entity }: PanelProps) {
  return (
    <PanelRow label="State">
      <PanelValue text={readBinarySensor(entity).words} />
    </PanelRow>
  );
}
