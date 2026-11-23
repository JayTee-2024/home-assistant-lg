/**
 * The media player type: speakers, TVs and streaming boxes that Home Assistant controls.
 */

import type { DeviceType } from '../device-type';
import { readableName, UNAVAILABLE } from '../shared/predict';
import { playPause } from './actions';
import { MediaPlayerCard } from './Card';
import { readMediaPlayer } from './model';
import { MediaPlayerPanel } from './Panel';

export const mediaPlayerType: DeviceType = {
  id: 'media_player',
  label: 'Media',
  icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  domains: ['media_player'],
  mainOrder: 30,
  cardSize: 'wide',
  supports: () => true,

  okAction: (entity) => {
    const view = readMediaPlayer(entity);
    if (!view.isAvailable) return 'nothing';
    return view.canPlayPause ? playPause(entity) : 'open-panel';
  },
  isActive: (entity) => readMediaPlayer(entity).isPlaying,
  summary: (entity) => {
    const view = readMediaPlayer(entity);
    if (!view.isAvailable) return UNAVAILABLE;
    const state = readableName(view.state);
    return view.title === null ? state : state + ' · ' + view.title;
  },

  Card: MediaPlayerCard,
  Panel: MediaPlayerPanel,
};
