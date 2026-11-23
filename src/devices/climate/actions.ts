/**
 * What each heating control sends to Home Assistant.
 *
 * Home Assistant: https://www.home-assistant.io/integrations/climate/
 */

import type { EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';
import { predict } from '../shared/predict';

export function setTarget(entity: EntityState, temperature: number): Action {
  return {
    call: {
      domain: 'climate',
      service: 'set_temperature',
      entityId: entity.entity_id,
      data: { temperature },
    },
    predicted: predict(entity, entity.state, { temperature }),
  };
}

export function setHvacMode(entity: EntityState, mode: string): Action {
  return {
    call: {
      domain: 'climate',
      service: 'set_hvac_mode',
      entityId: entity.entity_id,
      data: { hvac_mode: mode },
    },
    predicted: predict(entity, mode),
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
