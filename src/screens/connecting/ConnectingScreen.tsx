/**
 * Shown while the app connects to Home Assistant with a saved sign-in, and when it cannot.
 * The app keeps trying by itself; this screen says so and offers a way out.
 */

import { useEffect } from 'preact/hooks';
import { focusFirst, topScope } from '../shared/focus';
import { TitleBar } from '../shared/TitleBar';

export interface ConnectingScreenProps {
  /** The address being connected to, for the message. */
  address: string;
  /** Why the last attempt failed, or null while the first attempt is still going. */
  failure: 'cannot-reach' | 'not-ready' | 'sign-in-rejected' | null;
  /** Goes to the sign-in screen, to use another address or sign in again. */
  onSignInAgain(): void;
  onClose(): void;
}

export function ConnectingScreen(props: ConnectingScreenProps) {
  const hasFailed = props.failure !== null;

  useEffect(() => {
    focusFirst(topScope());
  }, [hasFailed]);

  return (
    <div class="screen" data-focus-scope>
      <TitleBar onClose={props.onClose} />
      <main class="centred">
        <h1>{heading(props.failure)}</h1>
        <p class="centred-detail">{detail(props.failure, props.address)}</p>
        {hasFailed && (
          <button class="button button-outline" data-focus-first onClick={props.onSignInAgain}>
            Sign in again or change the address
          </button>
        )}
      </main>
    </div>
  );
}

function heading(failure: ConnectingScreenProps['failure']): string {
  if (failure === null) return 'Connecting to Home Assistant';
  if (failure === 'not-ready') return 'Home Assistant is not ready';
  return 'Cannot reach Home Assistant';
}

function detail(failure: ConnectingScreenProps['failure'], address: string): string {
  if (failure === null) return address;
  if (failure === 'not-ready') {
    return (
      'It answered at ' +
      address +
      ' but could not send its devices, as happens just after it starts. Trying again every few seconds.'
    );
  }
  return 'Nothing answered at ' + address + '. Trying again every few seconds.';
}
