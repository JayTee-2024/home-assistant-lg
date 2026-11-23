/**
 * Tests for the binary sensor type: a yes/no reading put into words for its kind.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { binarySensorType } from './index';
import { readBinarySensor } from './model';

const motion = sampleEntity('binary_sensor.front_door_motion'); // off

function words(deviceClass: string | undefined): [string, string] {
  return [
    readBinarySensor(changed(motion, { device_class: deviceClass }, 'on')).words,
    readBinarySensor(changed(motion, { device_class: deviceClass }, 'off')).words,
  ];
}

describe('readBinarySensor', () => {
  it('reads on and off', () => {
    expect(readBinarySensor(motion).isOn).toBe(false);
    expect(readBinarySensor(changed(motion, {}, 'on')).isOn).toBe(true);
  });

  it.each([
    ['door', 'Open', 'Closed'],
    ['window', 'Open', 'Closed'],
    ['opening', 'Open', 'Closed'],
    ['garage_door', 'Open', 'Closed'],
    ['motion', 'Detected', 'Clear'],
    ['occupancy', 'Detected', 'Clear'],
    ['presence', 'Detected', 'Clear'],
    ['smoke', 'Detected', 'Clear'],
    ['gas', 'Detected', 'Clear'],
    ['problem', 'Detected', 'Clear'],
    ['safety', 'Detected', 'Clear'],
    ['battery', 'Low', 'Normal'],
    ['connectivity', 'Connected', 'Disconnected'],
    ['moisture', 'Wet', 'Dry'],
    ['lock', 'Unlocked', 'Locked'],
  ])('puts a %s sensor into words', (deviceClass, whenOn, whenOff) => {
    expect(words(deviceClass)).toEqual([whenOn, whenOff]);
  });

  it('falls back to On and Off for a kind it does not know, or none', () => {
    expect(words('something_new')).toEqual(['On', 'Off']);
    expect(words(undefined)).toEqual(['On', 'Off']);
  });

  it('says Unavailable when the sensor cannot be reached', () => {
    const view = readBinarySensor(changed(motion, {}, 'unavailable'));

    expect(view.words).toBe('Unavailable');
    expect(view.isOn).toBe(false);
  });
});

describe('the binary sensor type', () => {
  it('does nothing on OK, and is shown as on when it is on', () => {
    expect(binarySensorType.okAction(motion)).toBe('nothing');
    expect(binarySensorType.isActive(motion)).toBe(false);
    expect(binarySensorType.isActive(changed(motion, {}, 'on'))).toBe(true);
  });

  it('sums itself up in its words', () => {
    expect(binarySensorType.summary(motion)).toBe('Clear');
  });

  it('covers binary_sensor entities', () => {
    expect(binarySensorType.domains).toEqual(['binary_sensor']);
  });
});
