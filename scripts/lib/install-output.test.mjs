import { expect, it } from 'vitest';
import { readInstallAnswer, readInstallPid, readInstallProgress } from './install-output.mjs';

it('is waiting while the TV is still installing', () => {
  const output = `{
    "id": "com.ares.defaultName",
    "statusValue": 13,
    "details": { "packageId": "net.badacid.homeassistlg", "state": "installing" },
    "returnValue": true
}`;
  expect(readInstallProgress(output)).toBe('waiting');
  expect(readInstallProgress('')).toBe('waiting');
});

it('is installed once the TV reports the installed state, however the JSON is spaced', () => {
  expect(readInstallProgress('{ "details": { "state": "installed" }, "returnValue": true }')).toBe(
    'installed',
  );
  expect(readInstallProgress('{"details":{"state":"installed"}}')).toBe('installed');
});

it('is failed when the TV refuses the request', () => {
  const output = '{ "returnValue": false, "errorCode": -1, "errorText": "Not permitted" }';
  expect(readInstallProgress(output)).toBe('failed');
});

it('is failed when the TV reports an install failure', () => {
  const output = '{ "details": { "state": "install failed", "reason": "FAILED_IPKG_INSTALL" } }';
  expect(readInstallProgress(output)).toBe('failed');
});

it('treats a failure seen after earlier progress as failed', () => {
  const output = '{ "details": { "state": "installing" } }\n{ "details": { "reason": "FAILED" } }';
  expect(readInstallProgress(output)).toBe('failed');
});

it('reads the process number the install command prints first', () => {
  expect(readInstallPid('install-pid:6855\n{ "returnValue": true }')).toBe('6855');
});

it('has no process number when the TV printed none', () => {
  expect(readInstallPid('')).toBeNull();
  expect(readInstallPid('{ "state": "installed" }')).toBeNull();
});

it("gives the install service's answer without the process number line", () => {
  expect(readInstallAnswer('install-pid:6855\n{ "returnValue": true }\n')).toBe(
    '{ "returnValue": true }',
  );
});

it('gives an empty answer when the TV printed only the process number', () => {
  expect(readInstallAnswer('install-pid:6855\n')).toBe('');
});
