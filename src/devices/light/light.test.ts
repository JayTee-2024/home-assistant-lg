/**
 * Tests for the light type: what a light reports, and what each control sends.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { setBrightness, setColour, setEffect, setWhite, toggle } from './actions';
import { lightType } from './index';
import { nextBrightness, readLight, whiteSteps } from './model';

const lamp = sampleEntity('light.lounge_lamp'); // colour bulb, on, brightness 180
const ceiling = sampleEntity('light.kitchen_ceiling'); // colour bulb, off
const hall = sampleEntity('light.hall_light'); // dimmable white bulb, on, brightness 128
const onOffOnly = changed(hall, {
  supported_color_modes: ['onoff'],
  color_mode: 'onoff',
  brightness: null,
});

describe('readLight', () => {
  it('reads a colour bulb that is on', () => {
    const view = readLight(lamp);

    expect(view.isOn).toBe(true);
    expect(view.brightnessPercent).toBe(71);
    expect(view.canDim).toBe(true);
    expect(view.canSetWhite).toBe(true);
    expect(view.canSetColour).toBe(true);
    expect(view.rgb).toEqual([255, 180, 84]);
    expect(view.minKelvin).toBe(1500);
    expect(view.maxKelvin).toBe(9000);
    expect(view.effects).toEqual(['effect_colorloop', 'effect_pulse', 'effect_stop']);
    expect(view.effect).toBeNull();
  });

  it('reads a bulb that is off: no brightness, but still what it can do', () => {
    const view = readLight(ceiling);

    expect(view.isOn).toBe(false);
    expect(view.brightnessPercent).toBeNull();
    expect(view.canDim).toBe(true);
    expect(view.canSetColour).toBe(true);
    expect(view.rgb).toBeNull();
  });

  it('reads a white dimmable bulb: dims, but no white range and no colour', () => {
    const view = readLight(hall);

    expect(view.brightnessPercent).toBe(50);
    expect(view.canDim).toBe(true);
    expect(view.canSetWhite).toBe(false);
    expect(view.canSetColour).toBe(false);
  });

  it('reads a plain on/off light: nothing but on and off', () => {
    const view = readLight(onOffOnly);

    expect(view.isOn).toBe(true);
    expect(view.canDim).toBe(false);
    expect(view.brightnessPercent).toBeNull();
    expect(view.effects).toEqual([]);
  });

  it('reads a light with no attributes at all without failing', () => {
    const bare = { entity_id: 'light.bare', state: 'on', attributes: {} };

    expect(readLight(bare)).toEqual({
      isOn: true,
      isAvailable: true,
      brightnessPercent: null,
      canDim: false,
      canSetWhite: false,
      canSetColour: false,
      whiteKelvin: null,
      minKelvin: 2000,
      maxKelvin: 6500,
      rgb: null,
      effects: [],
      effect: null,
    });
  });

  it('never shows 0% for a light that is on', () => {
    expect(readLight(changed(lamp, { brightness: 1 })).brightnessPercent).toBe(1);
  });

  it('ignores a colour that is not three numbers', () => {
    expect(readLight(changed(lamp, { rgb_color: [255, 'x', 0] })).rgb).toBeNull();
    expect(readLight(changed(lamp, { rgb_color: [255, 0] })).rgb).toBeNull();
  });

  it('reads an unavailable light as off and not available', () => {
    const view = readLight(changed(lamp, {}, 'unavailable'));

    expect(view.isOn).toBe(false);
    expect(view.isAvailable).toBe(false);
  });
});

describe('whiteSteps', () => {
  it("gives five whites from warm to cool across the bulb's range", () => {
    expect(whiteSteps(readLight(lamp))).toEqual([1500, 3375, 5250, 7125, 9000]);
  });
});

describe('nextBrightness', () => {
  it('moves to the next multiple of ten', () => {
    expect(nextBrightness(71, 1)).toBe(80);
    expect(nextBrightness(71, -1)).toBe(70);
    expect(nextBrightness(70, 1)).toBe(80);
    expect(nextBrightness(70, -1)).toBe(60);
  });

  it('stays between 1 and 100', () => {
    expect(nextBrightness(100, 1)).toBe(100);
    expect(nextBrightness(10, -1)).toBe(1);
    expect(nextBrightness(1, -1)).toBe(1);
    expect(nextBrightness(1, 1)).toBe(10);
  });

  it('counts a light that is off as zero', () => {
    expect(nextBrightness(null, 1)).toBe(10);
    expect(nextBrightness(null, -1)).toBe(1);
  });
});

describe('light actions', () => {
  it('toggles, predicting the opposite state', () => {
    const action = toggle(lamp);

    expect(action.call).toEqual({
      domain: 'light',
      service: 'toggle',
      entityId: 'light.lounge_lamp',
      data: {},
    });
    expect(action.predicted.state).toBe('off');
    expect(toggle(ceiling).predicted.state).toBe('on');
  });

  it('sets brightness as a percentage, turning the light on', () => {
    const action = setBrightness(ceiling, 40);

    expect(action.call).toEqual({
      domain: 'light',
      service: 'turn_on',
      entityId: 'light.kitchen_ceiling',
      data: { brightness_pct: 40 },
    });
    expect(action.predicted.state).toBe('on');
    expect(readLight(action.predicted).brightnessPercent).toBe(40);
  });

  it('keeps brightness between 1 and 100', () => {
    expect(setBrightness(lamp, 0).call.data).toEqual({ brightness_pct: 1 });
    expect(setBrightness(lamp, 250).call.data).toEqual({ brightness_pct: 100 });
  });

  it("sets a white, kept inside the bulb's own range", () => {
    expect(setWhite(lamp, 3000).call.data).toEqual({ color_temp_kelvin: 3000 });
    expect(setWhite(lamp, 500).call.data).toEqual({ color_temp_kelvin: 1500 });
    expect(setWhite(lamp, 20000).call.data).toEqual({ color_temp_kelvin: 9000 });
    expect(readLight(setWhite(lamp, 3000).predicted).whiteKelvin).toBe(3000);
    expect(readLight(setWhite(lamp, 3000).predicted).rgb).toBeNull();
  });

  it('sets a colour', () => {
    const action = setColour(lamp, [0, 128, 255]);

    expect(action.call.service).toBe('turn_on');
    expect(action.call.data).toEqual({ rgb_color: [0, 128, 255] });
    expect(readLight(action.predicted).rgb).toEqual([0, 128, 255]);
  });

  it('sets an effect', () => {
    const action = setEffect(lamp, 'effect_pulse');

    expect(action.call.data).toEqual({ effect: 'effect_pulse' });
    expect(readLight(action.predicted).effect).toBe('effect_pulse');
  });

  it('leaves the entity it was given unchanged', () => {
    setBrightness(lamp, 10);
    setColour(lamp, [1, 2, 3]);

    expect(lamp.attributes['brightness']).toBe(180);
    expect(lamp.attributes['rgb_color']).toEqual([255, 180, 84]);
  });
});

describe('the light type', () => {
  it('toggles on OK, and does nothing when the light is unavailable', () => {
    expect(lightType.okAction(lamp)).toEqual(toggle(lamp));
    expect(lightType.okAction(changed(lamp, {}, 'unavailable'))).toBe('nothing');
  });

  it('is shown as on only when it is on', () => {
    expect(lightType.isActive(lamp)).toBe(true);
    expect(lightType.isActive(ceiling)).toBe(false);
  });

  it('sums itself up as its state and brightness', () => {
    expect(lightType.summary(lamp)).toBe('On · 71%');
    expect(lightType.summary(ceiling)).toBe('Off');
    expect(lightType.summary(onOffOnly)).toBe('On');
    expect(lightType.summary(changed(lamp, {}, 'unavailable'))).toBe('Unavailable');
  });
});
