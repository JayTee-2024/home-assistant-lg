/**
 * A camera's full-screen view (the camera type asks for `panelLayout: 'full-screen'`).
 *
 * It shows the still picture, refreshed every 2 seconds, filling the screen's height. Where
 * Home Assistant can show the camera live, a **Watch live** button starts live video, which
 * replaces the picture once it arrives. Live video starts with the sound off. Closing the view
 * ends the live session.
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
import { CameraPicture } from './CameraPicture';
import { cameraControls } from './model';

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

  // Closing the view ends any live session.
  useEffect(() => () => stopSession(), []);

  function stopSession() {
    if (session.current !== null) {
      session.current.stop();
      session.current = null;
    }
    const element = video.current;
    if (element !== null) {
      element.pause();
      // Let go of the stream, so the TV stops decoding it.
      (element as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = null;
    }
  }

  function startSession() {
    // Never two sessions at once: end any earlier one first.
    stopSession();
    move('start');
    let thisSession: LiveVideo | null = null;
    const isCurrent = () => session.current === thisSession;
    thisSession = liveVideo.start(entityId, {
      onStream(stream) {
        if (!isCurrent() || video.current === null) return;
        (video.current as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = stream;
        video.current.muted = isMutedNow.current;
        void video.current.play();
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
      <CameraPicture entity={entity} homeAddress={homeAddress} refreshMs={PANEL_REFRESH_MS} />
      {/* Always in the page, so the stream has somewhere to go; shown only once it plays. */}
      <video
        ref={video}
        class={'camera-live' + (state === 'playing' ? '' : ' camera-live-hidden')}
        autoPlay
        muted
      />

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
