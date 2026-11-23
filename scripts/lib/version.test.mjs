import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// The version is set in package.json. package-lock.json repeats it, and npm rewrites the lock
// file on the next install when the two differ, which leaves an unexplained change behind.
test('package-lock.json carries the same version as package.json', () => {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  expect(lock.version).toBe(version);
  expect(lock.packages[''].version).toBe(version);
});
