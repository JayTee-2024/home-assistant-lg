/**
 * The light type: bulbs, lamps and dimmers.
 */

import type { DeviceType } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { toggle } from './actions';
import { LightCard } from './Card';
import { readLight } from './model';
import { LightPanel } from './Panel';

export const lightType: DeviceType = {
  id: 'light',
  label: 'Light',
  icon: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  domains: ['light'],
  mainOrder: 50,
  cardSize: 'small',
  supports: () => true,

  okAction: (entity) => (readLight(entity).isAvailable ? toggle(entity) : 'nothing'),
  isActive: (entity) => readLight(entity).isOn,
  summary: (entity) => {
    const view = readLight(entity);
    if (!view.isAvailable) return UNAVAILABLE;
    if (!view.isOn) return 'Off';
    return view.brightnessPercent === null ? 'On' : 'On · ' + view.brightnessPercent + '%';
  },

  Card: LightCard,
  Panel: LightPanel,
};
