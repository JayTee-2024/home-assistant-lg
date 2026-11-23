/**
 * Tests for reorganise.ts: where a card being moved goes with each arrow, or under the pointer.
 */

import { describe, expect, it } from 'vitest';
import { cellAt, stepPlace } from './reorganise';

describe('stepPlace', () => {
  it('moves one cell in each direction', () => {
    const at = { page: 0, column: 2, row: 1 };

    expect(stepPlace(at, 'small', 'left', 1)).toEqual({ page: 0, column: 1, row: 1 });
    expect(stepPlace(at, 'small', 'right', 1)).toEqual({ page: 0, column: 3, row: 1 });
    expect(stepPlace(at, 'small', 'up', 1)).toEqual({ page: 0, column: 2, row: 0 });
    expect(stepPlace(at, 'small', 'down', 1)).toEqual({ page: 0, column: 2, row: 2 });
  });

  it("stops at the top and bottom of the grid, allowing for the card's height", () => {
    expect(stepPlace({ page: 0, column: 0, row: 0 }, 'small', 'up', 1)).toEqual({
      page: 0,
      column: 0,
      row: 0,
    });
    expect(stepPlace({ page: 0, column: 0, row: 1 }, 'large', 'down', 1)).toEqual({
      page: 0,
      column: 0,
      row: 1,
    });
  });

  it('carries the card past the right edge to the left of the next page', () => {
    expect(stepPlace({ page: 0, column: 4, row: 1 }, 'wide', 'right', 2)).toEqual({
      page: 1,
      column: 0,
      row: 1,
    });
  });

  it('carries the card past the left edge to the right of the page before, allowing for its width', () => {
    expect(stepPlace({ page: 1, column: 0, row: 0 }, 'wide', 'left', 2)).toEqual({
      page: 0,
      column: 4,
      row: 0,
    });
  });

  it('stops at the left edge of the first page', () => {
    expect(stepPlace({ page: 0, column: 0, row: 0 }, 'small', 'left', 1)).toEqual({
      page: 0,
      column: 0,
      row: 0,
    });
  });

  it('goes past the last page onto a new, empty one, but no further', () => {
    expect(stepPlace({ page: 1, column: 5, row: 0 }, 'small', 'right', 2)).toEqual({
      page: 2,
      column: 0,
      row: 0,
    });
    expect(stepPlace({ page: 2, column: 5, row: 0 }, 'small', 'right', 2)).toEqual({
      page: 2,
      column: 5,
      row: 0,
    });
  });
});

describe('cellAt', () => {
  // A grid 600 wide and 300 tall at (100, 50), with a 30-unit gap: cells 75 wide and 80 tall.
  const grid = { left: 100, top: 50, width: 600, height: 300 };

  it('gives the cell under the pointer', () => {
    expect(cellAt(100, 50, grid, 30)).toEqual({ column: 0, row: 0 });
    expect(cellAt(699, 349, grid, 30)).toEqual({ column: 5, row: 2 });
    expect(cellAt(320, 200, grid, 30)).toEqual({ column: 2, row: 1 });
  });

  it('keeps a point off the grid on its nearest edge cell', () => {
    expect(cellAt(0, 0, grid, 30)).toEqual({ column: 0, row: 0 });
    expect(cellAt(2000, 2000, grid, 30)).toEqual({ column: 5, row: 2 });
  });
});
