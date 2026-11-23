/**
 * The live connection to Home Assistant, as the rest of the app sees it.
 *
 * This is only the description (an interface). The real thing, built on Home Assistant's
 * own connection library, is src/platform/home-assistant-connection.ts. Screens and device
 * types depend on this description, never on the library, so they can be tested with a
 * stand-in and the library can be replaced without touching them.
 */

import type { HomeSnapshot } from './home-assistant';

/** One instruction to Home Assistant: "light.turn_on for light.lounge_lamp with brightness_pct 50". */
export interface ServiceCall {
  /** The entity type that owns the service: 'light'. */
  domain: string;
  /** The service's name: 'turn_on'. */
  service: string;
  entityId: string;
  /** The service's settings, in Home Assistant's own names: { brightness_pct: 50 }. */
  data: { [name: string]: unknown };
}

export type ConnectionStatus =
  /** Talking to Home Assistant. */
  | 'connected'
  /** The link dropped. The connection keeps trying by itself. */
  | 'reconnecting'
  /** Home Assistant no longer accepts the saved sign-in. The person must sign in again. */
  | 'sign-in-rejected';

export interface HomeConnection {
  /** The signed-in Home Assistant user's name. */
  userName: string;
  /** `listener` is called at once with the home as it is now, then again on every change. */
  onHome(listener: (home: HomeSnapshot) => void): void;
  onStatus(listener: (status: ConnectionStatus) => void): void;
  /** Resolves when Home Assistant has accepted the call. Rejects with an Error carrying its reason. */
  call(call: ServiceCall): Promise<void>;
  /** Asks Home Assistant to cancel this TV's sign-in, then closes. Never rejects. */
  signOut(): Promise<void>;
  close(): void;
}

/** Why a connection could not be opened. openHomeConnection rejects with an Error whose message is one of these. */
export type OpenFailure = 'cannot-reach' | 'sign-in-rejected';
