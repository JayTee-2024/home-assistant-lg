/**
 * The list of device types the app supports.
 *
 * To add a type: make its folder (copy an existing one), then add it to the list below.
 * The picker, the card sizes, what OK does and "Not supported yet" all follow from this
 * list, so nothing else needs to change.
 *
 * Keep the list in `mainOrder`, lowest first. That is the order in which parts lead a
 * device's card: a doorbell's camera before its battery sensor.
 */

import type { DeviceType } from './device-type';
import { lightType } from './light';
import { switchType } from './switch';

export const DEVICE_TYPES: DeviceType[] = [lightType, switchType];

/** The type with the given id, or null. Saved data and parts refer to types by id. */
export function deviceTypeFor(typeId: string): DeviceType | null {
  for (const type of DEVICE_TYPES) {
    if (type.id === typeId) return type;
  }
  return null;
}
