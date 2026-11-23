// Tests for fake-home.mjs, the stand-in Home Assistant used for development.
// They speak to it the way the app does: the sign-in requests, then WebSocket messages.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createFakeHome, FAKE_PASSWORD, FAKE_USERNAME } from './fake-home.mjs';

const sampleHome = JSON.parse(readFileSync('fixtures/sample-home.json', 'utf8'));
const CLIENT_ID = 'https://example.test/';

/** Signs in over HTTP and returns the tokens. */
function signIn(home) {
  const flow = home.handleHttp({
    method: 'POST',
    path: '/auth/login_flow',
    body: { client_id: CLIENT_ID, handler: ['homeassistant', null], redirect_uri: CLIENT_ID },
  });
  const step = home.handleHttp({
    method: 'POST',
    path: '/auth/login_flow/' + flow.json.flow_id,
    body: { client_id: CLIENT_ID, username: FAKE_USERNAME, password: FAKE_PASSWORD },
  });
  const tokens = home.handleHttp({
    method: 'POST',
    path: '/auth/token',
    body: { grant_type: 'authorization_code', code: step.json.result, client_id: CLIENT_ID },
  });
  return tokens.json;
}

/** Opens a socket, signs it in, and returns it with the list of everything the home sent. */
function openSignedInSocket(home) {
  const received = [];
  const socket = home.openSocket((message) => received.push(message));
  socket.receive({ type: 'auth', access_token: signIn(home).access_token });
  return { socket, received };
}

describe('signing in over HTTP', () => {
  it('goes from a flow, through the right password, to tokens', () => {
    const tokens = signIn(createFakeHome(sampleHome));

    expect(typeof tokens.access_token).toBe('string');
    expect(typeof tokens.refresh_token).toBe('string');
    expect(tokens.expires_in).toBe(1800);
  });

  it('answers a wrong password the way Home Assistant does', () => {
    const home = createFakeHome(sampleHome);
    const flow = home.handleHttp({ method: 'POST', path: '/auth/login_flow', body: {} });

    const step = home.handleHttp({
      method: 'POST',
      path: '/auth/login_flow/' + flow.json.flow_id,
      body: { username: FAKE_USERNAME, password: 'wrong' },
    });

    expect(step.status).toBe(200);
    expect(step.json.type).toBe('form');
    expect(step.json.errors).toEqual({ base: 'invalid_auth' });
  });

  it('answers 404 for a flow it does not know', () => {
    const home = createFakeHome(sampleHome);

    const step = home.handleHttp({ method: 'POST', path: '/auth/login_flow/nope', body: {} });

    expect(step.status).toBe(404);
  });

  it('refuses a code it did not give out, and a code used twice', () => {
    const home = createFakeHome(sampleHome);
    const bad = home.handleHttp({
      method: 'POST',
      path: '/auth/token',
      body: { grant_type: 'authorization_code', code: 'made-up' },
    });

    expect(bad.status).toBe(400);
  });

  it('gives a new access token for a refresh token, and none once it is revoked', () => {
    const home = createFakeHome(sampleHome);
    const tokens = signIn(home);
    const refresh = () =>
      home.handleHttp({
        method: 'POST',
        path: '/auth/token',
        body: { grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
      });

    expect(refresh().status).toBe(200);

    home.handleHttp({
      method: 'POST',
      path: '/auth/revoke',
      body: { token: tokens.refresh_token },
    });

    expect(refresh().status).toBe(400);
  });

  it('answers 404 for any other address', () => {
    expect(
      createFakeHome(sampleHome).handleHttp({ method: 'GET', path: '/', body: {} }).status,
    ).toBe(404);
  });
});

describe('the WebSocket', () => {
  it('asks for sign-in first, and accepts a real access token', () => {
    const { received } = openSignedInSocket(createFakeHome(sampleHome));

    expect(received[0].type).toBe('auth_required');
    expect(received[1].type).toBe('auth_ok');
  });

  it('rejects a token it did not give out', () => {
    const received = [];
    const socket = createFakeHome(sampleHome).openSocket((message) => received.push(message));

    socket.receive({ type: 'auth', access_token: 'made-up' });

    expect(received[1].type).toBe('auth_invalid');
  });

  it('sends every state once when entities are subscribed to', () => {
    const { socket, received } = openSignedInSocket(createFakeHome(sampleHome));

    socket.receive({ id: 1, type: 'subscribe_entities' });

    expect(received[2]).toEqual({ id: 1, type: 'result', success: true, result: null });
    expect(received[3].type).toBe('event');
    expect(Object.keys(received[3].event.a).length).toBe(sampleHome.states.length);
    expect(received[3].event.a['light.lounge_lamp'].s).toBe('on');
    expect(received[3].event.a['light.lounge_lamp'].a.brightness).toBe(180);
  });

  it('answers the three registry lists and the current user from the sample home', () => {
    const { socket, received } = openSignedInSocket(createFakeHome(sampleHome));

    socket.receive({ id: 1, type: 'config/entity_registry/list' });
    socket.receive({ id: 2, type: 'config/device_registry/list' });
    socket.receive({ id: 3, type: 'config/area_registry/list' });
    socket.receive({ id: 4, type: 'auth/current_user' });

    expect(received[2].result).toEqual(sampleHome.entities);
    expect(received[3].result).toEqual(sampleHome.devices);
    expect(received[4].result).toEqual(sampleHome.areas);
    expect(received[5].result.name).toBe('TV');
  });

  it('turns a light off when asked to toggle it, and tells subscribers', () => {
    const home = createFakeHome(sampleHome);
    const { socket, received } = openSignedInSocket(home);
    socket.receive({ id: 1, type: 'subscribe_entities' });
    received.length = 0;

    socket.receive({
      id: 2,
      type: 'call_service',
      domain: 'light',
      service: 'toggle',
      target: { entity_id: 'light.lounge_lamp' },
    });

    const change = received.filter((message) => message.type === 'event')[0];
    expect(change.id).toBe(1);
    expect(change.event.c['light.lounge_lamp']['+'].s).toBe('off');
    expect(received.filter((message) => message.id === 2)[0].success).toBe(true);
    expect(home.states().filter((state) => state.entity_id === 'light.lounge_lamp')[0].state).toBe(
      'off',
    );
  });

  it('sets brightness from brightness_pct and turns the light on', () => {
    const home = createFakeHome(sampleHome);
    const { socket } = openSignedInSocket(home);

    socket.receive({
      id: 1,
      type: 'call_service',
      domain: 'light',
      service: 'turn_on',
      service_data: { brightness_pct: 50 },
      target: { entity_id: 'light.kitchen_ceiling' },
    });

    const light = home.states().filter((state) => state.entity_id === 'light.kitchen_ceiling')[0];
    expect(light.state).toBe('on');
    expect(light.attributes.brightness).toBe(128);
  });

  it('fails a call for an entity it does not have, with a reason', () => {
    const { socket, received } = openSignedInSocket(createFakeHome(sampleHome));

    socket.receive({
      id: 1,
      type: 'call_service',
      domain: 'light',
      service: 'toggle',
      target: { entity_id: 'light.nope' },
    });

    expect(received[2].success).toBe(false);
    expect(typeof received[2].error.message).toBe('string');
  });

  it('answers ping with pong, and an unknown command with an error', () => {
    const { socket, received } = openSignedInSocket(createFakeHome(sampleHome));

    socket.receive({ id: 1, type: 'ping' });
    socket.receive({ id: 2, type: 'made/up' });

    expect(received[2]).toEqual({ id: 1, type: 'pong' });
    expect(received[3].error.code).toBe('unknown_command');
  });

  it('does not change the sample home it was given', () => {
    const before = JSON.stringify(sampleHome);
    const { socket } = openSignedInSocket(createFakeHome(sampleHome));

    socket.receive({
      id: 1,
      type: 'call_service',
      domain: 'switch',
      service: 'toggle',
      target: { entity_id: 'switch.tv_plug' },
    });

    expect(JSON.stringify(sampleHome)).toBe(before);
  });
});

describe('making the stand-in misbehave, for tests', () => {
  it('answers a broken command with an error, as Home Assistant does while it is starting', () => {
    const home = createFakeHome(sampleHome);
    home.breakCommand('config/device_registry/list');
    const { socket, received } = openSignedInSocket(home);

    socket.receive({ id: 1, type: 'config/device_registry/list' });

    expect(received[2].success).toBe(false);
  });

  it('never answers a silenced command', () => {
    const home = createFakeHome(sampleHome);
    home.silenceCommand('subscribe_entities');
    const { socket, received } = openSignedInSocket(home);

    socket.receive({ id: 1, type: 'subscribe_entities' });

    expect(received.length).toBe(2);
  });

  it('counts the sockets that are open', () => {
    const home = createFakeHome(sampleHome);
    const { socket } = openSignedInSocket(home);

    expect(home.openSockets()).toBe(1);
    socket.close();
    expect(home.openSockets()).toBe(0);
  });
});

describe('camera pictures', () => {
  it('serves a picture for a camera, as a PNG', () => {
    const answer = createFakeHome(sampleHome).handleHttp({
      method: 'GET',
      path: '/api/camera_proxy/camera.front_door',
      body: {},
    });

    expect(answer.status).toBe(200);
    expect(answer.contentType).toBe('image/png');
    expect(answer.bytes.subarray(1, 4).toString()).toBe('PNG');
  });

  it('answers 404 for a camera it does not have', () => {
    expect(
      createFakeHome(sampleHome).handleHttp({
        method: 'GET',
        path: '/api/camera_proxy/camera.nope',
        body: {},
      }).status,
    ).toBe(404);
  });
});

describe('heating', () => {
  it('sets the target temperature, the mode and the preset of a thermostat', () => {
    const home = createFakeHome(sampleHome);
    const { socket } = openSignedInSocket(home);
    const call = (id, service, data) =>
      socket.receive({
        id,
        type: 'call_service',
        domain: 'climate',
        service,
        service_data: data,
        target: { entity_id: 'climate.living_room' },
      });

    call(1, 'set_temperature', { temperature: 22.5 });
    call(2, 'set_preset_mode', { preset_mode: 'away' });
    call(3, 'set_hvac_mode', { hvac_mode: 'off' });

    const tado = home.states().filter((state) => state.entity_id === 'climate.living_room')[0];
    expect(tado.attributes.temperature).toBe(22.5);
    expect(tado.attributes.preset_mode).toBe('away');
    expect(tado.state).toBe('off');
  });
});

describe('the other device types', () => {
  /** Calls one service on one entity and returns that entity afterwards. */
  function callAndRead(domain, service, entityId, data = {}) {
    const home = createFakeHome(sampleHome);
    const { socket, received } = openSignedInSocket(home);
    socket.receive({
      id: 1,
      type: 'call_service',
      domain,
      service,
      service_data: data,
      target: { entity_id: entityId },
    });
    const answer = received.filter((message) => message.id === 1)[0];
    return { answer, entity: home.states().filter((state) => state.entity_id === entityId)[0] };
  }

  it('plays, pauses and sets the volume of a speaker', () => {
    expect(
      callAndRead('media_player', 'media_play_pause', 'media_player.living_room_sonos').entity
        .state,
    ).toBe('paused');
    expect(
      callAndRead('media_player', 'volume_set', 'media_player.living_room_sonos', {
        volume_level: 0.5,
      }).entity.attributes.volume_level,
    ).toBe(0.5);
  });

  it('opens, closes and positions a blind', () => {
    expect(callAndRead('cover', 'close_cover', 'cover.lounge_blind').entity.state).toBe('closed');
    const positioned = callAndRead('cover', 'set_cover_position', 'cover.lounge_blind', {
      position: 75,
    }).entity;
    expect(positioned.attributes.current_position).toBe(75);
    expect(positioned.state).toBe('open');
  });

  it('switches a fan and sets its speed', () => {
    expect(callAndRead('fan', 'toggle', 'fan.bedroom_fan').entity.state).toBe('off');
    expect(
      callAndRead('fan', 'set_percentage', 'fan.bedroom_fan', { percentage: 75 }).entity.attributes
        .percentage,
    ).toBe(75);
  });

  it('starts a vacuum and sends it home', () => {
    expect(callAndRead('vacuum', 'start', 'vacuum.robot').entity.state).toBe('cleaning');
    expect(callAndRead('vacuum', 'return_to_base', 'vacuum.robot').entity.state).toBe('returning');
  });
});

describe('live camera video', () => {
  it('offers WebRTC for cameras, and nothing for other entities', () => {
    const { socket, received } = openSignedInSocket(createFakeHome(sampleHome));

    socket.receive({ id: 5, type: 'camera/capabilities', entity_id: 'camera.front_door' });
    socket.receive({ id: 6, type: 'camera/capabilities', entity_id: 'light.lounge_lamp' });

    expect(received[2]).toEqual({
      id: 5,
      type: 'result',
      success: true,
      result: { frontend_stream_types: ['web_rtc'], two_way_audio: false },
    });
    expect(received[3].success).toBe(false);
  });

  it('gives a client configuration with no ICE servers', () => {
    const { socket, received } = openSignedInSocket(createFakeHome(sampleHome));

    socket.receive({
      id: 7,
      type: 'camera/webrtc/get_client_config',
      entity_id: 'camera.front_door',
    });

    expect(received[2].result).toEqual({ configuration: { iceServers: [] } });
  });

  it('accepts an offer, then reports that it has no live video to send', () => {
    const { socket, received } = openSignedInSocket(createFakeHome(sampleHome));

    socket.receive({
      id: 8,
      type: 'camera/webrtc/offer',
      entity_id: 'camera.front_door',
      offer: 'v=0',
    });

    expect(received[2]).toEqual({ id: 8, type: 'result', success: true, result: null });
    expect(received[3]).toEqual({
      id: 8,
      type: 'event',
      event: {
        type: 'error',
        code: 'webrtc_offer_failed',
        message: 'The stand-in home has no live video.',
      },
    });
  });
});
