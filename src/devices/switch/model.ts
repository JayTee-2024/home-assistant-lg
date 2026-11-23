/**
 * Reads a switch, plug or on/off helper into what the card shows.
 *
 * Home Assistant: https://www.home-assistant.io/integrations/switch/
 */

import { isAvailable, type EntityState } from '../../core/home-assistant';

export interface SwitchView {
  isOn: boolean;
  isAvailable: boolean;
}

export function readSwitch(entity: EntityState): SwitchView {
  return { isOn: entity.state === 'on', isAvailable: isAvailable(entity) };
}
