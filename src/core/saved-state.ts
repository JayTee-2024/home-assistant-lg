/**
 * What the app keeps between runs, and how it is written to and read from text.
 *
 * Four things are kept, on the TV only: the Home Assistant address, the tokens from
 * signing in, the layout, and the PIN lock's PIN when it is on. The password is never kept. It is not a field of anything
 * here, and serialiseSavedState writes only the fields it names.
 *
 * Reading never fails. Whatever is found (nothing, damaged text, data from another version)
 * the app gets a usable state, at worst an empty one that leads to the sign-in screen.
 *
 * This file does not touch the TV's storage. src/platform/storage.ts does that.
 */

import {
  cellsOf,
  EMPTY_LAYOUT,
  GRID_COLUMNS,
  GRID_ROWS,
  type CardPlace,
  type Layout,
} from './layout';
import type { CardSize } from './part-type';
import { isValidPin } from './pin-lock';

/** Change this number when the saved shape changes, so old data is ignored and not misread. */
const SAVED_VERSION = 1;

export interface SavedSignIn {
  /** For example 'http://192.168.1.100:8123'. */
  address: string;
  /** 'account': signed in with a username and password. 'long-lived-token': the Advanced route. */
  kind: 'account' | 'long-lived-token';
  accessToken: string;
  /** The key that gets new access tokens. Empty for a long-lived token. */
  refreshToken: string;
  /** When the access token stops working, in milliseconds since 1970. 0 for a long-lived token. */
  expiresAt: number;
}

export interface SavedState {
  /** null when signed out. */
  signIn: SavedSignIn | null;
  layout: Layout;
  /** The Home Assistant address the layout belongs to. Kept through sign-out. */
  layoutAddress: string | null;
  /** The PIN lock's four digits, or null when the lock is off (see pin-lock.ts). */
  pin: string | null;
}

export const EMPTY_SAVED_STATE: SavedState = {
  signIn: null,
  layout: EMPTY_LAYOUT,
  layoutAddress: null,
  pin: null,
};

export function serialiseSavedState(state: SavedState): string {
  const signIn = state.signIn;

  return JSON.stringify({
    version: SAVED_VERSION,
    signIn:
      signIn === null
        ? null
        : {
            address: signIn.address,
            kind: signIn.kind,
            accessToken: signIn.accessToken,
            refreshToken: signIn.refreshToken,
            expiresAt: signIn.expiresAt,
          },
    layout: {
      cards: state.layout.cards.map((card) => ({
        deviceId: card.deviceId,
        page: card.page,
        column: card.column,
        row: card.row,
        size: card.size,
      })),
    },
    layoutAddress: state.layoutAddress,
    pin: state.pin,
  });
}

export function parseSavedState(text: string | null): SavedState {
  if (text === null) return EMPTY_SAVED_STATE;

  let saved: unknown;
  try {
    saved = JSON.parse(text);
  } catch {
    return EMPTY_SAVED_STATE;
  }

  if (!isRecord(saved) || saved['version'] !== SAVED_VERSION) return EMPTY_SAVED_STATE;

  const layoutAddress = saved['layoutAddress'];
  const pin = saved['pin'];
  return {
    signIn: readSignIn(saved['signIn']),
    layout: readLayout(saved['layout']),
    layoutAddress: typeof layoutAddress === 'string' ? layoutAddress : null,
    // Absent in data saved before the PIN lock existed: the lock is then off.
    pin: typeof pin === 'string' && isValidPin(pin) ? pin : null,
  };
}

/**
 * The state after a successful sign-in. The layout is kept when it belongs to the same
 * Home Assistant, and cleared when the address is different: another home's devices would
 * all be missing.
 */
export function afterSignIn(state: SavedState, signIn: SavedSignIn): SavedState {
  const sameHome = state.layoutAddress === signIn.address;

  return {
    signIn,
    layout: sameHome ? state.layout : EMPTY_LAYOUT,
    layoutAddress: signIn.address,
    pin: state.pin,
  };
}

/**
 * The state after signing out: the tokens go, the layout stays for the next sign-in. The PIN
 * goes too: it guards a sign-in, and signing out is the way past a forgotten PIN.
 */
export function afterSignOut(state: SavedState): SavedState {
  return { signIn: null, layout: state.layout, layoutAddress: state.layoutAddress, pin: null };
}

function isRecord(value: unknown): value is { [name: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSignIn(value: unknown): SavedSignIn | null {
  if (!isRecord(value)) return null;

  const { address, kind, accessToken, refreshToken, expiresAt } = value;
  if (typeof address !== 'string' || typeof accessToken !== 'string') return null;
  if (typeof refreshToken !== 'string' || typeof expiresAt !== 'number') return null;
  if (kind !== 'account' && kind !== 'long-lived-token') return null;

  return { address, kind, accessToken, refreshToken, expiresAt };
}

function readLayout(value: unknown): Layout {
  if (!isRecord(value) || !Array.isArray(value['cards'])) return EMPTY_LAYOUT;

  const cards: CardPlace[] = [];
  for (const item of value['cards'] as unknown[]) {
    const card = readCard(item);
    if (card !== null) cards.push(card);
  }
  return { cards };
}

/** One saved card, or null when any field is missing, of the wrong kind, or off the grid. */
function readCard(value: unknown): CardPlace | null {
  if (!isRecord(value)) return null;

  const { deviceId, page, column, row, size } = value;
  if (typeof deviceId !== 'string') return null;
  if (!isWholeNumber(page) || !isWholeNumber(column) || !isWholeNumber(row)) return null;
  if (size !== 'small' && size !== 'wide' && size !== 'large') return null;

  const cells = cellsOf(size as CardSize);
  if (column + cells.columns > GRID_COLUMNS || row + cells.rows > GRID_ROWS) return null;

  return { deviceId, page, column, row, size };
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= 0;
}
