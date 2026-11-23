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

  it('never lets a type claim locks or alarm panels, which must never be controlled from the TV', () => {
    for (const type of DEVICE_TYPES) {
      expect(type.domains).not.toContain('lock');
      expect(type.domains).not.toContain('alarm_control_panel');
    }
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

  it('leads the doorbell with its camera, as a large card', () => {
    const ring = findDevice(devices, 'device:dev_ring');

    expect(ring?.mainPart?.typeId).toBe('camera');
    expect(ring?.cardSize).toBe('large');
  });

  it('gives the doorbell its camera, two binary sensors and its battery as parts', () => {
    const parts = findDevice(devices, 'device:dev_ring')?.parts.map((part) => part.entityId);

    expect(parts).toEqual([
      'camera.front_door',
      'binary_sensor.front_door_ding',
      'binary_sensor.front_door_motion',
      'sensor.front_door_battery',
    ]);
  });

  it('lists the scene and the script as buttons of their own', () => {
    expect(findDevice(devices, 'entity:scene.movie_night')?.mainPart?.typeId).toBe('button');
    expect(findDevice(devices, 'entity:script.goodnight')?.mainPart?.typeId).toBe('button');
  });

  it('leads the Tado thermostat with its heating, as a wide card', () => {
    const tado = findDevice(devices, 'device:dev_tado');

    expect(tado?.mainPart?.typeId).toBe('climate');
    expect(tado?.cardSize).toBe('wide');
  });

  it('has nothing supported for the lock or the garage door', () => {
    expect(findDevice(devices, 'device:dev_lock')?.parts).toEqual([]);
    expect(findDevice(devices, 'device:dev_garage')?.parts).toEqual([]);
  });
});
