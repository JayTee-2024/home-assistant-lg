// Tests for live-video.ts with a stand-in peer connection and connection: real WebRTC cannot
// run here, so these check the order of the steps and which events reach the view.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { LIVE_PICTURE_TIMEOUT_MS, type LiveEvent } from '../core/live-video';
import { createLiveVideoSource } from './live-video';

class FakePeer {
  static last: FakePeer;
  iceConnectionState = 'new';
  iceGatheringState = 'complete';
  localDescription: { sdp: string } | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  onaddstream: ((event: { stream: unknown }) => void) | null = null;
  remoteSet = false;
  candidates: Array<{ afterAnswer: boolean }> = [];
  closed = false;
  answerDone: () => void = () => undefined;
  constructor() {
    FakePeer.last = this;
  }
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'offer-sdp' });
  }
  setLocalDescription(description: { sdp: string }) {
    this.localDescription = description;
    return Promise.resolve();
  }
  setRemoteDescription() {
    return new Promise<void>((resolve) => {
      this.answerDone = () => {
        this.remoteSet = true;
        resolve();
      };
    });
  }
  addIceCandidate() {
    this.candidates.push({ afterAnswer: this.remoteSet });
    return Promise.resolve();
  }
  close() {
    this.closed = true;
  }
  ice(state: string) {
    this.iceConnectionState = state;
    if (this.oniceconnectionstatechange) this.oniceconnectionstatechange();
  }
}

interface Sent {
  message: { type: string };
  options: unknown;
  callback: (event: unknown) => void;
}

function fakeConnection() {
  const subscriptions: Sent[] = [];
  let unsubscribed = 0;
  const connection = {
    sendMessagePromise: (message: { type: string }) =>
      Promise.resolve(
        message.type === 'camera/capabilities'
          ? { frontend_stream_types: ['web_rtc'] }
          : { configuration: { iceServers: [] } },
      ),
    subscribeMessage: (
      callback: (event: unknown) => void,
      message: { type: string },
      options: unknown,
    ) => {
      subscriptions.push({ message, options, callback });
      return Promise.resolve(() => {
        unsubscribed += 1;
        return Promise.resolve();
      });
    },
  };
  return {
    connection: connection as unknown as Connection,
    subscriptions,
    unsubscribed: () => unsubscribed,
  };
}

/** Lets every pending promise step run. */
async function settle() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as unknown as { window: unknown }).window = {
    webkitRTCPeerConnection: FakePeer,
    RTCSessionDescription: function (init: unknown) {
      return init;
    },
    RTCIceCandidate: function (init: unknown) {
      return init;
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as unknown as { window?: unknown }).window;
});

async function startedSession() {
  const fake = fakeConnection();
  const events: LiveEvent[] = [];
  const streams: unknown[] = [];
  const session = createLiveVideoSource(fake.connection).start('camera.front_door', {
    onStream: (stream) => streams.push(stream),
    onEvent: (event) => events.push(event),
  });
  await settle();
  return { ...fake, events, streams, session, peer: FakePeer.last };
}

describe('a live session', () => {
  it('sends the offer once, and asks for it not to be sent again after a reconnect', async () => {
    const { subscriptions } = await startedSession();
    expect(subscriptions.length).toBe(1);
    expect((subscriptions[0] as Sent).message).toEqual({
      type: 'camera/webrtc/offer',
      entity_id: 'camera.front_door',
      offer: 'offer-sdp',
    });
    expect((subscriptions[0] as Sent).options).toEqual({ resubscribe: false });
  });

  it('reports the picture only once the stream has arrived and the connection is up', async () => {
    const { peer, events, streams } = await startedSession();

    (peer.onaddstream as (event: { stream: unknown }) => void)({ stream: 'stream' });
    expect(streams).toEqual(['stream']);
    expect(events).toEqual([]);

    peer.ice('checking');
    expect(events).toEqual([]);
    peer.ice('connected');
    expect(events).toEqual(['picture']);
    peer.ice('completed');
    expect(events).toEqual(['picture']);
  });

  it('still times out when the stream arrived but the connection never came up', async () => {
    const { peer, events } = await startedSession();
    (peer.onaddstream as (event: { stream: unknown }) => void)({ stream: 'stream' });
    peer.ice('checking');

    vi.advanceTimersByTime(LIVE_PICTURE_TIMEOUT_MS);

    expect(events).toEqual(['timed-out']);
  });

  it('gives a dropped connection a few seconds to come back before reporting it lost', async () => {
    const { peer, events } = await startedSession();
    (peer.onaddstream as (event: { stream: unknown }) => void)({ stream: 'stream' });
    peer.ice('connected');

    peer.ice('disconnected');
    vi.advanceTimersByTime(2000);
    peer.ice('connected');
    vi.advanceTimersByTime(10000);
    expect(events).toEqual(['picture']);

    peer.ice('disconnected');
    vi.advanceTimersByTime(10000);
    expect(events).toEqual(['picture', 'connection-lost']);
  });

  it('reports a failed connection at once', async () => {
    const { peer, events } = await startedSession();
    peer.ice('failed');
    expect(events).toEqual(['connection-lost']);
  });

  it('adds the camera’s network candidates only after its answer has been applied', async () => {
    const { peer, subscriptions } = await startedSession();
    const send = (subscriptions[0] as Sent).callback;

    send({ type: 'answer', answer: 'answer-sdp' });
    send({ type: 'candidate', candidate: { candidate: 'c1', sdpMLineIndex: 0 } });
    await settle();
    expect(peer.candidates).toEqual([]);

    peer.answerDone();
    await settle();
    expect(peer.candidates).toEqual([{ afterAnswer: true }]);
  });

  it('ends everything when stopped, and reports nothing afterwards', async () => {
    const { peer, events, session, unsubscribed } = await startedSession();
    session.stop();
    session.stop();

    expect(peer.closed).toBe(true);
    expect(unsubscribed()).toBe(1);
    peer.ice('failed');
    vi.advanceTimersByTime(LIVE_PICTURE_TIMEOUT_MS);
    expect(events).toEqual([]);
  });
});
