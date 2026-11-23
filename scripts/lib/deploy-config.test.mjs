import { expect, it } from 'vitest';
import { readDeployConfig } from './deploy-config.mjs';

it('lists every missing setting', () => {
  expect(readDeployConfig({})).toEqual({
    ok: false,
    problems: ['TV_HOST is not set', 'TV_SSH_KEY is not set'],
  });
});

it('uses root and port 22 unless told otherwise', () => {
  expect(readDeployConfig({ TV_HOST: '192.168.1.65', TV_SSH_KEY: '/keys/tv' })).toEqual({
    ok: true,
    host: '192.168.1.65',
    keyPath: '/keys/tv',
    user: 'root',
    port: 22,
  });
});

it('accepts a user and port', () => {
  expect(
    readDeployConfig({
      TV_HOST: 'tv',
      TV_SSH_KEY: '/k',
      TV_SSH_USER: 'prisoner',
      TV_SSH_PORT: '9922',
    }),
  ).toMatchObject({ ok: true, user: 'prisoner', port: 9922 });
});

it('rejects a port that is not a whole number from 1 to 65535', () => {
  for (const bad of ['abc', '0', '70000', '22.5']) {
    expect(readDeployConfig({ TV_HOST: 'tv', TV_SSH_KEY: '/k', TV_SSH_PORT: bad })).toEqual({
      ok: false,
      problems: ['TV_SSH_PORT must be a whole number from 1 to 65535'],
    });
  }
});

it('treats blank values as not set', () => {
  expect(readDeployConfig({ TV_HOST: '  ', TV_SSH_KEY: '' })).toEqual({
    ok: false,
    problems: ['TV_HOST is not set', 'TV_SSH_KEY is not set'],
  });
});

it('trims spaces around values', () => {
  expect(readDeployConfig({ TV_HOST: ' 192.168.1.65 ', TV_SSH_KEY: ' /keys/tv ' })).toMatchObject({
    ok: true,
    host: '192.168.1.65',
    keyPath: '/keys/tv',
  });
});
