/**
 * The vacuum type: robot vacuums and mops.
 */

import type { DeviceType } from '../device-type';
import { VacuumCard } from './Card';
import { readVacuum } from './model';
import { VacuumPanel } from './Panel';

export const vacuumType: DeviceType = {
  id: 'vacuum',
  label: 'Vacuum',
  icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  domains: ['vacuum'],
  mainOrder: 40,
  cardSize: 'small',
  supports: () => true,

  okAction: (entity) => (readVacuum(entity).isAvailable ? 'open-panel' : 'nothing'),
  isActive: (entity) => entity.state === 'cleaning' || entity.state === 'returning',
  summary: (entity) => readVacuum(entity).words,

  Card: VacuumCard,
  Panel: VacuumPanel,
};
