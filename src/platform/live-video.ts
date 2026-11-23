/**
 * Live camera video over WebRTC, through Home Assistant.
 *
 * Home Assistant passes the WebRTC "call" between this TV and the camera (for a Ring
 * doorbell, Ring's servers). The steps:
 *   1. Make a peer connection and an offer for audio and video only.
 *   2. Wait until the TV has found its network addresses (ICE "gathering"), so the offer
 *      carries them and nothing has to be sent afterwards.
 *   3. Send the offer with `camera/webrtc/offer`. Home Assistant answers with events:
 *      session, answer, candidate (the camera's addresses), or error.
 *   4. The video arrives as a stream once the two sides have connected.
 *
 * What the LG C9 (webOS 4.5, Chromium 53) needs, found with a test on the TV:
 *   - the peer connection is only there under its old name, webkitRTCPeerConnection;
 *   - the stream arrives through the old `onaddstream`, not `ontrack`;
 *   - the offer must not include a data channel: the camera answers with audio and video
 *     only, and the TV refuses an answer with fewer channels than its offer.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/camera#webrtc-streams
 */

import type { Connection } from 'home-assistant-js-websocket';
import {
  LIVE_PICTURE_TIMEOUT_MS,
  type LiveEvent,
  type LiveVideo,
  type LiveVideoHandlers,
  type LiveVideoSource,
} from '../core/live-video';

/** How long to wait for the TV's network addresses before sending the offer anyway. */
const GATHERING_TIMEOUT_MS = 3000;

/** The parts of Chromium 53's peer connection this file uses. */
interface PeerConnection {
  iceConnectionState: string;
  iceGatheringState: string;
  localDescription: { sdp: string } | null;
  oniceconnectionstatechange: (() => void) | null;
  onicegatheringstatechange: (() => void) | null;
  onaddstream: ((event: { stream: MediaStream }) => void) | null;
  createOffer(options: { offerToReceiveAudio: boolean; offerToReceiveVideo: boolean }): Promise<{
    type: string;
    sdp: string;
  }>;
  setLocalDescription(description: { type: string; sdp: string }): Promise<void>;
  setRemoteDescription(description: unknown): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  close(): void;
}

type PeerConnectionClass = new (configuration: unknown) => PeerConnection;

/** The events Home Assistant sends on the `camera/webrtc/offer` subscription. */
type OfferEvent =
  | { type: 'session'; session_id: string }
  | { type: 'answer'; answer: string }
  | { type: 'candidate'; candidate: unknown }
  | { type: 'error'; code: string; message: string };

export function createLiveVideoSource(connection: Connection): LiveVideoSource {
  return {
    isSupported(entityId) {
      return connection
        .sendMessagePromise<{ frontend_stream_types?: string[] }>({
          type: 'camera/capabilities',
          entity_id: entityId,
        })
        .then(
          (capabilities) =>
            findPeerConnectionClass() !== null &&
            Array.isArray(capabilities.frontend_stream_types) &&
            capabilities.frontend_stream_types.indexOf('web_rtc') !== -1,
          () => false,
        );
    },

    start(entityId, handlers) {
      return startSession(connection, entityId, handlers);
    },
  };
}

function startSession(
  connection: Connection,
  entityId: string,
  handlers: LiveVideoHandlers,
): LiveVideo {
  let isStopped = false;
  let peer: PeerConnection | null = null;
  let unsubscribe: (() => Promise<void>) | null = null;
  let hasPicture = false;

  // After stop(), nothing more is reported: the view has moved on.
  const report = (event: LiveEvent) => {
    if (!isStopped) handlers.onEvent(event);
  };

  const pictureTimer = setTimeout(() => {
    if (!hasPicture) report('timed-out');
  }, LIVE_PICTURE_TIMEOUT_MS);

  const PeerConnectionClass = findPeerConnectionClass();
  if (PeerConnectionClass === null) {
    // Reported after start() returns, so the caller has its LiveVideo first.
    setTimeout(() => report('refused'), 0);
  } else {
    connection
      .sendMessagePromise<{ configuration?: unknown }>({
        type: 'camera/webrtc/get_client_config',
        entity_id: entityId,
      })
      .then((config) => {
        if (isStopped) throw new Error('stopped');
        peer = new PeerConnectionClass(config.configuration ?? {});
        watchPeer(peer);
        return peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      })
      .then((offer) => (peer as PeerConnection).setLocalDescription(offer))
      .then(() => gathered(peer as PeerConnection))
      .then(() => {
        if (isStopped) throw new Error('stopped');
        const sdp = (peer as PeerConnection).localDescription;
        return connection.subscribeMessage<OfferEvent>(onOfferEvent, {
          type: 'camera/webrtc/offer',
          entity_id: entityId,
          offer: sdp === null ? '' : sdp.sdp,
        });
      })
      .then((stopSubscription) => {
        unsubscribe = stopSubscription;
        // stop() was called while the subscription was being made: end it now.
        if (isStopped) endSubscription();
      })
      .catch(() => report('refused'));
  }

  function watchPeer(connected: PeerConnection) {
    connected.onaddstream = (event) => {
      if (isStopped) return;
      hasPicture = true;
      handlers.onStream(event.stream);
      report('picture');
    };
    connected.oniceconnectionstatechange = () => {
      const state = connected.iceConnectionState;
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        report('connection-lost');
      }
    };
  }

  function onOfferEvent(event: OfferEvent) {
    if (isStopped || peer === null) return;
    const w = window as unknown as {
      RTCSessionDescription: new (init: unknown) => unknown;
      RTCIceCandidate: new (init: unknown) => unknown;
    };
    if (event.type === 'answer') {
      peer
        .setRemoteDescription(new w.RTCSessionDescription({ type: 'answer', sdp: event.answer }))
        .catch(() => report('refused'));
    } else if (event.type === 'candidate') {
      // A candidate the TV cannot use is not fatal: another one may connect.
      peer.addIceCandidate(new w.RTCIceCandidate(event.candidate)).catch(() => undefined);
    } else if (event.type === 'error') {
      report('refused');
    }
  }

  function endSubscription() {
    if (unsubscribe === null) return;
    const stopSubscription = unsubscribe;
    unsubscribe = null;
    // The socket may already be gone; there is nothing left to end then.
    stopSubscription().catch(() => undefined);
  }

  return {
    stop() {
      if (isStopped) return;
      isStopped = true;
      clearTimeout(pictureTimer);
      endSubscription();
      if (peer !== null) {
        peer.onaddstream = null;
        peer.oniceconnectionstatechange = null;
        peer.close();
        peer = null;
      }
    },
  };
}

/** The TV's peer connection class, under whichever name this browser has it. */
function findPeerConnectionClass(): PeerConnectionClass | null {
  const w = window as unknown as {
    RTCPeerConnection?: PeerConnectionClass;
    webkitRTCPeerConnection?: PeerConnectionClass;
  };
  return w.RTCPeerConnection ?? w.webkitRTCPeerConnection ?? null;
}

/** Resolves once the TV has found its network addresses, or after GATHERING_TIMEOUT_MS. */
function gathered(peer: PeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (peer.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, GATHERING_TIMEOUT_MS);
    peer.onicegatheringstatechange = () => {
      if (peer.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolve();
      }
    };
  });
}
