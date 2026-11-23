/**
 * The inside of a vacuum's card: what it is doing, in words.
 */

import type { CardProps } from '../device-type';
import { readVacuum } from './model';

export function VacuumCard({ entity }: CardProps) {
  return (
    <div class="face">
      <div class="face-state">{readVacuum(entity).words}</div>
    </div>
  );
}
