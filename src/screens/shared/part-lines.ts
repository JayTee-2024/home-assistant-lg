/**
 * A short line for each of a device's other parts (all but the main one), such as
 * 'Battery 74%'. Used by the cards and by the full-screen panel's top bar.
 */

import type { Device } from '../../core/devices';
import type { HomeSnapshot } from '../../core/home-assistant';
import { deviceTypeFor } from '../../devices/registry';

/** At most `limit` lines, in the device's part order. Parts with nothing to say are skipped. */
export function otherPartLines(device: Device, home: HomeSnapshot, limit: number): string[] {
  const lines: string[] = [];

  for (const part of device.parts.slice(1)) {
    if (lines.length === limit) break;

    const type = deviceTypeFor(part.typeId);
    const entity = home.states[part.entityId];
    const summary = type === null || entity === undefined ? null : type.summary(entity);
    if (summary !== null) lines.push(part.name + ' ' + summary);
  }
  return lines;
}
