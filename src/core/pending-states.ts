/**
 * Shows a press at once, before Home Assistant confirms it.
 *
 * When the person presses OK on a lamp, the card should change immediately. Home
 * Assistant's confirmation takes a moment (longer for cloud devices). So the app keeps the
 * state each action predicts (see Action in src/devices/device-type.ts) as "pending", and
 * lays it over the real state until one of two things happens:
 *   - Home Assistant reports a new state for that entity, which then wins, right or wrong;
 *   - five seconds pass, so a command that got lost cannot leave a wrong state on screen.
 * A command that fails outright removes its pending state straight away (withoutPending).
 *
 * Every function returns a new value and leaves what it was given untouched.
 */

import type { EntityState, HomeSnapshot } from './home-assistant';

export interface PendingStates {
  [entityId: string]: { state: EntityState; since: number };
}

/** How long a predicted state is shown without confirmation, in milliseconds. */
export const PENDING_LIMIT_MS = 5000;

/** Adds (or replaces) the predicted state for one entity. `now` is the time of the press. */
export function withPending(
  pending: PendingStates,
  predicted: EntityState,
  now: number,
): PendingStates {
  return { ...pending, [predicted.entity_id]: { state: predicted, since: now } };
}

/** Removes one entity's predicted state. Gives back the same list when there was none. */
export function withoutPending(pending: PendingStates, entityId: string): PendingStates {
  if (pending[entityId] === undefined) return pending;

  const rest: PendingStates = {};
  for (const id of Object.keys(pending)) {
    const entry = pending[id];
    if (id !== entityId && entry !== undefined) rest[id] = entry;
  }
  return rest;
}

/**
 * Drops the predictions that are finished with: those whose entity Home Assistant has
 * reported anew between `previous` and `next`, and those older than PENDING_LIMIT_MS.
 * Gives back the same list when nothing was dropped.
 *
 * "Reported anew" is checked by comparing the two state objects themselves: the connection
 * keeps the same object for an entity until Home Assistant sends a change for it.
 */
export function settle(
  pending: PendingStates,
  previous: HomeSnapshot,
  next: HomeSnapshot,
  now: number,
): PendingStates {
  let settled = pending;

  for (const entityId of Object.keys(pending)) {
    const entry = pending[entityId];
    if (entry === undefined) continue;

    const wasReported = previous.states[entityId] !== next.states[entityId];
    const isTooOld = now - entry.since >= PENDING_LIMIT_MS;
    if (wasReported || isTooOld) settled = withoutPending(settled, entityId);
  }

  return settled;
}

/** The home as it should be shown: the real states with the predicted ones laid over them. */
export function applyPending(home: HomeSnapshot, pending: PendingStates): HomeSnapshot {
  const entityIds = Object.keys(pending).filter((entityId) => home.states[entityId] !== undefined);
  if (entityIds.length === 0) return home;

  const states = { ...home.states };
  for (const entityId of entityIds) {
    const entry = pending[entityId];
    if (entry !== undefined) states[entityId] = entry.state;
  }
  return { states, entities: home.entities, devices: home.devices, areas: home.areas };
}
