/**
 * The inside of a media player's card: what is playing, and who by.
 */

import type { CardProps } from '../device-type';
import { readableName, UNAVAILABLE } from '../shared/predict';
import { readMediaPlayer } from './model';

export function MediaPlayerCard({ entity }: CardProps) {
  const view = readMediaPlayer(entity);
  if (!view.isAvailable) {
    return (
      <div class="face">
        <div class="face-state">{UNAVAILABLE}</div>
      </div>
    );
  }

  return (
    <div class="face face-media">
      <div class="face-state">{view.title ?? readableName(view.state)}</div>
      {view.artist !== null && <div class="face-detail">{view.artist}</div>}
      {view.title !== null && <div class="face-detail">{readableName(view.state)}</div>}
    </div>
  );
}
