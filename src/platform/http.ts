/**
 * Sends HTTP requests from the app using the browser's fetch.
 *
 * This is the "real" sender. Logic that needs to send requests takes a sender as a
 * parameter, so tests can pass a stand-in and never touch the network.
 */

import type { HttpSend } from '../proof/probe';

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
