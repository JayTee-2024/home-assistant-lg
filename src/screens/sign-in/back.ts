/**
 * Where Back takes the person on the sign-in screen: one form back, rather than out of the
 * app. On the first forms it returns null, and Back leaves the app as on any first screen.
 */

/** The sign-in screen's forms (see SignInScreen.tsx). */
export type Form = 'looking' | 'address' | 'credentials' | 'code' | 'token';

/**
 *   'address'  show the address form again
 *   'restart'  try the address again, which lands on username and password (the same as the
 *              token form's "Back to username and password" button)
 */
export function backFrom(form: Form): 'address' | 'restart' | null {
  if (form === 'credentials') return 'address';
  if (form === 'code' || form === 'token') return 'restart';
  return null;
}
