/**
 * What the remote's Back key does on the app's first screen: hand over to the TV.
 *
 * LG's rule for an app's entry page: on webOS 5 and lower, show the Home launcher; on
 * webOS 6 and higher, ask whether to leave the app. The TV's own platformBack does exactly
 * that on each version. It lives on `webOSSystem` on newer TVs and `PalmSystem` on older
 * ones. In a desktop browser neither exists, and this does nothing.
 *
 * LG's guide: https://webostv.developer.lge.com/develop/guides/back-button
 */

interface PlatformBack {
  platformBack?: () => void;
}

export function leaveToTv(): void {
  const tv = window as unknown as { webOSSystem?: PlatformBack; PalmSystem?: PlatformBack };
  const system = tv.webOSSystem ?? tv.PalmSystem;
  if (system !== undefined && typeof system.platformBack === 'function') system.platformBack();
}
