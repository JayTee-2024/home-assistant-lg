/**
 * A camera's panel: the still picture, large, refreshed every 2 seconds.
 */

import type { PanelProps } from '../device-type';
import { CameraPicture } from './CameraPicture';

/** How often the panel's picture is fetched again: quick, since someone is looking at it. */
const PANEL_REFRESH_MS = 2000;

export function CameraPanel({ entity, homeAddress }: PanelProps) {
  return (
    <div class="camera-panel">
      <CameraPicture entity={entity} homeAddress={homeAddress} refreshMs={PANEL_REFRESH_MS} />
    </div>
  );
}
