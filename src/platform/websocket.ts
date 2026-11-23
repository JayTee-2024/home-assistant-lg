/**
 * THROWAWAY: used only by the TV proof, and deleted with src/proof. The real app's
 * live connection is opened by the Home Assistant library, not by this file.
 *
 * Opens a real browser WebSocket and presents it as the small SocketLike shape the
 * probe uses. Like http.ts, this is the "real" side: the probe takes an opener as a
 * parameter so tests can pass a stand-in and never touch the network.
 */

/** The parts of a WebSocket the probe uses, so tests can supply a stand-in. */
export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close(): void;
}

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
