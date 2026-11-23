/**
 * Settings: a full-screen layer over the home screen, with its sections listed on the left.
 *
 *   Devices            the device picker
 *   Reorganise layout  leaves Settings for the reorganise mode
 *   Connection         the address, the signed-in user, and Sign out
 *
 * Back, or the close button, returns to the home screen.
 */

import { useEffect, useState } from 'preact/hooks';
import type { Device, Room } from '../../core/devices';
import type { Layout } from '../../core/layout';
import { focusFirst, topScope } from '../shared/focus';
import { CLOSE_ICON, Icon } from '../shared/Icon';
import { ConnectionSection } from './ConnectionSection';
import { DevicePicker } from './DevicePicker';

export interface SettingsScreenProps {
  rooms: Room[];
  layout: Layout;
  address: string;
  userName: string;
  onToggleDevice(device: Device): void;
  onUnsupportedDevice(device: Device): void;
  onSignOut(): void;
  /** Leaves Settings for the "Reorganise layout" mode. */
  onReorganise(): void;
  onClose(): void;
}

type Section = 'devices' | 'connection';

export function SettingsScreen(props: SettingsScreenProps) {
  const [section, setSection] = useState<Section>('devices');

  // When Settings opens, focus the first device in the picker.
  useEffect(() => {
    focusFirst(topScope());
  }, []);

  return (
    <div class="settings" role="dialog" aria-label="Settings" data-focus-scope>
      <header class="title-bar">
        <div class="title-bar-name">Settings</div>
        <div class="title-bar-buttons">
          <button class="icon-button" aria-label="Close settings" onClick={props.onClose}>
            <Icon path={CLOSE_ICON} />
          </button>
        </div>
      </header>

      <div class="settings-body">
        {/* A column: Up and Down stay in this list, and Left from the content lands on the open section. */}
        <nav class="settings-sections" data-focus-column>
          <SectionButton
            label="Devices"
            isCurrent={section === 'devices'}
            onPress={() => setSection('devices')}
          />
          <SectionButton label="Reorganise layout" isCurrent={false} onPress={props.onReorganise} />
          <SectionButton
            label="Connection"
            isCurrent={section === 'connection'}
            onPress={() => setSection('connection')}
          />
        </nav>

        <main class="settings-content" data-scrolls>
          {section === 'devices' && (
            <div>
              <h1>Devices</h1>
              <p class="settings-note">
                Choose what to show on the home screen. Devices are added to Home Assistant in Home
                Assistant itself.
              </p>
              <DevicePicker
                rooms={props.rooms}
                layout={props.layout}
                onToggle={props.onToggleDevice}
                onUnsupported={props.onUnsupportedDevice}
              />
            </div>
          )}

          {section === 'connection' && (
            <div>
              <h1>Connection</h1>
              <ConnectionSection
                address={props.address}
                userName={props.userName}
                onSignOut={props.onSignOut}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SectionButton(props: { label: string; isCurrent: boolean; onPress(): void }) {
  return (
    <button
      class={'settings-section' + (props.isCurrent ? ' settings-section-current' : '')}
      aria-current={props.isCurrent ? 'page' : undefined}
      data-focus-entry={props.isCurrent ? '' : undefined}
      onClick={props.onPress}
    >
      {props.label}
    </button>
  );
}
