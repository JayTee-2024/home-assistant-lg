/**
 * Tests for the vacuum type: robot vacuums.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { locate, pause, returnHome, start, stop } from './actions';
import { vacuumType } from './index';
import { readVacuum } from './model';

const robot = sampleEntity('vacuum.robot'); // docked, features 12828

describe('readVacuum', () => {
  it('reads a docked vacuum and what it supports', () => {
    expect(readVacuum(robot)).toEqual({
      isAvailable: true,
      activity: 'docked',
      words: 'Docked',
      canStart: true,
      canPause: true,
      canStop: true,
      canReturnHome: true,
      canLocate: true,
    });
  });

  it('puts each activity into words, and an error plainly', () => {
    const words = (state: string) => readVacuum(changed(robot, {}, state)).words;

    expect(words('cleaning')).toBe('Cleaning');
    expect(words('returning')).toBe('Returning to dock');
    expect(words('paused')).toBe('Paused');
    expect(words('idle')).toBe('Idle');
    expect(words('error')).toBe('Needs attention');
    expect(words('unavailable')).toBe('Unavailable');
  });
});

describe('vacuum actions', () => {
  it('starts, pauses, stops, returns home and locates', () => {
    expect(start(robot).call).toEqual({
      domain: 'vacuum',
      service: 'start',
      entityId: 'vacuum.robot',
      data: {},
    });
    expect(start(robot).predicted.state).toBe('cleaning');
    expect(pause(robot).call.service).toBe('pause');
    expect(stop(robot).call.service).toBe('stop');
    expect(returnHome(robot).call.service).toBe('return_to_base');
    expect(returnHome(robot).predicted.state).toBe('returning');
    expect(locate(robot).call.service).toBe('locate');
    expect(locate(robot).predicted).toEqual(robot);
  });
});

describe('the vacuum type', () => {
  it('opens its panel on OK, even when it needs attention', () => {
    expect(vacuumType.okAction(robot)).toBe('open-panel');
    expect(vacuumType.okAction(changed(robot, {}, 'error'))).toBe('open-panel');
    expect(vacuumType.okAction(changed(robot, {}, 'unavailable'))).toBe('nothing');
  });

  it('is shown as on while cleaning or returning', () => {
    expect(vacuumType.isActive(robot)).toBe(false);
    expect(vacuumType.isActive(changed(robot, {}, 'cleaning'))).toBe(true);
    expect(vacuumType.isActive(changed(robot, {}, 'returning'))).toBe(true);
  });

  it('sums itself up in words', () => {
    expect(vacuumType.summary(changed(robot, {}, 'error'))).toBe('Needs attention');
  });
});
