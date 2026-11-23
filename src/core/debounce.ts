/**
 * Waits for a burst of presses to end, then does one thing.
 *
 * Heating uses it: each press of − or + changes the target shown on screen at once, but
 * Home Assistant is told only once, 1.5 seconds after the last press. Some thermostats
 * (Tado among them) limit how many changes they accept in a day.
 *
 * The timer functions are passed in, as in long-press.ts, so tests can wind time by hand.
 */

export interface Debouncer {
  /** Starts the wait again. */
  trigger(): void;
  /** Runs now if something is waiting, as when the panel closes before the time is up. */
  flush(): void;
  /** Forgets what was waiting. */
  cancel(): void;
}

export function createDebouncer(
  run: () => void,
  ms: number,
  setTimer: (run: () => void, ms: number) => number,
  clearTimer: (id: number) => void,
): Debouncer {
  let timer: number | null = null;

  const stop = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  return {
    trigger() {
      stop();
      timer = setTimer(() => {
        timer = null;
        run();
      }, ms);
    },
    flush() {
      if (timer === null) return;
      stop();
      run();
    },
    cancel: stop,
  };
}
