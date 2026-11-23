// Turns what ssh printed when it failed into one sentence that says what to do.
// deploy.mjs prints ssh's own output first, then this.

/**
 * @param output  everything ssh printed
 * @param host    the TV's address
 * @param keyPath the private key file deploy.mjs gave ssh
 */
export function describeSshFailure(output, host, keyPath) {
  // Windows' ssh ignores a key file that other users of the computer can read.
  if (output.includes('bad permissions') || output.includes('UNPROTECTED PRIVATE KEY')) {
    const windowsPath = keyPath.replace(/\//g, '\\');
    return (
      'ssh would not use the key file because other users on this computer can read it.\n' +
      'On Windows, run these two commands in Command Prompt from this folder, then deploy again:\n' +
      '  icacls "' +
      windowsPath +
      '" /inheritance:r\n' +
      '  icacls "' +
      windowsPath +
      '" /grant:r "%USERNAME%:R"\n' +
      'On Mac or Linux, run: chmod 600 "' +
      keyPath +
      '"'
    );
  }
  if (output.includes('Permission denied')) {
    return (
      'The TV at ' +
      host +
      ' refused the SSH key. ' +
      'Check that TV_SSH_KEY in .env.local names the key the TV accepts for root.'
    );
  }
  if (
    /timed out|No route to host|Connection refused|Network is unreachable|Could not resolve/.test(
      output,
    )
  ) {
    return (
      'Could not reach the TV at ' + host + '. Is it switched on, with its SSH server running?'
    );
  }
  return 'Could not copy the package to the TV at ' + host + '. The message above says why.';
}
