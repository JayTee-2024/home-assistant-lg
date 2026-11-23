/**
 * Tests for the button type: things that are pressed or run, with no state to show.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { press } from './actions';
import { buttonType } from './index';

const scene = sampleEntity('scene.movie_night');
const script = sampleEntity('script.goodnight');
const button = { entity_id: 'button.restart_router', state: 'unknown', attributes: {} };
const inputButton = {
  entity_id: 'input_button.doorbell_test',
  state: '2026-11-20T08:00:00+00:00',
  attributes: {},
};

describe('press', () => {
  it.each([
    [button, 'button', 'press'],
    [inputButton, 'input_button', 'press'],
    [scene, 'scene', 'turn_on'],
    [script, 'script', 'turn_on'],
  ])('sends the right service for %o', (entity, domain, service) => {
    expect(press(entity).call).toEqual({ domain, service, entityId: entity.entity_id, data: {} });
  });

  it('predicts no change, because a press has no lasting state', () => {
    expect(press(scene).predicted).toEqual(scene);
  });
});

describe('the button type', () => {
  it('covers buttons, button helpers, scenes and scripts', () => {
    expect(buttonType.domains).toEqual(['button', 'input_button', 'scene', 'script']);
  });

  it('presses on OK', () => {
    expect(buttonType.okAction(scene)).toEqual(press(scene));
  });

  it('can be pressed while its state is "unknown", which only means it was never pressed', () => {
    expect(buttonType.okAction(button)).toEqual(press(button));
  });

  it('does nothing on OK when it is unavailable', () => {
    expect(buttonType.okAction(changed(scene, {}, 'unavailable'))).toBe('nothing');
  });

  it('is never shown as on, and has no summary line', () => {
    expect(buttonType.isActive(scene)).toBe(false);
    expect(buttonType.summary(scene)).toBeNull();
  });
});
