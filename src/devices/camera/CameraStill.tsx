/**
 * A camera's still picture, as the card and the full-screen view show it: Home Assistant's
 * picture (CameraPicture), with a small label for cameras whose picture is a recording
 * rather than a current view (see picture-updates.ts):
 *
 *   "Last recording"      the picture is the camera's last recorded event
 *   "Updating picture…"   live view has just stopped, and Ring is still processing its recording
 */

import { useEffect, useState } from 'preact/hooks';
import type { EntityState } from '../../core/home-assistant';
import { CameraPicture } from './CameraPicture';
import { readCamera } from './model';
import {
  labelFor,
  liveStoppedAt,
  onPictureUpdatesChanged,
  PICTURE_UPDATE_WAIT_MS,
} from './picture-updates';

export interface CameraStillProps {
  entity: EntityState;
  homeAddress: string;
  refreshMs: number;
}

export function CameraStill({ entity, homeAddress, refreshMs }: CameraStillProps) {
  const entityId = entity.entity_id;
  const [stopped, setStopped] = useState(() => liveStoppedAt(entityId));
  const [now, setNow] = useState(() => Date.now());

  useEffect(
    () =>
      onPictureUpdatesChanged(() => {
        setStopped(liveStoppedAt(entityId));
        setNow(Date.now());
      }),
    [entityId],
  );

  const label = labelFor(readCamera(entity).recordingId, stopped, now);

  // While waiting, look again when the wait runs out, so the label changes back by itself.
  useEffect(() => {
    if (label !== 'Updating picture…' || stopped === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), stopped.at + PICTURE_UPDATE_WAIT_MS - now);
    return () => clearTimeout(timer);
  }, [label, stopped, now]);

  return (
    <div class="camera-still">
      <CameraPicture entity={entity} homeAddress={homeAddress} refreshMs={refreshMs} />
      {label !== null && <div class="camera-label">{label}</div>}
    </div>
  );
}
