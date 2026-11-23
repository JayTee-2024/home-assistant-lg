/**
 * Small helpers the device types share for building predicted states and readable words.
 */

import type { EntityState } from '../../core/home-assistant';

/** A copy of `entity` with a new state and some attributes replaced. The original is not changed. */
export function predict(
  entity: EntityState,
  state: string,
  attributes: { [name: string]: unknown } = {},
): EntityState {
  return {
    entity_id: entity.entity_id,
    state,
    attributes: Object.assign({}, entity.attributes, attributes),
  };
}

/** Turns Home Assistant's lower_case_names into words for the screen: 'effect_pulse' → 'Effect pulse'. */
export function readableName(text: string): string {
  const words = text.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The word a card shows for an entity Home Assistant cannot reach. */
export const UNAVAILABLE = 'Unavailable';
