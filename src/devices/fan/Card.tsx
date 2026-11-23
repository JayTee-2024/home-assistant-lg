/**
 * The inside of a fan's card: On or Off, and its speed.
 */

import type { CardProps } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { readFan } from './model';

export function FanCard({ entity }: CardProps) {
  const view = readFan(entity);

  return (
    <div class="face">
      <div class="face-state">{!view.isAvailable ? UNAVAILABLE : view.isOn ? 'On' : 'Off'}</div>
      {view.isOn && view.speedPercent !== null && (
        <div class="face-detail">{view.speedPercent}%</div>
      )}
    </div>
  );
}
