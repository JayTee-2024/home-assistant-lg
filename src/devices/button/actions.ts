/**
 * What pressing a button, scene or script sends to Home Assistant.
 */

import { domainOf, type EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';

/**
 * Buttons have a 'press' service; scenes and scripts are started with 'turn_on'.
 * The predicted state is the entity unchanged: a press leaves nothing to show.
 */
export function press(entity: EntityState): Action {
  const domain = domainOf(entity.entity_id);
  const service = domain === 'scene' || domain === 'script' ? 'turn_on' : 'press';

  return {
    call: { domain, service, entityId: entity.entity_id, data: {} },
    predicted: entity,
  };
}
