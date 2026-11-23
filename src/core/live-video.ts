/**
 * Live camera video: what the camera's view needs from the connection, and the states a
 * live session goes through.
 *
 *   idle        showing the still picture; no session
 *   connecting  a session has been asked for; no picture yet
 *   playing     live video is showing
 *   ended       a playing session was cut off (Ring ends live views after a few minutes)
 *   failed      the session never produced a picture
 *
 * The WebRTC work itself is in src/platform/live-video.ts.
 */

export type LiveState = 'idle' | 'connecting' | 'playing' | 'ended' | 'failed';

export type LiveEvent =
  /** The person asked for live video. */
  | 'start'
  /** The video arrived. */
  | 'picture'
  /** The network link to the camera dropped or failed. */
  | 'connection-lost'
  /** Home Assistant, or the camera behind it, said no or reported an error. */
  | 'refused'
  /** No picture arrived within LIVE_PICTURE_TIMEOUT_MS. */
  | 'timed-out'
  /** The person stopped it, or closed the view. */
  | 'stop';

/** How long to wait for the picture before giving up. A Ring doorbell can take 10 seconds or so. */
export const LIVE_PICTURE_TIMEOUT_MS = 30000;

export function nextLiveState(state: LiveState, event: LiveEvent): LiveState {
  if (event === 'stop') return 'idle';

  const isRunning = state === 'connecting' || state === 'playing';
  if (event === 'start') return isRunning ? state : 'connecting';
  // Anything else only matters while a session is running.
  if (!isRunning) return state;

  if (event === 'picture') return 'playing';
  if (state === 'connecting') return 'failed';
  // Playing: the time limit no longer matters; anything else cut it off.
  return event === 'timed-out' ? 'playing' : 'ended';
}

/** A running live session. stop() may be called any number of times. */
export interface LiveVideo {
  stop(): void;
}

export interface LiveVideoHandlers {
  /** The video to show, once it arrives. */
  onStream(stream: MediaStream): void;
  /** Everything that happens to the session after it starts (never 'start' or 'stop'). */
  onEvent(event: LiveEvent): void;
}

/** What the connection offers for live video. */
export interface LiveVideoSource {
  /** True when Home Assistant can show this camera live. False when it cannot, or on any error. */
  isSupported(entityId: string): Promise<boolean>;
  start(entityId: string, handlers: LiveVideoHandlers): LiveVideo;
}

/** For when there is no connection to ask: no camera can go live, and a start is refused. */
export const NO_LIVE_VIDEO: LiveVideoSource = {
  isSupported: () => Promise.resolve(false),
  start(_entityId, handlers) {
    setTimeout(() => handlers.onEvent('refused'), 0);
    return { stop: () => undefined };
  },
};
