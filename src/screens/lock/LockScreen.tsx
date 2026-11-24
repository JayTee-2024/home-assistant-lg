/**
 * The lock screen, shown over everything while the PIN lock is on and the PIN has not been
 * typed: when the app opens, and when it is returned to. The rules are in
 * src/core/pin-lock.ts.
 *
 * "Forgot PIN?" signs out, which removes the PIN. Signing in again needs the Home Assistant
 * password, so this is no way round the lock.
 */

import { useEffect, useState } from 'preact/hooks';
import {
  EMPTY_PIN_ENTRY,
  deleteDigit,
  secondsToWait,
  typeDigit,
  type PinEntry,
} from '../../core/pin-lock';
import { focusFirst, topScope } from '../shared/focus';
import { PinPad } from '../shared/PinPad';

export interface LockScreenProps {
  pin: string;
  onUnlock(): void;
  /** Signs out of Home Assistant on this TV, which removes the PIN. */
  onSignOut(): void;
}

export function LockScreen(props: LockScreenProps) {
  const [entry, setEntry] = useState<PinEntry>(EMPTY_PIN_ENTRY);
  const [wasWrong, setWasWrong] = useState(false);
  const [isAskingSignOut, setIsAskingSignOut] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    focusFirst(topScope());
  }, [isAskingSignOut]);

  // While waiting after wrong tries, count the seconds down.
  const waiting = secondsToWait(entry, now);
  useEffect(() => {
    if (waiting === 0) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [waiting, now]);

  function onDigit(digit: string) {
    const step = typeDigit(entry, digit, props.pin, Date.now());
    setEntry(step.entry);
    setNow(Date.now());
    if (step.result === 'unlocked') props.onUnlock();
    else if (step.result === 'wrong') setWasWrong(true);
    else if (step.result === 'more') setWasWrong(false);
  }

  let message: string | null = null;
  if (waiting > 0) message = 'Too many wrong tries. Wait ' + waiting + ' seconds.';
  else if (wasWrong) message = 'Wrong PIN. Try again.';

  if (isAskingSignOut) {
    return (
      <div class="lock" role="dialog" aria-label="Forgot PIN" data-focus-scope>
        <div class="lock-box">
          <div class="pin-title">Forgot your PIN?</div>
          <p class="lock-note">
            Signing out removes the PIN. You can then sign in again with your Home Assistant
            username and password, and your layout is kept.
          </p>
          <div class="lock-buttons" data-focus-row>
            <button class="button button-main" onClick={props.onSignOut}>
              Sign out
            </button>
            <button
              class="button button-outline"
              data-focus-first
              onClick={() => setIsAskingSignOut(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="lock" role="dialog" aria-label="Enter PIN" data-focus-scope>
      <div class="lock-box">
        <PinPad
          title="Enter your PIN"
          message={message}
          typedCount={entry.digits.length}
          onDigit={onDigit}
          onDelete={() => setEntry(deleteDigit(entry))}
        />
        <button class="button button-link lock-forgot" onClick={() => setIsAskingSignOut(true)}>
          Forgot PIN?
        </button>
      </div>
    </div>
  );
}
