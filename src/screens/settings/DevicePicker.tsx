/**
 * The device picker: every device Home Assistant has, grouped by room, each with a button
 * that puts it on the home screen or takes it off.
 *
 * A device with nothing this app supports is still listed, marked "Not supported yet".
 * Which devices exist and what they are called is decided in src/core/devices.ts.
 */

import type { Device, Room } from '../../core/devices';
import { hasCard, type Layout } from '../../core/layout';
import { deviceTypeFor } from '../../devices/registry';
import { Icon } from '../shared/Icon';

export interface DevicePickerProps {
  rooms: Room[];
  layout: Layout;
  /** Adds the device's card, or removes it when it already has one. */
  onToggle(device: Device): void;
  /** The person chose a device this app does not support yet. */
  onUnsupported(device: Device): void;
}

export function DevicePicker(props: DevicePickerProps) {
  if (props.rooms.length === 0) {
    return (
      <p class="settings-note">
        Home Assistant has no devices yet. Add them in Home Assistant first.
      </p>
    );
  }

  let isFirstRow = true;

  return (
    <div>
      {props.rooms.map((room) => (
        <section key={room.name}>
          <h2 class="picker-room">{room.name}</h2>
          {room.devices.map((device) => {
            const isFirst = isFirstRow;
            isFirstRow = false;
            return (
              <PickerRow
                key={device.id}
                device={device}
                isOnScreen={hasCard(props.layout, device.id)}
                isFirst={isFirst}
                onToggle={props.onToggle}
                onUnsupported={props.onUnsupported}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}

interface PickerRowProps {
  device: Device;
  isOnScreen: boolean;
  /** The first row takes the focus when Settings opens. */
  isFirst: boolean;
  onToggle(device: Device): void;
  onUnsupported(device: Device): void;
}

function PickerRow({ device, isOnScreen, isFirst, onToggle, onUnsupported }: PickerRowProps) {
  const type = device.mainPart === null ? null : deviceTypeFor(device.mainPart.typeId);

  // A device that lost its supported parts can still have a card. Let it be removed.
  if (type === null && isOnScreen) {
    return (
      <button
        class="picker-row picker-row-on"
        aria-pressed
        data-focus-first={isFirst ? '' : undefined}
        onClick={() => onToggle(device)}
      >
        <span class="picker-icon" />
        <span class="picker-name">{device.name}</span>
        <span class="picker-type">Not supported</span>
        <span class="picker-state">Remove</span>
      </button>
    );
  }

  if (type === null) {
    return (
      <button
        class="picker-row picker-row-unsupported"
        data-focus-first={isFirst ? '' : undefined}
        onClick={() => onUnsupported(device)}
      >
        <span class="picker-icon" />
        <span class="picker-name">{device.name}</span>
        <span class="picker-state">Not supported yet</span>
      </button>
    );
  }

  return (
    <button
      class={'picker-row' + (isOnScreen ? ' picker-row-on' : '')}
      aria-pressed={isOnScreen}
      data-focus-first={isFirst ? '' : undefined}
      onClick={() => onToggle(device)}
    >
      <span class="picker-icon">
        <Icon path={type.icon} />
      </span>
      <span class="picker-name">{device.name}</span>
      <span class="picker-type">{type.label}</span>
      <span class="picker-state">{isOnScreen ? 'On screen ✓' : 'Add'}</span>
    </button>
  );
}
