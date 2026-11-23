/**
 * Reads a camera into where its still picture can be fetched.
 *
 * Home Assistant gives each camera an `entity_picture`: a path on the Home Assistant
 * server that includes a short-lived key, so the picture can be fetched with no sign-in.
 * Home Assistant changes the key every few minutes and reports the new path, so the path
 * is always read from the latest state.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/camera
 */

import { isAvailable, readText, type EntityState } from '../../core/home-assistant';
import type { LiveState } from '../../core/live-video';

export interface CameraView {
  isAvailable: boolean;
  /** The picture's path on the Home Assistant server, or null when there is none. */
  picturePath: string | null;
}

export function readCamera(entity: EntityState): CameraView {
  const available = isAvailable(entity);
  return {
    isAvailable: available,
    picturePath: available ? readText(entity, 'entity_picture') : null,
  };
}

/**
 * The full address of the picture. `refreshCount` is added to it so each refresh is a
 * different address, and the TV fetches a new picture instead of reusing the one it has.
 */
export function pictureUrl(
  homeAddress: string,
  picturePath: string | null,
  refreshCount: number,
): string | null {
  if (picturePath === null) return null;

  const base = homeAddress.replace(/\/$/, '');
  const joiner = picturePath.indexOf('?') === -1 ? '?' : '&';
  return base + picturePath + joiner + '_=' + refreshCount;
}

/** What the full-screen camera view's buttons and status line say. */
export interface CameraControls {
  liveLabel: 'Watch live' | 'Stop live' | 'Watch again';
  /** null when there is no sound to switch: before live video, and after it. */
  soundLabel: 'Sound on' | 'Sound off' | null;
  status: string | null;
}

export function cameraControls(state: LiveState, isMuted: boolean): CameraControls {
  const soundLabel = isMuted ? 'Sound on' : 'Sound off';
  switch (state) {
    case 'idle':
      return { liveLabel: 'Watch live', soundLabel: null, status: null };
    case 'connecting':
      return { liveLabel: 'Stop live', soundLabel, status: 'Connecting…' };
    case 'playing':
      return { liveLabel: 'Stop live', soundLabel, status: 'Live' };
    case 'ended':
      return { liveLabel: 'Watch again', soundLabel: null, status: 'Live view ended' };
    case 'failed':
      return { liveLabel: 'Watch again', soundLabel: null, status: 'Live view did not start' };
  }
}
