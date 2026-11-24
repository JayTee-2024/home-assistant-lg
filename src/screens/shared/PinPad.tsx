/**
 * The keypad for typing a 4-digit PIN: four dots showing how many digits are in, and
 * buttons 1 to 9, 0 and Delete. The remote's number keys work too.
 *
 * It only reports what is pressed. The lock screen and Settings decide what the digits mean.
 */

import { useEffect, useRef } from 'preact/hooks';
import { PIN_LENGTH } from '../../core/pin-lock';

export interface PinPadProps {
  title: string;
  /** Shown under the dots: an error, or what to do next. */
  message: string | null;
  /** How many digits have been typed so far. */
  typedCount: number;
  onDigit(digit: string): void;
  onDelete(): void;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/** Key codes of the number keys: the remote's (and a keyboard's top row), and a number pad's. */
const FIRST_DIGIT_KEY = 48;
const FIRST_NUMBER_PAD_KEY = 96;
const BACKSPACE_KEY = 8;

export function PinPad(props: PinPadProps) {
  // The key listener is set up once, so it reaches the newest handlers through this.
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const code = event.keyCode;
      if (code >= FIRST_DIGIT_KEY && code <= FIRST_DIGIT_KEY + 9) {
        handlers.current.onDigit(String(code - FIRST_DIGIT_KEY));
      } else if (code >= FIRST_NUMBER_PAD_KEY && code <= FIRST_NUMBER_PAD_KEY + 9) {
        handlers.current.onDigit(String(code - FIRST_NUMBER_PAD_KEY));
      } else if (code === BACKSPACE_KEY) {
        handlers.current.onDelete();
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const dots = [];
  for (let i = 0; i < PIN_LENGTH; i++) {
    dots.push(<span class={'pin-dot' + (i < props.typedCount ? ' pin-dot-filled' : '')} key={i} />);
  }

  return (
    <div class="pin-pad">
      <div class="pin-title">{props.title}</div>
      <div class="pin-dots" aria-label={props.typedCount + ' of ' + PIN_LENGTH + ' digits entered'}>
        {dots}
      </div>
      <div class="pin-message">{props.message ?? ' '}</div>

      {ROWS.map((row) => (
        <div class="pin-row" data-focus-row key={row[0]}>
          {row.map((digit) => (
            <button
              class="button button-outline pin-key"
              data-focus-first={digit === '1' ? '' : undefined}
              onClick={() => props.onDigit(digit)}
              key={digit}
            >
              {digit}
            </button>
          ))}
        </div>
      ))}
      {/* 0 sits under the 8, as on a phone, with Delete beside it. */}
      <div class="pin-row" data-focus-row>
        <span class="pin-key-gap" />
        <button class="button button-outline pin-key" onClick={() => props.onDigit('0')}>
          0
        </button>
        <button class="button button-outline pin-key pin-key-delete" onClick={props.onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
