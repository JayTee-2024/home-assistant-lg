/**
 * What each light control sends to Home Assistant.
 *
 * Everything except toggle is the service 'light.turn_on' with one setting, which also
 * turns the light on. Home Assistant:
 * https://www.home-assistant.io/integrations/light/#action-lightturn_on
 */

import type { EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';
import { predict } from '../shared/predict';
import { readLight } from './model';

export function toggle(entity: EntityState): Action {
  return {
    call: { domain: 'light', service: 'toggle', entityId: entity.entity_id, data: {} },
    predicted: predict(entity, entity.state === 'on' ? 'off' : 'on'),
  };
}

/** `percent` is kept between 1 and 100. */
export function setBrightness(entity: EntityState, percent: number): Action {
  const kept = Math.max(1, Math.min(100, Math.round(percent)));

  return turnOn(entity, { brightness_pct: kept }, { brightness: Math.round((kept / 100) * 255) });
}

/** `kelvin` is kept inside the range the light itself reports. */
export function setWhite(entity: EntityState, kelvin: number): Action {
  const view = readLight(entity);
  const kept = Math.max(view.minKelvin, Math.min(view.maxKelvin, Math.round(kelvin)));

  return turnOn(
    entity,
    { color_temp_kelvin: kept },
    { color_temp_kelvin: kept, color_mode: 'color_temp', rgb_color: null },
  );
}

export function setColour(entity: EntityState, rgb: [number, number, number]): Action {
  return turnOn(entity, { rgb_color: rgb }, { rgb_color: rgb, color_temp_kelvin: null });
}

export function setEffect(entity: EntityState, effect: string): Action {
  return turnOn(entity, { effect }, { effect });
}

/** light.turn_on with `data`, predicting the light on with `predictedAttributes` laid over its own. */
function turnOn(
  entity: EntityState,
  data: { [name: string]: unknown },
  predictedAttributes: { [name: string]: unknown },
): Action {
  return {
    call: { domain: 'light', service: 'turn_on', entityId: entity.entity_id, data },
    predicted: predict(entity, 'on', predictedAttributes),
  };
}
