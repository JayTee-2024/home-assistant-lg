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
