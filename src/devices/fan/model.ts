/**
 * Reads a fan into what the card and panel show.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/fan
 */

import {
  hasFeature,
  isAvailable,
  readNumber,
  readText,
  readTextList,
  type EntityState,
} from '../../core/home-assistant';

const SET_SPEED = 1;
const OSCILLATE = 2;
const PRESET_MODE = 8;

/** The smallest speed step the panel uses, so a fan with 100 speeds needs 10 presses, not 100. */
const SMALLEST_STEP = 10;

export interface FanView {
  isAvailable: boolean;
  isOn: boolean;
  /** 0 to 100. null when the fan does not report it. */
  speedPercent: number | null;
  /** How far one press of − or + moves the speed, in percent. */
  step: number;
  canSetSpeed: boolean;
  canOscillate: boolean;
  isOscillating: boolean;
  presets: string[];
  preset: string | null;
}

export function readFan(entity: EntityState): FanView {
  const step = readNumber(entity, 'percentage_step');

  return {
    isAvailable: isAvailable(entity),
    isOn: entity.state === 'on',
    speedPercent: readNumber(entity, 'percentage'),
    step: Math.max(SMALLEST_STEP, step ?? 0),
    canSetSpeed: hasFeature(entity, SET_SPEED),
    canOscillate: hasFeature(entity, OSCILLATE),
    isOscillating: entity.attributes['oscillating'] === true,
    presets: hasFeature(entity, PRESET_MODE) ? readTextList(entity, 'preset_modes') : [],
    preset: readText(entity, 'preset_mode'),
  };
}

/** The speed one press of − (-1) or + (1) leads to, in the fan's own step, from 0 to 100. */
export function nextSpeed(current: number | null, step: number, direction: -1 | 1): number {
  const from = current ?? 0;
  const next =
    direction === 1
      ? Math.floor(from / step + 1e-6) * step + step
      : Math.ceil(from / step - 1e-6) * step - step;
  return Math.max(0, Math.min(100, Math.round(next)));
}
