/**
 * Moves the remote's focus around the screen.
 *
 * Every screen works the same way: anything that can take focus is a <button>, an <input>,
 * or an element marked data-focusable, and the arrows move to the nearest one in that
 * direction. Which one is "nearest" is decided by src/core/spatial-focus.ts; this file
 * reads the positions off the page and moves the browser's real focus.
 *
 * Three markers on elements steer it:
 *   data-focus-scope   the part of the page the arrows are confined to. The last one in
 *                      the page wins, so an open panel or Settings takes over the arrows.
 *   data-pointer-only  can be clicked with the pointer but is skipped by the arrows.
 *   data-scrolls       a list that scrolls. It is scrolled to keep the focused row in view.
 */

import { nextInDirection, type Box, type Direction } from '../../core/spatial-focus';

const FOCUSABLE = 'button, input, [data-focusable]';

/** How much room to keep between the focused row and the edge of a scrolling list, in pixels. */
const SCROLL_MARGIN = 24;

/** The scope the arrows are confined to right now. */
export function topScope(): HTMLElement {
  const scopes = document.querySelectorAll<HTMLElement>('[data-focus-scope]');
  return scopes[scopes.length - 1] ?? document.body;
}

/**
 * Moves focus from the focused element to the nearest one in `direction` inside `scope`.
 * Returns false when there is nothing that way. When nothing in the scope has focus yet,
 * focuses the scope's first element.
 */
export function moveFocus(scope: HTMLElement, direction: Direction): boolean {
  const candidates = focusableIn(scope);
  const current = document.activeElement as HTMLElement | null;

  if (current === null || candidates.indexOf(current) === -1) {
    focusFirst(scope);
    return candidates.length > 0;
  }

  const index = nextInDirection(boxOf(current), candidates.map(boxOf), direction);
  const next = index === null ? undefined : candidates[index];
  if (next === undefined) return false;

  focusElement(next);
  return true;
}

/** Focuses the element marked data-focus-first in the scope, or else its first focusable element. */
export function focusFirst(scope: HTMLElement): void {
  const candidates = focusableIn(scope);
  const preferred = candidates.filter((element) => element.hasAttribute('data-focus-first'))[0];
  const first = preferred ?? candidates[0];
  if (first !== undefined) focusElement(first);
}

/** Focuses `element` and scrolls its list, if it is in one, so it can be seen. */
export function focusElement(element: HTMLElement): void {
  element.focus();
  keepInView(element);
}

/** True when the focused element is a text field, where Left and Right move the cursor. */
export function isTypingInField(): boolean {
  const current = document.activeElement;
  return current !== null && current.tagName === 'INPUT';
}

function focusableIn(scope: HTMLElement): HTMLElement[] {
  const found = Array.prototype.slice.call(scope.querySelectorAll(FOCUSABLE)) as HTMLElement[];

  return found.filter((element) => {
    if ((element as HTMLButtonElement).disabled) return false;
    if (element.hasAttribute('data-pointer-only')) return false;
    // An element that is not drawn (inside something hidden) has no rectangles.
    return element.getClientRects().length > 0;
  });
}

function boxOf(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/**
 * Scrolls the nearest data-scrolls list by setting scrollTop. Chromium 53 has
 * scrollIntoView, but not the options that would make it scroll only as far as needed.
 */
function keepInView(element: HTMLElement): void {
  let list = element.parentElement;
  while (list !== null && !list.hasAttribute('data-scrolls')) {
    list = list.parentElement;
  }
  if (list === null) return;

  const row = element.getBoundingClientRect();
  const frame = list.getBoundingClientRect();
  if (row.top < frame.top + SCROLL_MARGIN) {
    list.scrollTop -= frame.top + SCROLL_MARGIN - row.top;
  } else if (row.bottom > frame.bottom - SCROLL_MARGIN) {
    list.scrollTop += row.bottom - (frame.bottom - SCROLL_MARGIN);
  }
}
