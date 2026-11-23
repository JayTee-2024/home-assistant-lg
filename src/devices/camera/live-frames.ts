/**
 * The last frame of live video, kept so a camera's picture is up to date after watching it.
 *
 * Some cameras' still picture is not current. For a Ring doorbell, Home Assistant serves
 * the first frame of the camera's last recording, which changes only when Ring records a
 * new event (motion, or the button); watching live does not record one. Home Assistant
 * reports which recording the picture comes from as the camera's `last_video_id`.
 *
 * So, for those cameras, the frame seen last in live video is saved when live video stops,
 * and shown, labelled with its time, until the camera records something newer. Frames are
 * kept only while the app is open.
 *
 * Cameras without a `last_video_id` have a current still picture, and are left alone.
 */

export interface LiveFrame {
  /**
   * The frame, copied from the video. Kept as a canvas and drawn straight onto the screen:
   * the LG C9 takes about 20 seconds to show the same frame encoded as a JPEG picture.
   */
  image: HTMLCanvasElement;
  takenAt: Date;
  /** The camera's `last_video_id` when the frame was taken. */
  recordingId: string;
}

/** Which picture a camera shows. */
export type Still =
  /** The saved live frame. */
  | { kind: 'live-frame'; frame: LiveFrame }
  /** Home Assistant's picture, which is the camera's last recording, not a current view. */
  | { kind: 'recording' }
  /** Home Assistant's picture, which is current. */
  | { kind: 'picture' };

/** `recordingId` is the camera's current `last_video_id`, or null when it has none. */
export function stillFor(recordingId: string | null, frame: LiveFrame | undefined): Still {
  if (recordingId === null) return { kind: 'picture' };
  if (frame !== undefined && frame.recordingId === recordingId)
    return { kind: 'live-frame', frame };
  return { kind: 'recording' };
}

export function liveTimeLabel(takenAt: Date): string {
  const twoDigits = (n: number) => (n < 10 ? '0' : '') + n;
  return 'Live at ' + twoDigits(takenAt.getHours()) + ':' + twoDigits(takenAt.getMinutes());
}

const frames = new Map<string, LiveFrame>();
const listeners: Array<() => void> = [];

export function saveLiveFrame(entityId: string, frame: LiveFrame): void {
  frames.set(entityId, frame);
  listeners.slice().forEach((listener) => listener());
}

export function liveFrameFor(entityId: string): LiveFrame | undefined {
  return frames.get(entityId);
}

/** Calls `listener` whenever a frame is saved. Returns a function that stops it. */
export function onLiveFramesChanged(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const at = listeners.indexOf(listener);
    if (at !== -1) listeners.splice(at, 1);
  };
}
