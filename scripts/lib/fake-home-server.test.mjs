// Tests for fake-home-server.mjs: reading request bodies, and one real round trip over HTTP.

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { parseBody, startFakeHomeServer } from './fake-home-server.mjs';

const sampleHome = JSON.parse(readFileSync('fixtures/sample-home.json', 'utf8'));

describe('parseBody', () => {
  it('reads JSON', () => {
    expect(parseBody('application/json', '{"username":"tv"}')).toEqual({ username: 'tv' });
  });

  it('reads form fields', () => {
    expect(
      parseBody(
        'application/x-www-form-urlencoded',
        'grant_type=refresh_token&client_id=https%3A%2F%2Fa.b%2F',
      ),
    ).toEqual({ grant_type: 'refresh_token', client_id: 'https://a.b/' });
  });

  it('reads the multi-part form a browser sends for FormData', () => {
    const boundary = '----WebKitFormBoundaryabc';
    const text =
      `--${boundary}\r\nContent-Disposition: form-data; name="grant_type"\r\n\r\nrefresh_token\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="refresh_token"\r\n\r\nrefresh-1\r\n` +
      `--${boundary}--\r\n`;

    expect(parseBody('multipart/form-data; boundary=' + boundary, text)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
    });
  });

  it('gives an empty object for an empty or unreadable body', () => {
    expect(parseBody('application/json', '')).toEqual({});
    expect(parseBody('application/json', '{nope')).toEqual({});
    expect(parseBody(undefined, 'whatever')).toEqual({});
  });
});

describe('startFakeHomeServer', () => {
  let server = null;
  afterEach(async () => {
    if (server) await server.stop();
    server = null;
  });

  it('answers the sign-in start over real HTTP, with the header that lets a browser read it', async () => {
    server = await startFakeHomeServer(sampleHome, 0);

    const answer = await fetch(server.address + '/auth/login_flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(answer.status).toBe(200);
    expect(answer.headers.get('access-control-allow-origin')).toBe('*');
    expect((await answer.json()).type).toBe('form');
  });

  it('speaks WebSocket at /api/websocket', async () => {
    server = await startFakeHomeServer(sampleHome, 0);
    const socket = new WebSocket(server.address.replace('http', 'ws') + '/api/websocket');

    const first = await new Promise((resolve, reject) => {
      socket.onmessage = (event) => resolve(JSON.parse(event.data));
      socket.onerror = () => reject(new Error('socket error'));
    });
    socket.close();

    expect(first.type).toBe('auth_required');
  });
});
