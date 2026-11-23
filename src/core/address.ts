/**
 * Turns what the user typed into the base address of their Home Assistant,
 * for example "192.168.1.100" into "http://192.168.1.100:8123".
 *
 * It only tidies and validates the text. It does not check that anything
 * answers at the address.
 */

export type AddressResult = { ok: true; url: string } | { ok: false; reason: 'empty' | 'invalid' };

/** The address Home Assistant uses on most home networks. Tried before asking the user. */
export const DEFAULT_ADDRESS = 'homeassistant.local:8123';

/** Home Assistant's own default port. */
const DEFAULT_PORT = '8123';

export function normaliseAddress(input: string): AddressResult {
  const typed = input.trim();
  if (typed === '') {
    return { ok: false, reason: 'empty' };
  }
  if (/\s/.test(typed)) {
    return { ok: false, reason: 'invalid' };
  }

  const schemeWasTyped = /^https?:\/\//i.test(typed);
  if (!schemeWasTyped && typed.includes('://')) {
    // Some other scheme, such as ftp://. Only http and https reach Home Assistant.
    return { ok: false, reason: 'invalid' };
  }

  const candidate = schemeWasTyped ? typed : 'http://' + typed;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.hostname === '') {
    return { ok: false, reason: 'invalid' };
  }

  // Why not just read parsed.port: URL drops a port that is the default for its scheme, so a
  // typed ":80" reads back as "". We look at the typed text to tell "no port" from "port 80".
  const hostAndPort = candidate.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] ?? '';
  const portWasTyped = /:\d+$/.test(hostAndPort);

  // Someone who typed a full address knows their port. Only a bare host gets the default.
  const port = schemeWasTyped || portWasTyped ? parsed.port : DEFAULT_PORT;

  const url = parsed.protocol + '//' + parsed.hostname + (port === '' ? '' : ':' + port);
  return { ok: true, url };
}
