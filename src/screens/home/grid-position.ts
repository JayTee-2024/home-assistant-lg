/**
 * Where a card sits on the grid, as CSS lengths. Shared by the home screen and the
 * reorganise mode, which both place cards by their grid coordinates.
 *
 * Chromium 53 has no CSS grid, so each card is placed with absolute positioning. For a grid
 * of N columns with gap G, one column plus its gap is (100% + G) / N wide, so a card starting
 * at column C and covering K columns has
 *     left:  C * (100% + G) / N
 *     width: K * (100% + G) / N - G
 * and the same for rows.
 */

/** The space between cards. Must match the 1.5rem the reorganise mode uses for dragging. */
const GAP = '1.5rem';

/** How far along the grid a column or row starts. */
export function along(index: number, count: number): string {
  return 'calc(' + index + ' * (100% + ' + GAP + ') / ' + count + ')';
}

/** How wide or tall a card covering `cells` cells is: the cells plus the gaps between them. */
export function span(cells: number, count: number): string {
  return 'calc(' + cells + ' * (100% + ' + GAP + ') / ' + count + ' - ' + GAP + ')';
}
