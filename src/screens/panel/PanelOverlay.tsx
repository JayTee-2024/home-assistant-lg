/**
 * A device's panel: a large box over the home screen with every control the device has.
 *
 * It shows one section per part of the device, each drawn by that part's device type
 * (its Panel component). Back, or the close button, closes it.
 */

import { useEffect } from 'preact/hooks';
import type { Device } from '../../core/devices';
import type { HomeSnapshot } from '../../core/home-assistant';
import type { Action } from '../../devices/device-type';
import { deviceTypeFor } from '../../devices/registry';
import { focusFirst, topScope } from '../shared/focus';
import { CLOSE_ICON, Icon } from '../shared/Icon';

export interface PanelOverlayProps {
  device: Device;
  home: HomeSnapshot;
  onRun(action: Action): void;
  onClose(): void;
}

export function PanelOverlay(props: PanelOverlayProps) {
  const { device, home } = props;

  // When the panel opens, focus its first control.
  useEffect(() => {
    focusFirst(topScope());
  }, []);

  return (
    <div class="overlay">
      <div class="panel" role="dialog" aria-label={device.name} data-focus-scope data-scrolls>
        <div class="panel-heading">
          <h1>{device.name}</h1>
          {device.roomName !== null && <div class="panel-room">{device.roomName}</div>}
        </div>

        {device.parts.map((part) => {
          const type = deviceTypeFor(part.typeId);
          const entity = home.states[part.entityId];
          if (type === null || entity === undefined) return null;

          const PartPanel = type.Panel;
          return (
            <section class="panel-part" key={part.entityId}>
              {device.parts.length > 1 && <h2 class="panel-part-name">{part.name}</h2>}
              <PartPanel entity={entity} run={props.onRun} />
            </section>
          );
        })}

        {/* Last in the page so the first control, not this button, takes focus; drawn top right. */}
        <button class="icon-button panel-close" aria-label="Close" onClick={props.onClose}>
          <Icon path={CLOSE_ICON} />
        </button>
      </div>
    </div>
  );
}
