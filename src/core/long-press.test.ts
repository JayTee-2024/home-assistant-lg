/**
 * Tests for long-press.ts: telling a short press of OK from a long one.
 */

import { describe, expect, it } from 'vitest';
import { createLongPress, LONG_PRESS_MS } from './long-press';

/** A hand-wound timer, so the tests decide when time passes. */
function handTimer() {
  let pending: { run: () => void; ms: number } | null = null;
  return {
    set: (run: () => void, ms: number) => {
      pending = { run, ms };
      return 1;
    },
    clear: () => {
      pending = null;
    },
    fire: () => {
      const timer = pending;
      pending = null;
      if (timer) timer.run();
    },
    pendingMs: () => (pending ? pending.ms : null),
  };
}

function setUp() {
  const timer = handTimer();
  let longPresses = 0;
  const press = createLongPress(() => (longPresses += 1), timer.set, timer.clear);
  return { timer, press, longPresses: () => longPresses };
}

describe('createLongPress', () => {
  it('waits 600 milliseconds before calling a press long', () => {
    const { timer, press } = setUp();

    press.keyDown(false);

    expect(LONG_PRESS_MS).toBe(600);
    expect(timer.pendingMs()).toBe(600);
  });

  it('reports a short press when the key comes up before the time', () => {
    const { timer, press, longPresses } = setUp();

    press.keyDown(false);

    expect(press.keyUp()).toBe('short');
    expect(longPresses()).toBe(0);
    expect(timer.pendingMs()).toBeNull();
  });

  it('runs the long-press action once when the time passes, and reports long on key up', () => {
    const { timer, press, longPresses } = setUp();

    press.keyDown(false);
    timer.fire();

    expect(longPresses()).toBe(1);
    expect(press.keyUp()).toBe('long');
  });

  it('ignores the repeats a held key sends', () => {
    const { timer, press, longPresses } = setUp();

    press.keyDown(false);
    press.keyDown(true);
    press.keyDown(true);
    timer.fire();

    expect(longPresses()).toBe(1);
  });

  it('reports none for a key up with no key down before it', () => {
    expect(setUp().press.keyUp()).toBe('none');
  });

  it('reports none after a press was cancelled, and never runs the action', () => {
    const { timer, press, longPresses } = setUp();

    press.keyDown(false);
    press.cancel();
    timer.fire();

    expect(longPresses()).toBe(0);
    expect(press.keyUp()).toBe('none');
  });

  it('starts fresh for the next press', () => {
    const { timer, press } = setUp();

    press.keyDown(false);
    timer.fire();
    press.keyUp();
    press.keyDown(false);

    expect(press.keyUp()).toBe('short');
  });
});
