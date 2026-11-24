/**
 * What each heating control sends to Home Assistant.
 *
 * Home Assistant: https://www.home-assistant.io/integrations/climate/
 */

import type { EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';
import { readClimate } from './model';
import { predict } from '../shared/predict';

export function setTarget(entity: EntityState, temperature: number): Action {
  return {
    call: {
      domain: 'climate',
      service: 'set_temperature',
      entityId: entity.entity_id,
      data: { temperature },
    },
    predicted: predict(entity, entity.state, withDoing(entity, entity.state, { temperature })),
  };
}

/**
 * What the thermostat will be doing after a press, for the card until Home Assistant reports (a cloud
 * thermostat such as Tado can take a while): 'off' when switched off; 'heating' or 'cooling' when the target
 * is beyond the room temperature in that mode; otherwise 'idle'. Without this the card kept the old word, so
 * a thermostat just switched on still said "Off". A thermostat that never says what it is doing gets no guess.
 */
function withDoing(
  entity: EntityState,
  mode: string,
  attributes: { [name: string]: unknown },
): { [name: string]: unknown } {
  if (readClimate(entity).hvacAction === null) return attributes;

  const after = readClimate(predict(entity, mode, attributes));
  const room = after.currentTemperature;
  const target = after.targetTemperature;
  let doing = 'idle';
  if (mode === 'off') doing = 'off';
  else if (room !== null && target !== null) {
    if (mode === 'heat' && target > room) doing = 'heating';
    if (mode === 'cool' && target < room) doing = 'cooling';
  }
  return Object.assign({}, attributes, { hvac_action: doing });
}

export function setHvacMode(entity: EntityState, mode: string): Action {
  return {
    call: {
      domain: 'climate',
      service: 'set_hvac_mode',
      entityId: entity.entity_id,
      data: { hvac_mode: mode },
    },
    predicted: predict(entity, mode, withDoing(entity, mode, {})),
  };
}

export function setPreset(entity: EntityState, preset: string): Action {
  return {
    call: {
      domain: 'climate',
      service: 'set_preset_mode',
      entityId: entity.entity_id,
      data: { preset_mode: preset },
    },
    predicted: predict(entity, entity.state, { preset_mode: preset }),
  };
}
