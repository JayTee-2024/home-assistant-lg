/**
 * What each vacuum control sends to Home Assistant.
 *
 * Home Assistant: https://www.home-assistant.io/integrations/vacuum/
 */

import type { EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';
import { predict } from '../shared/predict';

export function start(entity: EntityState): Action {
  return send(entity, 'start', 'cleaning');
}

export function pause(entity: EntityState): Action {
  return send(entity, 'pause', 'paused');
}

export function stop(entity: EntityState): Action {
  return send(entity, 'stop', 'idle');
}

export function returnHome(entity: EntityState): Action {
  return send(entity, 'return_to_base', 'returning');
}

/** Makes the vacuum beep so it can be found. Nothing about it changes. */
export function locate(entity: EntityState): Action {
  return {
    call: { domain: 'vacuum', service: 'locate', entityId: entity.entity_id, data: {} },
    predicted: entity,
  };
}

function send(entity: EntityState, service: string, state: string): Action {
  return {
    call: { domain: 'vacuum', service, entityId: entity.entity_id, data: {} },
    predicted: predict(entity, state),
  };
}
