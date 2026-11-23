/**
 * Reads a light into what the card and panel show, and what the light says it can do.
 *
 * Home Assistant reports what a light supports in `supported_color_modes`. The modes used
 * here: 'brightness' (dims), 'color_temp' (shades of white), and the colour modes 'hs',
 * 'xy', 'rgb', 'rgbw' and 'rgbww'. Any mode other than 'onoff' can also dim.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/light
 */

import {
  isAvailable,
  readNumber,
  readText,
  readTextList,
  type EntityState,
} from '../../core/home-assistant';

export interface LightView {
  isOn: boolean;
  isAvailable: boolean;
  /** 1 to 100. null when the light is off or cannot dim. */
  brightnessPercent: number | null;
  canDim: boolean;
  /** True when the light can show different whites, from warm to cool. */
  canSetWhite: boolean;
  canSetColour: boolean;
  /** The white the light is showing, in kelvin. null when it is showing a colour, or is off. */
  whiteKelvin: number | null;
  /** The warmest and coolest whites the light can show, in kelvin. */
  minKelvin: number;
  maxKelvin: number;
  /** The colour the light is showing as red, green, blue (0 to 255 each). null when unknown. */
  rgb: [number, number, number] | null;
  effects: string[];
  effect: string | null;
}

const COLOUR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];
const DEFAULT_MIN_KELVIN = 2000;
const DEFAULT_MAX_KELVIN = 6500;

/** How many whites the panel offers, from warm to cool. */
const WHITE_STEP_COUNT = 5;
/** How much one press of − or + changes the brightness, in percent. */
const BRIGHTNESS_STEP = 10;

export function readLight(entity: EntityState): LightView {
  const modes = readTextList(entity, 'supported_color_modes');
  const canSetWhite = modes.indexOf('color_temp') !== -1;
  const canSetColour = modes.some((mode) => COLOUR_MODES.indexOf(mode) !== -1);
  const canDim = canSetWhite || canSetColour || modes.indexOf('brightness') !== -1;
  const isOn = entity.state === 'on';

  return {
    isOn,
    isAvailable: isAvailable(entity),
    brightnessPercent: isOn && canDim ? brightnessPercent(entity) : null,
    canDim,
    canSetWhite,
    canSetColour,
    whiteKelvin: isOn ? readNumber(entity, 'color_temp_kelvin') : null,
    minKelvin: readNumber(entity, 'min_color_temp_kelvin') ?? DEFAULT_MIN_KELVIN,
    maxKelvin: readNumber(entity, 'max_color_temp_kelvin') ?? DEFAULT_MAX_KELVIN,
    rgb: isOn ? readRgb(entity) : null,
    effects: readTextList(entity, 'effect_list'),
    effect: readText(entity, 'effect'),
  };
}

/** The whites the panel offers: evenly spaced from the light's warmest to its coolest. */
export function whiteSteps(view: LightView): number[] {
  const steps: number[] = [];
  for (let index = 0; index < WHITE_STEP_COUNT; index++) {
    const share = index / (WHITE_STEP_COUNT - 1);
    steps.push(Math.round(view.minKelvin + (view.maxKelvin - view.minKelvin) * share));
  }
  return steps;
}

/**
 * The brightness one press of − (direction -1) or + (direction 1) leads to: the next
 * multiple of ten, never below 1 or above 100. A light that is off counts as 0.
 */
export function nextBrightness(current: number | null, direction: -1 | 1): number {
  const from = current ?? 0;
  const next =
    direction === 1
      ? Math.floor(from / BRIGHTNESS_STEP) * BRIGHTNESS_STEP + BRIGHTNESS_STEP
      : Math.ceil(from / BRIGHTNESS_STEP) * BRIGHTNESS_STEP - BRIGHTNESS_STEP;
  return Math.max(1, Math.min(100, next));
}

/** Home Assistant gives brightness as 0 to 255. A light that is on never reads as 0%. */
function brightnessPercent(entity: EntityState): number | null {
  const brightness = readNumber(entity, 'brightness');
  if (brightness === null) return null;
  return Math.max(1, Math.round((brightness / 255) * 100));
}

function readRgb(entity: EntityState): [number, number, number] | null {
  const value = entity.attributes['rgb_color'];
  if (!Array.isArray(value) || value.length !== 3) return null;

  const [red, green, blue] = value as unknown[];
  if (typeof red !== 'number' || typeof green !== 'number' || typeof blue !== 'number') return null;
  return [red, green, blue];
}
