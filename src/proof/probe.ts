/**
 * THROWAWAY: part of the TV proof, deleted once the real sign-in exists.
 *
 * Small tests ("probes") that find out, from inside the TV app, how much of
 * Home Assistant the app can reach, and from that which sign-in route to build.
 *
 * Nothing here touches the network itself. The caller passes in the function
 * that sends a request, which is what makes this file testable.
 */

/** How long a probe waits before giving up. */
export const PROBE_TIMEOUT_MS = 8000;

/** The fixed address the app presents to Home Assistant as its identity. It is never fetched. */
export const CLIENT_ID = 'https://jaytee-2024.github.io/home-assistant-lg/';

export type ProbeOutcome =
  /** Home Assistant answered as expected. */
  | 'reached'
  /** A server answered with an error status (400 or above). */
  | 'refused-by-server'
  /** Something answered, but not the way Home Assistant does. */
  | 'unexpected-answer'
  /** The request failed. A browser cannot tell "blocked by a security rule" from "nothing there". */
  | 'blocked-or-unreachable'
  /** Nothing came back in time. */
  | 'timeout';

export interface ProbeResult {
  name: string;
  outcome: ProbeOutcome;
  httpStatus: number | null;
  detail: string;
}

export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  jsonBody?: unknown;
  /** True: only find out whether the server answers; the answer itself cannot be read. */
  opaque?: boolean;
}

/** Resolves with the answer. Rejects when the browser blocks the request or nothing answers. */
export type HttpSend = (request: HttpRequest) => Promise<{ status: number; body: string }>;

export interface ProbePlan {
  reach: HttpRequest;
  providers: HttpRequest;
  startSignIn: HttpRequest;
  webSocketUrl: string;
}

/** The parts of a WebSocket the probe uses, so tests can supply a stand-in. */
export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close(): void;
}

export type SignInRoute = 'direct' | 'helper-service' | 'unreachable';

/** Longest piece of a server's error text worth showing on screen. */
const DETAIL_LENGTH = 200;

/** Builds the four probes for a Home Assistant base address such as "http://192.168.1.100:8123". */
export function buildProbes(baseUrl: string): ProbePlan {
  return {
    // An opaque request succeeds whenever a server answers, whatever security rules apply.
    // It is the control: it separates "Home Assistant is not there" from "the app is blocked".
    reach: { method: 'GET', url: baseUrl + '/manifest.json', opaque: true },
    providers: { method: 'GET', url: baseUrl + '/auth/providers' },
    // The first request of Home Assistant's sign-in. The question the proof exists to answer
    // is whether the TV lets this one through.
    startSignIn: {
      method: 'POST',
      url: baseUrl + '/auth/login_flow',
      jsonBody: { client_id: CLIENT_ID, handler: ['homeassistant', null], redirect_uri: CLIENT_ID },
    },
    // http becomes ws and https becomes wss.
    webSocketUrl: baseUrl.replace(/^http/, 'ws') + '/api/websocket',
  };
}

/** Reads a JSON object from text, or returns null when the text is anything else. */
function parseJsonObject(text: string): { [key: string]: unknown } | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null
      ? (value as { [key: string]: unknown })
      : null;
  } catch {
    return null;
  }
}

/** True for Home Assistant's answer to /auth/providers: an object with a list of providers. */
export function isProvidersAnswer(body: string): boolean {
  const answer = parseJsonObject(body);
  return answer !== null && Array.isArray(answer.providers);
}

/** True for Home Assistant's answer to a new sign-in: a form asking for username and password. */
export function isSignInFormAnswer(body: string): boolean {
  const answer = parseJsonObject(body);
  return answer !== null && answer.type === 'form';
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sends one request and reports what happened. Never rejects.
 *
 * `isExpected` is given the body of a successful answer and says whether it looks like
 * Home Assistant's. It is not called for an opaque request, whose body cannot be read.
 */
export function runHttpProbe(
  name: string,
  request: HttpRequest,
  send: HttpSend,
  isExpected: (body: string) => boolean,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    // Whichever of answer, failure or timeout comes first wins; the rest are ignored.
    let settled = false;
    const settle = (outcome: ProbeOutcome, httpStatus: number | null, detail: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ name, outcome, httpStatus, detail });
    };

    const timer = setTimeout(
      () => settle('timeout', null, 'No answer after ' + timeoutMs / 1000 + ' seconds'),
      timeoutMs,
    );

    send(request).then(
      (answer) => {
        if (request.opaque) {
          settle('reached', null, 'A server answered');
        } else if (answer.status >= 400) {
          settle('refused-by-server', answer.status, answer.body.slice(0, DETAIL_LENGTH));
        } else if (!isExpected(answer.body)) {
          settle('unexpected-answer', answer.status, answer.body.slice(0, DETAIL_LENGTH));
        } else {
          settle('reached', answer.status, 'Answered as expected');
        }
      },
      (error: unknown) => settle('blocked-or-unreachable', null, errorText(error)),
    );
  });
}

/**
 * Opens Home Assistant's live connection and waits for its greeting. Never rejects.
 *
 * Home Assistant's first message on a new connection is always
 * {"type": "auth_required", "ha_version": "..."}.
 * See https://developers.home-assistant.io/docs/api/websocket
 */
export function runWebSocketProbe(
  url: string,
  openSocket: (url: string) => SocketLike,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  const name = 'Live connection';

  return new Promise((resolve) => {
    let socket: SocketLike | null = null;
    let settled = false;
    const settle = (outcome: ProbeOutcome, detail: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (socket) socket.close();
      resolve({ name, outcome, httpStatus: null, detail });
    };

    const timer = setTimeout(
      () => settle('timeout', 'No answer after ' + timeoutMs / 1000 + ' seconds'),
      timeoutMs,
    );

    try {
      socket = openSocket(url);
    } catch (error) {
      settle('blocked-or-unreachable', errorText(error));
      return;
    }

    socket.onmessage = (event) => {
      let version: string | null = null;
      try {
        const message = JSON.parse(event.data) as { type?: unknown; ha_version?: unknown };
        if (message.type === 'auth_required') {
          version = typeof message.ha_version === 'string' ? message.ha_version : 'unknown version';
        }
      } catch {
        // Not JSON, so not Home Assistant. Reported below.
      }
      if (version === null) {
        settle('unexpected-answer', event.data.slice(0, DETAIL_LENGTH));
      } else {
        settle('reached', 'Home Assistant ' + version);
      }
    };
    socket.onerror = () => settle('blocked-or-unreachable', 'The connection failed');
    socket.onclose = () => settle('blocked-or-unreachable', 'The connection closed straight away');
  });
}

/**
 * Decides how the real app should sign in, from two probe results.
 *
 * - unreachable: nothing answered at the address, so nothing can be concluded.
 * - direct: the app's own sign-in request got through.
 * - helper-service: Home Assistant is there, but the app's sign-in request was stopped,
 *   so sign-in has to go through the small service bundled with the app.
 */
export function decideSignInRoute(reach: ProbeResult, startSignIn: ProbeResult): SignInRoute {
  if (reach.outcome !== 'reached') return 'unreachable';
  if (startSignIn.outcome === 'reached') return 'direct';
  return 'helper-service';
}
