/**
 * The real live connection to Home Assistant, built on Home Assistant's own connection
 * library (home-assistant-js-websocket).
 *
 * The library does the hard parts: the WebSocket, signing it in, reconnecting after a drop,
 * getting a fresh access token when one runs out, and keeping the list of entity states
 * current. This file turns what the library offers into the app's own small interface
 * (src/core/home-connection.ts). It is the only file that imports the library.
 *
 * It does not decide what anything means. Sorting entities into devices is
 * src/core/devices.ts; what to do when the sign-in is rejected is src/app.
 *
 * The library: https://github.com/home-assistant/home-assistant-js-websocket
 * The messages: https://developers.home-assistant.io/docs/api/websocket
 */

import {
  Auth,
  callService,
  createConnection,
  createLongLivedTokenAuth,
  ERR_INVALID_AUTH,
  getUser,
  subscribeEntities,
  type AuthData,
  type Connection,
} from 'home-assistant-js-websocket';
import { CLIENT_ID } from '../core/client-id';
import {
  readRegistryAreas,
  readRegistryDevices,
  readRegistryEntities,
  type EntityState,
  type HomeSnapshot,
} from '../core/home-assistant';
import type { ConnectionStatus, HomeConnection, OpenFailure } from '../core/home-connection';
import type { SavedSignIn } from '../core/saved-state';

/** The registries are read again when Home Assistant says they changed, but not more often than this. */
const REGISTRY_REFRESH_DELAY_MS = 1000;

const REGISTRY_EVENTS = [
  'entity_registry_updated',
  'device_registry_updated',
  'area_registry_updated',
];

/**
 * Opens the connection and waits until the first full picture of the home has arrived.
 *
 * `onTokens` is called whenever the library gets a new access token, with the sign-in to
 * save in place of the old one.
 *
 * Rejects with an Error whose message is an OpenFailure.
 */
export function openHomeConnection(
  signIn: SavedSignIn,
  onTokens: (signIn: SavedSignIn) => void,
): Promise<HomeConnection> {
  const auth = makeAuth(signIn, onTokens);

  return createConnection({ auth }).then(
    (connection) => loadHome(connection, auth),
    (error: unknown) => {
      throw new Error(failureFor(error));
    },
  );
}

function makeAuth(signIn: SavedSignIn, onTokens: (signIn: SavedSignIn) => void): Auth {
  if (signIn.kind === 'long-lived-token') {
    return createLongLivedTokenAuth(signIn.address, signIn.accessToken);
  }

  const data: AuthData = {
    hassUrl: signIn.address,
    clientId: CLIENT_ID,
    access_token: signIn.accessToken,
    refresh_token: signIn.refreshToken,
    expires: signIn.expiresAt,
    // Only used by the library as a record of the token's lifetime. `expires` is what it checks.
    expires_in: 0,
  };

  return new Auth(data, (fresh) => {
    // The library passes null after a sign-out. There is nothing to save then.
    if (fresh === null) return;
    onTokens({
      address: signIn.address,
      kind: 'account',
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresAt: fresh.expires,
    });
  });
}

/** The library rejects with a number. Anything that is not "invalid sign-in" means the address did not answer. */
function failureFor(error: unknown): OpenFailure {
  return error === ERR_INVALID_AUTH ? 'sign-in-rejected' : 'cannot-reach';
}

/** Fetches the user, the registries and the first states, then returns the working connection. */
function loadHome(connection: Connection, auth: Auth): Promise<HomeConnection> {
  let home: HomeSnapshot = { states: {}, entities: [], devices: [], areas: [] };
  const homeListeners: Array<(home: HomeSnapshot) => void> = [];
  const statusListeners: Array<(status: ConnectionStatus) => void> = [];

  const tellHome = () => {
    for (const listener of homeListeners) listener(home);
  };
  const tellStatus = (status: ConnectionStatus) => {
    for (const listener of statusListeners) listener(status);
  };

  const loadRegistries = () =>
    Promise.all([
      connection.sendMessagePromise({ type: 'config/entity_registry/list' }),
      connection.sendMessagePromise({ type: 'config/device_registry/list' }),
      connection.sendMessagePromise({ type: 'config/area_registry/list' }),
    ]).then(([entities, devices, areas]) => {
      home = {
        states: home.states,
        entities: readRegistryEntities(entities),
        devices: readRegistryDevices(devices),
        areas: readRegistryAreas(areas),
      };
    });

  // Read the registries again shortly after Home Assistant reports a change to any of them.
  let refreshTimer: number | null = null;
  const refreshRegistriesSoon = () => {
    if (refreshTimer !== null) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      loadRegistries().then(tellHome, () => {
        // A failed refresh is not worth telling anyone about: the next change tries again.
      });
    }, REGISTRY_REFRESH_DELAY_MS);
  };
  for (const eventType of REGISTRY_EVENTS) {
    connection.subscribeEvents(refreshRegistriesSoon, eventType).catch(() => {
      // Without these events the app still works; it just misses renames until the next start.
    });
  }

  connection.addEventListener('ready', () => tellStatus('connected'));
  connection.addEventListener('disconnected', () => tellStatus('reconnecting'));
  connection.addEventListener('reconnect-error', (_connection, error) => {
    if (error === ERR_INVALID_AUTH) tellStatus('sign-in-rejected');
  });

  // The library calls this with every entity's state, at first and again after each change.
  // Its entity objects already have the shape of EntityState, so they are used as they are.
  const firstStates = new Promise<void>((resolve) => {
    subscribeEntities(connection, (entities) => {
      home = {
        states: entities as { [entityId: string]: EntityState },
        entities: home.entities,
        devices: home.devices,
        areas: home.areas,
      };
      resolve();
      tellHome();
    });
  });

  return Promise.all([getUser(connection), loadRegistries(), firstStates]).then(([user]) => ({
    userName: user.name,

    onHome(listener) {
      homeListeners.push(listener);
      listener(home);
    },

    onStatus(listener) {
      statusListeners.push(listener);
    },

    call(call) {
      return callService(connection, call.domain, call.service, call.data, {
        entity_id: call.entityId,
      }).then(
        () => undefined,
        (error: unknown) => {
          throw new Error(reasonFor(error));
        },
      );
    },

    signOut() {
      const revoked =
        auth.data.refresh_token === '' ? Promise.resolve() : auth.revoke().catch(() => undefined);
      return revoked.then(() => connection.close());
    },

    close() {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      connection.close();
    },
  }));
}

/** Home Assistant's reason for refusing a call. The library rejects with { code, message }. */
function reasonFor(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message !== '') return message;
  }
  return 'Home Assistant did not accept the command.';
}
