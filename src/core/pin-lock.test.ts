import { describe, expect, it } from 'vitest';
import {
  EMPTY_PIN_ENTRY,
  MAX_WRONG_TRIES,
  WAIT_AFTER_WRONG_MS,
  deleteDigit,
  isValidPin,
  secondsToWait,
  typeDigit,
  type PinEntry,
} from './pin-lock';

const NOW = 1_000_000;

/** Types every digit of `text` and returns the last step. */
function type(entry: PinEntry, text: string, pin: string, now = NOW) {
  let step = { entry, result: 'more' as string };
  for (const digit of text.split('')) step = typeDigit(step.entry, digit, pin, now);
  return step;
}

describe('isValidPin', () => {
  it('accepts exactly four digits', () => {
    expect(isValidPin('0412')).toBe(true);
    for (const bad of ['', '123', '12345', '12a4', ' 123', '１２３４']) {
      expect(isValidPin(bad)).toBe(false);
    }
  });
});

describe('typing a PIN', () => {
  it('waits for more digits until there are four', () => {
    const step = type(EMPTY_PIN_ENTRY, '123', '1234');
    expect(step.result).toBe('more');
    expect(step.entry.digits).toBe('123');
  });

  it('unlocks on the right PIN', () => {
    expect(type(EMPTY_PIN_ENTRY, '1234', '1234').result).toBe('unlocked');
  });

  it('clears the digits and counts the try on a wrong PIN', () => {
    const step = type(EMPTY_PIN_ENTRY, '9999', '1234');
    expect(step.result).toBe('wrong');
    expect(step.entry).toEqual({ digits: '', wrongTries: 1, waitUntil: 0 });
  });

  it('ignores anything that is not a single digit', () => {
    expect(typeDigit(EMPTY_PIN_ENTRY, 'a', '1234', NOW).entry).toEqual(EMPTY_PIN_ENTRY);
    expect(typeDigit(EMPTY_PIN_ENTRY, '12', '1234', NOW).entry).toEqual(EMPTY_PIN_ENTRY);
  });

  it('makes the person wait after too many wrong tries, then allows one more go', () => {
    let entry = EMPTY_PIN_ENTRY;
    for (let i = 0; i < MAX_WRONG_TRIES; i++) entry = type(entry, '9999', '1234').entry;
    expect(entry.waitUntil).toBe(NOW + WAIT_AFTER_WRONG_MS);
    expect(secondsToWait(entry, NOW)).toBe(30);

    // Even the right PIN is refused during the wait.
    const during = type(entry, '1234', '1234', NOW + 1000);
    expect(during.result).toBe('waiting');
    expect(during.entry.digits).toBe('');

    expect(secondsToWait(entry, NOW + WAIT_AFTER_WRONG_MS)).toBe(0);
    expect(type(entry, '1234', '1234', NOW + WAIT_AFTER_WRONG_MS).result).toBe('unlocked');
  });

  it('waits again after each further wrong try', () => {
    let entry = EMPTY_PIN_ENTRY;
    for (let i = 0; i < MAX_WRONG_TRIES; i++) entry = type(entry, '9999', '1234').entry;
    const later = NOW + WAIT_AFTER_WRONG_MS;
    entry = type(entry, '9999', '1234', later).entry;
    expect(entry.waitUntil).toBe(later + WAIT_AFTER_WRONG_MS);
  });
});

describe('deleteDigit', () => {
  it('removes the last digit, and does nothing when there are none', () => {
    expect(deleteDigit({ digits: '12', wrongTries: 2, waitUntil: 0 }).digits).toBe('1');
    expect(deleteDigit(EMPTY_PIN_ENTRY)).toEqual(EMPTY_PIN_ENTRY);
  });
});
