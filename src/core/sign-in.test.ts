/**
 * Tests for sign-in.ts: the conversation with Home Assistant that turns a username and
 * password into tokens. Every test uses a stand-in sender that answers from a script.
 */

import { describe, expect, it } from 'vitest';
import { CLIENT_ID } from './client-id';
import type { HttpAnswer, HttpRequest, HttpSend } from './http';
import {
  beginSignIn,
  SIGN_IN_REFUSED,
  signInWithToken,
  submitCode,
  submitCredentials,
} from './sign-in';

const address = 'http://192.168.1.100:8123';
const NOW = 1700000000000;

/** A sender that gives the scripted answers in order and remembers what it was asked. */
function scripted(...answers: Array<HttpAnswer | Error>) {
  const requests: HttpRequest[] = [];
  const send: HttpSend = (request) => {
    requests.push(request);
    const next = answers.shift();
    if (next === undefined) return Promise.reject(new Error('the test scripted too few answers'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { send, requests };
}

function json(status: number, body: unknown): HttpAnswer {
  return { status, body: JSON.stringify(body) };
}

const form = json(200, { type: 'form', flow_id: 'flow-1', step_id: 'init', errors: {} });
const entry = json(200, { type: 'create_entry', result: 'code-xyz', version: 1 });
const tokens = json(200, {
  access_token: 'access-abc',
  refresh_token: 'refresh-def',
  expires_in: 1800,
  token_type: 'Bearer',
});

describe('beginSignIn', () => {
  it('asks Home Assistant to start a sign-in and moves to the credentials step', async () => {
    const { send, requests } = scripted(form);

    const step = await beginSignIn(send, address);

    expect(step).toEqual({ kind: 'credentials', flowId: 'flow-1', message: null });
    expect(requests).toEqual([
      {
        method: 'POST',
        url: address + '/auth/login_flow',
        jsonBody: {
          client_id: CLIENT_ID,
          handler: ['homeassistant', null],
          redirect_uri: CLIENT_ID,
        },
      },
    ]);
  });

  it('says it cannot reach the address when nothing answers', async () => {
    const step = await beginSignIn(scripted(new Error('timeout')).send, address);

    expect(step.kind).toBe('cannot-reach');
  });

  it('says it is not Home Assistant when a web page answers', async () => {
    const step = await beginSignIn(
      scripted({ status: 200, body: '<html>Router</html>' }).send,
      address,
    );

    expect(step.kind).toBe('not-home-assistant');
  });

  it('says it is not Home Assistant when JSON of another shape answers', async () => {
    const step = await beginSignIn(scripted(json(200, { hello: 'world' })).send, address);

    expect(step.kind).toBe('not-home-assistant');
  });

  it("passes on Home Assistant's reason when it refuses", async () => {
    const step = await beginSignIn(
      scripted(json(400, { message: 'Invalid client id' })).send,
      address,
    );

    expect(step).toEqual({ kind: 'failed', message: 'Invalid client id' });
  });

  it('points to the access token route when Home Assistant refuses the sign-in from this app', async () => {
    // What Home Assistant answers when its cross-origin check refuses an app's sign-in.
    const refused = { status: 403, body: 'CORS preflight request failed' };

    const step = await beginSignIn(scripted(refused).send, address);

    expect(step).toEqual({ kind: 'failed', message: SIGN_IN_REFUSED });
    expect(SIGN_IN_REFUSED).toContain('access token');
  });

  it('gives a plain reason when a refusal carries none', async () => {
    const step = await beginSignIn(scripted({ status: 500, body: 'oops' }).send, address);

    expect(step).toEqual({ kind: 'failed', message: 'Home Assistant answered with error 500.' });
  });
});

describe('submitCredentials', () => {
  it('sends the username and password, exchanges the code, and ends signed in', async () => {
    const { send, requests } = scripted(entry, tokens);

    const step = await submitCredentials(send, address, 'flow-1', 'tv', 'secret', NOW);

    expect(step).toEqual({
      kind: 'signed-in',
      signIn: {
        address,
        kind: 'account',
        accessToken: 'access-abc',
        refreshToken: 'refresh-def',
        expiresAt: NOW + 1800 * 1000,
      },
    });
    expect(requests).toEqual([
      {
        method: 'POST',
        url: address + '/auth/login_flow/flow-1',
        jsonBody: { client_id: CLIENT_ID, username: 'tv', password: 'secret' },
      },
      {
        method: 'POST',
        url: address + '/auth/token',
        formBody: { grant_type: 'authorization_code', code: 'code-xyz', client_id: CLIENT_ID },
      },
    ]);
  });

  it("stays on the credentials step with Home Assistant's wording for a wrong password", async () => {
    const wrong = json(200, {
      type: 'form',
      flow_id: 'flow-1',
      step_id: 'init',
      errors: { base: 'invalid_auth' },
    });

    const step = await submitCredentials(scripted(wrong).send, address, 'flow-1', 'tv', 'x', NOW);

    expect(step).toEqual({
      kind: 'credentials',
      flowId: 'flow-1',
      message: 'Invalid username or password',
    });
  });

  it('shows an error key it does not know as it is', async () => {
    const odd = json(200, {
      type: 'form',
      flow_id: 'flow-1',
      step_id: 'init',
      errors: { base: 'odd_one' },
    });

    const step = await submitCredentials(scripted(odd).send, address, 'flow-1', 'tv', 'x', NOW);

    expect(step).toEqual({ kind: 'credentials', flowId: 'flow-1', message: 'odd_one' });
  });

  it('moves to the code step when Home Assistant asks for a two-step code', async () => {
    const mfa = json(200, { type: 'form', flow_id: 'flow-1', step_id: 'mfa', errors: {} });

    const step = await submitCredentials(
      scripted(mfa).send,
      address,
      'flow-1',
      'tv',
      'secret',
      NOW,
    );

    expect(step).toEqual({ kind: 'code', flowId: 'flow-1', message: null });
  });

  it('fails with the reason when Home Assistant aborts the sign-in', async () => {
    const abort = json(200, { type: 'abort', flow_id: 'flow-1', reason: 'too_many_retry' });

    const step = await submitCredentials(scripted(abort).send, address, 'flow-1', 'tv', 'x', NOW);

    expect(step).toEqual({ kind: 'failed', message: 'too_many_retry' });
  });

  it('starts again with an explanation when Home Assistant has forgotten the sign-in', async () => {
    const forgotten = json(404, { message: 'Invalid flow specified' });
    const freshForm = json(200, { type: 'form', flow_id: 'flow-2', step_id: 'init', errors: {} });
    const { send, requests } = scripted(forgotten, freshForm);

    const step = await submitCredentials(send, address, 'flow-1', 'tv', 'secret', NOW);

    expect(step).toEqual({
      kind: 'credentials',
      flowId: 'flow-2',
      message: 'Sign-in took too long. Please try again.',
    });
    expect(requests[1]?.url).toBe(address + '/auth/login_flow');
  });

  it('says it cannot reach the address when the connection drops part-way', async () => {
    const step = await submitCredentials(
      scripted(new Error('Failed to fetch')).send,
      address,
      'flow-1',
      'tv',
      'secret',
      NOW,
    );

    expect(step.kind).toBe('cannot-reach');
  });

  it('fails when the token exchange is refused', async () => {
    const refused = json(400, { error: 'invalid_request', error_description: 'Invalid code' });

    const step = await submitCredentials(
      scripted(entry, refused).send,
      address,
      'flow-1',
      'tv',
      'secret',
      NOW,
    );

    expect(step).toEqual({ kind: 'failed', message: 'Invalid code' });
  });

  it('fails when the token answer lacks a token', async () => {
    const step = await submitCredentials(
      scripted(entry, json(200, { access_token: 'only-this' })).send,
      address,
      'flow-1',
      'tv',
      'secret',
      NOW,
    );

    expect(step.kind).toBe('not-home-assistant');
  });
});

describe('submitCode', () => {
  it('sends the code and ends signed in', async () => {
    const { send, requests } = scripted(entry, tokens);

    const step = await submitCode(send, address, 'flow-1', '123456', NOW);

    expect(step.kind).toBe('signed-in');
    expect(requests[0]).toEqual({
      method: 'POST',
      url: address + '/auth/login_flow/flow-1',
      jsonBody: { client_id: CLIENT_ID, code: '123456' },
    });
  });

  it('stays on the code step for a wrong code', async () => {
    const wrong = json(200, {
      type: 'form',
      flow_id: 'flow-1',
      step_id: 'mfa',
      errors: { base: 'invalid_code' },
    });

    const step = await submitCode(scripted(wrong).send, address, 'flow-1', '000000', NOW);

    expect(step).toEqual({
      kind: 'code',
      flowId: 'flow-1',
      message: 'Invalid authentication code',
    });
  });
});

describe('signInWithToken', () => {
  it('builds a sign-in from a long-lived access token, trimming stray spaces', () => {
    expect(signInWithToken(address, '  eyJ.token.value \n')).toEqual({
      address,
      kind: 'long-lived-token',
      accessToken: 'eyJ.token.value',
      refreshToken: '',
      expiresAt: 0,
    });
  });
});
