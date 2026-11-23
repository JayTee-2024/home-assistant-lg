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
import { buildDevices, findDevice, groupByRoom, type Device } from '../core/devices';
import { EMPTY_HOME, type HomeSnapshot } from '../core/home-assistant';
import type { ConnectionStatus, HomeConnection, OpenFailure } from '../core/home-connection';
import { withTimeout } from '../core/http';
import { addCard, hasCard, pageCount, removeCard, withCurrentSizes } from '../core/layout';
import { createLongPress } from '../core/long-press';
import {
  applyPending,
  settle,
  withoutPending,
  withPending,
  type PendingStates,
} from '../core/pending-states';
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
import type { Action } from '../devices/device-type';
import { DEVICE_TYPES, deviceTypeFor } from '../devices/registry';
import { ConnectingScreen } from '../screens/connecting/ConnectingScreen';
import { HomeScreen, type PageEntry } from '../screens/home/HomeScreen';
import { PanelOverlay } from '../screens/panel/PanelOverlay';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import {
  focusElement,
  focusFirst,
  isTypingInField,
  moveFocus,
  topScope,
} from '../screens/shared/focus';
import { Toast } from '../screens/shared/Toast';
import { SignInScreen } from '../screens/sign-in/SignInScreen';

type Phase = 'starting' | 'signed-out' | 'connecting' | 'home';

/** What is open over the home screen, if anything. */
type Overlay = { kind: 'none' } | { kind: 'panel'; deviceId: string } | { kind: 'settings' };
const NO_OVERLAY: Overlay = { kind: 'none' };

/** How long a sign-in request may take before the app gives up on it. */
const REQUEST_TIMEOUT_MS = 8000;
/** How long to wait before trying again when Home Assistant cannot be reached at start-up. */
const RETRY_DELAY_MS = 5000;

/** How long a message at the bottom of the screen stays up. */
const TOAST_MS = 4000;
/** How often to check for predicted states that have waited too long (see pending-states.ts). */
const PENDING_CHECK_MS = 1000;

const SIGN_IN_REJECTED = 'Home Assistant did not accept the sign-in. Please sign in again.';
const NOT_CONNECTED = 'Not connected to Home Assistant.';

const send = withTimeout(fetchSend, REQUEST_TIMEOUT_MS);

export function App() {
  const [phase, setPhase] = useState<Phase>('starting');
  const [saved, setSaved] = useState<SavedState>(() => parseSavedState(readSavedText()));
  const [notice, setNotice] = useState<string | null>(null);
  const [connectFailure, setConnectFailure] = useState<OpenFailure | null>(null);
  const [home, setHome] = useState<HomeSnapshot>(EMPTY_HOME);
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [pending, setPending] = useState<PendingStates>({});
  const [overlay, setOverlay] = useState<Overlay>(NO_OVERLAY);
  const [page, setPage] = useState(0);
  const [pageEntry, setPageEntry] = useState<PageEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // The newest saved state, for code that runs later (timers, the connection's callbacks)
  // and would otherwise see the state as it was when that code was set up.
  const savedRef = useRef(saved);
  const connectionRef = useRef<HomeConnection | null>(null);
  const retryTimer = useRef<number | null>(null);
  /**
   * Counts connection attempts. Each attempt remembers its number, and anything it does
   * later (succeed, fail, save new tokens) is ignored once a newer attempt has started or
   * the person has signed out. Without this, a slow attempt the person had already left
   * could pull them off the sign-in screen, or bring back a sign-in they had abandoned.
   */
  const attempt = useRef(0);
  const homeRef = useRef(home);
  const toastTimer = useRef<number | null>(null);
  /** What had focus before a panel or Settings opened, to return to when it closes. */
  const focusBeforeOverlay = useRef<HTMLElement | null>(null);

  // Everything below is worked out afresh from the state above each time the app redraws.
  const shownHome = applyPending(home, pending);
  const devices = buildDevices(shownHome, DEVICE_TYPES);

  // The remote's key listener is set up once, so it reads the current values through this.
  const current = useRef({ phase, overlay, page, devices, shownHome, status, pages: 1 });
  current.current = {
    phase,
    overlay,
    page,
    devices,
    shownHome,
    status,
    pages: pageCount(saved.layout),
  };

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
    attempt.current += 1;
    const thisAttempt = attempt.current;
    const isCurrent = () => attempt.current === thisAttempt;

    openHomeConnection(signIn, (fresh) => {
      if (isCurrent()) updateSaved((state) => ({ ...state, signIn: fresh }));
    }).then(
      (connection) => {
        if (!isCurrent()) {
          connection.close();
          return;
        }
        connectionRef.current = connection;
        setUserName(connection.userName);
        setConnectFailure(null);
        setStatus('connected');
        connection.onHome((next) => {
          // A new report from Home Assistant settles the predictions it covers.
          const previous = homeRef.current;
          homeRef.current = next;
          setPending((current) => settle(current, previous, next, Date.now()));
          setHome(next);
        });
        connection.onStatus((next) => {
          if (next === 'sign-in-rejected') signOutLocally(SIGN_IN_REJECTED);
          else setStatus(next);
        });
        setPhase('home');
      },
      (error: Error) => {
        if (!isCurrent()) return;
        if (error.message === 'sign-in-rejected') {
          signOutLocally(SIGN_IN_REJECTED);
          return;
        }
        // Home Assistant did not answer, or was not ready. Say so, and try again shortly,
        // with the newest saved tokens.
        setConnectFailure(error.message === 'not-ready' ? 'not-ready' : 'cannot-reach');
        retryTimer.current = setTimeout(() => {
          const latest = savedRef.current.signIn;
          if (latest !== null && isCurrent()) connect(latest);
        }, RETRY_DELAY_MS);
      },
    );
  }

  /** Forgets the sign-in on this TV and shows the sign-in screen. The layout is kept. */
  function signOutLocally(reason: string | null) {
    // Ends any attempt in progress (see `attempt`).
    attempt.current += 1;
    stopRetrying();
    if (connectionRef.current !== null) connectionRef.current.close();
    connectionRef.current = null;
    updateSaved(afterSignOut);
    setConnectFailure(null);
    setOverlay(NO_OVERLAY);
    setPending({});
    setPage(0);
    setNotice(reason);
    setPhase('signed-out');
  }

  function showToast(message: string) {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  /** Carries out one action: show its predicted state at once, and send it to Home Assistant. */
  function run(action: Action) {
    const connection = connectionRef.current;
    if (connection === null || current.current.status !== 'connected') {
      showToast(NOT_CONNECTED);
      return;
    }

    setPending((states) => withPending(states, action.predicted, Date.now()));
    connection.call(action.call).catch((error: Error) => {
      // Put the card back to the real state and say why.
      setPending((states) => withoutPending(states, action.call.entityId));
      showToast(error.message);
    });
  }

  function openOverlay(next: Overlay) {
    // A card for a device Home Assistant no longer has has no panel to open.
    if (next.kind === 'panel' && findDevice(current.current.devices, next.deviceId) === null)
      return;
    focusBeforeOverlay.current = document.activeElement as HTMLElement | null;
    setOverlay(next);
  }

  function closeOverlay() {
    setOverlay(NO_OVERLAY);
  }

  /** A short press of OK on a card, or a click on it: do the main part's everyday action. */
  function pressCard(deviceId: string) {
    const device = findDevice(current.current.devices, deviceId);
    const main = device === null ? null : device.mainPart;
    const type = main === null ? null : deviceTypeFor(main.typeId);
    const entity = main === null ? undefined : current.current.shownHome.states[main.entityId];
    if (type === null || entity === undefined) return;

    const action = type.okAction(entity);
    if (action === 'nothing') return;
    if (action === 'open-panel') openOverlay({ kind: 'panel', deviceId });
    else run(action);
  }

  /** In the picker: puts the device on the home screen, or takes it off. */
  function toggleDevice(device: Device) {
    if (hasCard(savedRef.current.layout, device.id)) {
      // Always allowed, even for a device that is no longer supported, so no card can get stuck.
      updateSaved((state) => ({ ...state, layout: removeCard(state.layout, device.id) }));
      return;
    }

    const size = device.cardSize;
    if (size === null) {
      showToast(device.name + ' is not supported yet.');
      return;
    }
    updateSaved((state) => ({ ...state, layout: addCard(state.layout, device.id, size) }));
  }

  /** Signs out for real: Home Assistant cancels this TV's sign-in, then the TV forgets it. */
  function signOut() {
    const connection = connectionRef.current;
    const cancelled = connection === null ? Promise.resolve() : connection.signOut();
    cancelled.then(() => signOutLocally(null));
  }

  /** Shows another page. `from` is the side focus comes in from, when the arrows flipped it. */
  function showPage(next: number, from: 'left' | 'right' | null) {
    const focused = document.activeElement;
    const top = focused === null ? 0 : focused.getBoundingClientRect().top;
    setPageEntry(from === null ? null : { from, top });
    setPage(next);
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

  // Keep the saved layout in step with the devices as they are now (see withCurrentSizes).
  useEffect(() => {
    if (phase !== 'home') return;
    // A device that has not fully reported yet (just after Home Assistant starts) may look
    // smaller than it is. Leave its card alone until it has, or the layout would be shuffled
    // every time Home Assistant restarts.
    const sizeOf = (deviceId: string) => {
      const device = findDevice(devices, deviceId);
      return device === null || !device.isComplete ? null : device.cardSize;
    };
    if (withCurrentSizes(savedRef.current.layout, sizeOf) !== savedRef.current.layout) {
      updateSaved((state) => ({ ...state, layout: withCurrentSizes(state.layout, sizeOf) }));
    }
  }, [home, phase]);

  // If the device whose panel is open disappears from Home Assistant, close the panel, so
  // no invisible overlay is left holding the arrows.
  useEffect(() => {
    if (overlay.kind === 'panel' && findDevice(devices, overlay.deviceId) === null) {
      setOverlay(NO_OVERLAY);
    }
  }, [overlay, home]);

  // While any press is waiting for confirmation, check each second for ones that have waited too long.
  useEffect(() => {
    if (Object.keys(pending).length === 0) return;
    const timer = setInterval(() => {
      setPending((states) => settle(states, homeRef.current, homeRef.current, Date.now()));
    }, PENDING_CHECK_MS);
    return () => clearInterval(timer);
  }, [pending]);

  // When a panel or Settings closes, put the focus back where it was.
  useEffect(() => {
    if (overlay.kind !== 'none' || phase !== 'home') return;
    const before = focusBeforeOverlay.current;
    focusBeforeOverlay.current = null;
    if (before === null) return;
    // What had the focus may be gone: "Add devices" disappears once there is a card.
    if (document.body.contains(before)) focusElement(before);
    else focusFirst(topScope());
  }, [overlay]);

  // If the last page empties, step back to one that exists.
  useEffect(() => {
    const pages = pageCount(saved.layout);
    if (page > pages - 1) setPage(pages - 1);
  }, [saved.layout, page]);

  // The remote. One listener for the whole app.
  //   Arrows  move focus within the top-most screen or overlay; on the home screen, Left and
  //           Right past the edge flip the page.
  //   OK      on a card: a short press does the card's action, a long press opens its panel.
  //           Anywhere else it is left to the browser, which presses the focused button.
  //   Back    closes the panel or Settings.
  useEffect(() => {
    /** The device id of the focused card, or null when the focus is not on a card. */
    const focusedCard = (): string | null => {
      const focused = document.activeElement;
      return focused === null ? null : focused.getAttribute('data-card');
    };

    let pressedCard: string | null = null;
    const longPress = createLongPress(
      () => {
        if (pressedCard !== null) openOverlay({ kind: 'panel', deviceId: pressedCard });
      },
      (runLater, ms) => setTimeout(runLater, ms),
      (id) => clearTimeout(id),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      const key = remoteKeyFromCode(event.keyCode);
      const now = current.current;

      if (key === 'ok') {
        // While OK is held after a press on a card, the remote keeps sending OK. Swallow every
        // one until the key comes up: once a long press has opened the panel, those repeats
        // would otherwise press the panel's first button.
        if (pressedCard !== null) {
          longPress.keyDown(true);
          event.preventDefault();
          return;
        }
        const card = focusedCard();
        if (card === null || event.repeat) return;
        pressedCard = card;
        longPress.keyDown(false);
        event.preventDefault();
        return;
      }

      if (key === 'back') {
        if (now.overlay.kind !== 'none') closeOverlay();
        event.preventDefault();
        return;
      }

      if (key !== 'up' && key !== 'down' && key !== 'left' && key !== 'right') return;

      // In a text field, Left and Right move the cursor.
      if ((key === 'left' || key === 'right') && isTypingInField()) return;

      event.preventDefault();
      longPress.cancel();
      if (moveFocus(topScope(), key)) return;

      // Nothing that way. On the home screen, Left and Right flip the page.
      if (now.phase !== 'home' || now.overlay.kind !== 'none') return;
      if (key === 'left' && now.page > 0) showPage(now.page - 1, 'right');
      if (key === 'right' && now.page < now.pages - 1) showPage(now.page + 1, 'left');
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (remoteKeyFromCode(event.keyCode) !== 'ok') return;

      const kind = longPress.keyUp();
      if (kind === 'short' && pressedCard !== null && focusedCard() === pressedCard) {
        pressCard(pressedCard);
      }
      pressedCard = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
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
        failure={connectFailure}
        onSignInAgain={() => signOutLocally(null)}
        onClose={closeApp}
      />
    );
  }

  const homeAddress = saved.signIn === null ? '' : saved.signIn.address;
  const panelDevice = overlay.kind === 'panel' ? findDevice(devices, overlay.deviceId) : null;

  return (
    <div>
      <HomeScreen
        layout={saved.layout}
        page={page}
        pageEntry={pageEntry}
        devices={devices}
        home={shownHome}
        homeAddress={homeAddress}
        isReconnecting={status === 'reconnecting'}
        onCardPress={pressCard}
        onCardMore={(deviceId) => openOverlay({ kind: 'panel', deviceId })}
        onPage={(next) => showPage(next, null)}
        onSettings={() => openOverlay({ kind: 'settings' })}
        onClose={closeApp}
      />

      {panelDevice !== null && (
        <PanelOverlay
          device={panelDevice}
          home={shownHome}
          homeAddress={homeAddress}
          onRun={run}
          onClose={closeOverlay}
        />
      )}

      {overlay.kind === 'settings' && (
        <SettingsScreen
          rooms={groupByRoom(devices)}
          layout={saved.layout}
          address={saved.signIn === null ? '' : saved.signIn.address}
          userName={userName}
          onToggleDevice={toggleDevice}
          onUnsupportedDevice={(device) => showToast(device.name + ' is not supported yet.')}
          onSignOut={signOut}
          onClose={closeOverlay}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
