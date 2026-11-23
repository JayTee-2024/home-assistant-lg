import { expect, it } from 'vitest';
import { installCommand, launchCommand } from './tv-commands.mjs';

it('builds the install command, reading nothing from standard input', () => {
  expect(installCommand('/tmp/home-assist-lg.ipk')).toBe(
    'luna-send -i -f luna://com.webos.appInstallService/dev/install ' +
      '\'{"id":"com.ares.defaultName","ipkUrl":"/tmp/home-assist-lg.ipk","subscribe":true}\'' +
      ' < /dev/null',
  );
});

it('builds the launch command, reading nothing from standard input', () => {
  expect(launchCommand('net.badacid.homeassistlg')).toBe(
    'luna-send -n 1 -f luna://com.webos.service.applicationManager/launch ' +
      '\'{"id":"net.badacid.homeassistlg"}\'' +
      ' < /dev/null',
  );
});
