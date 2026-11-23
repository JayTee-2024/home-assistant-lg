/**
 * The inside of a binary sensor's card: its state in words.
 */

import type { CardProps } from '../device-type';
import { readBinarySensor } from './model';

export function BinarySensorCard({ entity }: CardProps) {
  return (
    <div class="face">
      <div class="face-state">{readBinarySensor(entity).words}</div>
    </div>
  );
}
