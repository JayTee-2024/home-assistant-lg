/**
 * The inside of a button's card: the word for what OK will do.
 */

import type { CardProps } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { readButton } from './model';

export function ButtonCard({ entity }: CardProps) {
  const view = readButton(entity);

  return (
    <div class="face">
      <div class="face-state">{view.canPress ? view.verb : UNAVAILABLE}</div>
    </div>
  );
}
