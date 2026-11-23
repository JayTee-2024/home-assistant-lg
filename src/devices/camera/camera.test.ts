/**
 * Tests for the camera type: where its still picture comes from.
 */

import { describe, expect, it } from 'vitest';
import { changed, sampleEntity } from '../../test-support/sample-home';
import { cameraType } from './index';
import { pictureUrl, readCamera } from './model';

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
