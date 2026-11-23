/**
 * A camera's still picture, as the card and the full-screen view show it: either Home
 * Assistant's picture (CameraPicture), or the frame saved from live video (see
 * live-frames.ts), with a small label saying which.
 *
 *   "Live at 16:42"    the saved frame from watching live
 *   "Last recording"   Home Assistant's picture, for cameras where it is not a current view
 *   (no label)         Home Assistant's picture, which is current
 *
 * Home Assistant's picture stays loaded underneath the saved frame, so when a newer
 * recording replaces the frame there is no wait on a black screen: the picture is already
 * there, and refreshes in place.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { EntityState } from '../../core/home-assistant';
import { CameraPicture } from './CameraPicture';
import {
  liveFrameFor,
  liveTimeLabel,
  onLiveFramesChanged,
  stillFor,
  type LiveFrame,
} from './live-frames';
import { readCamera } from './model';
import { diag } from './diag';

export interface CameraStillProps {
  entity: EntityState;
  homeAddress: string;
  refreshMs: number;
}

export function CameraStill({ entity, homeAddress, refreshMs }: CameraStillProps) {
  const entityId = entity.entity_id;
  const [frame, setFrame] = useState(() => liveFrameFor(entityId));

  // A frame saved while this picture is showing (the view saves one as live video stops).
  useEffect(() => onLiveFramesChanged(() => setFrame(liveFrameFor(entityId))), [entityId]);

  const still = stillFor(readCamera(entity).recordingId, frame);

  return (
    <div class="camera-still">
      <CameraPicture entity={entity} homeAddress={homeAddress} refreshMs={refreshMs} />
      {still.kind === 'live-frame' && <FrameCanvas frame={still.frame} />}
      {still.kind === 'live-frame' && (
        <div class="camera-label">{liveTimeLabel(still.frame.takenAt)}</div>
      )}
      {still.kind === 'recording' && <div class="camera-label">Last recording</div>}
    </div>
  );
}

/** Draws the saved frame onto a canvas of the same size; CSS fits it to the space. */
function FrameCanvas({ frame }: { frame: LiveFrame }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const target = canvas.current;
    if (target === null) return;
    target.width = frame.image.width;
    target.height = frame.image.height;
    const drawing = target.getContext('2d');
    if (drawing !== null) drawing.drawImage(frame.image, 0, 0);
    diag('FrameCanvas drawn ' + target.width + 'x' + target.height + ' shown ' + target.clientWidth + 'x' + target.clientHeight);
  }, [frame]);

  return <canvas ref={canvas} class="camera-picture camera-frame" />;
}
