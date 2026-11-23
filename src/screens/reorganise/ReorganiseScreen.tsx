/**
 * The "Reorganise layout" mode: every card with a move marker, and every empty cell shown.
 *
 * With the remote: arrows move between cards; OK picks the focused card up; the arrows then
 * move it (past the left or right edge it goes to the next page); OK puts it down; Back puts
 * it back where it was. With the pointer: press on a card, drag it, and let go.
 * Back with nothing picked up, or "Done", saves and leaves. Empty pages are removed then.
 *
 * The keys reach this screen through `registerKeys`: the app passes every key here first,
 * so this screen can take over the arrows while a card is picked up.
 *
 * Whether a card fits where it is dropped is decided by moveCard (src/core/layout.ts); where
 * each arrow takes it, by src/core/reorganise.ts.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { findDevice, type Device } from '../../core/devices';
import {
  cardsOnPage,
  cellsOf,
  GRID_COLUMNS,
  GRID_ROWS,
  moveCard,
  pageCount,
  removeEmptyPages,
  type CardPlace,
  type GridPlace,
  type Layout,
} from '../../core/layout';
import { cellAt, stepPlace } from '../../core/reorganise';
import type { RemoteKey } from '../../core/remote-key';
import { deviceTypeFor } from '../../devices/registry';
import { focusElement, focusFirst, moveFocus, topScope } from '../shared/focus';
import { Icon } from '../shared/Icon';
import { along, span } from '../home/grid-position';

/** The four-arrow "move" marker drawn on every card. */
const MOVE_ICON = 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20';

/** How long "It does not fit there" stays up. */
const REFUSED_MS = 1500;

export interface ReorganiseScreenProps {
  layout: Layout;
  devices: Device[];
  /** Saves the new layout and leaves the mode. */
  onDone(layout: Layout): void;
  /** Gives the app this screen's key handler (or null when the screen goes away). */
  registerKeys(handler: ((key: RemoteKey) => boolean) | null): void;
}

/** A card that has been picked up: where it is now, and where it came from. */
interface Held {
  deviceId: string;
  place: GridPlace;
  from: CardPlace;
  /** True while it is being dragged with the pointer. */
  isDragging: boolean;
}

export function ReorganiseScreen(props: ReorganiseScreenProps) {
  const [layout, setLayout] = useState(props.layout);
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState<Held | null>(null);
  const [isRefused, setIsRefused] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const refusedTimer = useRef<number | null>(null);

  // The key handler is registered once, so it reads the current values through this.
  const now = useRef({ layout, page, held });
  now.current = { layout, page, held };

  const pages = Math.max(pageCount(layout), held === null ? 0 : held.place.page + 1);

  function refuse() {
    setIsRefused(true);
    if (refusedTimer.current !== null) clearTimeout(refusedTimer.current);
    refusedTimer.current = setTimeout(() => setIsRefused(false), REFUSED_MS);
  }

  function focusCard(deviceId: string) {
    // After the redraw, so the card is in its new place.
    setTimeout(() => {
      const card = document.querySelector<HTMLElement>('[data-move-card="' + deviceId + '"]');
      if (card !== null) focusElement(card);
    }, 0);
  }

  function pickUp(deviceId: string, isDragging: boolean) {
    const card = now.current.layout.cards.filter((item) => item.deviceId === deviceId)[0];
    if (card === undefined) return;
    setHeld({
      deviceId,
      place: { page: card.page, column: card.column, row: card.row },
      from: card,
      isDragging,
    });
  }

  /** Puts the held card down where it is, if it fits there. */
  function drop() {
    const current = now.current.held;
    if (current === null) return;

    const moved = moveCard(now.current.layout, current.deviceId, current.place);
    if (moved === null) {
      refuse();
      if (current.isDragging) putBack();
      return;
    }
    setLayout(moved);
    setHeld(null);
    focusCard(current.deviceId);
  }

  function putBack() {
    const current = now.current.held;
    if (current === null) return;
    setHeld(null);
    setPage(current.from.page);
    focusCard(current.deviceId);
  }

  function moveHeld(place: GridPlace) {
    const current = now.current.held;
    if (current === null) return;
    setHeld({ ...current, place });
    setPage(place.page);
  }

  function finish() {
    props.onDone(removeEmptyPages(now.current.layout));
  }

  // The remote's keys, offered by the app before it does anything with them.
  useEffect(() => {
    const handleKey = (key: RemoteKey): boolean => {
      const current = now.current;

      if (current.held !== null) {
        const heldCard = current.held;
        if (key === 'ok') drop();
        else if (key === 'back') putBack();
        else if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
          const size = heldCard.from.size;
          moveHeld(stepPlace(heldCard.place, size, key, pageCount(current.layout)));
        }
        return true;
      }

      if (key === 'back') {
        finish();
        return true;
      }
      if (key === 'ok') {
        const focused = document.activeElement;
        const deviceId = focused === null ? null : focused.getAttribute('data-move-card');
        if (deviceId === null) return false;
        pickUp(deviceId, false);
        return true;
      }
      if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
        if (moveFocus(topScope(), key)) return true;
        // Nothing that way: Left and Right turn the page.
        const last = pageCount(current.layout) - 1;
        if (key === 'left' && current.page > 0) setPage(current.page - 1);
        if (key === 'right' && current.page < last) setPage(current.page + 1);
        return true;
      }
      return false;
    };

    props.registerKeys(handleKey);
    return () => props.registerKeys(null);
  }, []);

  // When the screen opens, focus the first card.
  useEffect(() => {
    focusFirst(topScope());
  }, []);

  // After the page changes with nothing picked up, focus a card on the new page.
  useEffect(() => {
    if (now.current.held === null && grid.current !== null) {
      const first = grid.current.querySelector<HTMLElement>('[data-move-card]');
      if (first !== null) focusElement(first);
    }
  }, [page]);

  // Dragging with the pointer: follow it while the button is down, drop when it comes up.
  useEffect(() => {
    if (held === null || !held.isDragging) return;

    const onMove = (event: MouseEvent) => {
      const current = now.current.held;
      if (current === null || grid.current === null) return;
      const rect = grid.current.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5;
      const cell = cellAt(event.clientX, event.clientY, rect, gap);
      const size = cellsOf(current.from.size);
      moveHeld({
        page: now.current.page,
        column: Math.min(cell.column, GRID_COLUMNS - size.columns),
        row: Math.min(cell.row, GRID_ROWS - size.rows),
      });
    };
    const onUp = () => drop();

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [held === null ? null : held.deviceId, held !== null && held.isDragging]);

  const shownCards = cardsOnPage(layout, page).filter(
    (card) => held === null || card.deviceId !== held.deviceId,
  );
  const heldFits = held === null ? true : moveCard(layout, held.deviceId, held.place) !== null;

  const cells: GridPlace[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let column = 0; column < GRID_COLUMNS; column++) cells.push({ page, column, row });
  }

  return (
    <div class="reorganise" role="dialog" aria-label="Reorganise layout" data-focus-scope>
      <header class="title-bar">
        <div class="title-bar-name">Reorganise layout</div>
        <div class="reorganise-help">
          {held === null
            ? 'OK picks a card up · Back or Done saves'
            : isRefused || !heldFits
              ? 'It does not fit there'
              : 'Arrows move it · OK puts it down · Back puts it back'}
        </div>
        <button class="button button-main reorganise-done" onClick={finish}>
          Done
        </button>
      </header>

      <main class="home">
        <div class="grid" ref={grid}>
          {cells.map((cell) => (
            <div
              key={cell.column + '-' + cell.row}
              class="reorganise-cell"
              style={{
                left: along(cell.column, GRID_COLUMNS),
                top: along(cell.row, GRID_ROWS),
                width: span(1, GRID_COLUMNS),
                height: span(1, GRID_ROWS),
              }}
            />
          ))}

          {shownCards.map((card) => (
            <MoveCard
              key={card.deviceId}
              card={card}
              device={findDevice(props.devices, card.deviceId)}
              onPress={(isDragging) => pickUp(card.deviceId, isDragging)}
            />
          ))}

          {held !== null && held.place.page === page && (
            <MoveCard
              card={{ ...held.from, ...held.place }}
              device={findDevice(props.devices, held.deviceId)}
              heldState={heldFits && !isRefused ? 'held' : 'refused'}
            />
          )}
        </div>

        {pages > 1 && (
          <div class="page-dots" aria-label={'Page ' + (page + 1) + ' of ' + pages}>
            {Array.from({ length: pages }, (_, index) => (
              <span key={index} class={'page-dot' + (index === page ? ' page-dot-current' : '')} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface MoveCardProps {
  card: CardPlace;
  device: Device | null;
  /** Set for the card being moved: 'refused' while it is over a place it does not fit. */
  heldState?: 'held' | 'refused';
  /** A press on the card with the pointer, which starts a drag. */
  onPress?(isDragging: boolean): void;
}

/** A card as the reorganise mode draws it: icon, name and the move marker. */
function MoveCard({ card, device, heldState, onPress }: MoveCardProps) {
  const size = cellsOf(card.size);
  const type =
    device === null || device.mainPart === null ? null : deviceTypeFor(device.mainPart.typeId);
  const name = device === null ? 'Not available' : device.name;

  let className = 'card move-card';
  if (heldState === 'held') className += ' move-card-held';
  if (heldState === 'refused') className += ' move-card-refused';

  return (
    <div
      class={className}
      style={{
        left: along(card.column, GRID_COLUMNS),
        top: along(card.row, GRID_ROWS),
        width: span(size.columns, GRID_COLUMNS),
        height: span(size.rows, GRID_ROWS),
      }}
      data-move-card={heldState === undefined ? card.deviceId : undefined}
      data-focusable={heldState === undefined ? '' : undefined}
      tabIndex={heldState === undefined ? 0 : -1}
      onMouseDown={
        onPress === undefined
          ? undefined
          : (event) => {
              event.preventDefault();
              onPress(true);
            }
      }
    >
      <div class="card-top">
        <div class="card-icon">{type !== null && <Icon path={type.icon} />}</div>
        <div class="move-marker">
          <Icon path={MOVE_ICON} />
        </div>
      </div>
      <div class="card-name">{name}</div>
    </div>
  );
}
