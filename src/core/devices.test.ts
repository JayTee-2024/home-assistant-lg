/**
 * Tests for devices.ts: how Home Assistant's entities are sorted into devices and parts.
 */

import { describe, expect, it } from 'vitest';
import { sampleHome } from '../test-support/sample-home';
import { buildDevices, findDevice, groupByRoom, NO_ROOM, type Device } from './devices';
import { EMPTY_HOME, type HomeSnapshot } from './home-assistant';
import type { PartType } from './part-type';

// Three small part types, enough to exercise every rule without the real ones in src/devices.
const light: PartType = {
  id: 'light',
  domains: ['light'],
  mainOrder: 50,
  cardSize: 'small',
  supports: () => true,
};
const cover: PartType = {
  id: 'cover',
  domains: ['cover'],
  mainOrder: 60,
  cardSize: 'wide',
  supports: (entity) => entity.attributes['device_class'] !== 'garage',
};
const sensor: PartType = {
  id: 'sensor',
  domains: ['sensor'],
  mainOrder: 100,
  cardSize: 'small',
  supports: () => true,
};
const partTypes = [light, cover, sensor];

function sampleDevice(id: string): Device {
  const device = findDevice(buildDevices(sampleHome(), partTypes), id);
  if (device === null) throw new Error('No device ' + id);
  return device;
}

/** A tiny home with loose entities only, for the rules about things with no device. */
function homeWith(entityIds: string[]): HomeSnapshot {
  const home: HomeSnapshot = { states: {}, entities: [], devices: [], areas: [] };
  for (const entityId of entityIds) {
    home.states[entityId] = { entity_id: entityId, state: 'on', attributes: {} };
  }
  return home;
}

describe('buildDevices: which entities count', () => {
  it('ignores disabled and hidden entities', () => {
    const home = sampleHome();
    home.states['light.hall_light_twin'] = {
      entity_id: 'light.hall_light_twin',
      state: 'on',
      attributes: {},
    };
    home.entities.push({
      entity_id: 'light.hall_light_twin',
      device_id: 'dev_lifx_white',
      area_id: null,
      disabled_by: null,
      hidden_by: 'user',
      entity_category: null,
      name: null,
      original_name: 'Twin',
    });

    const device = findDevice(buildDevices(home, partTypes), 'device:dev_lifx_white');

    expect(device?.parts.map((part) => part.entityId)).toEqual(['light.hall_light']);
  });

  it('ignores disabled devices', () => {
    const home = sampleHome();
    const lamp = home.devices.filter((device) => device.id === 'dev_lifx_lamp')[0];
    if (lamp) lamp.disabled_by = 'user';

    expect(findDevice(buildDevices(home, partTypes), 'device:dev_lifx_lamp')).toBeNull();
  });

  it('leaves out diagnostic and configuration entities', () => {
    expect(sampleDevice('device:dev_lifx_lamp').parts.map((part) => part.entityId)).toEqual([
      'light.lounge_lamp',
    ]);
  });

  it('keeps a diagnostic sensor when it is a battery level', () => {
    const parts = sampleDevice('device:dev_tado').parts.map((part) => part.entityId);

    expect(parts).toContain('sensor.living_room_heating_battery');
  });

  it('skips an entity that is in the registry but has no state yet', () => {
    const home = sampleHome();
    delete home.states['light.hall_light'];

    expect(findDevice(buildDevices(home, partTypes), 'device:dev_lifx_white')?.parts).toEqual([]);
  });

  it('treats an entity its type refuses as not supported', () => {
    const garage = sampleDevice('device:dev_garage');

    expect(garage.parts).toEqual([]);
    expect(garage.mainPart).toBeNull();
    expect(garage.cardSize).toBeNull();
  });
});

describe('buildDevices: the device', () => {
  it('leads with the part whose type has the lowest order, and takes its card size', () => {
    const home = sampleHome();
    home.states['cover.lounge_blind'] = {
      entity_id: 'cover.lounge_blind',
      state: 'open',
      attributes: {},
    };
    home.entities.push({
      entity_id: 'cover.lounge_blind',
      device_id: 'dev_lifx_lamp',
      area_id: null,
      disabled_by: null,
      hidden_by: null,
      entity_category: null,
      name: null,
      original_name: 'Blind',
    });

    const device = findDevice(buildDevices(home, partTypes), 'device:dev_lifx_lamp');

    expect(device?.mainPart?.entityId).toBe('light.lounge_lamp');
    expect(device?.cardSize).toBe('small');
    expect(device?.parts.map((part) => part.typeId)).toEqual(['light', 'cover']);
  });

  it('orders parts of the same type by name, with a battery level last', () => {
    expect(sampleDevice('device:dev_tado').parts.map((part) => part.name)).toEqual([
      'Humidity',
      'Temperature',
      'Battery',
    ]);
  });

  it('puts a battery level last even when its type would otherwise come first', () => {
    const lateType: PartType = {
      id: 'binary_sensor',
      domains: ['binary_sensor'],
      mainOrder: 110,
      cardSize: 'small',
      supports: () => true,
    };

    const doorbell = findDevice(buildDevices(sampleHome(), [sensor, lateType]), 'device:dev_ring');

    expect(doorbell?.parts.map((part) => part.name)).toEqual(['Ding', 'Motion', 'Battery']);
    expect(doorbell?.mainPart?.name).toBe('Ding');
  });

  it('still returns a device with nothing supported, with no parts', () => {
    const bridge = sampleDevice('device:dev_bridge');

    expect(bridge.name).toBe('Tado bridge');
    expect(bridge.parts).toEqual([]);
  });

  it('returns a device whose entities are all disabled, with no parts', () => {
    const home = sampleHome();
    for (const entity of home.entities) {
      if (entity.device_id === 'dev_plug_tv') entity.disabled_by = 'user';
    }

    expect(findDevice(buildDevices(home, partTypes), 'device:dev_plug_tv')?.parts).toEqual([]);
  });
});

describe('buildDevices: names and rooms', () => {
  it('prefers the name the person gave the device', () => {
    expect(sampleDevice('device:dev_lifx_lamp').name).toBe('Lounge lamp');
  });

  it('uses the device name when the person gave none', () => {
    expect(sampleDevice('device:dev_plug_kettle').name).toBe('Kettle plug');
  });

  it('names a device with no name after its first entity', () => {
    expect(sampleDevice('device:dev_noname').name).toBe('Spare plug');
  });

  it('calls a device with no name and no entities "Unnamed device"', () => {
    const home = sampleHome();
    home.devices.push({
      id: 'dev_empty',
      name: null,
      name_by_user: null,
      area_id: null,
      disabled_by: null,
    });

    expect(findDevice(buildDevices(home, partTypes), 'device:dev_empty')?.name).toBe(
      'Unnamed device',
    );
  });

  it("names a part by the person's name for it, then the integration's, then the friendly name", () => {
    expect(sampleDevice('device:dev_lifx_white').parts[0]?.name).toBe('Hall light');
    expect(sampleDevice('device:dev_lifx_lamp').parts[0]?.name).toBe('Lounge lamp');

    const loose = findDevice(
      buildDevices(homeWith(['light.loose']), partTypes),
      'entity:light.loose',
    );
    expect(loose?.name).toBe('light.loose');
  });

  it('puts a device in its area, and gives null when it has none or the area is unknown', () => {
    expect(sampleDevice('device:dev_lifx_lamp').roomName).toBe('Living room');
    expect(sampleDevice('device:dev_garage').roomName).toBeNull();

    const home = sampleHome();
    const lamp = home.devices.filter((device) => device.id === 'dev_lifx_lamp')[0];
    if (lamp) lamp.area_id = 'area_that_was_deleted';
    expect(findDevice(buildDevices(home, partTypes), 'device:dev_lifx_lamp')?.roomName).toBeNull();
  });
});

describe('buildDevices: things with no device', () => {
  it('lists a loose entity of a supported type as a device of its own', () => {
    const devices = buildDevices(homeWith(['light.loose']), partTypes);

    expect(devices.map((device) => device.id)).toEqual(['entity:light.loose']);
    expect(devices[0]?.mainPart?.entityId).toBe('light.loose');
  });

  it('lists a loose lock, alarm or cover with no parts, so the picker can say it is not supported', () => {
    const devices = buildDevices(homeWith(['lock.shed', 'alarm_control_panel.house']), partTypes);

    expect(devices.map((device) => device.id).sort()).toEqual([
      'entity:alarm_control_panel.house',
      'entity:lock.shed',
    ]);
    expect(devices[0]?.parts).toEqual([]);
  });

  it('does not list other loose entities, such as automations', () => {
    expect(
      buildDevices(homeWith(['automation.morning', 'sun.sun', 'zone.home']), partTypes),
    ).toEqual([]);
  });

  it('uses the registry entry of a loose entity for its name and room', () => {
    const home = homeWith(['light.loose']);
    home.areas.push({ area_id: 'study', name: 'Study' });
    home.entities.push({
      entity_id: 'light.loose',
      device_id: null,
      area_id: 'study',
      disabled_by: null,
      hidden_by: null,
      entity_category: null,
      name: 'Desk lamp',
      original_name: null,
    });

    const device = buildDevices(home, partTypes)[0];

    expect(device?.name).toBe('Desk lamp');
    expect(device?.roomName).toBe('Study');
  });

  it('gives nothing for an empty home', () => {
    expect(buildDevices(EMPTY_HOME, partTypes)).toEqual([]);
  });
});

describe('groupByRoom', () => {
  it('orders rooms by name with "No room" last, and devices by name within a room', () => {
    const rooms = groupByRoom(buildDevices(sampleHome(), partTypes));

    expect(rooms.map((room) => room.name)).toEqual(['Hallway', 'Kitchen', 'Living room', NO_ROOM]);
    expect(rooms[2]?.devices.map((device) => device.name)).toEqual([
      'Living room heating',
      'Lounge lamp',
      'TV plug',
    ]);
  });
});

describe('findDevice', () => {
  it('finds a device by id and gives null for an unknown id', () => {
    const devices = buildDevices(sampleHome(), partTypes);

    expect(findDevice(devices, 'device:dev_ring')?.name).toBe('Front door');
    expect(findDevice(devices, 'device:nope')).toBeNull();
  });
});
