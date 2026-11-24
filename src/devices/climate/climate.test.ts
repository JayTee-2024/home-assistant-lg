/**
 * Tests for the heating type: reading a thermostat, stepping its target, and what it sends.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { setHvacMode, setPreset, setTarget } from './actions';
import { climateType } from './index';
import { readClimate, stepTarget } from './model';

const tado = sampleEntity('climate.living_room'); // heat, heating, 20.5 → 21, range 5–25, step 0.1

describe('readClimate', () => {
  it('reads a thermostat', () => {
    const view = readClimate(tado);

    expect(view.hvacMode).toBe('heat');
    expect(view.hvacAction).toBe('heating');
    expect(view.currentTemperature).toBe(20.5);
    expect(view.targetTemperature).toBe(21);
    expect(view.minTemp).toBe(5);
    expect(view.maxTemp).toBe(25);
    expect(view.step).toBe(0.1);
    expect(view.hvacModes).toEqual(['off', 'auto', 'heat']);
    expect(view.presetModes).toEqual(['home', 'away']);
    expect(view.presetMode).toBe('home');
    expect(view.canSetTarget).toBe(true);
  });

  it('fills in a range and a step when the thermostat reports none', () => {
    const view = readClimate(
      changed(tado, { min_temp: null, max_temp: undefined, target_temp_step: null }),
    );

    expect(view.minTemp).toBe(7);
    expect(view.maxTemp).toBe(35);
    expect(view.step).toBe(0.5);
  });

  it('reads a thermostat that is off, with no target', () => {
    const view = readClimate(changed(tado, { temperature: null, hvac_action: 'idle' }, 'off'));

    expect(view.targetTemperature).toBeNull();
    expect(view.hvacMode).toBe('off');
  });

  it('cannot set a target when the thermostat does not say it can', () => {
    expect(readClimate(changed(tado, { supported_features: 0 })).canSetTarget).toBe(false);
  });
});

describe('stepTarget', () => {
  const view = readClimate(changed(tado, { target_temp_step: 0.5 }));

  it('moves one step up or down', () => {
    expect(stepTarget(view, 21, 1)).toBe(21.5);
    expect(stepTarget(view, 21, -1)).toBe(20.5);
  });

  it('stays within the range', () => {
    expect(stepTarget(view, 25, 1)).toBe(25);
    expect(stepTarget(view, 5, -1)).toBe(5);
    expect(stepTarget(view, 40, -1)).toBe(25);
  });

  it('lands on a whole step from a value between steps', () => {
    expect(stepTarget(view, 21.3, 1)).toBe(21.5);
    expect(stepTarget(view, 21.3, -1)).toBe(21);
  });

  it('starts from the current temperature, or else the minimum, when there is no target', () => {
    expect(stepTarget(view, null, 1)).toBe(21);
    expect(
      stepTarget(
        readClimate(changed(tado, { current_temperature: null, target_temp_step: 0.5 })),
        null,
        1,
      ),
    ).toBe(5.5);
  });

  it('keeps every decimal a step needs, such as 0.25', () => {
    const quarter = readClimate(changed(tado, { target_temp_step: 0.25 }));

    expect(stepTarget(quarter, 21, 1)).toBe(21.25);
    expect(stepTarget(quarter, 21.25, 1)).toBe(21.5);
  });

  it('avoids the floating-point dust of steps like 0.1', () => {
    expect(stepTarget(readClimate(tado), 21, 1)).toBe(21.1);
    expect(stepTarget(readClimate(tado), 21.1, 1)).toBe(21.2);
  });
});

describe('climate actions', () => {
  it('sets the target temperature', () => {
    const action = setTarget(tado, 22);

    expect(action.call).toEqual({
      domain: 'climate',
      service: 'set_temperature',
      entityId: 'climate.living_room',
      data: { temperature: 22 },
    });
    expect(readClimate(action.predicted).targetTemperature).toBe(22);
  });

  it('sets the mode and the preset', () => {
    expect(setHvacMode(tado, 'off').call).toEqual({
      domain: 'climate',
      service: 'set_hvac_mode',
      entityId: 'climate.living_room',
      data: { hvac_mode: 'off' },
    });
    expect(setHvacMode(tado, 'off').predicted.state).toBe('off');
    expect(setPreset(tado, 'away').call.data).toEqual({ preset_mode: 'away' });
    expect(readClimate(setPreset(tado, 'away').predicted).presetMode).toBe('away');
  });
});

describe('what the card shows straight after a press, before Home Assistant reports', () => {
  const idleAt14 = changed(tado, { temperature: 14, current_temperature: 22.1, hvac_action: 'idle' });
  const off = changed(tado, { temperature: null, hvac_action: 'off' }, 'off');

  it('a target above the room temperature shows as heating, and the card is on', () => {
    const predicted = setTarget(idleAt14, 23).predicted;
    expect(readClimate(predicted).hvacAction).toBe('heating');
    expect(climateType.isActive(predicted)).toBe(true);
  });

  it('a target at or below the room temperature shows as idle', () => {
    expect(readClimate(setTarget(tado, 19).predicted).hvacAction).toBe('idle');
    expect(readClimate(setTarget(tado, 20.5).predicted).hvacAction).toBe('idle');
  });

  it('switching off shows as off, and switching on no longer says Off', () => {
    expect(readClimate(setHvacMode(tado, 'off').predicted).hvacAction).toBe('off');
    // The target a thermostat picks when switched on is not known yet: on, but not known to be heating.
    expect(readClimate(setHvacMode(off, 'heat').predicted).hvacAction).toBe('idle');
    expect(readClimate(setHvacMode(idleAt14, 'heat').predicted).hvacAction).toBe('idle');
    expect(readClimate(setHvacMode(changed(tado, {}, 'off'), 'heat').predicted).hvacAction).toBe('heating');
  });

  it('a target set while off does not pretend the heating is on', () => {
    expect(readClimate(setTarget(off, 23).predicted).hvacAction).toBe('off');
  });

  it('a thermostat that never says what it is doing gets no guess', () => {
    const quiet = changed(tado, { hvac_action: undefined });
    expect(readClimate(setTarget(quiet, 23).predicted).hvacAction).toBe(null);
    expect(readClimate(setHvacMode(quiet, 'off').predicted).hvacAction).toBe(null);
  });
});

describe('the heating type', () => {
  it('is a wide card that opens its panel on OK', () => {
    expect(climateType.cardSize).toBe('wide');
    expect(climateType.okAction(tado)).toBe('open-panel');
    expect(climateType.okAction(changed(tado, {}, 'unavailable'))).toBe('nothing');
  });

  it('is shown as on while heating, and off when idle or off', () => {
    expect(climateType.isActive(tado)).toBe(true);
    expect(climateType.isActive(changed(tado, { hvac_action: 'idle' }))).toBe(false);
    expect(climateType.isActive(changed(tado, { hvac_action: null }, 'off'))).toBe(false);
  });

  it('sums itself up as the current and target temperatures', () => {
    expect(climateType.summary(tado)).toBe('20.5° → 21°');
    expect(climateType.summary(changed(tado, { temperature: null }, 'off'))).toBe('20.5° · Off');
  });
});
