/**
 * Tests for the label on a camera's picture after watching it live.
 */

import { describe, expect, it } from 'vitest';
import {
  PICTURE_UPDATE_WAIT_MS,
  labelFor,
  liveStoppedAt,
  noteLiveStopped,
  onPictureUpdatesChanged,
} from './picture-updates';

const stopped = { at: 1_000_000, recordingId: 'rec-1' };

describe('labelFor', () => {
  it('says the picture is updating after live view, until the camera has a new recording', () => {
    expect(labelFor('rec-1', stopped, stopped.at + 5000)).toBe('Updating picture…');
    expect(labelFor('rec-2', stopped, stopped.at + 5000)).toBe('Last recording');
  });

  it('gives up waiting after a while', () => {
    expect(labelFor('rec-1', stopped, stopped.at + PICTURE_UPDATE_WAIT_MS - 1)).toBe(
      'Updating picture…',
    );
    expect(labelFor('rec-1', stopped, stopped.at + PICTURE_UPDATE_WAIT_MS)).toBe('Last recording');
  });

  it('labels a recording when live view has not been watched', () => {
    expect(labelFor('rec-1', undefined, stopped.at)).toBe('Last recording');
  });

  it('leaves cameras whose picture is not a recording unlabelled', () => {
    expect(labelFor(null, stopped, stopped.at)).toBeNull();
    expect(labelFor(null, undefined, stopped.at)).toBeNull();
  });
});

describe('noting that live view stopped', () => {
  it('keeps the latest stop for each camera and tells listeners', () => {
    let calls = 0;
    const stop = onPictureUpdatesChanged(() => (calls += 1));

    noteLiveStopped('camera.front_door', { at: 1, recordingId: 'rec-1' });
    noteLiveStopped('camera.front_door', { at: 2, recordingId: 'rec-1' });
    stop();
    noteLiveStopped('camera.front_door', { at: 3, recordingId: 'rec-1' });

    expect(calls).toBe(2);
    expect(liveStoppedAt('camera.front_door')).toEqual({ at: 3, recordingId: 'rec-1' });
    expect(liveStoppedAt('camera.garden')).toBeUndefined();
  });
});
