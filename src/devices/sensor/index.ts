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
  icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
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
