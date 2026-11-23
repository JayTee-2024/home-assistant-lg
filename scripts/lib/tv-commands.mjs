// The commands the deploy script runs on the TV, as text.
//
// Both use luna-send, the TV's tool for calling its own system services.

// Why every command ends with "< /dev/null": when luna-send is started over SSH without a
// terminal, it prints nothing and exits at once, reporting success. Giving it an empty
// standard input makes it behave. Found on an LG C9 (webOS 4.5) on 2026-11-23.
const NO_INPUT = ' < /dev/null';

/** Asks the TV's install service to install a package already copied to the TV. */
export function installCommand(remotePackagePath) {
  const request = JSON.stringify({
    // The install service wants an id here but takes the real one from the package.
    // This is the value LG's own tools send.
    id: 'com.ares.defaultName',
    ipkUrl: remotePackagePath,
    subscribe: true,
  });
  // -i keeps luna-send running so it prints each progress message as the install proceeds.
  return (
    "luna-send -i -f luna://com.webos.appInstallService/dev/install '" + request + "'" + NO_INPUT
  );
}

/** Asks the TV to open an installed app. */
export function launchCommand(appId) {
  const request = JSON.stringify({ id: appId });
  return (
    "luna-send -n 1 -f luna://com.webos.service.applicationManager/launch '" +
    request +
    "'" +
    NO_INPUT
  );
}
