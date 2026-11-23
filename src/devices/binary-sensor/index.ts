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
