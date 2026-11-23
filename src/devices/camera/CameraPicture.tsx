/**
 * A camera's still picture, fetched again every `refreshMs`.
 *
 * The next picture is loaded out of sight and swapped in only once it has arrived, so the
 * screen never flashes empty between pictures. A picture that will not load is replaced by
 * a plain "No picture" box, never the browser's broken-image icon.
 */

import { useEffect, useState } from 'preact/hooks';
import type { EntityState } from '../../core/home-assistant';
import { pictureUrl, readCamera } from './model';

export interface CameraPictureProps {
  entity: EntityState;
  homeAddress: string;
  refreshMs: number;
}

export function CameraPicture({ entity, homeAddress, refreshMs }: CameraPictureProps) {
  const [refreshCount, setRefreshCount] = useState(0);
  const [shown, setShown] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const view = readCamera(entity);
  const next = pictureUrl(homeAddress, view.picturePath, refreshCount);

  // Count up every refreshMs, which changes `next` and so fetches a new picture.
  useEffect(() => {
    const timer = setInterval(() => setRefreshCount((count) => count + 1), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  // Load the next picture out of sight; show it only once it has arrived.
  useEffect(() => {
    if (next === null) {
      setFailed(true);
      return;
    }
    const loader = new Image();
    loader.onload = () => {
      setShown(next);
      setFailed(false);
    };
    loader.onerror = () => setFailed(true);
    loader.src = next;
    return () => {
      loader.onload = null;
      loader.onerror = null;
    };
  }, [next]);

  // Until a first picture arrives, say what is happening. Once one has, a failed refresh
  // keeps it on screen; the home screen marks everything as out of date when Home Assistant
  // cannot be reached.
  if (shown === null) {
    return <div class="camera-picture camera-none">{failed ? 'No picture' : 'Loading…'}</div>;
  }
  return <img class="camera-picture" src={shown} alt="" />;
}
