/**
 * Where the app starts: load the polyfills and the styles, then draw the app.
 */

// Must come first: adds the functions Chromium 53 lacks before any other code runs.
import '../platform/polyfills';

// The styles. The build joins these into one file, app.css, in this order.
import './app.css';
import '../screens/sign-in/sign-in.css';
import '../devices/shared/devices.css';
import '../screens/home/home.css';
import '../screens/panel/panel.css';
import '../screens/settings/settings.css';
import '../screens/reorganise/reorganise.css';

import { render } from 'preact';
import { App } from './App';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('index.html has no element with id "app"');
}
render(<App />, root);
