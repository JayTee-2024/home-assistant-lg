/**
 * Whether the TV's on-screen keyboard is open. webOS reports it as `isKeyboardVisible` on
 * `webOSSystem` (newer TVs) or `PalmSystem` (older ones). In a desktop browser neither
 * exists, and the keyboard counts as closed.
 *
 * A focused text field is not enough to tell: the sign-in forms focus their first field as
 * soon as they appear, before anyone opens the keyboard.
 */

interface KeyboardState {
  isKeyboardVisible?: boolean;
}

export function isKeyboardOpen(): boolean {
  const tv = window as unknown as { webOSSystem?: KeyboardState; PalmSystem?: KeyboardState };
  const system = tv.webOSSystem ?? tv.PalmSystem;
  return system !== undefined && system.isKeyboardVisible === true;
}
