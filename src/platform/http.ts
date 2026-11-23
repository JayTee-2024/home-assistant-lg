/**
 * Sends HTTP requests from the app using the browser's fetch.
 *
 * This is the "real" sender. Logic that needs to send requests takes a sender (HttpSend)
 * as a parameter, so tests can pass a stand-in and never touch the network.
 *
 * It does not decide what an answer means, and it sets no time limit. Both belong to
 * the caller.
 */

export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  jsonBody?: unknown;
  /** True: only find out whether the server answers; the answer itself cannot be read. */
  opaque?: boolean;
}

/** Resolves with the answer. Rejects when the browser blocks the request or nothing answers. */
export type HttpSend = (request: HttpRequest) => Promise<{ status: number; body: string }>;

export const fetchSend: HttpSend = (request) => {
  const init: RequestInit = { method: request.method };

  if (request.opaque) {
    // "no-cors" asks only "does anything answer?". The browser hides the answer itself,
    // so this works whatever cross-origin rules the server applies.
    init.mode = 'no-cors';
  }
  if (request.jsonBody !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(request.jsonBody);
  }

  return fetch(request.url, init).then((response) => {
    if (request.opaque) {
      return { status: 0, body: '' };
    }
    return response.text().then((body) => ({ status: response.status, body }));
  });
};
