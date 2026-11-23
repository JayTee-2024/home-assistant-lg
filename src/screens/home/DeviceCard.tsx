/**
 * One card on the home screen: a device's icon, state, name and room.
 *
 * The frame is drawn here. The state shown at the top right comes from the device type of
 * the card's main part (its Card component), and other parts add a short line each.
 *
 * The card is placed by its grid coordinates with absolute positioning, because Chromium 53
 * has no CSS grid. home.css explains the arithmetic.
 */

import type { Device } from '../../core/devices';
import type { HomeSnapshot } from '../../core/home-assistant';
import { cellsOf, GRID_COLUMNS, GRID_ROWS, type CardPlace } from '../../core/layout';
import { deviceTypeFor } from '../../devices/registry';
import { Icon, MORE_ICON } from '../shared/Icon';

export interface DeviceCardProps {
  place: CardPlace;
  /** True for the card that takes the focus when the home screen appears. */
  isFirst: boolean;
  /** null when Home Assistant no longer has the device this card was made for. */
  device: Device | null;
  home: HomeSnapshot;
  /** The Home Assistant address, passed on to the device type's card. */
  homeAddress: string;
  /** A click on the card. (OK on the remote is handled by the app, to tell short from long.) */
  onPress(): void;
  /** Opens the device's panel. */
  onMore(): void;
}

/** The space between cards. Must match --gap in home.css. */
const GAP = '1.5rem';

export function DeviceCard(props: DeviceCardProps) {
  const { place, device, home } = props;
  const size = cellsOf(place.size);

  const style = {
    left: along(place.column, GRID_COLUMNS),
    top: along(place.row, GRID_ROWS),
    width: span(size.columns, GRID_COLUMNS),
    height: span(size.rows, GRID_ROWS),
  };

  const main = device === null ? null : device.mainPart;
  const mainType = main === null ? null : deviceTypeFor(main.typeId);
  const mainEntity = main === null ? undefined : home.states[main.entityId];

  if (device === null || main === null || mainType === null || mainEntity === undefined) {
    return (
      <div
        class="card card-missing"
        style={style}
        data-focusable
        data-card={place.deviceId}
        data-focus-first={props.isFirst ? '' : undefined}
        tabIndex={0}
      >
        <div class="card-names">
          <div class="card-name">{device === null ? 'Not available' : device.name}</div>
          <div class="card-room">
            {device === null ? 'No longer in Home Assistant' : 'Nothing here can be shown yet'}
          </div>
        </div>
      </div>
    );
  }

  const isActive = mainType.isActive(mainEntity);
  const MainCard = mainType.Card;
  const extraLines = extraLinesFor(device, home, place.size === 'small' ? 1 : 2);

  return (
    <div
      class={'card card-' + mainType.id + (isActive ? ' card-active' : '')}
      style={style}
      role="button"
      aria-label={device.name}
      data-focusable
      data-card={device.id}
      data-focus-first={props.isFirst ? '' : undefined}
      tabIndex={0}
      onClick={props.onPress}
    >
      <div class="card-top">
        <div class="card-icon">
          <Icon path={mainType.icon} />
        </div>
        <MainCard entity={mainEntity} homeAddress={props.homeAddress} />
      </div>

      <div class="card-names">
        <div class="card-name">{device.name}</div>
        {device.roomName !== null && <div class="card-room">{device.roomName}</div>}
        {extraLines.map((line) => (
          <div class="card-extra" key={line}>
            {line}
          </div>
        ))}
      </div>

      <button
        class="card-more"
        aria-label={'More controls for ' + device.name}
        data-pointer-only
        tabIndex={-1}
        onClick={(event) => {
          // Keep the click from also reaching the card, which would run its OK action.
          event.stopPropagation();
          props.onMore();
        }}
      >
        <Icon path={MORE_ICON} />
      </button>
    </div>
  );
}

/** A short line for each of the device's other parts, such as 'Battery 74%'. At most `limit` lines. */
function extraLinesFor(device: Device, home: HomeSnapshot, limit: number): string[] {
  const lines: string[] = [];

  for (const part of device.parts.slice(1)) {
    if (lines.length === limit) break;

    const type = deviceTypeFor(part.typeId);
    const entity = home.states[part.entityId];
    const summary = type === null || entity === undefined ? null : type.summary(entity);
    if (summary !== null) lines.push(part.name + ' ' + summary);
  }
  return lines;
}

/** How far along the grid a column or row starts: its share of the width plus the gaps before it. */
function along(index: number, count: number): string {
  return 'calc(' + index + ' * (100% + ' + GAP + ') / ' + count + ')';
}

/** How wide or tall a card covering `cells` cells is: the cells plus the gaps between them. */
function span(cells: number, count: number): string {
  return 'calc(' + cells + ' * (100% + ' + GAP + ') / ' + count + ' - ' + GAP + ')';
}
