import { describe, expect, it } from 'vitest';
import { judge } from './game';

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
