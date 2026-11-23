/**
 * Reads a robot vacuum into what the card and panel show.
 *
 * Its battery level is a separate sensor on the same device in current Home Assistant
 * versions, so it appears on the card as an extra line like any other part.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/vacuum
 */

import { hasFeature, isAvailable, type EntityState } from '../../core/home-assistant';
import { readableName, UNAVAILABLE } from '../shared/predict';

const PAUSE = 4;
const STOP = 8;
const RETURN_HOME = 16;
const LOCATE = 512;
const START = 8192;

/** Each activity in words. Anything not listed is shown in Home Assistant's own word. */
const WORDS: { [activity: string]: string } = {
  cleaning: 'Cleaning',
  docked: 'Docked',
  returning: 'Returning to dock',
  idle: 'Idle',
  paused: 'Paused',
  error: 'Needs attention',
};

export interface VacuumView {
  isAvailable: boolean;
  activity: string;
  words: string;
  canStart: boolean;
  canPause: boolean;
  canStop: boolean;
  canReturnHome: boolean;
  canLocate: boolean;
}

export function readVacuum(entity: EntityState): VacuumView {
  const available = isAvailable(entity);

  return {
    isAvailable: available,
    activity: entity.state,
    words: available ? (WORDS[entity.state] ?? readableName(entity.state)) : UNAVAILABLE,
    canStart: hasFeature(entity, START),
    canPause: hasFeature(entity, PAUSE),
    canStop: hasFeature(entity, STOP),
    canReturnHome: hasFeature(entity, RETURN_HOME),
    canLocate: hasFeature(entity, LOCATE),
  };
}
