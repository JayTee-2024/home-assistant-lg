/**
 * Tests for pending-states.ts: showing a press at once, before Home Assistant confirms it.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity, sampleHome } from '../test-support/sample-home';
import {
  applyPending,
  PENDING_LIMIT_MS,
  settle,
  withoutPending,
  withPending,
  type PendingStates,
} from './pending-states';

const NOW = 1700000000000;
const lampOn = sampleEntity('light.lounge_lamp');
const lampOff = changed(lampOn, {}, 'off');
const NONE: PendingStates = {};

describe('withPending and applyPending', () => {
  it('lays the predicted state over the real one', () => {
    const pending = withPending(NONE, lampOff, NOW);

    expect(applyPending(sampleHome(), pending).states['light.lounge_lamp']?.state).toBe('off');
  });

  it('leaves every other entity as it is', () => {
    const home = sampleHome();
    const shown = applyPending(home, withPending(NONE, lampOff, NOW));

    expect(shown.states['switch.tv_plug']).toBe(home.states['switch.tv_plug']);
    expect(shown.entities).toBe(home.entities);
  });

  it('gives back the same home when nothing is pending', () => {
    const home = sampleHome();

    expect(applyPending(home, NONE)).toBe(home);
  });

  it('does not change the home or the pending list it was given', () => {
    const home = sampleHome();
    const pending = withPending(NONE, lampOff, NOW);

    applyPending(home, pending);
    withPending(pending, changed(sampleEntity('switch.tv_plug'), {}, 'off'), NOW);

    expect(home.states['light.lounge_lamp']?.state).toBe('on');
    expect(Object.keys(pending)).toEqual(['light.lounge_lamp']);
  });

  it('ignores a pending state for an entity the home no longer has', () => {
    const home = sampleHome();
    delete home.states['light.lounge_lamp'];

    expect(
      applyPending(home, withPending(NONE, lampOff, NOW)).states['light.lounge_lamp'],
    ).toBeUndefined();
  });
});

describe('withoutPending', () => {
  it('removes one entity, as after a failed command', () => {
    const pending = withPending(
      withPending(NONE, lampOff, NOW),
      sampleEntity('switch.tv_plug'),
      NOW,
    );

    expect(Object.keys(withoutPending(pending, 'light.lounge_lamp'))).toEqual(['switch.tv_plug']);
  });

  it('gives back the same list when the entity was not pending', () => {
    const pending = withPending(NONE, lampOff, NOW);

    expect(withoutPending(pending, 'switch.tv_plug')).toBe(pending);
  });
});

describe('settle', () => {
  it('drops a prediction once Home Assistant reports a new state for that entity', () => {
    const before = sampleHome();
    const after = sampleHome();
    after.states['light.lounge_lamp'] = lampOff;
    const pending = withPending(NONE, lampOff, NOW);

    expect(settle(pending, before, after, NOW + 200)).toEqual({});
  });

  it('keeps a prediction while Home Assistant has reported nothing new for that entity', () => {
    const before = sampleHome();
    const after = sampleHome();
    // Some other entity changed. The lamp's state object is the same one as before.
    after.states['light.lounge_lamp'] = before.states['light.lounge_lamp'] ?? lampOn;
    after.states['switch.tv_plug'] = changed(sampleEntity('switch.tv_plug'), {}, 'off');
    const pending = withPending(NONE, lampOff, NOW);

    expect(Object.keys(settle(pending, before, after, NOW + 200))).toEqual(['light.lounge_lamp']);
  });

  it('drops a prediction that has waited too long, so a lost command cannot show a wrong state for ever', () => {
    const home = sampleHome();
    const pending = withPending(NONE, lampOff, NOW);

    expect(Object.keys(settle(pending, home, home, NOW + PENDING_LIMIT_MS - 1))).toEqual([
      'light.lounge_lamp',
    ]);
    expect(settle(pending, home, home, NOW + PENDING_LIMIT_MS)).toEqual({});
  });

  it('gives back the same list when nothing settled', () => {
    const home = sampleHome();
    const pending = withPending(NONE, lampOff, NOW);

    expect(settle(pending, home, home, NOW + 1)).toBe(pending);
  });
});
