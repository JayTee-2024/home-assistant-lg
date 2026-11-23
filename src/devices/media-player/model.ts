/**
 * Reads a media player (a speaker, a TV) into what the card and panel show.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/media-player
 */

import {
  hasFeature,
  isAvailable,
  readNumber,
  readText,
  readTextList,
  type EntityState,
} from '../../core/home-assistant';

/** The supported_features bits this type uses. */
const PAUSE = 1;
const VOLUME_SET = 4;
const VOLUME_MUTE = 8;
const PREVIOUS_TRACK = 16;
const NEXT_TRACK = 32;
const TURN_ON = 128;
const TURN_OFF = 256;
const SELECT_SOURCE = 2048;
const PLAY = 16384;

/** How much one press of volume − or + changes the volume, in percent. */
const VOLUME_STEP = 5;

export interface MediaPlayerView {
  isAvailable: boolean;
  /** 'playing', 'paused', 'idle', 'off', 'on', 'standby', 'buffering'. */
  state: string;
  isPlaying: boolean;
  title: string | null;
  artist: string | null;
  /** 0 to 100. null when the player does not report it. */
  volumePercent: number | null;
  isMuted: boolean;
  source: string | null;
  sources: string[];
  /** True when it can do at least one of play and pause. */
  canPlayPause: boolean;
  canPlay: boolean;
  canPause: boolean;
  canSetVolume: boolean;
  canMute: boolean;
  canSkip: boolean;
  canSelectSource: boolean;
  canTurnOn: boolean;
  canTurnOff: boolean;
}

export function readMediaPlayer(entity: EntityState): MediaPlayerView {
  const volume = readNumber(entity, 'volume_level');

  return {
    isAvailable: isAvailable(entity),
    state: entity.state,
    isPlaying: entity.state === 'playing',
    title: readText(entity, 'media_title'),
    artist: readText(entity, 'media_artist'),
    volumePercent: volume === null ? null : Math.round(volume * 100),
    isMuted: entity.attributes['is_volume_muted'] === true,
    source: readText(entity, 'source'),
    sources: readTextList(entity, 'source_list'),
    canPlayPause: hasFeature(entity, PAUSE) || hasFeature(entity, PLAY),
    canPlay: hasFeature(entity, PLAY),
    canPause: hasFeature(entity, PAUSE),
    canSetVolume: hasFeature(entity, VOLUME_SET),
    canMute: hasFeature(entity, VOLUME_MUTE),
    canSkip: hasFeature(entity, NEXT_TRACK) || hasFeature(entity, PREVIOUS_TRACK),
    canSelectSource: hasFeature(entity, SELECT_SOURCE),
    canTurnOn: hasFeature(entity, TURN_ON),
    canTurnOff: hasFeature(entity, TURN_OFF),
  };
}

/** The volume one press of − (-1) or + (1) leads to: the next multiple of 5, from 0 to 100. */
export function nextVolume(current: number | null, direction: -1 | 1): number {
  const from = current ?? 0;
  const next =
    direction === 1
      ? Math.floor(from / VOLUME_STEP) * VOLUME_STEP + VOLUME_STEP
      : Math.ceil(from / VOLUME_STEP) * VOLUME_STEP - VOLUME_STEP;
  return Math.max(0, Math.min(100, next));
}
