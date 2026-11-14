import { describe, expect, it } from 'vitest';
import { claimNoShortcut, judge } from './game';

describe('judge', () => {
  it('pays 3★ for smart, 1★ for plain correct', () => {
    expect(judge(5, 5, 0, true)).toEqual({ kind: 'correct', stars: 3 });
    expect(judge(5, 5, 0, false)).toEqual({ kind: 'correct', stars: 1 });
  });

  it('still pays 3★ when smart and right on the second try', () => {
    expect(judge(5, 5, 1, true)).toEqual({ kind: 'correct', stars: 3 });
  });

  it('first miss retries, second miss reveals with 1★', () => {
    expect(judge(4, 5, 0, true)).toEqual({ kind: 'retry' });
    expect(judge(4, 5, 1, true)).toEqual({ kind: 'reveal', stars: 1 });
  });
});

describe('claimNoShortcut', () => {
  it('nudges once in a learning problem that has a trick, then unlocks', () => {
    expect(claimNoShortcut('make10', true, 0)).toBe('nudge');
    expect(claimNoShortcut('make10', true, 1)).toBe('unlock');
  });

  it('unlocks right away when there really is no trick, or in mixed problems', () => {
    expect(claimNoShortcut('none', false, 0)).toBe('unlock');
    expect(claimNoShortcut('reorder', false, 0)).toBe('unlock');
  });
});
