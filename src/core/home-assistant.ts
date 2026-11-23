/**
 * The Home Assistant data the app reads, described once, and small functions that take
 * values out of it safely.
 *
 * Home Assistant sends attributes as loosely shaped JSON, and what is present differs from
 * one integration to the next. Code elsewhere never reaches into `attributes` directly: it
 * uses the readers below, which answer null (or an empty list) for anything missing or of
 * the wrong kind.
 *
 * This file does not talk to Home Assistant. See src/platform/home-assistant-connection.ts.
 *
 * Home Assistant's own description of these shapes:
 * https://developers.home-assistant.io/docs/core/entity
 */

/** One entity's current state, as Home Assistant reports it. */
export interface EntityState {
  /** For example 'light.lounge_lamp'. The part before the dot is the entity's type. */
  entity_id: string;
  /** For example 'on', 'off', '20.5', 'unavailable'. Always text. */
  state: string;
  attributes: { [name: string]: unknown };
}

/** An entity's entry in Home Assistant's entity registry: where it belongs and whether it is shown. */
export interface RegistryEntity {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  /** Set when the entity is switched off in Home Assistant. Such entities have no state. */
  disabled_by: string | null;
  /** Set when the entity is hidden from Home Assistant's own screens. */
  hidden_by: string | null;
  /** 'config' or 'diagnostic' for settings and technical readings; null for ordinary entities. */
  entity_category: string | null;
  /** The name the person gave it, if any. */
  name: string | null;
  /** The name the integration gave it. */
  original_name: string | null;
}

/** A device's entry in Home Assistant's device registry: one physical thing. */
export interface RegistryDevice {
  id: string;
  name: string | null;
  /** The name the person gave it, if any. */
  name_by_user: string | null;
  area_id: string | null;
  disabled_by: string | null;
}

/** A room, in Home Assistant's words an "area". */
export interface RegistryArea {
  area_id: string;
  name: string;
}

/** Everything the app knows about the home at one moment. */
export interface HomeSnapshot {
  states: { [entityId: string]: EntityState };
  entities: RegistryEntity[];
  devices: RegistryDevice[];
  areas: RegistryArea[];
}

export const EMPTY_HOME: HomeSnapshot = { states: {}, entities: [], devices: [], areas: [] };

/** The entity's type: 'light' for 'light.lounge_lamp'. Empty text when there is no dot. */
export function domainOf(entityId: string): string {
  const dot = entityId.indexOf('.');
  return dot === -1 ? '' : entityId.slice(0, dot);
}

/** False when Home Assistant cannot reach the entity or does not know its state. */
export function isAvailable(entity: EntityState): boolean {
  return entity.state !== 'unavailable' && entity.state !== 'unknown';
}

/** The attribute as a number, or null when it is missing or not a real number. */
export function readNumber(entity: EntityState, name: string): number | null {
  const value = entity.attributes[name];
  return typeof value === 'number' && isFinite(value) ? value : null;
}

/** The attribute as text, or null when it is missing or not text. */
export function readText(entity: EntityState, name: string): string | null {
  const value = entity.attributes[name];
  return typeof value === 'string' ? value : null;
}

/** The attribute as a list of text. Empty when it is missing or not a list; other kinds of item are dropped. */
export function readTextList(entity: EntityState, name: string): string[] {
  const value = entity.attributes[name];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Whether the entity says it supports a feature. Home Assistant packs these into one number,
 * `supported_features`, one bit per feature; each device type's model.ts names the bits it uses.
 */
export function hasFeature(entity: EntityState, bit: number): boolean {
  const features = readNumber(entity, 'supported_features') ?? 0;
  return (features & bit) !== 0;
}
