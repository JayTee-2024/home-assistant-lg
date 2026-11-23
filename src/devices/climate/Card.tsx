/**
 * The inside of a heating card: the room temperature, and the target and mode under it.
 */

import type { CardProps } from '../device-type';
import { readableName, UNAVAILABLE } from '../shared/predict';
import { formatTemperature, readClimate } from './model';

export function ClimateCard({ entity }: CardProps) {
  const view = readClimate(entity);
  if (!view.isAvailable) {
    return (
      <div class="face">
        <div class="face-state">{UNAVAILABLE}</div>
      </div>
    );
  }

  const doing =
    view.hvacAction === null ? readableName(view.hvacMode) : readableName(view.hvacAction);

  return (
    <div class="face">
      <div class="face-big">{formatTemperature(view.currentTemperature)}</div>
      <div class="face-detail">
        {view.hvacMode === 'off' ? 'Off' : 'Set to ' + formatTemperature(view.targetTemperature)}
        {' · ' + doing}
      </div>
    </div>
  );
}
