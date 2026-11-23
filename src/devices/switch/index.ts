/**
 * The switch type: switches, smart plugs, and on/off helpers (input_boolean).
 */

import type { DeviceType } from '../device-type';
import { UNAVAILABLE } from '../shared/predict';
import { toggle } from './actions';
import { SwitchCard } from './Card';
import { readSwitch } from './model';
import { SwitchPanel } from './Panel';

export const switchType: DeviceType = {
  id: 'switch',
  label: 'Switch',
  icon: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8zM12 18v4',
  domains: ['switch', 'input_boolean'],
  mainOrder: 80,
  cardSize: 'small',
  supports: () => true,

  okAction: (entity) => (readSwitch(entity).isAvailable ? toggle(entity) : 'nothing'),
  isActive: (entity) => readSwitch(entity).isOn,
  summary: (entity) => {
    const view = readSwitch(entity);
    if (!view.isAvailable) return UNAVAILABLE;
    return view.isOn ? 'On' : 'Off';
  },

  Card: SwitchCard,
  Panel: SwitchPanel,
};
