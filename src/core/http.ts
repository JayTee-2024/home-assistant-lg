/**
 * The shape of an HTTP request and of the function that sends one.
 *
 * Logic that needs the network takes a sender (HttpSend) as a parameter. The real sender
 * is src/platform/http.ts; tests pass a stand-in. Nothing in this file touches the network.
 */

export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  /** Sent as JSON. */
  jsonBody?: unknown;
  /** Sent as form fields, the way Home Assistant's token address expects. */
  formBody?: { [name: string]: string };
  /** True: only find out whether the server answers; the answer itself cannot be read. */
  opaque?: boolean;
}

export interface HttpAnswer {
  status: number;
  body: string;
}

/** Resolves with the answer. Rejects when the browser blocks the request or nothing answers. */
export type HttpSend = (request: HttpRequest) => Promise<HttpAnswer>;

/**
 * Returns a sender that gives up after `timeoutMs`.
 *
 * A browser's own request can wait a very long time when a device is switched off, and
 * Chromium 53 has no way to cancel one. So this does not cancel anything: it stops waiting,
 * rejects with Error('timeout'), and ignores the answer if it arrives later.
 */
export function withTimeout(send: HttpSend, timeoutMs: number): HttpSend {
  return (request) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);

      send(request).then(
        (answer) => {
          clearTimeout(timer);
          resolve(answer);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
}
