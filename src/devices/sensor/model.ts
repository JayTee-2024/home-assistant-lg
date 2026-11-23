/**
 * Reads a sensor into what the card shows: a reading and its unit.
 *
 * A sensor's state is the reading as text, already rounded the way the person set it up in
 * Home Assistant, so it is shown as it comes. The one exception is a date-and-time reading
 * (device class 'timestamp'), which arrives in a form meant for machines.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/sensor
 */

import { readText, type EntityState } from '../../core/home-assistant';
import { UNAVAILABLE } from '../shared/predict';

export interface SensorView {
  reading: string;
  /** null when the sensor has no unit, or has no reading to put one on. */
  unit: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function readSensor(entity: EntityState): SensorView {
  if (entity.state === 'unavailable') return { reading: UNAVAILABLE, unit: null };
  if (entity.state === 'unknown') return { reading: 'Unknown', unit: null };

  if (readText(entity, 'device_class') === 'timestamp') {
    const date = new Date(entity.state);
    if (!isNaN(date.getTime())) return { reading: formatDateTime(date), unit: null };
  }

  return { reading: entity.state, unit: readText(entity, 'unit_of_measurement') };
}

/** The reading and unit as one piece of text: '20.5 °C', '48%'. */
export function sensorText(view: SensorView): string {
  if (view.unit === null) return view.reading;
  // A percent sign sits against its number; every other unit gets a space.
  return view.unit === '%' ? view.reading + '%' : view.reading + ' ' + view.unit;
}

/** '20 Nov, 08:05', in the TV's own time zone. Written by hand because Chromium 53's date formatting is limited. */
export function formatDateTime(date: Date): string {
  const twoDigits = (value: number) => (value < 10 ? '0' + value : String(value));

  return (
    date.getDate() +
    ' ' +
    (MONTHS[date.getMonth()] ?? '') +
    ', ' +
    twoDigits(date.getHours()) +
    ':' +
    twoDigits(date.getMinutes())
  );
}
