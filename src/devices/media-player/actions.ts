/**
 * What each media player control sends to Home Assistant.
 *
 * Home Assistant: https://www.home-assistant.io/integrations/media_player/
 */

import type { EntityState } from '../../core/home-assistant';
import type { Action } from '../device-type';
import { predict } from '../shared/predict';
import { readMediaPlayer } from './model';

/**
 * Plays a paused player, or pauses a playing one. Home Assistant's own play/pause service
 * needs a player that supports both, so a player that supports only one is sent that one.
 * Gives null when the player cannot do what is needed (a playing player with no pause).
 */
export function playPause(entity: EntityState): Action | null {
  const view = readMediaPlayer(entity);
  const toState = view.isPlaying ? 'paused' : 'playing';

  if (view.canPlay && view.canPause) return send(entity, 'media_play_pause', {}, toState);
  if (view.isPlaying && view.canPause) return send(entity, 'media_pause', {}, toState);
  if (!view.isPlaying && view.canPlay) return send(entity, 'media_play', {}, toState);
  return null;
}

export function next(entity: EntityState): Action {
  return send(entity, 'media_next_track', {});
}

export function previous(entity: EntityState): Action {
  return send(entity, 'media_previous_track', {});
}

/** `percent` is 0 to 100; Home Assistant wants a fraction, 0 to 1. */
export function setVolume(entity: EntityState, percent: number): Action {
  const level = Math.max(0, Math.min(100, percent)) / 100;
  return send(entity, 'volume_set', { volume_level: level }, entity.state, { volume_level: level });
}

export function mute(entity: EntityState, isMuted: boolean): Action {
  return send(entity, 'volume_mute', { is_volume_muted: isMuted }, entity.state, {
    is_volume_muted: isMuted,
  });
}

export function selectSource(entity: EntityState, source: string): Action {
  return send(entity, 'select_source', { source }, entity.state, { source });
}

export function turnOn(entity: EntityState): Action {
  return send(entity, 'turn_on', {}, 'on');
}

export function turnOff(entity: EntityState): Action {
  return send(entity, 'turn_off', {}, 'off');
}

/** A media_player service call, predicting `state` (unchanged by default) and some attributes. */
function send(
  entity: EntityState,
  service: string,
  data: { [name: string]: unknown },
  state: string = entity.state,
  attributes: { [name: string]: unknown } = {},
): Action {
  return {
    call: { domain: 'media_player', service, entityId: entity.entity_id, data },
    predicted: predict(entity, state, attributes),
  };
}
