/**
 * Tests for the fan type.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { oscillate, setPreset, setSpeed, toggle } from './actions';
import { fanType } from './index';
import { nextSpeed, readFan } from './model';

const fan = sampleEntity('fan.bedroom_fan'); // on, 50%, step 25, features 59

describe('readFan', () => {
  it('reads a fan', () => {
    const view = readFan(fan);

    expect(view.isOn).toBe(true);
    expect(view.speedPercent).toBe(50);
    expect(view.step).toBe(25);
    expect(view.canSetSpeed).toBe(true);
    expect(view.canOscillate).toBe(true);
    expect(view.isOscillating).toBe(false);
    expect(view.presets).toEqual(['breeze']);
  });

  it('reads a fan that is on with no speed, or has no speed control', () => {
    const view = readFan(changed(fan, { percentage: null, supported_features: 0 }));

    expect(view.isOn).toBe(true);
    expect(view.speedPercent).toBeNull();
    expect(view.canSetSpeed).toBe(false);
  });

  it('uses steps of at least 10%, so a fan with 100 speeds is not tedious', () => {
    expect(readFan(changed(fan, { percentage_step: 1 })).step).toBe(10);
    expect(readFan(changed(fan, { percentage_step: null })).step).toBe(10);
  });
});

describe('nextSpeed', () => {
  it("moves in the fan's own step, between 0 and 100", () => {
    expect(nextSpeed(50, 25, 1)).toBe(75);
    expect(nextSpeed(50, 25, -1)).toBe(25);
    expect(nextSpeed(100, 25, 1)).toBe(100);
    expect(nextSpeed(null, 25, 1)).toBe(25);
    expect(nextSpeed(25, 25, -1)).toBe(0);
  });
});

describe('nextSpeed with speeds that do not divide 100 evenly', () => {
  // Home Assistant reports a 3-speed fan as 33, 66 or 100, with a step of 33.33...
  const third = 100 / 3;
  const sixth = 100 / 6;

  it('moves a 3-speed fan up and down one speed from each reported value', () => {
    expect(nextSpeed(33, third, 1)).toBe(67);
    expect(nextSpeed(66, third, 1)).toBe(100);
    expect(nextSpeed(100, third, -1)).toBe(67);
    expect(nextSpeed(67, third, -1)).toBe(33);
    expect(nextSpeed(33, third, -1)).toBe(0);
  });

  it('moves a 6-speed fan one speed at a time', () => {
    expect(nextSpeed(33, sixth, 1)).toBe(50);
    expect(nextSpeed(83, sixth, 1)).toBe(100);
    expect(nextSpeed(83, sixth, -1)).toBe(67);
  });
});

describe('fan actions', () => {
  it('toggles, sets the speed, oscillates and sets a preset', () => {
    expect(toggle(fan).call).toEqual({
      domain: 'fan',
      service: 'toggle',
      entityId: 'fan.bedroom_fan',
      data: {},
    });
    expect(toggle(fan).predicted.state).toBe('off');
    expect(setSpeed(fan, 75).call.data).toEqual({ percentage: 75 });
    expect(setSpeed(fan, 0).predicted.state).toBe('off');
    expect(oscillate(fan, true).call.data).toEqual({ oscillating: true });
    expect(setPreset(fan, 'breeze').call).toEqual({
      domain: 'fan',
      service: 'set_preset_mode',
      entityId: 'fan.bedroom_fan',
      data: { preset_mode: 'breeze' },
    });
  });
});

describe('the fan type', () => {
  it('toggles on OK, even with no speed control', () => {
    expect(fanType.okAction(fan)).toEqual(toggle(fan));
    expect(fanType.okAction(changed(fan, { supported_features: 0, percentage: null }))).toEqual(
      toggle(changed(fan, { supported_features: 0, percentage: null })),
    );
    expect(fanType.okAction(changed(fan, {}, 'unavailable'))).toBe('nothing');
  });

  it('is shown as on when on, and sums itself up with its speed', () => {
    expect(fanType.isActive(fan)).toBe(true);
    expect(fanType.summary(fan)).toBe('On · 50%');
    expect(fanType.summary(changed(fan, {}, 'off'))).toBe('Off');
  });
});
