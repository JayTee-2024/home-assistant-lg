/**
 * Tests for spatial-focus.ts: which box the remote's arrows move to.
 */

import { describe, expect, it } from 'vitest';
import { nextInDirection, type Box } from './spatial-focus';

/** A box on a grid of 100×100 cells with a 10-unit gap, like cards on the home screen. */
function cell(column: number, row: number, columns = 1, rows = 1): Box {
  return {
    left: column * 110,
    top: row * 110,
    width: columns * 100 + (columns - 1) * 10,
    height: rows * 100 + (rows - 1) * 10,
  };
}

// Three columns by two rows:
//   0 1 2
//   3 4 5
const grid = [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(1, 1), cell(2, 1)];

function fromGrid(index: number, direction: 'up' | 'down' | 'left' | 'right'): number | null {
  const from = grid[index];
  if (from === undefined) throw new Error('no box ' + index);
  return nextInDirection(from, grid, direction);
}

describe('nextInDirection', () => {
  it('moves to the neighbour in each direction', () => {
    expect(fromGrid(4, 'left')).toBe(3);
    expect(fromGrid(4, 'right')).toBe(5);
    expect(fromGrid(4, 'up')).toBe(1);
    expect(fromGrid(1, 'down')).toBe(4);
  });

  it('gives null when there is nothing that way', () => {
    expect(fromGrid(0, 'left')).toBeNull();
    expect(fromGrid(0, 'up')).toBeNull();
    expect(fromGrid(5, 'right')).toBeNull();
    expect(fromGrid(5, 'down')).toBeNull();
  });

  it('never chooses the box it started from', () => {
    expect(nextInDirection(cell(0, 0), [cell(0, 0)], 'right')).toBeNull();
  });

  it('prefers a box in the same row over a nearer box in another row', () => {
    const from = cell(0, 0);
    const sameRowFarAway = cell(5, 0);
    const otherRowNearby = cell(1, 1);

    expect(nextInDirection(from, [otherRowNearby, sameRowFarAway], 'right')).toBe(1);
  });

  it('takes the nearest box in another row when the row itself has nothing', () => {
    const from = cell(0, 0);

    expect(nextInDirection(from, [cell(3, 1), cell(1, 1)], 'right')).toBe(1);
  });

  it('reaches a wide box from either of the two small boxes under it', () => {
    const wide = cell(0, 0, 2, 1);
    const boxes = [wide, cell(0, 1), cell(1, 1)];

    expect(nextInDirection(cell(0, 1), boxes, 'up')).toBe(0);
    expect(nextInDirection(cell(1, 1), boxes, 'up')).toBe(0);
  });

  it('goes down from a wide box to the small box under its left edge', () => {
    const boxes = [cell(0, 0, 2, 1), cell(0, 1), cell(1, 1)];

    expect(nextInDirection(cell(0, 0, 2, 1), boxes, 'down')).toBe(1);
  });

  it('does not treat a tall box beside it as being below it', () => {
    // A 2×2 box at the left, and a small box at column 2, row 0. Nothing is below the small box.
    const large = cell(0, 0, 2, 2);
    const small = cell(2, 0);

    expect(nextInDirection(small, [large, small], 'down')).toBeNull();
    expect(nextInDirection(small, [large, small], 'left')).toBe(0);
  });

  it('moves between a row of buttons and a field above them', () => {
    const field: Box = { left: 0, top: 0, width: 600, height: 60 };
    const signIn: Box = { left: 0, top: 100, width: 200, height: 60 };
    const advanced: Box = { left: 220, top: 100, width: 200, height: 60 };
    const boxes = [field, signIn, advanced];

    expect(nextInDirection(field, boxes, 'down')).toBe(1);
    expect(nextInDirection(advanced, boxes, 'up')).toBe(0);
    expect(nextInDirection(signIn, boxes, 'right')).toBe(2);
  });
});
