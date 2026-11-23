/**
 * The rules of the "Reorganise layout" mode: where a card being moved goes with each
 * arrow, and which cell is under the pointer when it is dragged.
 *
 * Whether the card may be dropped there is layout.ts's moveCard. Drawing is
 * src/screens/reorganise.
 */

import { cellsOf, GRID_COLUMNS, GRID_ROWS, type GridPlace } from './layout';
import type { CardSize } from './part-type';
import type { Box, Direction } from './spatial-focus';

/**
 * The place one arrow press takes a card being moved.
 *   - Up and Down stop at the top and bottom of the grid.
 *   - Right past the edge goes to the left of the next page, and Left past the edge to the
 *     right of the page before.
 *   - The page after the last one may be used (it becomes a new page), but not any further.
 * `pageCount` is the number of pages the layout has now.
 */
export function stepPlace(
  place: GridPlace,
  size: CardSize,
  direction: Direction,
  pageCount: number,
): GridPlace {
  const cells = cellsOf(size);
  const lastColumn = GRID_COLUMNS - cells.columns;
  const lastRow = GRID_ROWS - cells.rows;
  const lastPage = pageCount;

  if (direction === 'up') return { ...place, row: Math.max(0, place.row - 1) };
  if (direction === 'down') return { ...place, row: Math.min(lastRow, place.row + 1) };

  if (direction === 'left') {
    if (place.column > 0) return { ...place, column: place.column - 1 };
    if (place.page === 0) return place;
    return { ...place, page: place.page - 1, column: lastColumn };
  }

  if (place.column < lastColumn) return { ...place, column: place.column + 1 };
  if (place.page >= lastPage) return place;
  return { ...place, page: place.page + 1, column: 0 };
}

/**
 * The grid cell under a point, for dragging with the pointer. `grid` is where the grid is
 * drawn and `gap` the space between cells, both in the same units as the point. A point
 * off the grid gives the nearest cell on its edge.
 */
export function cellAt(
  x: number,
  y: number,
  grid: Box,
  gap: number,
): { column: number; row: number } {
  const columnWidth = (grid.width + gap) / GRID_COLUMNS;
  const rowHeight = (grid.height + gap) / GRID_ROWS;

  const column = Math.floor((x - grid.left) / columnWidth);
  const row = Math.floor((y - grid.top) / rowHeight);

  return {
    column: Math.max(0, Math.min(GRID_COLUMNS - 1, column)),
    row: Math.max(0, Math.min(GRID_ROWS - 1, row)),
  };
}
