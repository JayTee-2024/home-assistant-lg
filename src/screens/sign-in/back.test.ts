import { describe, expect, it } from 'vitest';
import { backFrom } from './back';

describe('backFrom', () => {
  it('goes from username and password back to the address', () => {
    expect(backFrom('credentials')).toBe('address');
  });

  it('starts the sign-in again from the two-step code and the access token forms', () => {
    expect(backFrom('code')).toBe('restart');
    expect(backFrom('token')).toBe('restart');
  });

  it('leaves Back to the app on the first forms, where it leaves the app', () => {
    expect(backFrom('address')).toBeNull();
    expect(backFrom('looking')).toBeNull();
  });
});
