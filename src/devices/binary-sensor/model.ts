/**
 * Reads a binary sensor (one that is only ever on or off) into words that fit its kind:
 * a door is Open or Closed, a motion sensor reads Detected or Clear.
 *
 * Home Assistant names the kind in the `device_class` attribute. The full list:
 * https://www.home-assistant.io/integrations/binary_sensor/#device-class
 */

import { isAvailable, readText, type EntityState } from '../../core/home-assistant';
import { UNAVAILABLE } from '../shared/predict';

export interface BinarySensorView {
  isOn: boolean;
  /** The state in words: 'Open', 'Clear', 'Unavailable'. */
  words: string;
}

/** For each kind: the word when on, then the word when off. Kinds not listed read On and Off. */
const WORDS: { [deviceClass: string]: [string, string] } = {
  door: ['Open', 'Closed'],
  window: ['Open', 'Closed'],
  opening: ['Open', 'Closed'],
  garage_door: ['Open', 'Closed'],
  motion: ['Detected', 'Clear'],
  occupancy: ['Detected', 'Clear'],
  presence: ['Detected', 'Clear'],
  smoke: ['Detected', 'Clear'],
  gas: ['Detected', 'Clear'],
  problem: ['Detected', 'Clear'],
  safety: ['Detected', 'Clear'],
  battery: ['Low', 'Normal'],
  connectivity: ['Connected', 'Disconnected'],
  moisture: ['Wet', 'Dry'],
  lock: ['Unlocked', 'Locked'],
};

const DEFAULT_WORDS: [string, string] = ['On', 'Off'];

export function readBinarySensor(entity: EntityState): BinarySensorView {
  if (!isAvailable(entity)) return { isOn: false, words: UNAVAILABLE };

  const isOn = entity.state === 'on';
  const pair = WORDS[readText(entity, 'device_class') ?? ''] ?? DEFAULT_WORDS;
  return { isOn, words: isOn ? pair[0] : pair[1] };
}
