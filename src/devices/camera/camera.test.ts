/**
 * Tests for the camera type: where its still picture comes from, and its live view's controls.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { cameraType } from './index';
import { cameraControls, pictureUrl, readCamera } from './model';

const doorbell = sampleEntity('camera.front_door');
const address = 'http://192.168.1.100:8123';

describe('readCamera', () => {
  it("reads the picture's path, which carries Home Assistant's own short-lived key", () => {
    expect(readCamera(doorbell)).toEqual({
      isAvailable: true,
      picturePath: '/api/camera_proxy/camera.front_door?token=samplecameratoken',
      recordingId: '7432109876543',
    });
  });

  it('has no picture when Home Assistant gives none, or the camera is unavailable', () => {
    expect(readCamera(changed(doorbell, { entity_picture: null })).picturePath).toBeNull();
    expect(readCamera(changed(doorbell, {}, 'unavailable'))).toEqual({
      isAvailable: false,
      picturePath: null,
      recordingId: null,
    });
  });
});

describe('pictureUrl', () => {
  it('joins the address and the path, with a count that makes the TV fetch a fresh picture', () => {
    expect(pictureUrl(address, '/api/camera_proxy/camera.a?token=x', 3)).toBe(
      address + '/api/camera_proxy/camera.a?token=x&_=3',
    );
    expect(pictureUrl(address, '/api/picture', 0)).toBe(address + '/api/picture?_=0');
  });

  it('gives null when there is no picture', () => {
    expect(pictureUrl(address, null, 1)).toBeNull();
  });

  it('copes with an address that ends in a slash', () => {
    expect(pictureUrl(address + '/', '/p', 1)).toBe(address + '/p?_=1');
  });
});

describe('the camera type', () => {
  it('is a large card that opens its panel on OK, and is never shown as on', () => {
    expect(cameraType.cardSize).toBe('large');
    expect(cameraType.okAction(doorbell)).toBe('open-panel');
    expect(cameraType.isActive(doorbell)).toBe(false);
    expect(cameraType.summary(doorbell)).toBeNull();
  });
});

describe('cameraControls', () => {
  it('offers Watch live, and nothing else, before live video is asked for', () => {
    expect(cameraControls('idle', true)).toEqual({
      liveLabel: 'Watch live',
      soundLabel: null,
      status: null,
    });
  });

  it('offers Stop live and the sound while connecting and playing', () => {
    expect(cameraControls('connecting', true)).toEqual({
      liveLabel: 'Stop live',
      soundLabel: 'Sound on',
      status: 'Connecting…',
    });
    expect(cameraControls('playing', false)).toEqual({
      liveLabel: 'Stop live',
      soundLabel: 'Sound off',
      status: 'Live',
    });
  });

  it('offers Watch again once the session has ended or failed', () => {
    expect(cameraControls('ended', true)).toEqual({
      liveLabel: 'Watch again',
      soundLabel: null,
      status: 'Live view ended',
    });
    expect(cameraControls('failed', false)).toEqual({
      liveLabel: 'Watch again',
      soundLabel: null,
      status: 'Live view did not start',
    });
  });
});

describe('readCamera, recordings', () => {
  it('reads which recording the picture comes from, for cameras that say', () => {
    expect(readCamera(changed(doorbell, { last_video_id: '7432' })).recordingId).toBe('7432');
    expect(readCamera(changed(doorbell, { last_video_id: null })).recordingId).toBeNull();
  });

  it('accepts a recording number as well as text, as Ring ids are large numbers', () => {
    expect(readCamera(changed(doorbell, { last_video_id: 7432109876543 })).recordingId).toBe(
      '7432109876543',
    );
  });
});

describe('pictureUrl, safety', () => {
  it('only accepts a path on the Home Assistant server', () => {
    const home = 'http://192.168.1.100:8123';
    // "@host" after the address would make the browser read the address as a username.
    expect(pictureUrl(home, '@other.example/x.jpg', 1)).toBeNull();
    expect(pictureUrl(home, '.other.example/x.jpg', 1)).toBeNull();
    expect(pictureUrl(home, 'http://other.example/x.jpg', 1)).toBeNull();
    expect(pictureUrl(home, '//other.example/x.jpg', 1)).toBeNull();
    expect(pictureUrl(home, '', 1)).toBeNull();
    expect(pictureUrl(home, '/api/camera_proxy/camera.a?token=t', 1)).toBe(
      'http://192.168.1.100:8123/api/camera_proxy/camera.a?token=t&_=1',
    );
  });
});
