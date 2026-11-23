/**
 * The inside of a switch's card: On or Off.
 */

import type { CardProps } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { readSwitch } from './model';

export function SwitchCard({ entity }: CardProps) {
  const view = readSwitch(entity);

  return (
    <div class="face">
      <div class="face-state">{!view.isAvailable ? UNAVAILABLE : view.isOn ? 'On' : 'Off'}</div>
    </div>
  );
}
