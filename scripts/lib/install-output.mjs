// Reads what the TV's install service prints while it installs a package, and says
// whether the install has finished, failed, or is still going.
//
// The service prints one JSON message per progress step. Only two things matter to us,
// so this looks for them as text and does not try to parse the stream.

import { INSTALL_PID_LABEL } from './tv-commands.mjs';

/**
 * @param {string} output  everything the install command has printed so far
 * @returns {'waiting' | 'installed' | 'failed'}
 */
export function readInstallProgress(output) {
  // The TV pretty-prints its JSON, so ignore spacing when matching.
  const compact = output.replace(/\s+/g, '');

  if (compact.includes('"returnValue":false') || compact.includes('FAILED')) {
    return 'failed';
  }
  if (compact.includes('"state":"installfailed"')) {
    return 'failed';
  }
  if (compact.includes('"state":"installed"')) {
    return 'installed';
  }
  return 'waiting';
}

/**
 * Finds the process number the install command prints before anything else, so the
 * deploy script can end that process when the install is over.
 *
 * @param {string} output  everything the install command has printed so far
 * @returns {string | null}  the number as text, or null when none was printed
 */
export function readInstallPid(output) {
  const start = output.indexOf(INSTALL_PID_LABEL);
  if (start === -1) return null;

  const digits = /^[0-9]+/.exec(output.slice(start + INSTALL_PID_LABEL.length));
  return digits === null ? null : digits[0];
}

/**
 * Returns what the install service itself printed: the output without the process
 * number line. Empty text means the service gave no answer at all.
 *
 * @param {string} output  everything the install command has printed so far
 * @returns {string}
 */
export function readInstallAnswer(output) {
  const pid = readInstallPid(output);
  if (pid === null) return output.trim();
  return output.replace(INSTALL_PID_LABEL + pid, '').trim();
}
