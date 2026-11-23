/**
 * Tests for http.ts: the time limit added around a sender.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout, type HttpRequest, type HttpSend } from './http';

const request: HttpRequest = { method: 'GET', url: 'http://example.test/' };

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('passes the answer through when it arrives in time', async () => {
    const send: HttpSend = () => Promise.resolve({ status: 200, body: 'hello' });

    expect(await withTimeout(send, 1000)(request)).toEqual({ status: 200, body: 'hello' });
  });

  it('passes a failure through', async () => {
    const send: HttpSend = () => Promise.reject(new Error('no route'));

    await expect(withTimeout(send, 1000)(request)).rejects.toThrow('no route');
  });

  it('rejects with "timeout" once the time is up, and not before', async () => {
    vi.useFakeTimers();
    const neverAnswers: HttpSend = () => new Promise(() => {});
    let outcome = 'waiting';
    withTimeout(
      neverAnswers,
      8000,
    )(request).catch((error: Error) => {
      outcome = error.message;
    });

    await vi.advanceTimersByTimeAsync(7999);
    expect(outcome).toBe('waiting');

    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBe('timeout');
  });

  it('gives the request to the sender unchanged', async () => {
    const seen: HttpRequest[] = [];
    const send: HttpSend = (sent) => {
      seen.push(sent);
      return Promise.resolve({ status: 204, body: '' });
    };

    await withTimeout(send, 1000)(request);

    expect(seen).toEqual([request]);
  });
});
