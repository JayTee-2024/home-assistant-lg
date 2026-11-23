import { expect, it } from 'vitest';
import { installCommand, launchCommand, stopCommand } from './tv-commands.mjs';

it('builds the install command, reading nothing from standard input and printing its process number', () => {
  expect(installCommand('/tmp/home-assist-lg.ipk')).toBe(
    'luna-send -i -f luna://com.webos.appInstallService/dev/install ' +
      '\'{"id":"com.ares.defaultName","ipkUrl":"/tmp/home-assist-lg.ipk","subscribe":true}\'' +
      ' < /dev/null & echo "install-pid:$!"; wait',
  );
});

it('builds the command that stops a process on the TV', () => {
  expect(stopCommand('6855')).toBe('kill 6855');
});

it('refuses to build a stop command from anything but a process number', () => {
  expect(() => stopCommand('6855; reboot')).toThrow('not a process number');
  expect(() => stopCommand('')).toThrow('not a process number');
});

it('builds the launch command, reading nothing from standard input', () => {
  expect(launchCommand('net.badacid.homeassistlg')).toBe(
    'luna-send -n 1 -f luna://com.webos.service.applicationManager/launch ' +
      '\'{"id":"net.badacid.homeassistlg"}\'' +
      ' < /dev/null',
  );
});
