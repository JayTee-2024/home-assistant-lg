/**
 * A camera's still picture, as the card and the full-screen view show it: either Home
 * Assistant's picture (CameraPicture), or the frame saved from live video (see
 * live-frames.ts), with a small label saying which.
 *
 *   "Live at 16:42"    the saved frame from watching live
 *   "Last recording"   Home Assistant's picture, for cameras where it is not a current view
 *   (no label)         Home Assistant's picture, which is current
 */

import { useEffect, useState } from 'preact/hooks';
import type { EntityState } from '../../core/home-assistant';
import { CameraPicture } from './CameraPicture';
import { liveFrameFor, liveTimeLabel, onLiveFramesChanged, stillFor } from './live-frames';
import { readCamera } from './model';

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

  if (still.kind === 'live-frame') {
    return (
      <div class="camera-still">
        <img class="camera-picture" src={still.frame.url} alt="" />
        <div class="camera-label">{liveTimeLabel(still.frame.takenAt)}</div>
      </div>
    );
  }

  return (
    <div class="camera-still">
      <CameraPicture entity={entity} homeAddress={homeAddress} refreshMs={refreshMs} />
      {still.kind === 'recording' && <div class="camera-label">Last recording</div>}
    </div>
  );
}
