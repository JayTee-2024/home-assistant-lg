/**
 * Reads a button, scene or script. There is very little to read: these are pressed or run,
 * and have no lasting state worth showing.
 *
 * A button's state is the time it was last pressed, or 'unknown' when it never has been.
 * So 'unknown' does not mean "broken" here, and only 'unavailable' stops it being pressed.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/button
 */

import { domainOf, type EntityState } from '../../core/home-assistant';

export interface ButtonView {
  canPress: boolean;
  /** What the button says: 'Run' for a script, 'Activate' for a scene, 'Press' otherwise. */
  verb: string;
}

export function readButton(entity: EntityState): ButtonView {
  const domain = domainOf(entity.entity_id);

  return {
    canPress: entity.state !== 'unavailable',
    verb: domain === 'script' ? 'Run' : domain === 'scene' ? 'Activate' : 'Press',
  };
}
