/**
 * The conversation with Home Assistant that turns a username and password into tokens.
 *
 * Home Assistant calls this a "login flow". It goes:
 *   1. beginSignIn        "I want to sign in"            → Home Assistant opens a flow
 *   2. submitCredentials  username and password          → a one-time code, or "wrong password",
 *                                                           or "now give me your two-step code"
 *   3. submitCode         the two-step code, if asked    → a one-time code
 *   4. (inside 2 and 3)   the one-time code is exchanged → access token and refresh token
 *
 * Each function returns a SignInStep saying what the sign-in screen should show next. None
 * of them throws, and none of them keeps the password: it is passed straight through to
 * Home Assistant and forgotten.
 *
 * Nothing here touches the network: the caller passes in the sender (see http.ts).
 *
 * Home Assistant's documentation: https://developers.home-assistant.io/docs/auth_api
 * The login flow addresses are not in that page; they are the ones Home Assistant's own
 * sign-in page uses, and were tested on Home Assistant 2026.11 (docs/tv-proof-results.md).
 */

import { CLIENT_ID } from './client-id';
import type { HttpAnswer, HttpSend } from './http';
import type { SavedSignIn } from './saved-state';

export type SignInStep =
  /** Show the username and password form. `message` is an error to show with it, if any. */
  | { kind: 'credentials'; flowId: string; message: string | null }
  /** Show the two-step code form. */
  | { kind: 'code'; flowId: string; message: string | null }
  /** Finished. `signIn` is what to save. */
  | { kind: 'signed-in'; signIn: SavedSignIn }
  /** Nothing answered at the address. */
  | { kind: 'cannot-reach'; message: string }
  /** Something answered, but it is not Home Assistant. */
  | { kind: 'not-home-assistant'; message: string }
  /** Home Assistant refused. `message` is its reason. */
  | { kind: 'failed'; message: string };

/** Home Assistant sends error keys, not sentences. These are its own English words for them. */
const ERROR_WORDS: { [key: string]: string } = {
  invalid_auth: 'Invalid username or password',
  invalid_code: 'Invalid authentication code',
};

const CANNOT_REACH = 'Could not reach Home Assistant at this address.';
const NOT_HOME_ASSISTANT = 'Something answered at this address, but it is not Home Assistant.';
const TOOK_TOO_LONG = 'Sign-in took too long. Please try again.';

export function beginSignIn(send: HttpSend, address: string): Promise<SignInStep> {
  return send({
    method: 'POST',
    url: address + '/auth/login_flow',
    // The handler names the kind of account: Home Assistant's own usernames and passwords.
    jsonBody: { client_id: CLIENT_ID, handler: ['homeassistant', null], redirect_uri: CLIENT_ID },
  }).then(
    (answer) => {
      if (answer.status >= 400) return refusal(answer);

      const flow = readJson(answer);
      const flowId = flow === null ? null : flow['flow_id'];
      if (flow === null || flow['type'] !== 'form' || typeof flowId !== 'string') {
        return notHomeAssistant();
      }
      return { kind: 'credentials', flowId, message: null } as SignInStep;
    },
    () => cannotReach(),
  );
}

export function submitCredentials(
  send: HttpSend,
  address: string,
  flowId: string,
  username: string,
  password: string,
  now: number,
): Promise<SignInStep> {
  return submitFlowStep(send, address, flowId, { client_id: CLIENT_ID, username, password }, now);
}

export function submitCode(
  send: HttpSend,
  address: string,
  flowId: string,
  code: string,
  now: number,
): Promise<SignInStep> {
  return submitFlowStep(send, address, flowId, { client_id: CLIENT_ID, code }, now);
}

/** The "Advanced" route: a long-lived access token made on the person's Home Assistant profile page. */
export function signInWithToken(address: string, token: string): SavedSignIn {
  return {
    address,
    kind: 'long-lived-token',
    accessToken: token.trim(),
    refreshToken: '',
    expiresAt: 0,
  };
}

/** Sends one step of the flow and works out what its answer means. */
function submitFlowStep(
  send: HttpSend,
  address: string,
  flowId: string,
  jsonBody: { [name: string]: string },
  now: number,
): Promise<SignInStep> {
  return send({ method: 'POST', url: address + '/auth/login_flow/' + flowId, jsonBody }).then(
    (answer): SignInStep | Promise<SignInStep> => {
      // Home Assistant forgets a flow after a while, or when it restarts. Start a new one.
      if (answer.status === 404) return restart(send, address);
      if (answer.status >= 400) return refusal(answer);

      const result = readJson(answer);
      if (result === null) return notHomeAssistant();

      if (result['type'] === 'create_entry' && typeof result['result'] === 'string') {
        return exchangeCode(send, address, result['result'], now);
      }
      if (result['type'] === 'abort') {
        const reason = result['reason'];
        return {
          kind: 'failed',
          message: typeof reason === 'string' ? reason : 'Sign-in was stopped.',
        };
      }
      if (result['type'] === 'form') {
        const message = errorMessage(result['errors']);
        return result['step_id'] === 'mfa'
          ? { kind: 'code', flowId, message }
          : { kind: 'credentials', flowId, message };
      }
      return notHomeAssistant();
    },
    () => cannotReach(),
  );
}

/** Begins a fresh flow and tells the person why they are being asked again. */
function restart(send: HttpSend, address: string): Promise<SignInStep> {
  return beginSignIn(send, address).then((step) =>
    step.kind === 'credentials'
      ? { kind: 'credentials', flowId: step.flowId, message: TOOK_TOO_LONG }
      : step,
  );
}

/** Swaps the one-time code from the flow for the tokens the app keeps. */
function exchangeCode(
  send: HttpSend,
  address: string,
  code: string,
  now: number,
): Promise<SignInStep> {
  return send({
    method: 'POST',
    url: address + '/auth/token',
    formBody: { grant_type: 'authorization_code', code, client_id: CLIENT_ID },
  }).then(
    (answer): SignInStep => {
      if (answer.status >= 400) return refusal(answer);

      const tokens = readJson(answer);
      const accessToken = tokens === null ? null : tokens['access_token'];
      const refreshToken = tokens === null ? null : tokens['refresh_token'];
      const expiresIn = tokens === null ? null : tokens['expires_in'];
      if (
        typeof accessToken !== 'string' ||
        typeof refreshToken !== 'string' ||
        typeof expiresIn !== 'number'
      ) {
        return notHomeAssistant();
      }

      return {
        kind: 'signed-in',
        signIn: {
          address,
          kind: 'account',
          accessToken,
          refreshToken,
          // Home Assistant gives the lifetime in seconds.
          expiresAt: now + expiresIn * 1000,
        },
      };
    },
    () => cannotReach(),
  );
}

/** The answer's body as a JSON object, or null when it is anything else. */
function readJson(answer: HttpAnswer): { [name: string]: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(answer.body);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as { [name: string]: unknown };
    }
    return null;
  } catch {
    return null;
  }
}

/** The sentence for the first error in a flow answer's `errors`, or null when there is none. */
function errorMessage(errors: unknown): string | null {
  if (typeof errors !== 'object' || errors === null) return null;

  const base = (errors as { [name: string]: unknown })['base'];
  if (typeof base !== 'string') return null;
  return ERROR_WORDS[base] ?? base;
}

/** A 'failed' step carrying Home Assistant's own reason, when it gave one. */
function refusal(answer: HttpAnswer): SignInStep {
  const body = readJson(answer);
  const reason = body === null ? null : (body['message'] ?? body['error_description']);

  return {
    kind: 'failed',
    message:
      typeof reason === 'string'
        ? reason
        : 'Home Assistant answered with error ' + answer.status + '.',
  };
}

function cannotReach(): SignInStep {
  return { kind: 'cannot-reach', message: CANNOT_REACH };
}

function notHomeAssistant(): SignInStep {
  return { kind: 'not-home-assistant', message: NOT_HOME_ASSISTANT };
}
