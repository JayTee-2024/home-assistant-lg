/**
 * The inside of a camera's card: its still picture, refreshed every 10 seconds, or the frame
 * last seen in live video (see CameraStill.tsx).
 */

import type { CardProps } from '../device-type';
import { CameraStill } from './CameraStill';

/** How often a card's picture is fetched again. Slow, because a card is only a glance. */
const CARD_REFRESH_MS = 10000;

export function CameraCard({ entity, homeAddress }: CardProps) {
  return (
    <div class="face face-camera">
      <CameraStill entity={entity} homeAddress={homeAddress} refreshMs={CARD_REFRESH_MS} />
    </div>
  );
}
