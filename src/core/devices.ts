/**
 * Sorts Home Assistant's entities into devices and parts.
 *
 * The words, as the design uses them:
 *   device  one physical thing in Home Assistant, such as a doorbell. Also a "thing with no
 *           device", such as a scene, which is treated as a device with a single part.
 *   part    one supported entity of a device: the doorbell's camera, its motion sensor.
 *
 * The picker lists every device this returns. A device with no parts is listed as
 * "Not supported yet". The home screen shows a card for each device the person chose.
 *
 * This file decides only what belongs to what. It knows nothing about cards or screens:
 * the caller passes in the list of part types (see part-type.ts).
 */

import {
  domainOf,
  readText,
  type EntityState,
  type HomeSnapshot,
  type RegistryEntity,
} from './home-assistant';
import type { CardSize, PartType } from './part-type';

export interface Part {
  entityId: string;
  /** The id of the PartType this entity belongs to: 'light'. */
  typeId: string;
  name: string;
}

export interface Device {
  /** 'device:<registry id>', or 'entity:<entity id>' for a thing with no device. */
  id: string;
  name: string;
  /** null when Home Assistant has it in no area. */
  roomName: string | null;
  /** Supported parts only, in the order the card shows them. The first is the main part. */
  parts: Part[];
  /** null when the device has nothing this app supports. */
  mainPart: Part | null;
  /** The size of the device's card, from its main part. null when there is no main part. */
  cardSize: CardSize | null;
}

export interface Room {
  name: string;
  devices: Device[];
}

/** The heading for devices that Home Assistant has in no area. */
export const NO_ROOM = 'No room';

/**
 * Types that are listed even when nothing supports them, so the picker can say
 * "Not supported yet" for a lock, an alarm or a door. Other unsupported things with no
 * device (automations, zones, people) are not listed at all: they would bury the picker.
 */
const ALWAYS_LISTED_DOMAINS = ['lock', 'alarm_control_panel', 'cover'];

/** A part while it is being collected, with what is needed to put the parts in order. */
interface CollectedPart {
  part: Part;
  type: PartType;
  isBatteryLevel: boolean;
}

export function buildDevices(home: HomeSnapshot, partTypes: PartType[]): Device[] {
  const registryByEntityId: { [entityId: string]: RegistryEntity } = {};
  for (const entry of home.entities) {
    registryByEntityId[entry.entity_id] = entry;
  }

  const devices: Device[] = [];

  // 1. Real devices, each with the entities the registry says belong to it.
  for (const registryDevice of home.devices) {
    if (registryDevice.disabled_by !== null) continue;

    const entries = home.entities.filter(
      (entry) => entry.device_id === registryDevice.id && isShown(entry),
    );
    const collected = collectParts(entries, home, partTypes);
    const firstEntry = entries[0];

    devices.push(
      makeDevice(
        'device:' + registryDevice.id,
        registryDevice.name_by_user ??
          registryDevice.name ??
          (firstEntry ? entityName(firstEntry, home.states[firstEntry.entity_id]) : null) ??
          'Unnamed device',
        roomName(home, registryDevice.area_id),
        collected,
      ),
    );
  }

  // 2. Things with no device: every state whose registry entry names no device, or that
  //    has no registry entry at all (scenes and scripts written in YAML, for example).
  for (const entityId of Object.keys(home.states)) {
    const state = home.states[entityId];
    const entry = registryByEntityId[entityId];
    if (state === undefined) continue;
    if (entry !== undefined && (entry.device_id !== null || !isShown(entry))) continue;

    const type = partTypeFor(state, partTypes);
    const isListedAnyway = ALWAYS_LISTED_DOMAINS.indexOf(domainOf(entityId)) !== -1;
    if (type === null && !isListedAnyway) continue;

    const name = entry ? entityName(entry, state) : (readText(state, 'friendly_name') ?? entityId);
    const collected: CollectedPart[] =
      type === null
        ? []
        : [{ part: { entityId, typeId: type.id, name }, type, isBatteryLevel: false }];

    devices.push(
      makeDevice(
        'entity:' + entityId,
        name,
        roomName(home, entry ? entry.area_id : null),
        collected,
      ),
    );
  }

  return devices;
}

/** Rooms in name order with "No room" last; devices in name order within each room. */
export function groupByRoom(devices: Device[]): Room[] {
  const byName: { [roomName: string]: Device[] } = {};
  for (const device of devices) {
    const name = device.roomName ?? NO_ROOM;
    (byName[name] = byName[name] ?? []).push(device);
  }

  const names = Object.keys(byName).sort((a, b) => {
    if (a === NO_ROOM) return 1;
    if (b === NO_ROOM) return -1;
    return a.localeCompare(b);
  });

  return names.map((name) => ({
    name,
    devices: (byName[name] ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export function findDevice(devices: Device[], id: string): Device | null {
  for (const device of devices) {
    if (device.id === id) return device;
  }
  return null;
}

/** False for entities the person, or the integration, has switched off or hidden in Home Assistant. */
function isShown(entry: RegistryEntity): boolean {
  return entry.disabled_by === null && entry.hidden_by === null;
}

/** A sensor that reports a battery level. These are kept even though they are "diagnostic". */
function isBatteryLevel(state: EntityState): boolean {
  return domainOf(state.entity_id) === 'sensor' && readText(state, 'device_class') === 'battery';
}

function partTypeFor(state: EntityState, partTypes: PartType[]): PartType | null {
  const domain = domainOf(state.entity_id);
  for (const type of partTypes) {
    if (type.domains.indexOf(domain) !== -1 && type.supports(state)) return type;
  }
  return null;
}

function collectParts(
  entries: RegistryEntity[],
  home: HomeSnapshot,
  partTypes: PartType[],
): CollectedPart[] {
  const collected: CollectedPart[] = [];

  for (const entry of entries) {
    // An entity can be in the registry before it has reported anything. Skip it until it does.
    const state = home.states[entry.entity_id];
    if (state === undefined) continue;

    // Settings and technical readings (signal strength, firmware) stay off the card.
    const battery = isBatteryLevel(state);
    if (entry.entity_category !== null && !battery) continue;

    const type = partTypeFor(state, partTypes);
    if (type === null) continue;

    collected.push({
      part: { entityId: entry.entity_id, typeId: type.id, name: entityName(entry, state) },
      type,
      isBatteryLevel: battery,
    });
  }

  return collected;
}

/** Puts the parts in card order (see comparePartOrder) and builds the device from them. */
function makeDevice(
  id: string,
  name: string,
  room: string | null,
  collected: CollectedPart[],
): Device {
  const ordered = collected.slice().sort(comparePartOrder);
  const main = ordered[0];

  return {
    id,
    name,
    roomName: room,
    parts: ordered.map((item) => item.part),
    mainPart: main ? main.part : null,
    cardSize: main ? main.type.cardSize : null,
  };
}

/**
 * Card order: the most significant type first (lowest mainOrder); within a type, a battery
 * level after everything else, so a thermometer's card leads with the temperature; then by name.
 */
function comparePartOrder(a: CollectedPart, b: CollectedPart): number {
  if (a.type.mainOrder !== b.type.mainOrder) return a.type.mainOrder - b.type.mainOrder;
  if (a.isBatteryLevel !== b.isBatteryLevel) return a.isBatteryLevel ? 1 : -1;
  return a.part.name.localeCompare(b.part.name);
}

/** The person's name for the entity, then the integration's, then the friendly name, then the id. */
function entityName(entry: RegistryEntity, state: EntityState | undefined): string {
  return (
    entry.name ??
    entry.original_name ??
    (state ? readText(state, 'friendly_name') : null) ??
    entry.entity_id
  );
}

function roomName(home: HomeSnapshot, areaId: string | null): string | null {
  if (areaId === null) return null;
  for (const area of home.areas) {
    if (area.area_id === areaId) return area.name;
  }
  return null;
}
