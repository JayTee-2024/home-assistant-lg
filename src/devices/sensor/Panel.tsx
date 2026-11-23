/**
 * A sensor's panel: the same reading as the card. There is nothing to control.
 */

import type { PanelProps } from '../device-type';
import { PanelRow, PanelValue } from '../shared/controls';
import { readSensor, sensorText } from './model';

export function SensorPanel({ entity }: PanelProps) {
  return (
    <PanelRow label="Reading">
      <PanelValue text={sensorText(readSensor(entity))} />
    </PanelRow>
  );
}
