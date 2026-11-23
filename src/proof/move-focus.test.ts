/**
 * THROWAWAY: tests for move-focus.ts, deleted with the rest of src/proof.
 */

import { describe, expect, it } from 'vitest';
import { nextControlIndex } from './move-focus';

describe('nextControlIndex', () => {
  it('moves to the next control on Right', () => {
    expect(nextControlIndex(1, 'right', 3)).toBe(2);
  });

  it('moves to the previous control on Left', () => {
    expect(nextControlIndex(1, 'left', 3)).toBe(0);
  });

  it('treats Down like Right', () => {
    expect(nextControlIndex(0, 'down', 3)).toBe(1);
  });

  it('treats Up like Left', () => {
    expect(nextControlIndex(2, 'up', 3)).toBe(1);
  });

  it('stays on the last control when Right is pressed there', () => {
    expect(nextControlIndex(2, 'right', 3)).toBe(2);
  });

  it('stays on the first control when Left is pressed there', () => {
    expect(nextControlIndex(0, 'left', 3)).toBe(0);
  });

  it('goes to the first control when nothing in the row is focused', () => {
    expect(nextControlIndex(-1, 'left', 3)).toBe(0);
  });

  it('answers null for a key that does not move focus', () => {
    expect(nextControlIndex(1, 'ok', 3)).toBeNull();
  });

  it('answers null for a key the remote table does not know', () => {
    expect(nextControlIndex(1, null, 3)).toBeNull();
  });
});
