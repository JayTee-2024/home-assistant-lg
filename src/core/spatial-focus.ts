/**
 * Decides which thing on screen the remote's arrows move to.
 *
 * A TV app is driven by Up, Down, Left and Right. The TV's browser does not move focus by
 * itself (found on the LG C9, see docs/tv-proof-results.md), so the app does it, and it
 * does it the same way on every screen: by position. Each thing that can take focus is a
 * box, and an arrow moves to the nearest box lying in that direction.
 *
 * This file is only the geometry. Reading the boxes off the screen and moving the real
 * focus is src/screens/shared/focus.ts.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

/** A rectangle on screen. Any unit works as long as every box uses the same one. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Boxes that touch or overlap by less than this still count as lying beyond each other. */
const TOLERANCE = 1;

/**
 * The index in `candidates` of the box to move to from `from`, or null when nothing lies
 * that way.
 *
 * A box qualifies when the whole of it lies beyond `from` in the direction. Among those:
 *   1. boxes in line with `from` win (the same row for Left and Right, the same column
 *      for Up and Down);
 *   2. then the nearest along the direction;
 *   3. then the nearest across it;
 *   4. then the earliest in the list.
 */
export function nextInDirection(from: Box, candidates: Box[], direction: Direction): number | null {
  let best: { index: number; inLine: boolean; along: number; across: number } | null = null;

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    if (candidate === undefined) continue;

    const along = gapAlong(from, candidate, direction);
    if (along < -TOLERANCE) continue;

    const found = {
      index,
      inLine: isInLine(from, candidate, direction),
      along,
      across: distanceAcross(from, candidate, direction),
    };
    if (best === null || isBetter(found, best)) best = found;
  }

  return best === null ? null : best.index;
}

function isBetter(
  a: { inLine: boolean; along: number; across: number },
  b: { inLine: boolean; along: number; across: number },
): boolean {
  if (a.inLine !== b.inLine) return a.inLine;
  if (a.along !== b.along) return a.along < b.along;
  return a.across < b.across;
}

/**
 * The gap between `from` and `to` measured in the direction of travel. Negative when `to`
 * does not lie wholly beyond `from` that way, which also covers `to` being `from` itself.
 */
function gapAlong(from: Box, to: Box, direction: Direction): number {
  if (direction === 'right') return to.left - (from.left + from.width);
  if (direction === 'left') return from.left - (to.left + to.width);
  if (direction === 'down') return to.top - (from.top + from.height);
  return from.top - (to.top + to.height);
}

/** True when the two boxes share some of the same row (for Left and Right) or column (for Up and Down). */
function isInLine(from: Box, to: Box, direction: Direction): boolean {
  if (direction === 'left' || direction === 'right') {
    return to.top < from.top + from.height && from.top < to.top + to.height;
  }
  return to.left < from.left + from.width && from.left < to.left + to.width;
}

/** How far apart the two boxes' centres are, measured across the direction of travel. */
function distanceAcross(from: Box, to: Box, direction: Direction): number {
  if (direction === 'left' || direction === 'right') {
    return Math.abs(to.top + to.height / 2 - (from.top + from.height / 2));
  }
  return Math.abs(to.left + to.width / 2 - (from.left + from.width / 2));
}
