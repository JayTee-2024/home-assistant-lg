/**
 * The heating type: thermostats and heating controllers (Home Assistant's "climate").
 */

import type { DeviceType } from '../device-type';
import { ClimateCard } from './Card';
import { formatTemperature, readClimate } from './model';
import { ClimatePanel } from './Panel';

export const climateType: DeviceType = {
  id: 'climate',
  label: 'Heating',
  icon: 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
  domains: ['climate'],
  mainOrder: 20,
  cardSize: 'wide',
  supports: () => true,

  okAction: (entity) => (readClimate(entity).isAvailable ? 'open-panel' : 'nothing'),
  // On whenever it is switched on, as a light's card is: the card's words say whether it is heating or idle.
  isActive: (entity) => {
    const view = readClimate(entity);
    return view.isAvailable && view.hvacMode !== 'off';
  },
  summary: (entity) => {
    const view = readClimate(entity);
    const room = formatTemperature(view.currentTemperature);
    if (view.hvacMode === 'off' || view.targetTemperature === null) return room + ' · Off';
    return room + ' → ' + formatTemperature(view.targetTemperature);
  },

  Card: ClimateCard,
  Panel: ClimatePanel,
};
