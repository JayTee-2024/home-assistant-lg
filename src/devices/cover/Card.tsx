/**
 * The inside of a cover's card: Open or Closed, and how far open.
 */

import type { CardProps } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { coverWords, readCover } from './model';

export function CoverCard({ entity }: CardProps) {
  const view = readCover(entity);

  return (
    <div class="face">
      <div class="face-state">{view.isAvailable ? coverWords(view) : UNAVAILABLE}</div>
      {view.isAvailable && view.position !== null && (
        <div class="face-detail">{view.position}%</div>
      )}
    </div>
  );
}
