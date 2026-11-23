/**
 * Tests for the sensor type: a reading and its unit.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { sensorType } from './index';
import { formatDateTime, readSensor } from './model';

const temperature = sampleEntity('sensor.living_room_temperature');

describe('readSensor', () => {
  it("reads the reading in Home Assistant's own text, with its unit", () => {
    expect(readSensor(temperature)).toEqual({ reading: '20.5', unit: '°C' });
  });

  it('reads a sensor with no unit', () => {
    expect(
      readSensor(changed(temperature, { unit_of_measurement: undefined }, 'Cleaning')),
    ).toEqual({
      reading: 'Cleaning',
      unit: null,
    });
  });

  it('says so in words when the sensor is unavailable or unknown, with no unit', () => {
    expect(readSensor(changed(temperature, {}, 'unavailable'))).toEqual({
      reading: 'Unavailable',
      unit: null,
    });
    expect(readSensor(changed(temperature, {}, 'unknown'))).toEqual({
      reading: 'Unknown',
      unit: null,
    });
  });

  it('shows a date-and-time reading as a short date and time', () => {
    const uptime = sampleEntity('sensor.tado_bridge_uptime');

    expect(readSensor(uptime).reading).toBe(formatDateTime(new Date('2026-11-20T08:00:00+00:00')));
  });
});

describe('formatDateTime', () => {
  it('writes the day, the month in three letters, and the time on a 24-hour clock', () => {
    expect(formatDateTime(new Date(2026, 10, 20, 8, 5))).toBe('20 Nov, 08:05');
    expect(formatDateTime(new Date(2026, 0, 1, 23, 59))).toBe('1 Jan, 23:59');
  });
});

describe('the sensor type', () => {
  it('does nothing on OK and is never shown as on', () => {
    expect(sensorType.okAction(temperature)).toBe('nothing');
    expect(sensorType.isActive(temperature)).toBe(false);
  });

  it('sums itself up as the reading and unit', () => {
    expect(sensorType.summary(temperature)).toBe('20.5 °C');
    expect(sensorType.summary(sampleEntity('sensor.living_room_humidity'))).toBe('48%');
    expect(sensorType.summary(changed(temperature, {}, 'unavailable'))).toBe('Unavailable');
  });
});
