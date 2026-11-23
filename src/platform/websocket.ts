/**
 * Opens a real browser WebSocket and presents it as the small SocketLike shape the
 * logic uses.
 *
 * Like http.ts, this is the "real" side: logic takes an opener as a parameter so tests
 * can pass a stand-in and never touch the network.
 */

import type { SocketLike } from '../proof/probe';

export function openWebSocket(url: string): SocketLike {
  const socket = new WebSocket(url);

  const wrapper: SocketLike = {
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    close: () => socket.close(),
  };

  socket.onopen = () => wrapper.onopen?.();
  socket.onmessage = (event: MessageEvent) => {
    // Home Assistant only sends text. Anything else is passed on as empty text.
    const data: unknown = event.data;
    wrapper.onmessage?.({ data: typeof data === 'string' ? data : '' });
  };
  socket.onerror = () => wrapper.onerror?.();
  socket.onclose = () => wrapper.onclose?.();

  return wrapper;
}
