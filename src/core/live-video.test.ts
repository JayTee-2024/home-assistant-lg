import { describe, expect, it } from 'vitest';
import { nextLiveState, type LiveEvent, type LiveState } from './live-video';

const ALL_STATES: LiveState[] = ['idle', 'connecting', 'playing', 'ended', 'failed'];

describe('nextLiveState', () => {
  it('starts connecting from idle, and again after an end or a failure', () => {
    expect(nextLiveState('idle', 'start')).toBe('connecting');
    expect(nextLiveState('ended', 'start')).toBe('connecting');
    expect(nextLiveState('failed', 'start')).toBe('connecting');
  });

  it('plays once the picture arrives', () => {
    expect(nextLiveState('connecting', 'picture')).toBe('playing');
    expect(nextLiveState('playing', 'picture')).toBe('playing');
  });

  it('fails when the session breaks before any picture arrived', () => {
    const failures: LiveEvent[] = ['connection-lost', 'refused', 'timed-out'];
    for (const event of failures) expect(nextLiveState('connecting', event)).toBe('failed');
  });

  it('ends when a playing session is cut off', () => {
    expect(nextLiveState('playing', 'connection-lost')).toBe('ended');
    expect(nextLiveState('playing', 'refused')).toBe('ended');
  });

  it('ignores the time limit once the picture is playing', () => {
    expect(nextLiveState('playing', 'timed-out')).toBe('playing');
  });

  it('goes back to idle when stopped, from anywhere', () => {
    for (const state of ALL_STATES) expect(nextLiveState(state, 'stop')).toBe('idle');
  });

  it('ignores late events once the session is over', () => {
    for (const state of ['idle', 'ended', 'failed'] as LiveState[]) {
      expect(nextLiveState(state, 'picture')).toBe(state);
      expect(nextLiveState(state, 'connection-lost')).toBe(state);
    }
  });

  it('does not start a second session while one is running', () => {
    expect(nextLiveState('connecting', 'start')).toBe('connecting');
    expect(nextLiveState('playing', 'start')).toBe('playing');
  });
});
