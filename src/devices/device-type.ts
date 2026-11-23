/**
 * What every device type must provide. This is the recipe the README's "Adding a device
 * type" guide walks through.
 *
 * A device type is one folder under src/devices (light, switch, sensor and so on) that
 * knows everything about one kind of Home Assistant entity: how to read it, what each
 * control sends, and how its card and panel look. Each folder's index.ts exports one
 * DeviceType, and registry.ts lists them all. Nothing else in the app needs to change
 * when a type is added.
 */

import type { ComponentType } from 'preact';
import type { EntityState } from '../core/home-assistant';
import type { ServiceCall } from '../core/home-connection';
import type { PartType } from '../core/part-type';

/**
 * One thing the person did: what to send to Home Assistant, and what the entity should
 * look like straight away. The app shows `predicted` at once and replaces it with the real
 * state when Home Assistant reports it, so a press never feels slow.
 */
export interface Action {
  call: ServiceCall;
  predicted: EntityState;
}

/** What a type's card is given. */
export interface CardProps {
  entity: EntityState;
}

/** What a type's panel is given. `run` carries out an action. */
export interface PanelProps {
  entity: EntityState;
  run(action: Action): void;
}

export interface DeviceType extends PartType {
  /** The type's name in the device picker: 'Light'. */
  label: string;

  /**
   * What a short press of OK does on the card: an action to run, 'open-panel' for types
   * with no single everyday action, or 'nothing' (a sensor, or an entity that is unavailable).
   */
  okAction(entity: EntityState): Action | 'open-panel' | 'nothing';

  /** True when the entity counts as "on", which the card marks in amber. */
  isActive(entity: EntityState): boolean;

  /**
   * The entity in a few words, for when it is not the card's main part: '21.5 °C', 'On'.
   * null when there is nothing worth a line.
   */
  summary(entity: EntityState): string | null;

  /** The inside of the card when this type leads it. The frame and the name are drawn by the home screen. */
  Card: ComponentType<CardProps>;

  /** Every control this type has, for the device's panel. */
  Panel: ComponentType<PanelProps>;
}
