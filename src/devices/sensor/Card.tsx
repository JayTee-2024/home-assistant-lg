/**
 * The inside of a sensor's card: the reading, large, with its unit beside it.
 */

import type { CardProps } from '../device-type';
import { readSensor } from './model';

export function SensorCard({ entity }: CardProps) {
  const view = readSensor(entity);

  return (
    <div class="face">
      <div class="face-state">
        {view.reading}
        {view.unit !== null && <span class="face-unit">{view.unit}</span>}
      </div>
    </div>
  );
}
