/**
 * Gives names to the key codes an LG remote sends, so the rest of the app never
 * mentions a number.
 *
 * It only translates codes. Deciding what a key does belongs to the screens.
 */

import type { RemoteKey } from '../core/remote-key';

export type { RemoteKey };

const KEY_NAMES: { [keyCode: number]: RemoteKey } = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  13: 'ok',
  // 461 is webOS's own code for the remote's Back button.
  461: 'back',
  // Escape, so Back can be pressed on a desktop keyboard during development. Backspace is
  // deliberately not here: deleting a character in a text field must never mean Back.
  27: 'back',
  403: 'red',
  404: 'green',
  405: 'yellow',
  406: 'blue',
  // The remote's channel buttons arrive as Page Up and Page Down.
  33: 'channelUp',
  34: 'channelDown',
};

/** Returns the remote key for a keyboard event's keyCode, or null for any other key. */
export function remoteKeyFromCode(keyCode: number): RemoteKey | null {
  return KEY_NAMES[keyCode] ?? null;
}
