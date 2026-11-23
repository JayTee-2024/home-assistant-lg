/**
 * The app itself: it decides which screen is showing and holds what the screens share.
 *
 * The app is always in one of four phases:
 *   starting    reading what was saved
 *   signed-out  showing the sign-in screen
 *   connecting  has a saved sign-in and is opening the connection (and retrying if it fails)
 *   home        connected: the home screen, with Settings or a device's panel over it
 *
 * This is also the one place where the pieces from src/platform (the real network sender,
 * storage, the connection, closing the app) are handed to the screens, which know nothing
 * about the TV or the browser themselves.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { EMPTY_HOME, type HomeSnapshot } from '../core/home-assistant';
import type { HomeConnection } from '../core/home-connection';
import { withTimeout } from '../core/http';
import {
  afterSignIn,
  afterSignOut,
  parseSavedState,
  serialiseSavedState,
  type SavedSignIn,
  type SavedState,
} from '../core/saved-state';
import { closeApp } from '../platform/close-app';
import { openHomeConnection } from '../platform/home-assistant-connection';
import { fetchSend } from '../platform/http';
import { remoteKeyFromCode } from '../platform/keys';
import { readSavedText, writeSavedText } from '../platform/storage';
import { ConnectingScreen } from '../screens/connecting/ConnectingScreen';
import { isTypingInField, moveFocus, topScope } from '../screens/shared/focus';
import { SignInScreen } from '../screens/sign-in/SignInScreen';

type Phase = 'starting' | 'signed-out' | 'connecting' | 'home';

/** How long a sign-in request may take before the app gives up on it. */
const REQUEST_TIMEOUT_MS = 8000;
/** How long to wait before trying again when Home Assistant cannot be reached at start-up. */
const RETRY_DELAY_MS = 5000;

const SIGN_IN_REJECTED = 'Home Assistant did not accept the sign-in. Please sign in again.';

const send = withTimeout(fetchSend, REQUEST_TIMEOUT_MS);

export function App() {
  const [phase, setPhase] = useState<Phase>('starting');
  const [saved, setSaved] = useState<SavedState>(() => parseSavedState(readSavedText()));
  const [notice, setNotice] = useState<string | null>(null);
  const [hasConnectFailed, setHasConnectFailed] = useState(false);
  const [home, setHome] = useState<HomeSnapshot>(EMPTY_HOME);
  const [userName, setUserName] = useState('');

  // The newest saved state, for code that runs later (timers, the connection's callbacks)
  // and would otherwise see the state as it was when that code was set up.
  const savedRef = useRef(saved);
  const connectionRef = useRef<HomeConnection | null>(null);
  const retryTimer = useRef<number | null>(null);

  /** Changes what is saved, on screen and on the TV's storage together. */
  function updateSaved(change: (state: SavedState) => SavedState) {
    const next = change(savedRef.current);
    savedRef.current = next;
    setSaved(next);
    writeSavedText(serialiseSavedState(next));
  }

  function stopRetrying() {
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }

  function connect(signIn: SavedSignIn) {
    stopRetrying();
    setPhase('connecting');

    openHomeConnection(signIn, (fresh) =>
      updateSaved((state) => ({ ...state, signIn: fresh })),
    ).then(
      (connection) => {
        connectionRef.current = connection;
        setUserName(connection.userName);
        setHasConnectFailed(false);
        connection.onHome(setHome);
        connection.onStatus((status) => {
          if (status === 'sign-in-rejected') signOutLocally(SIGN_IN_REJECTED);
        });
        setPhase('home');
      },
      (error: Error) => {
        if (error.message === 'sign-in-rejected') {
          signOutLocally(SIGN_IN_REJECTED);
          return;
        }
        // Home Assistant did not answer. Say so, and try again shortly.
        setHasConnectFailed(true);
        retryTimer.current = setTimeout(() => connect(signIn), RETRY_DELAY_MS);
      },
    );
  }

  /** Forgets the sign-in on this TV and shows the sign-in screen. The layout is kept. */
  function signOutLocally(reason: string | null) {
    stopRetrying();
    if (connectionRef.current !== null) connectionRef.current.close();
    connectionRef.current = null;
    updateSaved(afterSignOut);
    setHasConnectFailed(false);
    setNotice(reason);
    setPhase('signed-out');
  }

  function handleSignedIn(signIn: SavedSignIn) {
    updateSaved((state) => afterSignIn(state, signIn));
    setNotice(null);
    connect(signIn);
  }

  // Start-up: connect with the saved sign-in, or show the sign-in screen.
  useEffect(() => {
    const signIn = savedRef.current.signIn;
    if (signIn === null) setPhase('signed-out');
    else connect(signIn);
    // The empty list means: run once, when the app starts.
  }, []);

  // The remote. One listener for the whole app: arrows move focus within the top-most
  // screen or overlay. OK is left to the browser, which presses the focused button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = remoteKeyFromCode(event.keyCode);
      if (key !== 'up' && key !== 'down' && key !== 'left' && key !== 'right') return;

      // In a text field, Left and Right move the cursor.
      if ((key === 'left' || key === 'right') && isTypingInField()) return;

      moveFocus(topScope(), key);
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (phase === 'starting') return null;

  if (phase === 'signed-out') {
    return (
      <SignInScreen
        send={send}
        startAddress={saved.layoutAddress}
        notice={notice}
        onSignedIn={handleSignedIn}
        onClose={closeApp}
      />
    );
  }

  if (phase === 'connecting') {
    return (
      <ConnectingScreen
        address={saved.signIn === null ? '' : saved.signIn.address}
        hasFailed={hasConnectFailed}
        onSignInAgain={() => signOutLocally(null)}
        onClose={closeApp}
      />
    );
  }

  // The home screen arrives in the next task. Until then, say that sign-in worked.
  return (
    <div class="screen" data-focus-scope>
      <main class="centred">
        <h1>Signed in as {userName}</h1>
        <p class="centred-detail">{Object.keys(home.states).length} entities loaded.</p>
      </main>
    </div>
  );
}
