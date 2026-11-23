/**
 * What each fan control sends to Home Assistant.
 *
 * Home Assistant: https://www.home-assistant.io/integrations/fan/
 */

import type { EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';
import { predict } from '../shared/predict';

export function toggle(entity: EntityState): Action {
  return send(entity, 'toggle', {}, entity.state === 'on' ? 'off' : 'on');
}

/** A speed of 0 turns the fan off. */
export function setSpeed(entity: EntityState, percent: number): Action {
  return send(entity, 'set_percentage', { percentage: percent }, percent > 0 ? 'on' : 'off', {
    percentage: percent,
  });
}

export function oscillate(entity: EntityState, isOscillating: boolean): Action {
  return send(entity, 'oscillate', { oscillating: isOscillating }, entity.state, {
    oscillating: isOscillating,
  });
}

export function setPreset(entity: EntityState, preset: string): Action {
  return send(entity, 'set_preset_mode', { preset_mode: preset }, 'on', { preset_mode: preset });
}

function send(
  entity: EntityState,
  service: string,
  data: { [name: string]: unknown },
  state: string,
  attributes: { [name: string]: unknown } = {},
): Action {
  return {
    call: { domain: 'fan', service, entityId: entity.entity_id, data },
    predicted: predict(entity, state, attributes),
  };
}
