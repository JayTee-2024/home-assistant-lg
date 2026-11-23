/**
 * Tests for the saved live frames: which picture a camera shows, and its label.
 */

import { describe, expect, it } from 'vitest';
import {
  liveFrameFor,
  liveTimeLabel,
  onLiveFramesChanged,
  saveLiveFrame,
  stillFor,
  type LiveFrame,
} from './live-frames';

const frame = (recordingId: string): LiveFrame => ({
  image: {} as HTMLCanvasElement,
  takenAt: new Date(2026, 10, 23, 16, 42),
  recordingId,
});

describe('stillFor', () => {
  it('shows the saved live frame while the camera has recorded nothing newer', () => {
    const saved = frame('rec-1');
    expect(stillFor('rec-1', saved)).toEqual({ kind: 'live-frame', frame: saved });
  });

  it('goes back to the camera’s picture, labelled as a recording, once it records something new', () => {
    expect(stillFor('rec-2', frame('rec-1'))).toEqual({ kind: 'recording' });
  });

  it('labels the picture as a recording when no live frame has been saved', () => {
    expect(stillFor('rec-1', undefined)).toEqual({ kind: 'recording' });
  });

  it('leaves cameras whose picture is not a recording alone', () => {
    expect(stillFor(null, frame('rec-1'))).toEqual({ kind: 'picture' });
    expect(stillFor(null, undefined)).toEqual({ kind: 'picture' });
  });
});

describe('liveTimeLabel', () => {
  it('gives the time of day the frame was seen, in 24-hour form', () => {
    expect(liveTimeLabel(new Date(2026, 10, 23, 16, 42))).toBe('Live at 16:42');
    expect(liveTimeLabel(new Date(2026, 10, 23, 9, 5))).toBe('Live at 09:05');
  });
});

describe('the saved frames', () => {
  it('keeps the latest frame for each camera and tells listeners', () => {
    let calls = 0;
    const stop = onLiveFramesChanged(() => (calls += 1));

    saveLiveFrame('camera.front_door', frame('rec-1'));
    saveLiveFrame('camera.front_door', frame('rec-2'));
    stop();
    saveLiveFrame('camera.front_door', frame('rec-3'));

    expect(calls).toBe(2);
    expect((liveFrameFor('camera.front_door') as LiveFrame).recordingId).toBe('rec-3');
    expect(liveFrameFor('camera.garden')).toBeUndefined();
  });
});
