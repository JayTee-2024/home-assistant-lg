// Tests the live connection (src/platform/home-assistant-connection.ts) against the
// stand-in Home Assistant, over a real WebSocket.
//
// The connection file is TypeScript written for the browser. Node 22 has the same
// WebSocket, fetch and FormData the browser has, so the test bundles the file with esbuild
// and imports the result.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_PASSWORD, FAKE_USERNAME } from './lib/fake-home.mjs';
import { startFakeHomeServer } from './lib/fake-home-server.mjs';

const sampleHome = JSON.parse(readFileSync('fixtures/sample-home.json', 'utf8'));

let openHomeConnection;
beforeAll(async () => {
  const outfile = join(mkdtempSync(join(tmpdir(), 'home-assist-lg-')), 'connection.mjs');
  await build({
    entryPoints: ['src/platform/home-assistant-connection.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  ({ openHomeConnection } = await import(pathToFileURL(outfile).href));
});

let server = null;
let connection = null;
afterEach(async () => {
  if (connection) connection.close();
  if (server) await server.stop();
  connection = null;
  server = null;
});

/** Signs in to the stand-in home over its sign-in addresses and returns what the app would save. */
function savedSignIn(expiresAt = Date.now() + 1800 * 1000) {
  const http = (path, body) => server.home.handleHttp({ method: 'POST', path, body }).json;
  const flow = http('/auth/login_flow', {});
  const step = http('/auth/login_flow/' + flow.flow_id, {
    username: FAKE_USERNAME,
    password: FAKE_PASSWORD,
  });
  const tokens = http('/auth/token', { grant_type: 'authorization_code', code: step.result });
  return {
    address: server.address,
    kind: 'account',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  };
}

/** Resolves once `isTrue()` holds, checking every 20 ms; fails the test after 2 seconds. */
async function waitFor(isTrue) {
  for (let waited = 0; waited < 2000; waited += 20) {
    if (isTrue()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('waited 2 seconds and it never happened');
}

/** Resolves with the first home for which `isWanted` is true. */
function nextHome(isWanted) {
  return new Promise((resolve) => {
    connection.onHome((home) => {
      if (isWanted(home)) resolve(home);
    });
  });
}

describe('openHomeConnection', () => {
  it('delivers the user, the states and the three registries', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    connection = await openHomeConnection(savedSignIn(), () => {});

    const home = await nextHome(() => true);

    expect(connection.userName).toBe('TV');
    expect(Object.keys(home.states).length).toBe(sampleHome.states.length);
    expect(home.states['light.lounge_lamp'].state).toBe('on');
    expect(home.entities.length).toBe(sampleHome.entities.length);
    expect(home.devices.length).toBe(sampleHome.devices.length);
    expect(home.areas).toEqual(sampleHome.areas);
  });

  it('sends a service call, and delivers the changed state afterwards', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    connection = await openHomeConnection(savedSignIn(), () => {});
    const lampOff = nextHome((home) => home.states['light.lounge_lamp'].state === 'off');

    await connection.call({
      domain: 'light',
      service: 'toggle',
      entityId: 'light.lounge_lamp',
      data: {},
    });

    expect((await lampOff).states['light.lounge_lamp'].state).toBe('off');
  });

  it("rejects a failed call with Home Assistant's reason", async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    connection = await openHomeConnection(savedSignIn(), () => {});

    await expect(
      connection.call({ domain: 'light', service: 'toggle', entityId: 'light.nope', data: {} }),
    ).rejects.toThrow('Entity light.nope was not found.');
  });

  it('gets a new access token when the saved one has run out, and reports it for saving', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    const expired = savedSignIn(Date.now() - 1000);
    const reported = [];

    connection = await openHomeConnection(expired, (signIn) => reported.push(signIn));

    expect(reported.length).toBe(1);
    expect(reported[0].accessToken).not.toBe(expired.accessToken);
    expect(reported[0].refreshToken).toBe(expired.refreshToken);
    expect(reported[0].address).toBe(expired.address);
    expect(reported[0].kind).toBe('account');
    expect(reported[0].expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects with "sign-in-rejected" for a long-lived token Home Assistant does not accept', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    const signIn = {
      address: server.address,
      kind: 'long-lived-token',
      accessToken: 'made-up',
      refreshToken: '',
      expiresAt: 0,
    };

    await expect(openHomeConnection(signIn, () => {})).rejects.toThrow('sign-in-rejected');
  });

  it('rejects with "sign-in-rejected" when the refresh token no longer works', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    const expired = savedSignIn(Date.now() - 1000);
    server.home.handleHttp({
      method: 'POST',
      path: '/auth/revoke',
      body: { token: expired.refreshToken },
    });

    await expect(openHomeConnection(expired, () => {})).rejects.toThrow('sign-in-rejected');
  });

  it('rejects with "cannot-reach" when nothing is listening at the address', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    const signIn = savedSignIn();
    await server.stop();
    server = null;

    await expect(openHomeConnection(signIn, () => {})).rejects.toThrow('cannot-reach');
  });

  it('rejects with "not-ready", and closes its socket, when Home Assistant refuses part of the first load', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    server.home.breakCommand('config/device_registry/list');

    await expect(openHomeConnection(savedSignIn(), () => {})).rejects.toThrow('not-ready');
    await waitFor(() => server.home.openSockets() === 0);
  });

  it('rejects with "not-ready", and closes its socket, when the first states never arrive', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    server.home.silenceCommand('subscribe_entities');

    await expect(openHomeConnection(savedSignIn(), () => {}, 300)).rejects.toThrow('not-ready');
    await waitFor(() => server.home.openSockets() === 0);
  });

  it('cancels the refresh token on sign out', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    const signIn = savedSignIn();
    connection = await openHomeConnection(signIn, () => {});

    await connection.signOut();

    const refresh = server.home.handleHttp({
      method: 'POST',
      path: '/auth/token',
      body: { grant_type: 'refresh_token', refresh_token: signIn.refreshToken },
    });
    expect(refresh.status).toBe(400);
  });
});
