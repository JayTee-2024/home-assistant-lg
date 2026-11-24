/**
 * Tests for saved-state.ts: what the app keeps on the TV, and how it survives bad data.
 */

import { describe, expect, it } from 'vitest';
import { addCard, EMPTY_LAYOUT } from './layout';
import {
  afterSignIn,
  afterSignOut,
  EMPTY_SAVED_STATE,
  parseSavedState,
  serialiseSavedState,
  type SavedSignIn,
  type SavedState,
} from './saved-state';

const signIn: SavedSignIn = {
  address: 'http://192.168.1.100:8123',
  kind: 'account',
  accessToken: 'access-abc',
  refreshToken: 'refresh-def',
  expiresAt: 1800000000000,
};

const layout = addCard(addCard(EMPTY_LAYOUT, 'device:lamp', 'small'), 'device:heating', 'wide');
const state: SavedState = { signIn, layout, layoutAddress: signIn.address, pin: null };

describe('saving and reading back', () => {
  it('gives back exactly what was saved', () => {
    expect(parseSavedState(serialiseSavedState(state))).toEqual(state);
  });

  it('gives back a signed-out state exactly too', () => {
    const signedOut: SavedState = {
      signIn: null,
      layout,
      layoutAddress: signIn.address,
      pin: null,
    };

    expect(parseSavedState(serialiseSavedState(signedOut))).toEqual(signedOut);
  });

  it('writes only the documented fields, so nothing else (a password, say) can be saved', () => {
    const withExtras = Object.assign({}, state, { password: 'secret' }) as SavedState;
    const text = serialiseSavedState(withExtras);

    expect(text).not.toContain('secret');
    expect(Object.keys(JSON.parse(text) as object).sort()).toEqual([
      'layout',
      'layoutAddress',
      'pin',
      'signIn',
      'version',
    ]);
  });
});

describe('reading bad data', () => {
  it('starts empty when nothing was saved', () => {
    expect(parseSavedState(null)).toEqual(EMPTY_SAVED_STATE);
    expect(parseSavedState('')).toEqual(EMPTY_SAVED_STATE);
  });

  it('starts empty when the text is not JSON', () => {
    expect(parseSavedState('{"version": 1, "signIn"')).toEqual(EMPTY_SAVED_STATE);
  });

  it('starts empty when the text is JSON of the wrong kind', () => {
    expect(parseSavedState('42')).toEqual(EMPTY_SAVED_STATE);
    expect(parseSavedState('null')).toEqual(EMPTY_SAVED_STATE);
    expect(parseSavedState('[]')).toEqual(EMPTY_SAVED_STATE);
  });

  it('starts empty when the data is from another version of the app', () => {
    const other = JSON.parse(serialiseSavedState(state)) as { version: number };
    other.version = 2;

    expect(parseSavedState(JSON.stringify(other))).toEqual(EMPTY_SAVED_STATE);
  });

  it('treats a sign-in with a missing or wrongly typed field as signed out, and keeps the layout', () => {
    const broken = JSON.parse(serialiseSavedState(state)) as { signIn: { accessToken?: unknown } };
    broken.signIn.accessToken = 12345;

    const parsed = parseSavedState(JSON.stringify(broken));

    expect(parsed.signIn).toBeNull();
    expect(parsed.layout).toEqual(layout);
  });

  it('drops a card with a bad field and keeps the others', () => {
    const broken = JSON.parse(serialiseSavedState(state)) as {
      layout: { cards: Array<{ [name: string]: unknown }> };
    };
    broken.layout.cards.push({ deviceId: 'device:odd', page: 0, column: 9, row: 0, size: 'small' });
    broken.layout.cards.push({
      deviceId: 'device:huge',
      page: 0,
      column: 0,
      row: 1,
      size: 'gigantic',
    });
    broken.layout.cards.push({ deviceId: 42, page: 0, column: 0, row: 2, size: 'small' });
    broken.layout.cards.push({
      deviceId: 'device:neg',
      page: -1,
      column: 0,
      row: 2,
      size: 'small',
    });
    broken.layout.cards.push({
      deviceId: 'device:half',
      page: 0,
      column: 0.5,
      row: 2,
      size: 'small',
    });
    broken.layout.cards.push({
      deviceId: 'device:tall',
      page: 0,
      column: 0,
      row: 2,
      size: 'large',
    });

    expect(parseSavedState(JSON.stringify(broken)).layout).toEqual(layout);
  });

  it('uses an empty layout when the layout is not a list of cards', () => {
    const broken = JSON.parse(serialiseSavedState(state)) as { layout: unknown };
    broken.layout = 'nonsense';

    expect(parseSavedState(JSON.stringify(broken)).layout).toEqual(EMPTY_LAYOUT);
  });
});

describe('afterSignIn', () => {
  it('keeps the layout when signing in to the same Home Assistant again', () => {
    const signedOut = afterSignOut(state);
    const again = afterSignIn(signedOut, Object.assign({}, signIn, { accessToken: 'new' }));

    expect(again.layout).toEqual(layout);
    expect(again.signIn?.accessToken).toBe('new');
  });

  it('clears the layout when signing in to a different Home Assistant', () => {
    const elsewhere = Object.assign({}, signIn, { address: 'http://10.0.0.5:8123' });

    const next = afterSignIn(afterSignOut(state), elsewhere);

    expect(next.layout).toEqual(EMPTY_LAYOUT);
    expect(next.layoutAddress).toBe('http://10.0.0.5:8123');
  });

  it('starts an empty layout for the first ever sign-in', () => {
    const first = afterSignIn(EMPTY_SAVED_STATE, signIn);

    expect(first).toEqual({
      signIn,
      layout: EMPTY_LAYOUT,
      layoutAddress: signIn.address,
      pin: null,
    });
  });
});

describe('afterSignOut', () => {
  it('removes the tokens and keeps the layout and which Home Assistant it belongs to', () => {
    const signedOut = afterSignOut(state);

    expect(signedOut).toEqual({
      signIn: null,
      layout,
      layoutAddress: signIn.address,
      pin: null,
    });
    expect(serialiseSavedState(signedOut)).not.toContain('refresh-def');
    expect(serialiseSavedState(signedOut)).not.toContain('access-abc');
  });
});

describe('the PIN', () => {
  const signedIn: SavedState = {
    signIn: {
      address: 'http://ha:8123',
      kind: 'account',
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 5,
    },
    layout: EMPTY_LAYOUT,
    layoutAddress: 'http://ha:8123',
    pin: '0412',
  };

  it('is saved and read back', () => {
    expect(parseSavedState(serialiseSavedState(signedIn)).pin).toBe('0412');
  });

  it('is off when the saved data has none, as data from before the PIN existed', () => {
    const old = JSON.parse(serialiseSavedState(signedIn));
    delete old.pin;
    const read = parseSavedState(JSON.stringify(old));
    expect(read.pin).toBeNull();
    expect(read.signIn).not.toBeNull();
  });

  it('is off when the saved value is not four digits', () => {
    for (const bad of ['12', 'abcd', 1234, {}]) {
      const text = JSON.stringify({ ...JSON.parse(serialiseSavedState(signedIn)), pin: bad });
      expect(parseSavedState(text).pin).toBeNull();
    }
  });

  it('is removed by signing out, and kept by signing in again to the same home', () => {
    expect(afterSignOut(signedIn).pin).toBeNull();
    expect(afterSignIn({ ...signedIn, signIn: null }, signedIn.signIn!).pin).toBe('0412');
  });
});
