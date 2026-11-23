/**
 * A camera's still picture, fetched again `refreshMs` after the last one arrived.
 *
 * The next picture is loaded out of sight and swapped in only once it has arrived, so the
 * screen never flashes empty between pictures. A picture that will not load is replaced by
 * a plain "No picture" box, never the browser's broken-image icon.
 */

import { useEffect, useState } from 'preact/hooks';
import type { EntityState } from '../../core/home-assistant';
import { pictureUrl, readCamera } from './model';
import { diag } from './diag';

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

  // Load the next picture out of sight, and show it only once it has arrived. The refresh
  // after it is planned only when this load has ended, well or badly: a cloud camera (Ring)
  // can take longer than refreshMs to send a picture, and starting a new load on a fixed
  // beat would throw each one away before it arrived, so none would ever be shown.
  useEffect(() => {
    if (next === null) {
      setFailed(true);
      return;
    }

    let waitTimer: number | null = null;
    const planNext = () => {
      waitTimer = setTimeout(() => setRefreshCount((count) => count + 1), refreshMs);
    };

    const loader = new Image();
    const started = Date.now();
    loader.onload = () => {
      diag('picture loaded in ' + (Date.now() - started) + 'ms, refresh ' + refreshMs);
      setShown(next);
      setFailed(false);
      planNext();
    };
    loader.onerror = () => {
      setFailed(true);
      planNext();
    };
    loader.src = next;

    return () => {
      loader.onload = null;
      loader.onerror = null;
      if (waitTimer !== null) clearTimeout(waitTimer);
    };
  }, [next]);

  // Until a first picture arrives, say what is happening. Once one has, a failed refresh
  // keeps it on screen; the home screen marks everything as out of date when Home Assistant
  // cannot be reached.
  // A camera Home Assistant cannot reach says so, rather than showing an old picture.
  if (!view.isAvailable) return <div class="camera-picture camera-none">Unavailable</div>;
  if (shown === null) {
    return <div class="camera-picture camera-none">{failed ? 'No picture' : 'Loading…'}</div>;
  }
  return <img class="camera-picture" src={shown} alt="" />;
}
