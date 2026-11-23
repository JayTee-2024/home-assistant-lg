import { describe, expect, it, vi } from 'vitest';
import {
  buildProbes,
  CLIENT_ID,
  decideSignInRoute,
  isProvidersAnswer,
  isSignInFormAnswer,
  PROBE_TIMEOUT_MS,
  runHttpProbe,
  runWebSocketProbe,
  type HttpRequest,
  type ProbeOutcome,
  type ProbeResult,
  type SocketLike,
} from './probe';

const base = 'http://192.168.1.100:8123';
const get: HttpRequest = { method: 'GET', url: base + '/auth/providers' };
const anything = () => true;

/** A stand-in for a WebSocket whose events the test fires by hand. */
function fakeSocket() {
  const socket: SocketLike & {
    closed: boolean;
    fireOpen(): void;
    fireMessage(data: string): void;
    fireError(): void;
    fireClose(): void;
  } = {
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    closed: false,
    close() {
      socket.closed = true;
    },
    fireOpen: () => socket.onopen?.(),
    fireMessage: (data: string) => socket.onmessage?.({ data }),
    fireError: () => socket.onerror?.(),
    fireClose: () => socket.onclose?.(),
  };
  return socket;
}

describe('buildProbes', () => {
  it('builds the four probes for an http address', () => {
    const plan = buildProbes(base);
    expect(plan.reach).toEqual({ method: 'GET', url: base + '/manifest.json', opaque: true });
    expect(plan.providers).toEqual({ method: 'GET', url: base + '/auth/providers' });
    expect(plan.startSignIn).toEqual({
      method: 'POST',
      url: base + '/auth/login_flow',
      jsonBody: { client_id: CLIENT_ID, handler: ['homeassistant', null], redirect_uri: CLIENT_ID },
    });
    expect(plan.webSocketUrl).toBe('ws://192.168.1.100:8123/api/websocket');
  });

  it('uses wss for an https address', () => {
    expect(buildProbes('https://example.ui.nabu.casa').webSocketUrl).toBe(
      'wss://example.ui.nabu.casa/api/websocket',
    );
  });
});

describe('runHttpProbe', () => {
  it('reports reached for an expected answer', async () => {
    const result = await runHttpProbe(
      'p',
      get,
      async () => ({ status: 200, body: '{}' }),
      anything,
    );
    expect(result).toMatchObject({ name: 'p', outcome: 'reached', httpStatus: 200 });
  });

  it('reports reached with no status for an opaque answer', async () => {
    const result = await runHttpProbe(
      'p',
      { ...get, opaque: true },
      async () => ({ status: 0, body: '' }),
      () => false,
    );
    expect(result).toMatchObject({ outcome: 'reached', httpStatus: null });
  });

  it('reports refused-by-server for a 4xx or 5xx status, with the start of the body', async () => {
    const result = await runHttpProbe(
      'p',
      get,
      async () => ({ status: 403, body: 'CORS preflight failed' }),
      anything,
    );
    expect(result).toMatchObject({ outcome: 'refused-by-server', httpStatus: 403 });
    expect(result.detail).toContain('CORS preflight failed');
  });

  it('keeps only the first 200 characters of a refused body', async () => {
    const result = await runHttpProbe(
      'p',
      get,
      async () => ({ status: 500, body: 'x'.repeat(500) }),
      anything,
    );
    expect(result.detail).toHaveLength(200);
  });

  it('reports unexpected-answer when the body is not what Home Assistant sends', async () => {
    const result = await runHttpProbe(
      'p',
      get,
      async () => ({ status: 200, body: '<html>router</html>' }),
      () => false,
    );
    expect(result).toMatchObject({ outcome: 'unexpected-answer', httpStatus: 200 });
  });

  it('reports blocked-or-unreachable when the request is rejected', async () => {
    const result = await runHttpProbe(
      'p',
      get,
      async () => {
        throw new Error('Failed to fetch');
      },
      anything,
    );
    expect(result).toMatchObject({
      outcome: 'blocked-or-unreachable',
      httpStatus: null,
      detail: 'Failed to fetch',
    });
  });

  it('reports timeout after 8 seconds when nothing comes back', async () => {
    vi.useFakeTimers();
    const pending = runHttpProbe('p', get, () => new Promise(() => {}), anything);
    vi.advanceTimersByTime(PROBE_TIMEOUT_MS);
    expect(await pending).toMatchObject({ outcome: 'timeout' });
    vi.useRealTimers();
  });

  it('ignores an answer that arrives after the timeout', async () => {
    vi.useFakeTimers();
    let answer: (value: { status: number; body: string }) => void = () => {};
    const pending = runHttpProbe(
      'p',
      get,
      () => new Promise((resolve) => (answer = resolve)),
      anything,
    );
    vi.advanceTimersByTime(PROBE_TIMEOUT_MS);
    answer({ status: 200, body: '{}' });
    expect(await pending).toMatchObject({ outcome: 'timeout' });
    vi.useRealTimers();
  });
});

describe('runWebSocketProbe', () => {
  it('reports reached when the first message is auth_required', async () => {
    const socket = fakeSocket();
    const pending = runWebSocketProbe('ws://x/api/websocket', () => socket);
    socket.fireOpen();
    socket.fireMessage('{"type":"auth_required","ha_version":"2026.11.1"}');
    expect(await pending).toMatchObject({ outcome: 'reached', detail: 'Home Assistant 2026.11.1' });
    expect(socket.closed).toBe(true);
  });

  it('reports unexpected-answer for any other first message', async () => {
    const socket = fakeSocket();
    const pending = runWebSocketProbe('ws://x/api/websocket', () => socket);
    socket.fireMessage('hello');
    expect(await pending).toMatchObject({ outcome: 'unexpected-answer' });
  });

  it('reports blocked-or-unreachable when the socket errors or closes first', async () => {
    const errored = fakeSocket();
    const first = runWebSocketProbe('ws://x', () => errored);
    errored.fireError();
    expect(await first).toMatchObject({ outcome: 'blocked-or-unreachable' });

    const closed = fakeSocket();
    const second = runWebSocketProbe('ws://x', () => closed);
    closed.fireOpen();
    closed.fireClose();
    expect(await second).toMatchObject({ outcome: 'blocked-or-unreachable' });
  });

  it('reports blocked-or-unreachable when the socket cannot even be created', async () => {
    const result = await runWebSocketProbe('ws://x', () => {
      throw new Error('Insecure connection refused');
    });
    expect(result).toMatchObject({
      outcome: 'blocked-or-unreachable',
      detail: 'Insecure connection refused',
    });
  });

  it('reports timeout after 8 seconds of silence', async () => {
    vi.useFakeTimers();
    const socket = fakeSocket();
    const pending = runWebSocketProbe('ws://x', () => socket);
    vi.advanceTimersByTime(PROBE_TIMEOUT_MS);
    expect(await pending).toMatchObject({ outcome: 'timeout' });
    expect(socket.closed).toBe(true);
    vi.useRealTimers();
  });
});

describe('decideSignInRoute', () => {
  const result = (outcome: ProbeOutcome): ProbeResult => ({
    name: 'p',
    outcome,
    httpStatus: null,
    detail: '',
  });

  it('is unreachable when Home Assistant did not answer at all', () => {
    expect(decideSignInRoute(result('timeout'), result('timeout'))).toBe('unreachable');
    expect(decideSignInRoute(result('blocked-or-unreachable'), result('reached'))).toBe(
      'unreachable',
    );
  });

  it('is direct when the sign-in request got through', () => {
    expect(decideSignInRoute(result('reached'), result('reached'))).toBe('direct');
  });

  it('is helper-service when Home Assistant answers but the sign-in request does not get through', () => {
    for (const outcome of [
      'blocked-or-unreachable',
      'refused-by-server',
      'unexpected-answer',
      'timeout',
    ] as const) {
      expect(decideSignInRoute(result('reached'), result(outcome))).toBe('helper-service');
    }
  });
});

describe('recognising Home Assistant answers', () => {
  it('accepts the sign-in options answer', () => {
    const body =
      '{"providers":[{"name":"Home Assistant Local","id":null,"type":"homeassistant"}],"preselect_remember_me":true}';
    expect(isProvidersAnswer(body)).toBe(true);
  });

  it('rejects anything without a providers list', () => {
    for (const body of ['<html>router</html>', '{}', '{"providers":"none"}', 'null', '']) {
      expect(isProvidersAnswer(body)).toBe(false);
    }
  });

  it('accepts the first step of a sign-in', () => {
    const body = '{"type":"form","flow_id":"3323f1c8","step_id":"init","errors":{}}';
    expect(isSignInFormAnswer(body)).toBe(true);
  });

  it('rejects anything that is not a sign-in form', () => {
    for (const body of ['<html>router</html>', '{}', '{"type":"abort"}', 'null', '']) {
      expect(isSignInFormAnswer(body)).toBe(false);
    }
  });
});
