/**
 * The home screen: the title bar and one page of the card grid.
 *
 * It draws what it is given and reports what the person does. Deciding what a press means,
 * keeping the layout, and talking to Home Assistant are the app's job (src/app/App.tsx).
 */

import { useEffect, useRef } from 'preact/hooks';
import { findDevice, type Device } from '../../core/devices';
import type { HomeSnapshot } from '../../core/home-assistant';
import { cardsOnPage, pageCount, type Layout } from '../../core/layout';
import { focusElement, focusFirst, topScope } from '../shared/focus';
import { Icon, LEFT_ICON, RIGHT_ICON } from '../shared/Icon';
import { TitleBar } from '../shared/TitleBar';
import { DeviceCard } from './DeviceCard';

/** How the current page was reached, so focus can land on the card nearest where it left. */
export interface PageEntry {
  /** The side of the screen focus comes in from. */
  from: 'left' | 'right';
  /** How far down the screen the focus was, in pixels, before the page changed. */
  top: number;
}

export interface HomeScreenProps {
  layout: Layout;
  page: number;
  /** Set when the page was just flipped with the arrows; null otherwise. */
  pageEntry: PageEntry | null;
  devices: Device[];
  home: HomeSnapshot;
  /** The Home Assistant address, for things fetched from it directly, such as camera pictures. */
  homeAddress: string;
  /** True while the connection to Home Assistant is down. */
  isReconnecting: boolean;
  onCardPress(deviceId: string): void;
  onCardMore(deviceId: string): void;
  onPage(page: number): void;
  onSettings(): void;
  onClose(): void;
}

export function HomeScreen(props: HomeScreenProps) {
  const grid = useRef<HTMLDivElement>(null);
  const pages = pageCount(props.layout);
  const cards = cardsOnPage(props.layout, props.page);

  // The card nearest the top left is marked as the one to focus first. Without a mark the
  // settings button would take the focus, because the title bar comes first in the page.
  let firstCard = cards[0];
  for (const card of cards) {
    if (firstCard === undefined) break;
    const isHigher = card.row < firstCard.row;
    const isFurtherLeft = card.row === firstCard.row && card.column < firstCard.column;
    if (isHigher || isFurtherLeft) firstCard = card;
  }

  // When the screen first appears, focus that card, or "Add devices" when there are no cards.
  useEffect(() => {
    focusFirst(topScope());
  }, []);

  // After a page flip, focus the card on the entering side that is nearest the old row.
  useEffect(() => {
    const entry = props.pageEntry;
    if (entry === null || grid.current === null) return;

    const found = grid.current.querySelectorAll<HTMLElement>('[data-card]');
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (let index = 0; index < found.length; index++) {
      const card = found[index];
      if (card === undefined) continue;

      const rect = card.getBoundingClientRect();
      const fromEdge = entry.from === 'left' ? rect.left : window.innerWidth - rect.right;
      // The entering edge matters most; among cards on that edge, the nearest row wins.
      const score = fromEdge * 10 + Math.abs(rect.top - entry.top);
      if (score < bestScore) {
        best = card;
        bestScore = score;
      }
    }
    if (best !== null) focusElement(best);
  }, [props.page, props.pageEntry]);

  return (
    <div class="screen" data-focus-scope>
      <TitleBar onSettings={props.onSettings} onClose={props.onClose} />

      {props.isReconnecting && (
        <div class="banner" role="status">
          Lost the connection to Home Assistant. Showing the last known states. Trying to reconnect…
        </div>
      )}

      {props.layout.cards.length === 0 ? (
        <main class="centred">
          <h1>No devices yet</h1>
          <p class="centred-detail">Choose which of your Home Assistant devices to show here.</p>
          <button class="button button-main" data-focus-first onClick={props.onSettings}>
            Add devices
          </button>
        </main>
      ) : (
        <main class="home">
          {/* While the connection is down, every card shows its last known state, dimmed. */}
          <div class={'grid' + (props.isReconnecting ? ' grid-stale' : '')} ref={grid}>
            {cards.map((place) => (
              <DeviceCard
                key={place.deviceId}
                place={place}
                isFirst={place === firstCard}
                device={findDevice(props.devices, place.deviceId)}
                home={props.home}
                homeAddress={props.homeAddress}
                onPress={() => props.onCardPress(place.deviceId)}
                onMore={() => props.onCardMore(place.deviceId)}
              />
            ))}
          </div>

          {pages > 1 && (
            <div class="page-dots" aria-label={'Page ' + (props.page + 1) + ' of ' + pages}>
              {Array.from({ length: pages }, (_, index) => (
                <span
                  key={index}
                  class={'page-dot' + (index === props.page ? ' page-dot-current' : '')}
                />
              ))}
            </div>
          )}

          {props.page > 0 && (
            <button
              class="page-arrow page-arrow-left"
              aria-label="Previous page"
              data-pointer-only
              tabIndex={-1}
              onClick={() => props.onPage(props.page - 1)}
            >
              <Icon path={LEFT_ICON} />
            </button>
          )}
          {props.page < pages - 1 && (
            <button
              class="page-arrow page-arrow-right"
              aria-label="Next page"
              data-pointer-only
              tabIndex={-1}
              onClick={() => props.onPage(props.page + 1)}
            >
              <Icon path={RIGHT_ICON} />
            </button>
          )}
        </main>
      )}
    </div>
  );
}
