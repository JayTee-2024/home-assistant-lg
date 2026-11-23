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
    });
  });

  it('has no picture when Home Assistant gives none, or the camera is unavailable', () => {
    expect(readCamera(changed(doorbell, { entity_picture: null })).picturePath).toBeNull();
    expect(readCamera(changed(doorbell, {}, 'unavailable'))).toEqual({
      isAvailable: false,
      picturePath: null,
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
