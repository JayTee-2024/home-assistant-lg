/**
 * The label on a camera's picture, for cameras whose picture is their last recording.
 *
 * For a Ring doorbell, Home Assistant's picture is the first frame of the camera's last
 * recording (it reports which one as the camera's `last_video_id`), not a current view, so
 * it is labelled "Last recording". With a Ring subscription, Ring records a live view as an
 * event too; once Ring has processed it, 20 seconds to a minute after live view stops, Home
 * Assistant's picture becomes that new recording. Until then the picture says "Updating
 * picture…".
 *
 * (Copying the last frame of live video instead does not work on the LG C9: the TV draws
 * live video in its own hardware, and a copy comes out black.)
 *
 * Cameras without a `last_video_id` have a current picture, and get no label.
 */

/** How long to wait for the new recording before going back to "Last recording". */
export const PICTURE_UPDATE_WAIT_MS = 3 * 60 * 1000;

/** When live view last stopped for a camera, and which recording its picture was then. */
export interface LiveStopped {
  at: number;
  recordingId: string;
}

export type PictureLabel = 'Updating picture…' | 'Last recording' | null;

/** `recordingId` is the camera's current `last_video_id`, or null when it has none. */
export function labelFor(
  recordingId: string | null,
  stopped: LiveStopped | undefined,
  now: number,
): PictureLabel {
  if (recordingId === null) return null;
  const isWaiting =
    stopped !== undefined &&
    stopped.recordingId === recordingId &&
    now - stopped.at < PICTURE_UPDATE_WAIT_MS;
  return isWaiting ? 'Updating picture…' : 'Last recording';
}

const stops = new Map<string, LiveStopped>();
const listeners: Array<() => void> = [];

/** Called by the camera's view when live video stops. Kept only while the app is open. */
export function noteLiveStopped(entityId: string, stopped: LiveStopped): void {
  stops.set(entityId, stopped);
  listeners.slice().forEach((listener) => listener());
}

export function liveStoppedAt(entityId: string): LiveStopped | undefined {
  return stops.get(entityId);
}

/** Calls `listener` whenever live view stops for any camera. Returns a function that stops it. */
export function onPictureUpdatesChanged(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const at = listeners.indexOf(listener);
    if (at !== -1) listeners.splice(at, 1);
  };
}
