/**
 * Tests for the cover type: blinds, curtains and shutters (never doors, garages or gates).
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { close, open, setPosition, stop } from './actions';
import { coverType } from './index';
import { readCover } from './model';

const blind = sampleEntity('cover.lounge_blind'); // open, 40%, features 15

describe('readCover', () => {
  it('reads a blind', () => {
    expect(readCover(blind)).toEqual({
      isAvailable: true,
      state: 'open',
      position: 40,
      canOpen: true,
      canClose: true,
      canStop: true,
      canSetPosition: true,
    });
  });

  it('reads a cover that reports no position', () => {
    expect(
      readCover(changed(blind, { current_position: null, supported_features: 3 })).position,
    ).toBeNull();
  });
});

describe('cover actions', () => {
  it('opens, closes and stops', () => {
    expect(open(blind).call.service).toBe('open_cover');
    expect(open(blind).predicted.state).toBe('opening');
    expect(close(blind).call.service).toBe('close_cover');
    expect(close(blind).predicted.state).toBe('closing');
    expect(stop(blind).call.service).toBe('stop_cover');
  });

  it('sets a position between 0 and 100', () => {
    expect(setPosition(blind, 75).call).toEqual({
      domain: 'cover',
      service: 'set_cover_position',
      entityId: 'cover.lounge_blind',
      data: { position: 75 },
    });
    expect(setPosition(blind, 140).call.data).toEqual({ position: 100 });
    expect(readCover(setPosition(blind, 75).predicted).position).toBe(75);
  });
});

describe('the cover type', () => {
  it('supports only the kinds of cover that are safe', () => {
    expect(coverType.supports(blind)).toBe(true);
    expect(coverType.supports(changed(blind, { device_class: 'curtain' }))).toBe(true);
    expect(coverType.supports(changed(blind, { device_class: 'garage' }))).toBe(false);
    expect(coverType.supports(changed(blind, { device_class: 'door' }))).toBe(false);
    expect(coverType.supports(changed(blind, { device_class: 'gate' }))).toBe(false);
    expect(coverType.supports(changed(blind, { device_class: null }))).toBe(false);
  });

  it('opens its panel on OK, and is shown as on when not closed', () => {
    expect(coverType.okAction(blind)).toBe('open-panel');
    expect(coverType.isActive(blind)).toBe(true);
    expect(coverType.isActive(changed(blind, {}, 'closed'))).toBe(false);
  });

  it('sums itself up in words, with the position when it has one', () => {
    expect(coverType.summary(blind)).toBe('Open · 40%');
    expect(coverType.summary(changed(blind, { current_position: null }, 'closing'))).toBe(
      'Closing',
    );
  });
});
