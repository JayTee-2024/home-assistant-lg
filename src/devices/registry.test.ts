/**
 * Tests for the registry of device types, and for how the real types sort the sample home.
 */

import { describe, expect, it } from 'vitest';
import { buildDevices, findDevice } from '../core/devices';
import { sampleHome } from '../test-support/sample-home';
import { DEVICE_TYPES, deviceTypeFor } from './registry';

describe('the registry', () => {
  it('gives every type its own id', () => {
    const ids = DEVICE_TYPES.map((type) => type.id);

    expect(ids.slice().sort()).toEqual(ids.filter((id, index) => ids.indexOf(id) === index).sort());
  });

  it('never lets two types claim the same Home Assistant entity type', () => {
    const domains: string[] = [];
    for (const type of DEVICE_TYPES) domains.push(...type.domains);

    expect(domains.filter((domain, index) => domains.indexOf(domain) !== index)).toEqual([]);
  });

  it('lists the types in the order their parts lead a card', () => {
    const orders = DEVICE_TYPES.map((type) => type.mainOrder);

    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  it('finds a type by its id, and gives null for an unknown id', () => {
    for (const type of DEVICE_TYPES) {
      expect(deviceTypeFor(type.id)).toBe(type);
    }
    expect(deviceTypeFor('teleporter')).toBeNull();
  });

  it('gives every type a name for the picker', () => {
    for (const type of DEVICE_TYPES) {
      expect(type.label.length).toBeGreaterThan(0);
    }
  });
});

describe('the sample home, sorted by the real types', () => {
  const devices = buildDevices(sampleHome(), DEVICE_TYPES);

  it('leads the LIFX bulb with its light', () => {
    expect(findDevice(devices, 'device:dev_lifx_lamp')?.mainPart?.typeId).toBe('light');
  });

  it('leads a plug with its switch', () => {
    expect(findDevice(devices, 'device:dev_plug_tv')?.mainPart?.typeId).toBe('switch');
  });

  it('lists the on/off helper as a switch of its own', () => {
    expect(findDevice(devices, 'entity:input_boolean.guest_mode')?.mainPart?.typeId).toBe('switch');
  });

  it('has nothing supported for the lock or the garage door', () => {
    expect(findDevice(devices, 'device:dev_lock')?.parts).toEqual([]);
    expect(findDevice(devices, 'device:dev_garage')?.parts).toEqual([]);
  });
});
