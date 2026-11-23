/**
 * Tests for home-assistant.ts: the small readers that take values out of Home Assistant data safely.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity, sampleHome } from '../test-support/sample-home';
import {
  domainOf,
  hasFeature,
  isAvailable,
  readNumber,
  readRegistryAreas,
  readRegistryDevices,
  readRegistryEntities,
  readText,
  readTextList,
} from './home-assistant';

const lamp = sampleEntity('light.lounge_lamp');

describe('domainOf', () => {
  it('gives the part of the entity id before the dot', () => {
    expect(domainOf('light.lounge_lamp')).toBe('light');
    expect(domainOf('binary_sensor.front_door_motion')).toBe('binary_sensor');
  });

  it('gives an empty text for something that is not an entity id', () => {
    expect(domainOf('nonsense')).toBe('');
  });
});

describe('isAvailable', () => {
  it('is true for an ordinary state', () => {
    expect(isAvailable(lamp)).toBe(true);
  });

  it('is false when Home Assistant reports unavailable or unknown', () => {
    expect(isAvailable(changed(lamp, {}, 'unavailable'))).toBe(false);
    expect(isAvailable(changed(lamp, {}, 'unknown'))).toBe(false);
  });
});

describe('readNumber', () => {
  it('reads a number', () => {
    expect(readNumber(lamp, 'brightness')).toBe(180);
  });

  it('is null for a missing attribute, a null, text that looks like a number, and NaN', () => {
    expect(readNumber(lamp, 'no_such_attribute')).toBeNull();
    expect(readNumber(lamp, 'color_temp_kelvin')).toBeNull();
    expect(readNumber(changed(lamp, { brightness: '180' }), 'brightness')).toBeNull();
    expect(readNumber(changed(lamp, { brightness: NaN }), 'brightness')).toBeNull();
  });
});

describe('readText', () => {
  it('reads text', () => {
    expect(readText(lamp, 'friendly_name')).toBe('Lounge lamp');
  });

  it('is null for a missing attribute and for a value that is not text', () => {
    expect(readText(lamp, 'no_such_attribute')).toBeNull();
    expect(readText(lamp, 'brightness')).toBeNull();
  });
});

describe('readTextList', () => {
  it('reads a list of text', () => {
    expect(readTextList(lamp, 'supported_color_modes')).toEqual(['color_temp', 'hs']);
  });

  it('keeps only the text from a mixed list', () => {
    expect(
      readTextList(changed(lamp, { effect_list: ['a', 3, null, 'b'] }), 'effect_list'),
    ).toEqual(['a', 'b']);
  });

  it('is empty for a missing attribute and for a value that is not a list', () => {
    expect(readTextList(lamp, 'no_such_attribute')).toEqual([]);
    expect(readTextList(lamp, 'friendly_name')).toEqual([]);
  });
});

describe('hasFeature', () => {
  it('reads one bit of supported_features', () => {
    expect(hasFeature(lamp, 4)).toBe(true);
    expect(hasFeature(lamp, 8)).toBe(false);
  });

  it('is false when the entity lists no features', () => {
    expect(hasFeature(sampleEntity('switch.tv_plug'), 1)).toBe(false);
  });
});

describe('the sample home', () => {
  it('has a registry entry for every state, except the ones that are deliberately loose', () => {
    const home = sampleHome();
    const registered = home.entities.map((entity) => entity.entity_id);
    const loose = Object.keys(home.states).filter(
      (entityId) => registered.indexOf(entityId) === -1,
    );

    expect(loose.sort()).toEqual(['scene.movie_night', 'script.goodnight', 'sun.sun']);
  });
});

describe('reading the registries', () => {
  it('keeps the fields the app uses from entity registry entries', () => {
    const entries = readRegistryEntities([
      {
        entity_id: 'light.a',
        device_id: 'dev1',
        area_id: null,
        disabled_by: null,
        hidden_by: 'user',
        entity_category: 'diagnostic',
        name: 'Lamp',
        original_name: 'LIFX A19',
        platform: 'lifx',
        unique_id: 'abc',
      },
    ]);

    expect(entries).toEqual([
      {
        entity_id: 'light.a',
        device_id: 'dev1',
        area_id: null,
        disabled_by: null,
        hidden_by: 'user',
        entity_category: 'diagnostic',
        name: 'Lamp',
        original_name: 'LIFX A19',
      },
    ]);
  });

  it('fills missing or wrongly typed fields with null, and drops entries with no id', () => {
    expect(
      readRegistryEntities([
        { entity_id: 'light.a', device_id: 7 },
        { name: 'no id' },
        'text',
        null,
      ]),
    ).toEqual([
      {
        entity_id: 'light.a',
        device_id: null,
        area_id: null,
        disabled_by: null,
        hidden_by: null,
        entity_category: null,
        name: null,
        original_name: null,
      },
    ]);
  });

  it('reads devices, including ones that carry fewer fields than usual', () => {
    expect(
      readRegistryDevices([
        {
          id: 'dev1',
          name: 'Lamp',
          name_by_user: 'Lounge lamp',
          area_id: 'living',
          disabled_by: null,
        },
        { id: 'child1', name: 'Child zone' },
        { name: 'no id' },
      ]),
    ).toEqual([
      {
        id: 'dev1',
        name: 'Lamp',
        name_by_user: 'Lounge lamp',
        area_id: 'living',
        disabled_by: null,
      },
      { id: 'child1', name: 'Child zone', name_by_user: null, area_id: null, disabled_by: null },
    ]);
  });

  it('reads areas and drops ones with no id or name', () => {
    expect(
      readRegistryAreas([
        { area_id: 'living', name: 'Living room', icon: null },
        { area_id: 'x' },
        {},
      ]),
    ).toEqual([{ area_id: 'living', name: 'Living room' }]);
  });

  it('gives an empty list for anything that is not a list', () => {
    expect(readRegistryEntities(null)).toEqual([]);
    expect(readRegistryDevices('nope')).toEqual([]);
    expect(readRegistryAreas({})).toEqual([]);
  });
});
