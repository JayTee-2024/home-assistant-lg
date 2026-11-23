/**
 * The fan type: ceiling, desk and tower fans.
 */

import type { DeviceType } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { toggle } from './actions';
import { FanCard } from './Card';
import { readFan } from './model';
import { FanPanel } from './Panel';

export const fanType: DeviceType = {
  id: 'fan',
  label: 'Fan',
  icon: 'M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 12c0 4-2 8-6 8M12 12c4 0 8 2 8 6M12 12c-4 0-8-2-8-6',
  domains: ['fan'],
  mainOrder: 70,
  cardSize: 'small',
  supports: () => true,

  okAction: (entity) => (readFan(entity).isAvailable ? toggle(entity) : 'nothing'),
  isActive: (entity) => readFan(entity).isOn,
  summary: (entity) => {
    const view = readFan(entity);
    if (!view.isAvailable) return UNAVAILABLE;
    if (!view.isOn) return 'Off';
    return view.speedPercent === null ? 'On' : 'On · ' + view.speedPercent + '%';
  },

  Card: FanCard,
  Panel: FanPanel,
};
