/**
 * What a switch's control sends to Home Assistant.
 */

import { domainOf, type EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';
import { predict } from '../shared/predict';

/**
 * Switches the entity to the other state. The service is called in the entity's own type
 * ('switch' or 'input_boolean'): both have a 'toggle' service.
 */
export function toggle(entity: EntityState): Action {
  return {
    call: {
      domain: domainOf(entity.entity_id),
      service: 'toggle',
      entityId: entity.entity_id,
      data: {},
    },
    predicted: predict(entity, entity.state === 'on' ? 'off' : 'on'),
  };
}
