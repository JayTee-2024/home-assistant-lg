/**
 * Tests for layout.ts: where cards go on the paged grid.
 */

import { describe, expect, it } from 'vitest';
import {
  addCard,
  cardsOnPage,
  cellsOf,
  EMPTY_LAYOUT,
  hasCard,
  pageCount,
  removeCard,
  withCurrentSizes,
  type CardPlace,
  type Layout,
} from './layout';
import type { CardSize } from './part-type';

/** Adds cards in order: 'a:small' is a small card for device 'a'. */
function layoutOf(...cards: string[]): Layout {
  let layout = EMPTY_LAYOUT;
  for (const card of cards) {
    const [deviceId, size] = card.split(':');
    layout = addCard(layout, deviceId ?? '', (size ?? 'small') as CardSize);
  }
  return layout;
}

function placeOf(layout: Layout, deviceId: string): string {
  const card = layout.cards.filter((place) => place.deviceId === deviceId)[0];
  return card ? `page ${card.page}, column ${card.column}, row ${card.row}` : 'not placed';
}

describe('cellsOf', () => {
  it('gives the cells each card size covers', () => {
    expect(cellsOf('small')).toEqual({ columns: 1, rows: 1 });
    expect(cellsOf('wide')).toEqual({ columns: 2, rows: 1 });
    expect(cellsOf('large')).toEqual({ columns: 2, rows: 2 });
  });
});

describe('pages', () => {
  it('has one page when empty', () => {
    expect(pageCount(EMPTY_LAYOUT)).toBe(1);
    expect(cardsOnPage(EMPTY_LAYOUT, 0)).toEqual([]);
  });

  it('counts pages up to the last one with a card', () => {
    const layout: Layout = {
      cards: [{ deviceId: 'a', page: 2, column: 0, row: 0, size: 'small' }],
    };

    expect(pageCount(layout)).toBe(3);
    expect(cardsOnPage(layout, 2).map((card) => card.deviceId)).toEqual(['a']);
    expect(cardsOnPage(layout, 0)).toEqual([]);
  });
});

describe('addCard', () => {
  it('puts the first card at the top left of the first page', () => {
    expect(placeOf(layoutOf('a:small'), 'a')).toBe('page 0, column 0, row 0');
  });

  it('fills a row from left to right, then the next row', () => {
    const layout = layoutOf('a', 'b', 'c', 'd', 'e', 'f', 'g');

    expect(placeOf(layout, 'f')).toBe('page 0, column 5, row 0');
    expect(placeOf(layout, 'g')).toBe('page 0, column 0, row 1');
  });

  it('puts a small card beside a wide one', () => {
    const layout = layoutOf('heating:wide', 'lamp:small');

    expect(placeOf(layout, 'lamp')).toBe('page 0, column 2, row 0');
  });

  it('keeps a large card clear of the cells another large card covers', () => {
    const layout = layoutOf('doorbell:large', 'a', 'b', 'c', 'd', 'e');

    // The doorbell covers columns 0-1 of rows 0 and 1, so the first row has four free cells.
    expect(placeOf(layout, 'd')).toBe('page 0, column 5, row 0');
    expect(placeOf(layout, 'e')).toBe('page 0, column 2, row 1');
  });

  it('moves a card that does not fit the remaining cells to the next place it fits', () => {
    // Five small cards leave one free cell in row 0: too narrow for a wide card.
    const layout = layoutOf('a', 'b', 'c', 'd', 'e', 'heating:wide', 'f');

    expect(placeOf(layout, 'heating')).toBe('page 0, column 0, row 1');
    expect(placeOf(layout, 'f')).toBe('page 0, column 5, row 0');
  });

  it('does not let a large card hang off the bottom row', () => {
    const layout = layoutOf(...'abcdefghijkl'.split(''), 'doorbell:large');

    // Rows 0 and 1 are full. Row 2 is free but a 2×2 card needs two rows.
    expect(placeOf(layout, 'doorbell')).toBe('page 1, column 0, row 0');
  });

  it('starts a new page when every page is full', () => {
    const eighteen = 'abcdefghijklmnopqr'.split('');
    const layout = layoutOf(...eighteen, 'extra');

    expect(placeOf(layout, 'extra')).toBe('page 1, column 0, row 0');
    expect(pageCount(layout)).toBe(2);
  });

  it('changes nothing when the device already has a card', () => {
    const layout = layoutOf('a', 'b');

    expect(addCard(layout, 'a', 'small')).toEqual(layout);
  });

  it('does not change the layout it was given', () => {
    const before = layoutOf('a');
    const copy = JSON.parse(JSON.stringify(before)) as Layout;

    addCard(before, 'b', 'small');

    expect(before).toEqual(copy);
  });
});

describe('removeCard', () => {
  it('leaves the gap, and the next card added fills it', () => {
    const removed = removeCard(layoutOf('a', 'b', 'c'), 'b');

    expect(hasCard(removed, 'b')).toBe(false);
    expect(placeOf(removed, 'c')).toBe('page 0, column 2, row 0');
    expect(placeOf(addCard(removed, 'd', 'small'), 'd')).toBe('page 0, column 1, row 0');
  });

  it('changes nothing for a device with no card', () => {
    const layout = layoutOf('a');

    expect(removeCard(layout, 'zzz')).toEqual(layout);
  });
});

describe('withCurrentSizes', () => {
  it('moves a card whose device changed size to a place where the new size fits', () => {
    const layout = layoutOf('a', 'b', 'c');
    const sizes: { [deviceId: string]: CardSize } = { a: 'small', b: 'large', c: 'small' };

    const updated = withCurrentSizes(layout, (deviceId) => sizes[deviceId] ?? null);
    const b = updated.cards.filter((card: CardPlace) => card.deviceId === 'b')[0];

    expect(b?.size).toBe('large');
    expect(placeOf(updated, 'a')).toBe('page 0, column 0, row 0');
    expect(placeOf(updated, 'c')).toBe('page 0, column 2, row 0');
    expect(placeOf(updated, 'b')).toBe('page 0, column 3, row 0');
  });

  it('keeps a card as it is when its device is gone', () => {
    const layout = layoutOf('a', 'gone:wide');

    expect(withCurrentSizes(layout, (deviceId) => (deviceId === 'a' ? 'small' : null))).toEqual(
      layout,
    );
  });

  it('gives back the same layout when nothing changed size', () => {
    const layout = layoutOf('a', 'b:wide');
    const sizes: { [deviceId: string]: CardSize } = { a: 'small', b: 'wide' };

    expect(withCurrentSizes(layout, (deviceId) => sizes[deviceId] ?? null)).toBe(layout);
  });
});
