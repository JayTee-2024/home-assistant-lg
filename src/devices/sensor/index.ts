/**
 * The sensor type: anything that reports a reading, such as a temperature or a battery level.
 */

import type { DeviceType } from '../device-type';
import { SensorCard } from './Card';
import { readSensor, sensorText } from './model';
import { SensorPanel } from './Panel';

export const sensorType: DeviceType = {
  id: 'sensor',
  label: 'Sensor',
  domains: ['sensor'],
  mainOrder: 100,
  cardSize: 'small',
  supports: () => true,

  okAction: () => 'nothing',
  isActive: () => false,
  summary: (entity) => sensorText(readSensor(entity)),

  Card: SensorCard,
  Panel: SensorPanel,
};
