// Starts a stand-in Home Assistant for development, so the app can be run in a desktop
// browser (or on a TV) without a real Home Assistant and without anyone's password.
// Run with: npm run dev:home
// To let a TV on the network reach it: DEV_OPEN=1 npm run dev:home
//
// It serves the made-up home in fixtures/sample-home.json. See scripts/lib/fake-home.mjs
// for what it can and cannot do.

import { readFileSync } from 'node:fs';
import { FAKE_PASSWORD, FAKE_USERNAME } from './lib/fake-home.mjs';
import { ALL_DEVICES, LOCAL_ONLY, startFakeHomeServer } from './lib/fake-home-server.mjs';

const PORT = Number(process.env.FAKE_HOME_PORT || 8124);
const CHANGING_SENSOR = 'sensor.living_room_temperature';

const sampleHome = JSON.parse(readFileSync('fixtures/sample-home.json', 'utf8'));
// Only this computer can connect, unless DEV_OPEN=1 is set (to try it from a TV).
const isOpen = process.env.DEV_OPEN === '1';
const server = await startFakeHomeServer(sampleHome, PORT, {
  host: isOpen ? ALL_DEVICES : LOCAL_ONLY,
});

// Nudge one sensor every ten seconds, so live updates can be seen on screen.
let warmer = true;
setInterval(() => {
  const sensor = server.home.states().filter((state) => state.entity_id === CHANGING_SENSOR)[0];
  if (!sensor) return;
  const next = Number(sensor.state) + (warmer ? 0.1 : -0.1);
  warmer = next < 21.5 ? (next <= 19.5 ? true : warmer) : false;
  server.home.setState(CHANGING_SENSOR, next.toFixed(1));
}, 10000);

console.log('Stand-in Home Assistant running.');
console.log('  Address:  ' + server.address);
console.log('  Username: ' + FAKE_USERNAME);
console.log('  Password: ' + FAKE_PASSWORD);
console.log('Press Ctrl+C to stop.');
