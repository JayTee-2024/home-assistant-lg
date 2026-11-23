import { expect, test } from 'vitest';
import { devBuildOptions, releaseBuildOptions } from './build-options.mjs';

test('the release build is minified and carries no source maps', () => {
  expect(releaseBuildOptions.minify).toBe(true);
  expect(releaseBuildOptions.sourcemap).toBe(false);
});

test('the development build keeps source maps for debugging', () => {
  expect(devBuildOptions.sourcemap).toBe('linked');
});

test('both builds target the TV browser engine', () => {
  for (const options of [releaseBuildOptions, devBuildOptions]) {
    expect(options.target).toEqual(['chrome53']);
    expect(options.format).toBe('iife');
  }
});
