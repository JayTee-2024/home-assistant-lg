// A stand-in Home Assistant for development and tests.
//
// It speaks enough of Home Assistant's sign-in and WebSocket language for the app to sign
// in, list devices, watch states and switch things on and off, all from the made-up home
// in fixtures/sample-home.json. It lets the app be built and tried without a real Home
// Assistant, and without anyone's password.
//
// This file has no network code. It takes parsed requests and messages and returns or
// emits answers. scripts/fake-home-assistant.mjs puts it on a real port.
//
// It is not a full Home Assistant. Anything it does not know answers with an error.
// The real message shapes: https://developers.home-assistant.io/docs/api/websocket

import { readFileSync } from 'node:fs';

/** A small made-up picture, served as every camera's still. */
const CAMERA_PICTURE = new URL('../../fixtures/camera.png', import.meta.url);

export const FAKE_USERNAME = 'tv';
export const FAKE_PASSWORD = 'tv';

const HA_VERSION = '2026.11.2';
const ACCESS_TOKEN_SECONDS = 1800;

/**
 * @param sampleHome  the parsed contents of fixtures/sample-home.json
 */
export function createFakeHome(sampleHome, cameraPicture = readFileSync(CAMERA_PICTURE)) {
  // Work on a copy, so the caller's sample home is never changed.
  const home = JSON.parse(JSON.stringify(sampleHome));

  const flows = new Set();
  const codes = new Set();
  const accessTokens = new Set();
  const refreshTokens = new Set();
  /** One entry per open socket that has subscribed to entities: { send, subscriptionId }. */
  const entitySubscribers = [];
  /** Commands that answer with an error, set by tests through breakCommand. */
  const brokenCommands = new Set();
  /** Commands that never get an answer, set by tests through silenceCommand. */
  const silentCommands = new Set();
  let openSocketCount = 0;
  let counter = 0;

  const newId = (prefix) => prefix + '-' + String(++counter);
  const findState = (entityId) => home.states.filter((state) => state.entity_id === entityId)[0];

  // ---- HTTP: signing in ----

  function handleHttp({ method, path, body }) {
    // A camera's still picture. The stand-in serves the same made-up picture for every camera.
    if (method === 'GET' && path.indexOf('/api/camera_proxy/') === 0) {
      const entityId = path.slice('/api/camera_proxy/'.length);
      if (findState(entityId) === undefined) return { status: 404, json: { message: 'Not found' } };
      return { status: 200, contentType: 'image/png', bytes: cameraPicture };
    }

    if (method === 'GET' && path === '/auth/providers') {
      return {
        status: 200,
        json: { providers: [{ name: 'Home Assistant Local', id: null, type: 'homeassistant' }] },
      };
    }

    if (method === 'POST' && path === '/auth/login_flow') {
      const flowId = newId('flow');
      flows.add(flowId);
      return { status: 200, json: credentialsForm(flowId, {}) };
    }

    if (method === 'POST' && path.indexOf('/auth/login_flow/') === 0) {
      const flowId = path.slice('/auth/login_flow/'.length);
      if (!flows.has(flowId)) {
        return { status: 404, json: { message: 'Invalid flow specified' } };
      }
      if (body.username !== FAKE_USERNAME || body.password !== FAKE_PASSWORD) {
        return { status: 200, json: credentialsForm(flowId, { base: 'invalid_auth' }) };
      }
      flows.delete(flowId);
      const code = newId('code');
      codes.add(code);
      return {
        status: 200,
        json: { type: 'create_entry', flow_id: flowId, result: code, version: 1 },
      };
    }

    if (method === 'POST' && path === '/auth/token') {
      if (body.grant_type === 'authorization_code' && codes.has(body.code)) {
        codes.delete(body.code);
        const refreshToken = newId('refresh');
        refreshTokens.add(refreshToken);
        return {
          status: 200,
          json: Object.assign(newAccessToken(), { refresh_token: refreshToken }),
        };
      }
      if (body.grant_type === 'refresh_token' && refreshTokens.has(body.refresh_token)) {
        return { status: 200, json: newAccessToken() };
      }
      // The older way to revoke, which the connection library still uses.
      if (body.action === 'revoke') {
        refreshTokens.delete(body.token);
        return { status: 200, json: {} };
      }
      return {
        status: 400,
        json: { error: 'invalid_request', error_description: 'Invalid code' },
      };
    }

    if (method === 'POST' && path === '/auth/revoke') {
      refreshTokens.delete(body.token);
      return { status: 200, json: {} };
    }

    return { status: 404, json: { message: 'Not found' } };
  }

  function credentialsForm(flowId, errors) {
    return {
      type: 'form',
      flow_id: flowId,
      handler: ['homeassistant', null],
      step_id: 'init',
      data_schema: [
        { name: 'username', type: 'string' },
        { name: 'password', type: 'string' },
      ],
      errors,
    };
  }

  function newAccessToken() {
    const accessToken = newId('access');
    accessTokens.add(accessToken);
    return { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_SECONDS };
  }

  // ---- WebSocket: live data ----

  /**
   * Starts one WebSocket session. `sendToClient` is called with each message for the app.
   * Returns { receive(message), close() } for messages from the app.
   */
  function openSocket(sendToClient) {
    let signedIn = false;
    let isOpen = true;
    const subscriber = { send: sendToClient, subscriptionId: null };
    openSocketCount += 1;

    sendToClient({ type: 'auth_required', ha_version: HA_VERSION });

    const result = (id, value) =>
      sendToClient({ id, type: 'result', success: true, result: value });
    const failure = (id, code, message) =>
      sendToClient({ id, type: 'result', success: false, error: { code, message } });

    function receive(message) {
      if (!signedIn) {
        if (message.type === 'auth' && accessTokens.has(message.access_token)) {
          signedIn = true;
          sendToClient({ type: 'auth_ok', ha_version: HA_VERSION });
        } else {
          sendToClient({ type: 'auth_invalid', message: 'Invalid access token or password' });
        }
        return;
      }

      if (silentCommands.has(message.type)) return;
      if (brokenCommands.has(message.type)) {
        failure(message.id, 'home_assistant_error', 'Home Assistant is not ready yet.');
        return;
      }

      switch (message.type) {
        case 'ping':
          sendToClient({ id: message.id, type: 'pong' });
          return;
        case 'supported_features':
        case 'subscribe_events':
        case 'unsubscribe_events':
          result(message.id, null);
          return;
        case 'subscribe_entities':
          subscriber.subscriptionId = message.id;
          entitySubscribers.push(subscriber);
          result(message.id, null);
          sendToClient({ id: message.id, type: 'event', event: { a: allStatesCompressed() } });
          return;
        case 'get_states':
          result(message.id, home.states);
          return;
        case 'config/entity_registry/list':
          result(message.id, home.entities);
          return;
        case 'config/device_registry/list':
          result(message.id, home.devices);
          return;
        case 'config/area_registry/list':
          result(message.id, home.areas);
          return;
        case 'auth/current_user':
          result(message.id, home.user);
          return;
        case 'call_service': {
          const problem = callService(message);
          if (problem === null) {
            result(message.id, { context: { id: newId('context') }, response: null });
          } else {
            failure(message.id, 'home_assistant_error', problem);
          }
          return;
        }
        // Live camera video. The stand-in offers WebRTC for its cameras but has no video to
        // send, so an offer always ends in an error event, as a camera that cannot start would.
        case 'camera/capabilities':
          if (String(message.entity_id).indexOf('camera.') === 0) {
            result(message.id, { frontend_stream_types: ['web_rtc'], two_way_audio: false });
          } else {
            failure(message.id, 'home_assistant_error', 'Not a camera.');
          }
          return;
        case 'camera/webrtc/get_client_config':
          result(message.id, { configuration: { iceServers: [] } });
          return;
        case 'camera/webrtc/offer':
          result(message.id, null);
          sendToClient({
            id: message.id,
            type: 'event',
            event: {
              type: 'error',
              code: 'webrtc_offer_failed',
              message: 'The stand-in home has no live video.',
            },
          });
          return;
        default:
          failure(message.id, 'unknown_command', 'Unknown command.');
      }
    }

    function close() {
      if (isOpen) openSocketCount -= 1;
      isOpen = false;
      const index = entitySubscribers.indexOf(subscriber);
      if (index !== -1) entitySubscribers.splice(index, 1);
    }

    return { receive, close };
  }

  /** Every state in the short form Home Assistant uses for subscribe_entities: s = state, a = attributes. */
  function allStatesCompressed() {
    const compressed = {};
    for (const state of home.states) {
      compressed[state.entity_id] = {
        s: state.state,
        a: state.attributes,
        c: 'sample-context',
        lc: Date.now() / 1000,
      };
    }
    return compressed;
  }

  /** Changes one entity and tells every subscribed socket, as Home Assistant would. */
  function setState(entityId, newState, newAttributes = {}) {
    const state = findState(entityId);
    if (state === undefined) return;

    state.state = newState;
    Object.assign(state.attributes, newAttributes);

    const change = {
      [entityId]: { '+': { s: newState, a: newAttributes, lc: Date.now() / 1000 } },
    };
    for (const subscriber of entitySubscribers) {
      subscriber.send({ id: subscriber.subscriptionId, type: 'event', event: { c: change } });
    }
  }

  /** Carries out a service call. Returns null when it worked, or the reason it did not. */
  function callService(message) {
    const target = message.target || {};
    const data = message.service_data || {};
    const entityId = target.entity_id || data.entity_id;
    const state = findState(entityId);
    if (state === undefined) return 'Entity ' + String(entityId) + ' was not found.';

    const domain = message.domain;
    const service = message.service;
    const key = domain + '.' + service;

    if (domain === 'light' || domain === 'switch' || domain === 'input_boolean') {
      const turnOn = service === 'turn_on' || (service === 'toggle' && state.state !== 'on');
      if (service !== 'turn_on' && service !== 'turn_off' && service !== 'toggle') {
        return 'The stand-in home does not know the service ' + key + '.';
      }
      setState(
        entityId,
        turnOn ? 'on' : 'off',
        domain === 'light' ? lightAttributes(state, data, turnOn) : {},
      );
      return null;
    }

    if (key === 'climate.set_temperature') {
      setState(entityId, state.state, { temperature: data.temperature });
      return null;
    }
    if (key === 'climate.set_hvac_mode') {
      setState(entityId, data.hvac_mode, {
        hvac_action: data.hvac_mode === 'off' ? 'off' : 'heating',
      });
      return null;
    }
    if (key === 'climate.set_preset_mode') {
      setState(entityId, state.state, { preset_mode: data.preset_mode });
      return null;
    }

    // Media players: just enough to see the panel change.
    if (key === 'media_player.media_play_pause') {
      setState(entityId, state.state === 'playing' ? 'paused' : 'playing');
      return null;
    }
    if (key === 'media_player.volume_set') {
      setState(entityId, state.state, { volume_level: data.volume_level });
      return null;
    }
    if (key === 'media_player.volume_mute') {
      setState(entityId, state.state, { is_volume_muted: data.is_volume_muted });
      return null;
    }
    if (key === 'media_player.select_source') {
      setState(entityId, state.state, { source: data.source });
      return null;
    }
    if (key === 'media_player.media_next_track' || key === 'media_player.media_previous_track') {
      return null;
    }

    // Covers move at once; a real one takes its time.
    if (key === 'cover.open_cover') {
      setState(entityId, 'open', { current_position: 100 });
      return null;
    }
    if (key === 'cover.close_cover') {
      setState(entityId, 'closed', { current_position: 0 });
      return null;
    }
    if (key === 'cover.stop_cover') return null;
    if (key === 'cover.set_cover_position') {
      setState(entityId, data.position > 0 ? 'open' : 'closed', {
        current_position: data.position,
      });
      return null;
    }

    // Fans.
    if (key === 'fan.toggle' || key === 'fan.turn_on' || key === 'fan.turn_off') {
      const turnOn = service === 'turn_on' || (service === 'toggle' && state.state !== 'on');
      setState(entityId, turnOn ? 'on' : 'off');
      return null;
    }
    if (key === 'fan.set_percentage') {
      setState(entityId, data.percentage > 0 ? 'on' : 'off', { percentage: data.percentage });
      return null;
    }
    if (key === 'fan.oscillate') {
      setState(entityId, state.state, { oscillating: data.oscillating });
      return null;
    }
    if (key === 'fan.set_preset_mode') {
      setState(entityId, 'on', { preset_mode: data.preset_mode });
      return null;
    }

    // Vacuums.
    const vacuumActivity = {
      'vacuum.start': 'cleaning',
      'vacuum.pause': 'paused',
      'vacuum.stop': 'idle',
      'vacuum.return_to_base': 'returning',
    }[key];
    if (vacuumActivity !== undefined) {
      setState(entityId, vacuumActivity);
      return null;
    }
    if (key === 'vacuum.locate') return null;

    if (key === 'button.press' || key === 'input_button.press' || key === 'scene.turn_on') {
      setState(entityId, new Date().toISOString());
      return null;
    }
    if (key === 'script.turn_on') {
      return null;
    }

    return 'The stand-in home does not know the service ' + key + '.';
  }

  /** What a light reports after a call: the brightness and colour asked for, or cleared when off. */
  function lightAttributes(state, data, turnOn) {
    if (!turnOn) return { brightness: null };

    const attributes = {};
    if (typeof data.brightness_pct === 'number') {
      attributes.brightness = Math.round((data.brightness_pct / 100) * 255);
    } else if (typeof state.attributes.brightness !== 'number') {
      attributes.brightness = 255;
    }
    if (typeof data.color_temp_kelvin === 'number') {
      attributes.color_temp_kelvin = data.color_temp_kelvin;
      attributes.color_mode = 'color_temp';
      attributes.rgb_color = null;
    }
    if (Array.isArray(data.rgb_color)) {
      attributes.rgb_color = data.rgb_color;
      attributes.color_mode = 'hs';
      attributes.color_temp_kelvin = null;
    }
    if (typeof data.effect === 'string') {
      attributes.effect = data.effect;
    }
    return attributes;
  }

  return {
    handleHttp,
    openSocket,
    /** The current states, for tests and for the server's "something changes by itself" timer. */
    states: () => home.states,
    setState,
    /** For tests: makes one WebSocket command answer with an error from now on. */
    breakCommand: (type) => brokenCommands.add(type),
    /** For tests: makes one WebSocket command go unanswered from now on. */
    silenceCommand: (type) => silentCommands.add(type),
    /** For tests: how many WebSocket sessions are open. */
    openSockets: () => openSocketCount,
  };
}
