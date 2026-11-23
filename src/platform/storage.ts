/**
 * Reads and writes the app's saved text in the TV's (or browser's) own storage.
 *
 * It only moves text. What the text means, and coping with bad text, is
 * src/core/saved-state.ts.
 *
 * Storage can be unavailable or full, and a browser may then throw. Neither case should
 * stop the app: a failed read means "nothing saved", and a failed write is skipped.
 */

const STORAGE_KEY = 'home-assist-lg';

export function readSavedText(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSavedText(text: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Nothing useful can be done here. The app keeps working; it will not remember this change.
  }
}
