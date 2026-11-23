/**
 * THROWAWAY: which control the remote's arrows move to on the TV proof screen.
 *
 * The proof screen's controls sit in one row, so Left and Right move along it. Up and
 * Down do the same, so either pair works. The real app's focus handling replaces this.
 */

import type { RemoteKey } from '../platform/keys';

/**
 * Returns the position of the control to focus after a key press, or null when the key
 * does not move focus.
 *
 * `current` is the position of the focused control in the row, or -1 when none is focused.
 */
export function nextControlIndex(
  current: number,
  key: RemoteKey | null,
  count: number,
): number | null {
  const step = key === 'right' || key === 'down' ? 1 : key === 'left' || key === 'up' ? -1 : 0;
  if (step === 0) return null;

  const last = count - 1;
  return Math.max(0, Math.min(last, current + step));
}
