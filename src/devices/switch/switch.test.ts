/**
 * Tests for the switch type: plugs, switches and on/off helpers.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { toggle } from './actions';
import { switchType } from './index';
import { readSwitch } from './model';

const tvPlug = sampleEntity('switch.tv_plug'); // on
const kettlePlug = sampleEntity('switch.kettle_plug'); // off
const guestMode = sampleEntity('input_boolean.guest_mode'); // off

describe('readSwitch', () => {
  it('reads on and off', () => {
    expect(readSwitch(tvPlug)).toEqual({ isOn: true, isAvailable: true });
    expect(readSwitch(kettlePlug)).toEqual({ isOn: false, isAvailable: true });
  });

  it('reads an unavailable switch as off and not available', () => {
    expect(readSwitch(sampleEntity('switch.spare_plug'))).toEqual({
      isOn: false,
      isAvailable: false,
    });
  });
});

describe('toggle', () => {
  it('asks Home Assistant to toggle, and predicts the opposite state', () => {
    const action = toggle(tvPlug);

    expect(action.call).toEqual({
      domain: 'switch',
      service: 'toggle',
      entityId: 'switch.tv_plug',
      data: {},
    });
    expect(action.predicted.state).toBe('off');
    expect(toggle(kettlePlug).predicted.state).toBe('on');
  });

  it("uses the entity's own type for the service, so helpers work too", () => {
    expect(toggle(guestMode).call.domain).toBe('input_boolean');
  });

  it('leaves the entity it was given unchanged', () => {
    toggle(tvPlug);

    expect(tvPlug.state).toBe('on');
  });
});

describe('the switch type', () => {
  it('covers switches and on/off helpers', () => {
    expect(switchType.domains).toEqual(['switch', 'input_boolean']);
    expect(switchType.cardSize).toBe('small');
  });

  it('toggles on OK, and does nothing when the switch is unavailable', () => {
    expect(switchType.okAction(tvPlug)).toEqual(toggle(tvPlug));
    expect(switchType.okAction(changed(tvPlug, {}, 'unavailable'))).toBe('nothing');
  });

  it('is shown as on only when it is on', () => {
    expect(switchType.isActive(tvPlug)).toBe(true);
    expect(switchType.isActive(kettlePlug)).toBe(false);
  });

  it('sums itself up in a word', () => {
    expect(switchType.summary(tvPlug)).toBe('On');
    expect(switchType.summary(kettlePlug)).toBe('Off');
    expect(switchType.summary(sampleEntity('switch.spare_plug'))).toBe('Unavailable');
  });
});
