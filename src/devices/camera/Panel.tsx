/**
 * A camera's full-screen view (the camera type asks for `panelLayout: 'full-screen'`).
 *
 * It shows the still picture, refreshed every 2 seconds, filling the screen's height. Where
 * Home Assistant can show the camera live, a **Watch live** button starts live video, which
 * replaces the picture once it arrives. Live video starts with the sound off. Closing the view
 * ends the live session.
 *
 * When live video stops, a camera whose picture is its last recording (Ring) labels it
 * "Updating picture…" until Ring's recording of the live view arrives (see picture-updates.ts).
 *
 * Live video is only started on request: each live view wakes a Ring doorbell and starts a
 * session with Ring. The session's states are in src/core/live-video.ts; the WebRTC work
 * behind `liveVideo` is in src/platform/live-video.ts.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  nextLiveState,
  type LiveEvent,
  type LiveState,
  type LiveVideo,
} from '../../core/live-video';
import type { PanelProps } from '../device-type';
import { CameraStill } from './CameraStill';
import { noteLiveStopped } from './picture-updates';
import { cameraControls, readCamera } from './model';

/** How often the still picture is fetched again: quick, since someone is looking at it. */
const PANEL_REFRESH_MS = 2000;

export function CameraPanel({ entity, homeAddress, liveVideo }: PanelProps) {
  const entityId = entity.entity_id;
  const [canGoLive, setCanGoLive] = useState(false);
  const [state, setStateNow] = useState<LiveState>('idle');
  // The latest state, for the session's handlers, which outlive the render they were made in.
  const stateNow = useRef<LiveState>('idle');
  const move = (event: LiveEvent) => {
    const next = nextLiveState(stateNow.current, event);
    stateNow.current = next;
    setStateNow(next);
    return next;
  };
  const [isMuted, setIsMuted] = useState(true);
  const session = useRef<LiveVideo | null>(null);
  // The live stream, so stopping can end its tracks (see stopSession).
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const liveButton = useRef<HTMLButtonElement>(null);

  // Ask once whether this camera can go live. Until the answer comes, there is no button.
  useEffect(() => {
    let isOpen = true;
    liveVideo.isSupported(entityId).then((supported) => {
      if (isOpen) setCanGoLive(supported);
    });
    return () => {
      isOpen = false;
    };
  }, [entityId]);

  // The button appears after the view has opened, so give it the focus then.
  useEffect(() => {
    if (canGoLive && liveButton.current !== null) liveButton.current.focus();
  }, [canGoLive]);

  // Closing the view ends any live session. So does leaving the app (the Home button, or
  // switching input), so doorbell sound cannot carry on in the background.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden || session.current === null) return;
      stopSession();
      move('stop');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopSession();
    };
  }, []);

  // When a session ends, the Sound button disappears. If it had the focus, the focus would be
  // lost and OK would do nothing, so put it on the live button instead.
  useEffect(() => {
    const focused = document.activeElement;
    const isLost = focused === null || focused === document.body;
    if (isLost && liveButton.current !== null) liveButton.current.focus();
  }, [state]);

  // The latest recording id, for noting when live view stops (see picture-updates.ts).
  const recordingNow = useRef<string | null>(null);
  recordingNow.current = readCamera(entity).recordingId;

  function stopSession() {
    const element = video.current;
    // A camera whose picture is its last recording (Ring) records the live view too: its
    // picture says "Updating picture…" until that recording arrives.
    const recordingId = recordingNow.current;
    // 'ended' counts too: Ring cut a session that was playing.
    const wasPlaying = stateNow.current === 'playing' || stateNow.current === 'ended';
    if (wasPlaying && recordingId !== null) {
      noteLiveStopped(entityId, { at: Date.now(), recordingId });
    }
    if (session.current !== null) {
      session.current.stop();
      session.current = null;
    }
    // End the stream's tracks and empty the player. On the LG C9 the video is drawn by a
    // hardware decoder, and the screen stays black over it until the decoder is shut down.
    // Without this it only shut down when the browser next cleared away unused objects,
    // 20 seconds to a minute later.
    if (stream.current !== null) {
      stream.current.getTracks().forEach((track) => track.stop());
      stream.current = null;
    }
    if (element !== null) {
      element.pause();
      (element as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = null;
      element.removeAttribute('src');
      element.load();
    }
  }

  function startSession() {
    // Never two sessions at once: end any earlier one first.
    stopSession();
    move('start');
    let thisSession: LiveVideo | null = null;
    const isCurrent = () => session.current === thisSession;
    thisSession = liveVideo.start(entityId, {
      onStream(arrived) {
        if (!isCurrent() || video.current === null) return;
        stream.current = arrived;
        (video.current as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = arrived;
        video.current.muted = isMutedNow.current;
        // play() rejects if the session is stopped before playback starts. Nothing to do then.
        video.current.play().catch(() => undefined);
      },
      onEvent(event: LiveEvent) {
        if (!isCurrent()) return;
        const next = move(event);
        // A session that has broken is finished: let go of it.
        if (next === 'ended' || next === 'failed') stopSession();
      },
    });
    session.current = thisSession;
  }

  // The latest mute setting, for the stream handler, which outlives the render it was made in.
  const isMutedNow = useRef(isMuted);
  isMutedNow.current = isMuted;

  function toggleSound() {
    const muted = !isMuted;
    setIsMuted(muted);
    if (video.current !== null) video.current.muted = muted;
  }

  function pressLive() {
    if (stateNow.current === 'connecting' || stateNow.current === 'playing') {
      stopSession();
      move('stop');
    } else {
      startSession();
    }
  }

  const controls = cameraControls(state, isMuted);

  return (
    <div class="camera-view">
      <CameraStill entity={entity} homeAddress={homeAddress} refreshMs={PANEL_REFRESH_MS} />
      {/* In the page only while live: on the TV a video player left in the page keeps the
          screen black for a while after it stops. Shown only once the picture plays. */}
      {(state === 'connecting' || state === 'playing') && (
        <video
          ref={video}
          class={'camera-live' + (state === 'playing' ? '' : ' camera-live-hidden')}
          autoPlay
          muted
        />
      )}

      {canGoLive && (
        <div class="camera-actions">
          <button ref={liveButton} class="button button-main" onClick={pressLive}>
            {controls.liveLabel}
          </button>
          {controls.soundLabel !== null && (
            <button class="button button-outline" onClick={toggleSound}>
              {controls.soundLabel}
            </button>
          )}
        </div>
      )}

      {controls.status !== null && <div class="camera-status">{controls.status}</div>}
    </div>
  );
}
