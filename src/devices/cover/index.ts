/**
 * The cover type: blinds, curtains, shades, shutters, awnings and windows.
 *
 * Doors, garage doors and gates are never supported, and nor is a cover that does not say
 * what it is: see SAFE_COVER_KINDS in src/core/devices.ts, which `supports` uses too.
 */

import { readText } from '../../core/home-assistant';
import { SAFE_COVER_KINDS } from '../../core/devices';
import type { DeviceType } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { CoverCard } from './Card';
import { coverWords, readCover } from './model';
import { CoverPanel } from './Panel';

export const coverType: DeviceType = {
  id: 'cover',
  label: 'Blind',
  icon: 'M3 3h18M5 3v12h14V3M5 7h14M5 11h14M12 15v5',
  domains: ['cover'],
  mainOrder: 60,
  cardSize: 'small',
  supports: (entity) => {
    const kind = readText(entity, 'device_class');
    return kind !== null && SAFE_COVER_KINDS.indexOf(kind) !== -1;
  },

  okAction: (entity) => (readCover(entity).isAvailable ? 'open-panel' : 'nothing'),
  isActive: (entity) => entity.state !== 'closed' && readCover(entity).isAvailable,
  summary: (entity) => {
    const view = readCover(entity);
    if (!view.isAvailable) return UNAVAILABLE;
    const words = coverWords(view).replace('…', '');
    return view.position === null ? words : words + ' · ' + view.position + '%';
  },

  Card: CoverCard,
  Panel: CoverPanel,
};
