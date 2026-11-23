/**
 * The bar across the top of every screen: the app's name, and the settings and close buttons.
 */

import { CLOSE_ICON, Icon, SETTINGS_ICON } from './Icon';

export interface TitleBarProps {
  /** Leave out to hide the settings button, as on the sign-in screen. */
  onSettings?: () => void;
  /** Leaves the app completely. */
  onClose(): void;
}

export function TitleBar(props: TitleBarProps) {
  return (
    <header class="title-bar">
      <div class="title-bar-name">Home Assist LG</div>
      <div class="title-bar-buttons">
        {props.onSettings !== undefined && (
          <button class="icon-button" aria-label="Settings" onClick={props.onSettings}>
            <Icon path={SETTINGS_ICON} />
          </button>
        )}
        <button class="icon-button" aria-label="Close the app" onClick={props.onClose}>
          <Icon path={CLOSE_ICON} />
        </button>
      </div>
    </header>
  );
}
