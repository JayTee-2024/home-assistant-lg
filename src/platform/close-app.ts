/**
 * Leaves the app completely.
 *
 * On webOS, closing the app's window ends the app. This was checked on an LG C9
 * (docs/tv-proof-results.md). In a desktop browser a page may not close a tab it did not
 * open, so there this does nothing, which is fine for development.
 */

export function closeApp(): void {
  window.close();
}
