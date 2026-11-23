/**
 * What each cover control sends to Home Assistant.
 *
 * Home Assistant: https://www.home-assistant.io/integrations/cover/
 */

import type { EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';
import { predict } from '../shared/predict';

export function open(entity: EntityState): Action {
  return send(entity, 'open_cover', {}, 'opening');
}

export function close(entity: EntityState): Action {
  return send(entity, 'close_cover', {}, 'closing');
}

export function stop(entity: EntityState): Action {
  return send(entity, 'stop_cover', {}, entity.state);
}

/** `position` is 0 (closed) to 100 (open), and is kept in that range. */
export function setPosition(entity: EntityState, position: number): Action {
  const kept = Math.max(0, Math.min(100, Math.round(position)));
  return send(entity, 'set_cover_position', { position: kept }, entity.state, {
    current_position: kept,
  });
}

function send(
  entity: EntityState,
  service: string,
  data: { [name: string]: unknown },
  state: string,
  attributes: { [name: string]: unknown } = {},
): Action {
  return {
    call: { domain: 'cover', service, entityId: entity.entity_id, data },
    predicted: predict(entity, state, attributes),
  };
}
