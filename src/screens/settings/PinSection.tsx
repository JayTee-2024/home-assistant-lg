/**
 * The PIN lock section of Settings: turn the lock on (type a new PIN twice), change the
 * PIN, or turn the lock off. Changing it or turning it off asks for the current PIN first.
 * The lock itself is described in src/core/pin-lock.ts.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  EMPTY_PIN_ENTRY,
  PIN_LENGTH,
  deleteDigit,
  secondsToWait,
  typeDigit,
  type PinEntry,
} from '../../core/pin-lock';
import { focusFirst, topScope } from '../shared/focus';
import { PinPad } from '../shared/PinPad';

export interface PinSectionProps {
  /** The current PIN, or null when the lock is off. */
  pin: string | null;
  /** Saves a new PIN, or null to turn the lock off. */
  onSetPin(pin: string | null): void;
}

type Step =
  | { kind: 'idle' }
  /** Typing the current PIN, before changing it or turning the lock off. */
  | { kind: 'current'; then: 'change' | 'off' }
  | { kind: 'new' }
  /** Typing the new PIN a second time. */
  | { kind: 'repeat'; first: string };

export function PinSection(props: PinSectionProps) {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [typed, setTyped] = useState('');
  const [entry, setEntry] = useState<PinEntry>(EMPTY_PIN_ENTRY);
  const [message, setMessage] = useState<string | null>(null);

  // Each step replaces what had the focus, so put the focus on the new step's first control.
  // Not when the section first appears: then the focus is still in the list of sections.
  const hasAppeared = useRef(false);
  useEffect(() => {
    if (hasAppeared.current) focusFirst(topScope());
    hasAppeared.current = true;
  }, [step.kind]);

  function go(next: Step, nextMessage: string | null) {
    setStep(next);
    setTyped('');
    setMessage(nextMessage);
  }

  /** A digit of the current PIN, checked by the same rules as the lock screen. */
  function onCurrentDigit(digit: string, then: 'change' | 'off') {
    if (props.pin === null) return;
    const now = Date.now();
    const result = typeDigit(entry, digit, props.pin, now);
    setEntry(result.entry);
    if (result.result === 'unlocked') {
      if (then === 'off') {
        props.onSetPin(null);
        go({ kind: 'idle' }, 'The PIN lock is off.');
      } else {
        go({ kind: 'new' }, null);
      }
    } else if (result.result === 'wrong' || result.result === 'waiting') {
      const wait = secondsToWait(result.entry, now);
      setMessage(
        wait > 0 ? 'Too many wrong tries. Wait ' + wait + ' seconds.' : 'Wrong PIN. Try again.',
      );
    } else {
      setMessage(null);
    }
  }

  /** A digit of a new PIN: the first typing, then the repeat. */
  function onNewDigit(digit: string) {
    const digits = typed + digit;
    if (digits.length < PIN_LENGTH) {
      setTyped(digits);
      return;
    }
    if (step.kind === 'new') {
      go({ kind: 'repeat', first: digits }, null);
    } else if (step.kind === 'repeat' && step.first === digits) {
      props.onSetPin(digits);
      go({ kind: 'idle' }, 'The PIN lock is on.');
    } else {
      go({ kind: 'new' }, 'The two PINs did not match. Start again.');
    }
  }

  if (step.kind === 'current') {
    return (
      <div class="settings-pin">
        <PinPad
          title="Enter your current PIN"
          message={message}
          typedCount={entry.digits.length}
          onDigit={(digit) => onCurrentDigit(digit, step.then)}
          onDelete={() => setEntry(deleteDigit(entry))}
        />
        <CancelButton onCancel={() => go({ kind: 'idle' }, null)} />
      </div>
    );
  }

  if (step.kind === 'new' || step.kind === 'repeat') {
    return (
      <div class="settings-pin">
        <PinPad
          title={step.kind === 'new' ? 'Choose a 4-digit PIN' : 'Type the PIN again'}
          message={message}
          typedCount={typed.length}
          onDigit={onNewDigit}
          onDelete={() => setTyped(typed.slice(0, -1))}
        />
        <CancelButton onCancel={() => go({ kind: 'idle' }, null)} />
      </div>
    );
  }

  return (
    <div>
      <p class="settings-note">
        With the PIN lock on, this app asks for a 4-digit PIN when it opens and when you come back
        to it. It keeps guests and children out of your home's controls.
      </p>
      <p class="settings-note">
        Choose a PIN you do not use for anything else, such as a bank card: it is kept on this TV.
        If you forget it, the lock screen lets you sign out, which removes the PIN.
      </p>
      <div class="settings-fact">
        <div class="settings-fact-label">PIN lock</div>
        <div class="settings-fact-value">{props.pin === null ? 'Off' : 'On'}</div>
      </div>
      {message !== null && <p class="settings-note settings-pin-done">{message}</p>}

      {props.pin === null ? (
        <button
          class="button button-outline"
          data-focus-first
          onClick={() => go({ kind: 'new' }, null)}
        >
          Turn on PIN lock
        </button>
      ) : (
        <div class="settings-buttons" data-focus-row>
          <button
            class="button button-outline"
            data-focus-first
            onClick={() => go({ kind: 'current', then: 'change' }, null)}
          >
            Change PIN
          </button>
          <button
            class="button button-outline"
            onClick={() => go({ kind: 'current', then: 'off' }, null)}
          >
            Turn off PIN lock
          </button>
        </div>
      )}
    </div>
  );
}

function CancelButton(props: { onCancel(): void }) {
  return (
    <button class="button button-link settings-pin-cancel" onClick={props.onCancel}>
      Cancel
    </button>
  );
}
