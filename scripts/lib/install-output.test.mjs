import { expect, it } from 'vitest';
import { readInstallProgress } from './install-output.mjs';

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
