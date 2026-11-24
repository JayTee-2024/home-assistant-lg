/**
 * The optional PIN lock: the rules for typing the PIN on the lock screen.
 *
 * The lock is for people holding the remote: with it on, the app asks for the PIN when it
 * opens and when it is returned to. It is off unless a PIN is set in Settings.
 *
 * It does not protect the sign-in stored on the TV from someone with root access to the
 * TV: the PIN is saved next to it, as plain text, because a 4-digit PIN cannot be
 * meaningfully hidden (there are only 10,000 to try).
 *
 * A forgotten PIN is removed by signing out, which the lock screen offers. Signing in
 * again then needs the Home Assistant password.
 */

export const PIN_LENGTH = 4;
/** After this many wrong tries in a row, every further wrong try brings a wait. */
export const MAX_WRONG_TRIES = 5;
export const WAIT_AFTER_WRONG_MS = 30000;

/** What has been typed on the lock screen so far. */
export interface PinEntry {
  digits: string;
  /** Wrong tries since the lock screen appeared. */
  wrongTries: number;
  /** No try is accepted before this time (milliseconds since 1970). 0 for no wait. */
  waitUntil: number;
}

export const EMPTY_PIN_ENTRY: PinEntry = { digits: '', wrongTries: 0, waitUntil: 0 };

export type PinResult =
  /** Fewer than four digits so far. */
  | 'more'
  | 'unlocked'
  | 'wrong'
  /** Too many wrong tries: nothing is accepted until the wait is over. */
  | 'waiting';

export function isValidPin(text: string): boolean {
  return /^[0-9]{4}$/.test(text);
}

/** Adds one digit. When that makes four, compares them with `pin`. */
export function typeDigit(
  entry: PinEntry,
  digit: string,
  pin: string,
  now: number,
): { entry: PinEntry; result: PinResult } {
  if (!/^[0-9]$/.test(digit)) return { entry, result: 'more' };
  if (now < entry.waitUntil) return { entry: { ...entry, digits: '' }, result: 'waiting' };

  const digits = entry.digits + digit;
  if (digits.length < PIN_LENGTH) return { entry: { ...entry, digits }, result: 'more' };
  if (digits === pin) return { entry: EMPTY_PIN_ENTRY, result: 'unlocked' };

  const wrongTries = entry.wrongTries + 1;
  return {
    entry: {
      digits: '',
      wrongTries,
      waitUntil: wrongTries >= MAX_WRONG_TRIES ? now + WAIT_AFTER_WRONG_MS : 0,
    },
    result: 'wrong',
  };
}

export function deleteDigit(entry: PinEntry): PinEntry {
  return entry.digits === '' ? entry : { ...entry, digits: entry.digits.slice(0, -1) };
}

/** Whole seconds left of the wait, rounded up. 0 when there is none. */
export function secondsToWait(entry: PinEntry, now: number): number {
  return Math.max(0, Math.ceil((entry.waitUntil - now) / 1000));
}
