// Reads what the TV's install service prints while it installs a package, and says
// whether the install has finished, failed, or is still going.
//
// The service prints one JSON message per progress step. Only two things matter to us,
// so this looks for them as text and does not try to parse the stream.

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
