import { expect, test } from 'vitest';
import {
  downloadUrl,
  makeManifest,
  makeRepositoryIndex,
  packageFileName,
  REPOSITORY_URL,
} from './release-files.mjs';

const appInfo = {
  id: 'net.badacid.homeassistlg',
  version: '1.0.0',
  type: 'web',
  title: 'Home Assist LG',
};

test('the package file name is the one ares-package writes', () => {
  expect(packageFileName('net.badacid.homeassistlg', '1.0.0')).toBe(
    'net.badacid.homeassistlg_1.0.0_all.ipk',
  );
});

test('downloads come from the GitHub release for that version', () => {
  expect(downloadUrl('1.0.0', 'a.ipk')).toBe(
    'https://github.com/JayTee-2024/home-assistant-lg/releases/download/v1.0.0/a.ipk',
  );
});

test('a base address replaces the GitHub release, with or without a trailing slash', () => {
  expect(downloadUrl('1.0.0', 'a.ipk', 'http://192.168.1.10:8080')).toBe(
    'http://192.168.1.10:8080/a.ipk',
  );
  expect(downloadUrl('1.0.0', 'a.ipk', 'http://192.168.1.10:8080/')).toBe(
    'http://192.168.1.10:8080/a.ipk',
  );
});

test('the manifest describes the exact package bytes', () => {
  const manifest = makeManifest(
    appInfo,
    new TextEncoder().encode('abc'),
    'https://example.com/a.ipk',
  );
  expect(manifest).toEqual({
    id: 'net.badacid.homeassistlg',
    version: '1.0.0',
    type: 'web',
    title: 'Home Assist LG',
    appDescription: 'Control your Home Assistant home with the TV remote.',
    iconUri:
      'https://raw.githubusercontent.com/JayTee-2024/home-assistant-lg/main/webos/largeIcon.png',
    sourceUrl: REPOSITORY_URL,
    rootRequired: false,
    ipkUrl: 'https://example.com/a.ipk',
    ipkSize: 3,
    ipkHash: { sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
  });
});

test('the repository index lists the one app in the shape Homebrew Channel reads', () => {
  const manifest = makeManifest(appInfo, new Uint8Array([1]), 'https://example.com/a.ipk');
  const index = makeRepositoryIndex(manifest, 'https://example.com/m.json');
  expect(index.paging).toEqual({
    page: 1,
    count: 1,
    maxPage: 1,
    itemsTotal: 1,
    prevUrl: null,
    nextUrl: null,
  });
  expect(index.packages).toEqual([
    {
      id: manifest.id,
      title: manifest.title,
      iconUri: manifest.iconUri,
      manifestUrl: 'https://example.com/m.json',
      manifest,
      pool: 'main',
      requirements: { webosRelease: '>=4.0' },
      shortDescription: manifest.appDescription,
    },
  ]);
});
