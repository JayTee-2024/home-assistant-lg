/**
 * Settings: a full-screen layer over the home screen, with its sections listed on the left.
 *
 *   Devices            the device picker
 *   Reorganise layout  leaves Settings for the reorganise mode
 *   Connection         the address, the signed-in user, and Sign out
 *   PIN lock           turn the optional PIN lock on or off, or change the PIN
 *   About              what the app is, its version and licence, and a word about Games Unleashed
 *
 * The app's version is shown in small text at the bottom of the list.
 *
 * Back, or the close button, returns to the home screen.
 */

import { useEffect, useState } from 'preact/hooks';
import { APP_VERSION } from '../../core/app-version';
import type { Device, Room } from '../../core/devices';
import type { Layout } from '../../core/layout';
import { focusFirst, topScope } from '../shared/focus';
import { CLOSE_ICON, Icon } from '../shared/Icon';
import { AboutSection } from './AboutSection';
import { ConnectionSection } from './ConnectionSection';
import { PinSection } from './PinSection';
import { DevicePicker } from './DevicePicker';

export interface SettingsScreenProps {
  rooms: Room[];
  layout: Layout;
  address: string;
  userName: string;
  /** True when signed in with a long-lived access token. */
  isToken: boolean;
  onToggleDevice(device: Device): void;
  onUnsupportedDevice(device: Device): void;
  onSignOut(): void;
  /** The PIN lock's PIN, or null when it is off. */
  pin: string | null;
  onSetPin(pin: string | null): void;
  /** Leaves Settings for the "Reorganise layout" mode. */
  onReorganise(): void;
  onClose(): void;
}

type Section = 'devices' | 'connection' | 'pin' | 'about';

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
          <SectionButton
            label="PIN lock"
            isCurrent={section === 'pin'}
            onPress={() => setSection('pin')}
          />
          <SectionButton
            label="About"
            isCurrent={section === 'about'}
            onPress={() => setSection('about')}
          />
          <div class="settings-version">Version {APP_VERSION}</div>
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
                isToken={props.isToken}
                onSignOut={props.onSignOut}
              />
            </div>
          )}

          {section === 'pin' && (
            <div>
              <h1>PIN lock</h1>
              <PinSection pin={props.pin} onSetPin={props.onSetPin} />
            </div>
          )}

          {section === 'about' && (
            <div>
              <h1>About</h1>
              <AboutSection />
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
