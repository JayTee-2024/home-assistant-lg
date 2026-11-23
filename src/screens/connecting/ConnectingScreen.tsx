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
  /** True once an attempt has failed. */
  hasFailed: boolean;
  /** Goes to the sign-in screen, to use another address or sign in again. */
  onSignInAgain(): void;
  onClose(): void;
}

export function ConnectingScreen(props: ConnectingScreenProps) {
  useEffect(() => {
    focusFirst(topScope());
  }, [props.hasFailed]);

  return (
    <div class="screen" data-focus-scope>
      <TitleBar onClose={props.onClose} />
      <main class="centred">
        <h1>{props.hasFailed ? 'Cannot reach Home Assistant' : 'Connecting to Home Assistant'}</h1>
        <p class="centred-detail">
          {props.hasFailed
            ? 'Nothing answered at ' + props.address + '. Trying again every few seconds.'
            : props.address}
        </p>
        {props.hasFailed && (
          <button class="button button-outline" onClick={props.onSignInAgain}>
            Sign in again or change the address
          </button>
        )}
      </main>
    </div>
  );
}
