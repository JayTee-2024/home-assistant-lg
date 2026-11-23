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
