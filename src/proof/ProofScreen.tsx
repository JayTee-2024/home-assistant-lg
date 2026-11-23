/**
 * THROWAWAY: the screen for the TV proof, deleted once the real app's screens exist.
 *
 * Shows what browser engine the TV has, runs the probes against a Home Assistant
 * address, and shows which sign-in route the real app should use. It also shows the
 * code of each remote key pressed, to confirm the key names in src/platform/keys.ts.
 *
 * The logic it shows is in probe.ts. This file only arranges it on screen.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_ADDRESS, normaliseAddress } from '../core/address';
import { fetchSend } from '../platform/http';
import { remoteKeyFromCode } from '../platform/keys';
import { openWebSocket } from '../platform/websocket';
import {
  buildProbes,
  decideSignInRoute,
  isProvidersAnswer,
  isSignInFormAnswer,
  runHttpProbe,
  runWebSocketProbe,
  type ProbeResult,
  type SignInRoute,
} from './probe';

function cssGridSupport(): string {
  return CSS.supports('display', 'grid') ? 'supported' : 'not supported';
}

function describeResult(result: ProbeResult): string {
  const status = result.httpStatus === null ? '' : ' (HTTP ' + result.httpStatus + ')';
  return result.outcome + status + ': ' + result.detail;
}

export function ProofScreen() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [route, setRoute] = useState<SignInRoute | null>(null);
  const [running, setRunning] = useState(false);
  const [lastKey, setLastKey] = useState('none yet');

  // The three controls, top to bottom, that Up and Down move between.
  const addressField = useRef<HTMLInputElement>(null);
  const runButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    runButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const key = remoteKeyFromCode(event.keyCode);
      setLastKey((key ?? 'unknown') + ' (' + event.keyCode + ')');

      if (key !== 'up' && key !== 'down') return;
      const controls = [addressField.current, runButton.current, closeButton.current];
      const current = controls.indexOf(document.activeElement as HTMLInputElement);
      const next = Math.max(0, Math.min(controls.length - 1, current + (key === 'down' ? 1 : -1)));
      controls[next]?.focus();
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function runTests() {
    const normalised = normaliseAddress(address);
    if (!normalised.ok) {
      setMessage(
        normalised.reason === 'empty' ? 'Enter an address' : 'That is not a valid address',
      );
      return;
    }

    setMessage('Testing ' + normalised.url + ' ...');
    setResults([]);
    setRoute(null);
    setRunning(true);

    const probes = buildProbes(normalised.url);
    const finished: ProbeResult[] = [];
    const show = (result: ProbeResult) => {
      finished.push(result);
      setResults(finished.slice());
      return result;
    };

    const reach = show(
      await runHttpProbe('Reach Home Assistant', probes.reach, fetchSend, () => true),
    );
    show(
      await runHttpProbe('Read sign-in options', probes.providers, fetchSend, isProvidersAnswer),
    );
    const startSignIn = show(
      await runHttpProbe('Start sign-in', probes.startSignIn, fetchSend, isSignInFormAnswer),
    );
    show(await runWebSocketProbe(probes.webSocketUrl, openWebSocket));

    setRoute(decideSignInRoute(reach, startSignIn));
    setMessage('Finished testing ' + normalised.url);
    setRunning(false);
  }

  return (
    <div class="proof">
      <h1>Home Assist LG: TV proof</h1>

      <div class="proof-row">
        <div class="proof-label">Browser engine:</div>
        <div class="proof-value">{navigator.userAgent}</div>
      </div>
      <div class="proof-row">
        <div class="proof-label">CSS grid:</div>
        <div class="proof-value">{cssGridSupport()}</div>
      </div>

      <div class="proof-controls">
        <div class="proof-field">
          <label for="address">Home Assistant address</label>
          <input
            id="address"
            ref={addressField}
            type="text"
            value={address}
            onInput={(event) => setAddress(event.currentTarget.value)}
          />
        </div>
        <button ref={runButton} disabled={running} onClick={runTests}>
          Run tests
        </button>
        <button ref={closeButton} class="secondary" onClick={() => window.close()}>
          Close app
        </button>
      </div>

      <div class="proof-message">{message}</div>

      {results.map((result) => (
        <div class="proof-row" key={result.name}>
          <div class="proof-label">{result.name}:</div>
          <div
            class={
              'proof-value ' + (result.outcome === 'reached' ? 'outcome-reached' : 'outcome-other')
            }
          >
            {describeResult(result)}
          </div>
        </div>
      ))}

      {route !== null && <div class="proof-verdict">Sign-in route: {route}</div>}

      <div class="proof-row" style={{ marginTop: 'auto' }}>
        <div class="proof-label">Last key:</div>
        <div class="proof-value">{lastKey}</div>
      </div>
    </div>
  );
}
