/**
 * Where the cards go: a grid of 6 columns by 3 rows, repeated over as many pages as needed.
 *
 * A layout is just a list of cards, each with its page, its top-left cell and its size.
 * Pages are not stored: there are as many as the highest page number in use.
 *
 * Every function here returns a new layout and leaves the one it was given untouched, so
 * the app can keep the previous layout (to undo a move, or to compare).
 *
 * This file does not draw anything and does not save anything. Drawing is
 * src/screens/home; saving is saved-state.ts.
 */

import type { CardSize } from './part-type';

export const GRID_COLUMNS = 6;
export const GRID_ROWS = 3;

/** One card's place. `column` and `row` are its top-left cell, counted from 0. */
export interface CardPlace {
  deviceId: string;
  page: number;
  column: number;
  row: number;
  size: CardSize;
}

export interface Layout {
  cards: CardPlace[];
}

export const EMPTY_LAYOUT: Layout = { cards: [] };

/** How many grid cells a card of each size covers. */
export function cellsOf(size: CardSize): { columns: number; rows: number } {
  if (size === 'large') return { columns: 2, rows: 2 };
  if (size === 'wide') return { columns: 2, rows: 1 };
  return { columns: 1, rows: 1 };
}

/** The number of pages: up to the last page that has a card, and never fewer than one. */
export function pageCount(layout: Layout): number {
  let highest = 0;
  for (const card of layout.cards) {
    if (card.page > highest) highest = card.page;
  }
  return highest + 1;
}

export function cardsOnPage(layout: Layout, page: number): CardPlace[] {
  return layout.cards.filter((card) => card.page === page);
}

export function hasCard(layout: Layout, deviceId: string): boolean {
  return layout.cards.some((card) => card.deviceId === deviceId);
}

/**
 * Adds a card in the first free place that fits it: pages in order, and on each page row
 * by row, left to right. When no page has room, the card starts a new page.
 * A device that already has a card is left where it is.
 */
export function addCard(layout: Layout, deviceId: string, size: CardSize): Layout {
  if (hasCard(layout, deviceId)) return layout;

  const pages = pageCount(layout);
  for (let page = 0; page < pages; page++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let column = 0; column < GRID_COLUMNS; column++) {
        const place: CardPlace = { deviceId, page, column, row, size };
        if (fits(layout, place)) {
          return { cards: layout.cards.concat([place]) };
        }
      }
    }
  }

  return { cards: layout.cards.concat([{ deviceId, page: pages, column: 0, row: 0, size }]) };
}

/** Removes a device's card. The other cards stay where they are, leaving a gap. */
export function removeCard(layout: Layout, deviceId: string): Layout {
  if (!hasCard(layout, deviceId)) return layout;
  return { cards: layout.cards.filter((card) => card.deviceId !== deviceId) };
}

/**
 * Brings a saved layout up to date with the devices as they are now.
 *
 * A device's card size can change between runs (say its camera was removed in Home
 * Assistant). Such a card is taken out and added again at its new size. A card whose
 * device is unknown (`sizeOf` gives null) is kept exactly as it is, so the home screen can
 * say what happened to it.
 *
 * Gives back the same layout object when nothing needed changing.
 */
export function withCurrentSizes(
  layout: Layout,
  sizeOf: (deviceId: string) => CardSize | null,
): Layout {
  let updated = layout;

  for (const card of layout.cards) {
    const size = sizeOf(card.deviceId);
    if (size === null || size === card.size) continue;

    updated = addCard(removeCard(updated, card.deviceId), card.deviceId, size);
  }

  return updated;
}

/** True when `place` lies wholly on the grid and covers no cell another card covers. */
function fits(layout: Layout, place: CardPlace): boolean {
  const size = cellsOf(place.size);
  if (place.column < 0 || place.row < 0) return false;
  if (place.column + size.columns > GRID_COLUMNS) return false;
  if (place.row + size.rows > GRID_ROWS) return false;

  for (const other of layout.cards) {
    if (other.page === place.page && overlaps(other, place)) return false;
  }
  return true;
}

/** True when two cards on the same page share at least one cell. */
function overlaps(a: CardPlace, b: CardPlace): boolean {
  const sizeA = cellsOf(a.size);
  const sizeB = cellsOf(b.size);

  const apartSideways =
    a.column + sizeA.columns <= b.column || b.column + sizeB.columns <= a.column;
  const apartUpAndDown = a.row + sizeA.rows <= b.row || b.row + sizeB.rows <= a.row;
  return !apartSideways && !apartUpAndDown;
}

/** A place on the grid: a page, and the top-left cell a card would cover. */
export interface GridPlace {
  page: number;
  column: number;
  row: number;
}

/**
 * Moves a card, for the "Reorganise layout" mode. Gives the new layout, or null when the
 * move is refused and nothing changes.
 *
 *   - The card moves when its new cells are on the grid and free. Its own old cells count
 *     as free, so a wide card can shift sideways by one.
 *   - Dropped exactly on another card of the same size, the two swap places.
 *   - Anything else (part of another card in the way, or off the grid) is refused.
 *
 * The page may be one past the last, which starts a new page.
 */
export function moveCard(layout: Layout, deviceId: string, to: GridPlace): Layout | null {
  const card = layout.cards.filter((item) => item.deviceId === deviceId)[0];
  if (card === undefined || to.page < 0) return null;

  const moved: CardPlace = {
    deviceId,
    page: to.page,
    column: to.column,
    row: to.row,
    size: card.size,
  };
  const others: Layout = removeCard(layout, deviceId);
  if (fits(others, moved)) {
    return { cards: layout.cards.map((item) => (item.deviceId === deviceId ? moved : item)) };
  }

  // A swap: exactly one card of the same size sits exactly at the place.
  const atPlace = others.cards.filter(
    (item) =>
      item.page === to.page &&
      item.column === to.column &&
      item.row === to.row &&
      item.size === card.size,
  )[0];
  if (atPlace === undefined) return null;

  const swappedOut: CardPlace = { ...atPlace, page: card.page, column: card.column, row: card.row };
  const swapped = layout.cards.map((item) => {
    if (item.deviceId === deviceId) return moved;
    if (item.deviceId === atPlace.deviceId) return swappedOut;
    return item;
  });
  return { cards: swapped };
}

/**
 * Drops pages that have no cards and numbers the later pages down to close the gap. Every
 * card keeps its place on its own page. Gives back the same layout when no page is empty.
 */
export function removeEmptyPages(layout: Layout): Layout {
  const used: number[] = [];
  for (const card of layout.cards) {
    if (used.indexOf(card.page) === -1) used.push(card.page);
  }
  used.sort((a, b) => a - b);

  const isCompact = used.every((page, index) => page === index);
  if (isCompact) return layout;

  return { cards: layout.cards.map((card) => ({ ...card, page: used.indexOf(card.page) })) };
}
