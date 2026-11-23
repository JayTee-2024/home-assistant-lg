/**
 * Reads a thermostat ("climate" in Home Assistant) into what the card and panel show.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/climate
 */

import {
  hasFeature,
  isAvailable,
  readNumber,
  readText,
  readTextList,
  type EntityState,
} from '../../core/home-assistant';

/** The supported_features bit that says the target temperature can be set. */
const TARGET_TEMPERATURE = 1;

/** Used when the thermostat does not report its own range or step. Home Assistant's own defaults. */
const DEFAULT_MIN = 7;
const DEFAULT_MAX = 35;
const DEFAULT_STEP = 0.5;

export interface ClimateView {
  isAvailable: boolean;
  /** What it is set to do: 'heat', 'auto', 'off' and so on. */
  hvacMode: string;
  /** What it is doing right now: 'heating', 'idle'. null when it does not say. */
  hvacAction: string | null;
  currentTemperature: number | null;
  targetTemperature: number | null;
  minTemp: number;
  maxTemp: number;
  step: number;
  hvacModes: string[];
  presetModes: string[];
  presetMode: string | null;
  canSetTarget: boolean;
}

export function readClimate(entity: EntityState): ClimateView {
  const step = readNumber(entity, 'target_temp_step');

  return {
    isAvailable: isAvailable(entity),
    hvacMode: entity.state,
    hvacAction: readText(entity, 'hvac_action'),
    currentTemperature: readNumber(entity, 'current_temperature'),
    targetTemperature: readNumber(entity, 'temperature'),
    minTemp: readNumber(entity, 'min_temp') ?? DEFAULT_MIN,
    maxTemp: readNumber(entity, 'max_temp') ?? DEFAULT_MAX,
    step: step !== null && step > 0 ? step : DEFAULT_STEP,
    hvacModes: readTextList(entity, 'hvac_modes'),
    presetModes: readTextList(entity, 'preset_modes'),
    presetMode: readText(entity, 'preset_mode'),
    canSetTarget: hasFeature(entity, TARGET_TEMPERATURE),
  };
}

/**
 * The target one press of − (direction -1) or + (direction 1) leads to: the next whole step
 * from `target`, kept within the thermostat's range. With no target yet, it starts from the
 * room temperature, or else the minimum.
 */
export function stepTarget(view: ClimateView, target: number | null, direction: -1 | 1): number {
  const from = target ?? view.currentTemperature ?? view.minTemp;
  const stepsFromZero = from / view.step;
  // A value already on a step moves a whole step; one between steps moves to the nearest
  // step in that direction. The small allowance absorbs floating-point dust (21.1 / 0.1).
  const nextSteps =
    direction === 1 ? Math.floor(stepsFromZero + 1e-6) + 1 : Math.ceil(stepsFromZero - 1e-6) - 1;
  const next = roundTo(nextSteps * view.step, view.step);

  return Math.max(view.minTemp, Math.min(view.maxTemp, next));
}

/** A temperature for the screen: '21°', '20.5°'. */
export function formatTemperature(value: number | null): string {
  if (value === null) return '–';
  return String(Math.round(value * 10) / 10) + '°';
}

/** Rounds away floating-point dust so 0.1 steps give 21.1, not 21.100000000000001. */
function roundTo(value: number, step: number): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
