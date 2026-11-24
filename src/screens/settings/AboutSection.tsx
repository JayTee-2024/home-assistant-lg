/**
 * The About section of Settings: what the app is, its version, where to get help, and a
 * note about Games Unleashed, another project by the same developer.
 *
 * Nothing here can be selected: links cannot be opened from the TV, so addresses are shown
 * in full for typing into a phone or computer.
 */

import { APP_VERSION } from '../../core/app-version';

const SOURCE_ADDRESS = 'github.com/JayTee-2024/home-assistant-lg';
const GAMES_ADDRESS = 'https://gamesunleashed.com';

export function AboutSection() {
  return (
    <div class="about">
      <div class="about-app">
        {/* The icon the TV shows for the app, packaged next to index.html. */}
        <img class="about-icon" src="largeIcon.png" alt="" />
        <div>
          <div class="about-name">Home Assist LG</div>
          <div class="about-version">Version {APP_VERSION}</div>
        </div>
      </div>

      <p class="settings-note">
        Control your Home Assistant home with the TV remote. Choose devices in Settings and they
        appear as cards: lights, plugs, heating, speakers, blinds, fans, robot vacuums, cameras and
        more.
      </p>
      <p class="settings-note">
        This TV talks straight to your own Home Assistant. Nothing is sent anywhere else, and your
        password is never stored. Locks, alarms, doors, garage doors and gates are deliberately not
        shown. Switches, buttons, scripts and scenes are: if any of yours controls something
        sensitive, turn on the PIN lock in Settings.
      </p>

      {/* Side by side, so the whole section fits on the screen without scrolling. */}
      <div class="about-facts">
        <div class="settings-fact">
          <div class="settings-fact-label">Help, updates and source code</div>
          <div class="settings-fact-value">{SOURCE_ADDRESS}</div>
        </div>
        <div class="settings-fact">
          <div class="settings-fact-label">Licence</div>
          <div class="settings-fact-value">Apache License 2.0</div>
        </div>
      </div>

      <section class="about-promo">
        <div class="about-promo-label">Also from the same developer</div>
        <div class="about-promo-name">Games Unleashed</div>
        <p class="about-promo-text">
          Free games for a rainy day. Thirty classic games in 3D: cards, board games, pub games,
          puzzles and arcade. Play against the computer or with friends online.
        </p>
        <div class="about-promo-address">{GAMES_ADDRESS}</div>
      </section>
    </div>
  );
}
