/**
 * What the core needs to know about a device type ("part type"), and the three card sizes.
 *
 * The full description of a device type, with its card and panel, is DeviceType in
 * src/devices/device-type.ts, which extends this. The split exists so the core can sort
 * entities into devices without knowing anything about screens.
 */

import type { EntityState } from './home-assistant';

/** small is 1×1 grid cells, wide is 2×1, large is 2×2. */
export type CardSize = 'small' | 'wide' | 'large';

export interface PartType {
  /** A short name for the type, used in saved data and as the folder name: 'light'. */
  id: string;
  /** The Home Assistant entity types this covers: ['switch', 'input_boolean']. */
  domains: string[];
  /**
   * Decides which part leads a device's card: the part whose type has the lowest number.
   * A doorbell's camera (10) leads over its battery sensor (100).
   */
  mainOrder: number;
  /** The size of the card when a part of this type leads it. */
  cardSize: CardSize;
  /**
   * False for an entity of the right type that must not be shown, such as a cover that
   * is a garage door. Entities this refuses are treated as not supported.
   */
  supports(entity: EntityState): boolean;
}
