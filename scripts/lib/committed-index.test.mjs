import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { downloadUrl, packageFileName } from './release-files.mjs';

// webosbrew/apps.json is what people add to Homebrew Channel. Between releases it must be a valid
// index, and every package it lists must point at that version's GitHub release.
const index = JSON.parse(readFileSync('webosbrew/apps.json', 'utf8'));

test('the committed index has the shape Homebrew Channel reads', () => {
  expect(index.paging.itemsTotal).toBe(index.packages.length);
  expect(Array.isArray(index.packages)).toBe(true);
});

test('every listed package downloads from its own version’s GitHub release', () => {
  for (const entry of index.packages) {
    const { id, version, ipkUrl } = entry.manifest;
    expect(ipkUrl).toBe(downloadUrl(version, packageFileName(id, version)));
  }
});
