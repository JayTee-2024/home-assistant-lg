import { expect, it } from 'vitest';
import { remoteKeyFromCode } from './keys';

it('names the remote keys', () => {
  const expected: Array<[number, string]> = [
    [37, 'left'],
    [38, 'up'],
    [39, 'right'],
    [40, 'down'],
    [13, 'ok'],
    [461, 'back'],
    [403, 'red'],
    [404, 'green'],
    [405, 'yellow'],
    [406, 'blue'],
    [33, 'channelUp'],
    [34, 'channelDown'],
  ];
  for (const [code, name] of expected) expect(remoteKeyFromCode(code)).toBe(name);
});

it('treats Backspace and Escape as back, for desktop development', () => {
  expect(remoteKeyFromCode(8)).toBe('back');
  expect(remoteKeyFromCode(27)).toBe('back');
});

it('returns null for any other key', () => {
  expect(remoteKeyFromCode(65)).toBeNull();
});
