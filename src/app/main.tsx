/**
 * Where the app starts.
 *
 * For now it shows the TV proof screen. The real app's start-up replaces this.
 */

// Must come first: adds the functions Chromium 53 lacks before any other code runs.
import '../platform/polyfills';
import './app.css';

import { render } from 'preact';
import { ProofScreen } from '../proof/ProofScreen';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('index.html has no element with id "app"');
}
render(<ProofScreen />, root);
