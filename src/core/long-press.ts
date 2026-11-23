/**
 * Tells a short press of OK from a long one.
 *
 * On the home screen a short OK does a card's everyday action and holding OK opens its
 * panel. A held key on a remote sends "key down" over and over, then one "key up", so this
 * keeps track of one press at a time.
 *
 * The timer functions are passed in. The app passes the browser's setTimeout and
 * clearTimeout; tests pass a timer they wind by hand.
 */

/** How long OK must be held to count as a long press. */
export const LONG_PRESS_MS = 600;

export interface LongPress {
  /** Call for every "key down". `isRepeat` is true for the repeats a held key sends. */
  keyDown(isRepeat: boolean): void;
  /** Call on "key up". Says what kind of press just ended; 'none' when there was no press to end. */
  keyUp(): 'short' | 'long' | 'none';
  /** Forgets the press in progress, for when focus moves away or a screen closes. */
  cancel(): void;
}

/** `onLong` runs once, as soon as a press has lasted LONG_PRESS_MS, while the key is still down. */
export function createLongPress(
  onLong: () => void,
  setTimer: (run: () => void, ms: number) => number,
  clearTimer: (id: number) => void,
): LongPress {
  let state: 'idle' | 'down' | 'long' = 'idle';
  let timer: number | null = null;

  const stopTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  return {
    keyDown(isRepeat) {
      if (isRepeat || state !== 'idle') return;

      state = 'down';
      timer = setTimer(() => {
        timer = null;
        // A cancelled press may leave a timer that a hand-wound test timer still fires.
        if (state !== 'down') return;
        state = 'long';
        onLong();
      }, LONG_PRESS_MS);
    },

    keyUp() {
      stopTimer();
      const ended = state;
      state = 'idle';
      if (ended === 'down') return 'short';
      if (ended === 'long') return 'long';
      return 'none';
    },

    cancel() {
      stopTimer();
      state = 'idle';
    },
  };
}
