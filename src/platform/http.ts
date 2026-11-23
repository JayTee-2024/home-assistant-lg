/**
 * Sends HTTP requests from the app using the browser's fetch.
 *
 * This is the "real" sender. Logic that needs to send requests takes a sender (HttpSend)
 * as a parameter, so tests can pass a stand-in and never touch the network.
 *
 * It does not decide what an answer means, and it sets no time limit. Both belong to
 * the caller.
 */

import type { HttpSend } from '../core/http';

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
  if (request.formBody !== undefined) {
    init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = encodeForm(request.formBody);
  }

  return fetch(request.url, init).then((response) => {
    if (request.opaque) {
      return { status: 0, body: '' };
    }
    return response.text().then((body) => ({ status: response.status, body }));
  });
};

/** Turns { a: '1', b: 'x y' } into 'a=1&b=x%20y'. */
function encodeForm(fields: { [name: string]: string }): string {
  return Object.keys(fields)
    .map((name) => encodeURIComponent(name) + '=' + encodeURIComponent(fields[name] ?? ''))
    .join('&');
}
