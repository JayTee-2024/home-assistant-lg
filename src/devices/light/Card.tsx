/**
 * The inside of a light's card: On or Off, the brightness, and a dot in the light's colour.
 */

import type { CardProps } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { readLight } from './model';

export function LightCard({ entity }: CardProps) {
  const view = readLight(entity);
  const rgb = view.rgb;

  return (
    <div class="face">
      <div class="face-state">{!view.isAvailable ? UNAVAILABLE : view.isOn ? 'On' : 'Off'}</div>
      {view.brightnessPercent !== null && (
        <div class="face-detail">
          {rgb !== null && (
            <span
              class="face-dot"
              style={{ backgroundColor: 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')' }}
            />
          )}
          {view.brightnessPercent}%
        </div>
      )}
    </div>
  );
}
