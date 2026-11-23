/**
 * Gives tests the sample home from fixtures/sample-home.json in the shapes the app uses.
 *
 * Test support only: nothing in the app imports this file, so it is never part of the build.
 */

import type { EntityState, HomeSnapshot } from '../core/home-assistant';
import rawSampleHome from '../../fixtures/sample-home.json';

/** A fresh copy of the sample home, safe for a test to change. */
export function sampleHome(): HomeSnapshot {
  const copy = JSON.parse(JSON.stringify(rawSampleHome)) as typeof rawSampleHome;
  const states: { [entityId: string]: EntityState } = {};
  for (const state of copy.states as EntityState[]) {
    states[state.entity_id] = state;
  }
  return { states, entities: copy.entities, devices: copy.devices, areas: copy.areas };
}

/** One entity from the sample home. Throws when the id is not in the sample, to catch typos in tests. */
export function sampleEntity(entityId: string): EntityState {
  const entity = sampleHome().states[entityId];
  if (entity === undefined) {
    throw new Error('No entity "' + entityId + '" in fixtures/sample-home.json');
  }
  return entity;
}

/** A copy of `entity` with some attributes replaced, and optionally a different state. */
export function changed(
  entity: EntityState,
  attributes: { [name: string]: unknown },
  state: string = entity.state,
): EntityState {
  return {
    entity_id: entity.entity_id,
    state,
    attributes: Object.assign({}, entity.attributes, attributes),
  };
}
