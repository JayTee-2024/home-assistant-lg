/**
 * Tests for the media player type: speakers and TVs that Home Assistant can play and pause.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import {
  mute,
  next,
  playPause,
  previous,
  selectSource,
  setVolume,
  turnOff,
  turnOn,
} from './actions';
import { mediaPlayerType } from './index';
import { nextVolume, readMediaPlayer } from './model';

const sonos = sampleEntity('media_player.living_room_sonos'); // playing, 32%, title and artist, features 18493

describe('readMediaPlayer', () => {
  it('reads a speaker that is playing', () => {
    const view = readMediaPlayer(sonos);

    expect(view.state).toBe('playing');
    expect(view.isPlaying).toBe(true);
    expect(view.title).toBe('Clair de Lune');
    expect(view.artist).toBe('Claude Debussy');
    expect(view.volumePercent).toBe(32);
    expect(view.isMuted).toBe(false);
    expect(view.source).toBe('Radio');
    expect(view.sources).toEqual(['Radio', 'TV', 'Line-in']);
  });

  it('reads what the speaker supports from its features', () => {
    const view = readMediaPlayer(sonos);

    expect(view.canPlayPause).toBe(true);
    expect(view.canSetVolume).toBe(true);
    expect(view.canMute).toBe(true);
    expect(view.canSkip).toBe(true);
    expect(view.canSelectSource).toBe(true);
    expect(view.canTurnOn).toBe(false);
    expect(view.canTurnOff).toBe(false);
  });

  it('reads a player that is off and reports nothing else', () => {
    const view = readMediaPlayer({ entity_id: 'media_player.tv', state: 'off', attributes: {} });

    expect(view.isPlaying).toBe(false);
    expect(view.title).toBeNull();
    expect(view.volumePercent).toBeNull();
    expect(view.canPlayPause).toBe(false);
    expect(view.sources).toEqual([]);
  });

  it('reads an unavailable player as not available', () => {
    expect(readMediaPlayer(changed(sonos, {}, 'unavailable')).isAvailable).toBe(false);
  });
});

describe('nextVolume', () => {
  it('moves in steps of 5, between 0 and 100', () => {
    expect(nextVolume(32, 1)).toBe(35);
    expect(nextVolume(32, -1)).toBe(30);
    expect(nextVolume(100, 1)).toBe(100);
    expect(nextVolume(0, -1)).toBe(0);
    expect(nextVolume(null, 1)).toBe(5);
  });
});

describe('media player actions', () => {
  const call = (action: { call: { service: string; data: unknown } }) => [
    action.call.service,
    action.call.data,
  ];

  it('plays and pauses, predicting the other state', () => {
    expect(call(playPause(sonos))).toEqual(['media_play_pause', {}]);
    expect(playPause(sonos).predicted.state).toBe('paused');
    expect(playPause(changed(sonos, {}, 'paused')).predicted.state).toBe('playing');
  });

  it('skips forward and back', () => {
    expect(call(next(sonos))).toEqual(['media_next_track', {}]);
    expect(call(previous(sonos))).toEqual(['media_previous_track', {}]);
  });

  it('sets the volume as a fraction, and predicts it', () => {
    expect(call(setVolume(sonos, 45))).toEqual(['volume_set', { volume_level: 0.45 }]);
    expect(readMediaPlayer(setVolume(sonos, 45).predicted).volumePercent).toBe(45);
  });

  it('mutes, chooses a source, and turns on and off', () => {
    expect(call(mute(sonos, true))).toEqual(['volume_mute', { is_volume_muted: true }]);
    expect(call(selectSource(sonos, 'TV'))).toEqual(['select_source', { source: 'TV' }]);
    expect(call(turnOn(sonos))).toEqual(['turn_on', {}]);
    expect(call(turnOff(sonos))).toEqual(['turn_off', {}]);
    expect(turnOff(sonos).call.domain).toBe('media_player');
  });
});

describe('the media player type', () => {
  it('is a wide card that plays or pauses on OK', () => {
    expect(mediaPlayerType.cardSize).toBe('wide');
    expect(mediaPlayerType.okAction(sonos)).toEqual(playPause(sonos));
  });

  it('opens its panel on OK when it cannot play or pause, and does nothing when unavailable', () => {
    expect(mediaPlayerType.okAction(changed(sonos, { supported_features: 4 }))).toBe('open-panel');
    expect(mediaPlayerType.okAction(changed(sonos, {}, 'unavailable'))).toBe('nothing');
  });

  it('is shown as on while playing', () => {
    expect(mediaPlayerType.isActive(sonos)).toBe(true);
    expect(mediaPlayerType.isActive(changed(sonos, {}, 'paused'))).toBe(false);
  });

  it('sums itself up as what is playing', () => {
    expect(mediaPlayerType.summary(sonos)).toBe('Playing · Clair de Lune');
    expect(mediaPlayerType.summary(changed(sonos, { media_title: null }, 'idle'))).toBe('Idle');
  });
});
