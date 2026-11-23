/**
 * Reads a cover (a blind, curtain or shutter) into what the card and panel show.
 *
 * Only covers known to be safe are ever read here: src/core/devices.ts treats every other
 * cover, and its whole device, as unsupported. See SAFE_COVER_KINDS there.
 *
 * Home Assistant: https://developers.home-assistant.io/docs/core/entity/cover
 */

import { hasFeature, isAvailable, readNumber, type EntityState } from '../../core/home-assistant';

const OPEN = 1;
const CLOSE = 2;
const SET_POSITION = 4;
const STOP = 8;

export interface CoverView {
  isAvailable: boolean;
  /** 'open', 'closed', 'opening', 'closing'. */
  state: string;
  /** 0 (closed) to 100 (open). null when the cover does not report it. */
  position: number | null;
  canOpen: boolean;
  canClose: boolean;
  canStop: boolean;
  canSetPosition: boolean;
}

export function readCover(entity: EntityState): CoverView {
  return {
    isAvailable: isAvailable(entity),
    state: entity.state,
    position: readNumber(entity, 'current_position'),
    canOpen: hasFeature(entity, OPEN),
    canClose: hasFeature(entity, CLOSE),
    canStop: hasFeature(entity, STOP),
    canSetPosition: hasFeature(entity, SET_POSITION),
  };
}

/** The state in words: 'Open', 'Closing…'. */
export function coverWords(view: CoverView): string {
  if (view.state === 'opening') return 'Opening…';
  if (view.state === 'closing') return 'Closing…';
  if (view.state === 'closed') return 'Closed';
  if (view.state === 'open') return 'Open';
  return view.state.charAt(0).toUpperCase() + view.state.slice(1);
}
