/**
 * Tests for debounce.ts: sending one change after a burst of presses.
 */

import { describe, expect, it } from 'vitest';
import { createDebouncer } from './debounce';

function handTimer() {
  let pending: (() => void) | null = null;
  const waits: number[] = [];
  return {
    set: (run: () => void, ms: number) => {
      pending = run;
      waits.push(ms);
      return waits.length;
    },
    clear: () => {
      pending = null;
    },
    fire: () => {
      const run = pending;
      pending = null;
      if (run) run();
    },
    waits: () => waits,
    isWaiting: () => pending !== null,
  };
}

describe('createDebouncer', () => {
  it('runs once, after the last of many triggers', () => {
    const timer = handTimer();
    let runs = 0;
    const debouncer = createDebouncer(() => (runs += 1), 1500, timer.set, timer.clear);

    debouncer.trigger();
    debouncer.trigger();
    debouncer.trigger();
    expect(runs).toBe(0);

    timer.fire();
    expect(runs).toBe(1);
    expect(timer.waits()).toEqual([1500, 1500, 1500]);
  });

  it('runs at once on flush, and not again when the time would have passed', () => {
    const timer = handTimer();
    let runs = 0;
    const debouncer = createDebouncer(() => (runs += 1), 1500, timer.set, timer.clear);

    debouncer.trigger();
    debouncer.flush();
    timer.fire();

    expect(runs).toBe(1);
  });

  it('does nothing on flush when nothing is waiting', () => {
    const timer = handTimer();
    let runs = 0;
    createDebouncer(() => (runs += 1), 1500, timer.set, timer.clear).flush();

    expect(runs).toBe(0);
  });

  it('never runs after cancel', () => {
    const timer = handTimer();
    let runs = 0;
    const debouncer = createDebouncer(() => (runs += 1), 1500, timer.set, timer.clear);

    debouncer.trigger();
    debouncer.cancel();
    timer.fire();
    debouncer.flush();

    expect(runs).toBe(0);
    expect(timer.isWaiting()).toBe(false);
  });
});
