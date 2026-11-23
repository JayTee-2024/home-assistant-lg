/**
 * The binary sensor type: door and window contacts, motion sensors, leak sensors and the like.
 */

import type { DeviceType } from '../device-type';
import { BinarySensorCard } from './Card';
import { readBinarySensor } from './model';
import { BinarySensorPanel } from './Panel';

export const binarySensorType: DeviceType = {
  id: 'binary_sensor',
  label: 'Sensor',
  icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  domains: ['binary_sensor'],
  mainOrder: 110,
  cardSize: 'small',
  supports: () => true,

  okAction: () => 'nothing',
  isActive: (entity) => readBinarySensor(entity).isOn,
  summary: (entity) => readBinarySensor(entity).words,

  Card: BinarySensorCard,
  Panel: BinarySensorPanel,
};
