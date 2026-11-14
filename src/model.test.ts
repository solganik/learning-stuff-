import { describe, expect, it } from 'vitest';
import {
  evaluate,
  format,
  mergeRoundPrefix,
  move,
  neighbours,
  parse,
  round,
  roundOption,
  split,
  splitOptions,
  MAX_TERMS,
  type Expr,
  type OpResult,
} from './model';

const ok = (r: OpResult): Expr => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.expr;
};

describe('parse / format', () => {
  it('round-trips with typographic minus', () => {
    expect(format(parse('13 − 6 + 7'))).toBe('13 − 6 + 7');
    expect(evaluate(parse('13 − 6 + 7'))).toBe(14);
  });
});

describe('move', () => {
  it('carries the sign with the number', () => {
    expect(format(ok(move(parse('7 − 5 + 3'), 2, 1)))).toBe('7 + 3 − 5');
    expect(format(ok(move(parse('7 − 5 + 3'), 1, 3)))).toBe('7 + 3 − 5');
    expect(format(ok(move(parse('7 − 5 + 3'), 2, 0)))).toBe('3 + 7 − 5');
  });

  it('rejects a negative term landing first, including when the first term moves away', () => {
    expect(move(parse('7 − 5 + 3'), 1, 0)).toEqual({ ok: false, reason: 'leading-negative' });
    expect(move(parse('7 − 5 + 3'), 0, 3)).toEqual({ ok: false, reason: 'leading-negative' });
  });

  it('treats the gaps on either side of a term as no-ops', () => {
    expect(move(parse('8 + 5'), 0, 0)).toEqual({ ok: false, reason: 'noop' });
    expect(move(parse('8 + 5'), 0, 1)).toEqual({ ok: false, reason: 'noop' });
  });
});

describe('split', () => {
  it('splits in place, both parts keep the sign', () => {
    expect(format(ok(split(parse('8 + 5'), 1, 2)))).toBe('8 + 2 + 3');
    expect(format(ok(split(parse('7 − 5 + 3'), 1, 2)))).toBe('7 − 2 − 3 + 3');
  });

  it('gives unique ids to the parts', () => {
    const e = ok(split(ok(split(parse('9 + 6'), 1, 1)), 2, 2));
    expect(new Set(e.map((t) => t.id)).size).toBe(e.length);
  });

  it('refuses 1, out-of-range parts, and growing past MAX_TERMS', () => {
    expect(split(parse('4 + 1'), 1, 1)).toEqual({ ok: false, reason: 'cannot-split' });
    expect(split(parse('8 + 5'), 1, 5)).toEqual({ ok: false, reason: 'cannot-split' });
    const full = parse(Array.from({ length: MAX_TERMS }, () => '2').join(' + '));
    expect(split(full, 0, 1)).toEqual({ ok: false, reason: 'too-many-terms' });
  });

  it('lists every ordered split up to 10, and big + small above 10', () => {
    expect(splitOptions(5)).toEqual([[1, 4], [2, 3], [3, 2], [4, 1]]);
    expect(splitOptions(1)).toEqual([]);
    expect(splitOptions(25)).toEqual([[24, 1], [23, 2], [22, 3], [21, 4], [20, 5], [19, 6], [18, 7], [17, 8], [16, 9]]);
  });
});

describe('round and fix', () => {
  it('is offered only one or two below a ten', () => {
    expect(roundOption(9)).toEqual({ up: 10, fix: 1 });
    expect(roundOption(48)).toEqual({ up: 50, fix: 2 });
    expect(roundOption(7)).toBeNull();
    expect(roundOption(40)).toBeNull();
  });

  it('flips the sign of the fix and marks the round part', () => {
    expect(format(ok(round(parse('26 + 9'), 1)))).toBe('26 + 10 − 1');
    expect(format(ok(round(parse('63 − 9'), 1)))).toBe('63 − 10 + 1');
    expect(ok(round(parse('26 + 9'), 1))[1].made).toBe('round');
    expect(round(parse('26 + 7'), 1)).toEqual({ ok: false, reason: 'cannot-split' });
  });
});

describe('merge', () => {
  it('collapses the shortest round prefix into one made tile', () => {
    const merged = mergeRoundPrefix(parse('38 + 2 + 5'))!;
    expect(format(merged)).toBe('40 + 5');
    expect(merged[0].made).toBe('ten');
    expect(format(mergeRoundPrefix(parse('27 + 3 − 8'))!)).toBe('30 − 8');
  });

  it('leaves expressions without a round prefix alone', () => {
    expect(mergeRoundPrefix(parse('38 + 7'))).toBeNull();
    expect(mergeRoundPrefix(parse('5 − 5 + 2 + 3'))).toBeNull();
  });

  it('made tiles cannot be split or rounded again', () => {
    const merged = mergeRoundPrefix(parse('38 + 2 + 5'))!;
    expect(split(merged, 0, 1)).toEqual({ ok: false, reason: 'locked' });
    expect(round(ok(round(parse('26 + 9'), 1)), 1)).toEqual({ ok: false, reason: 'locked' });
  });
});

describe('equality invariant', () => {
  it('every expression within 3 operations (and its merge) keeps the value and a positive first term', () => {
    for (const text of ['7 − 5 + 3', '27 − 8 + 3', '54 + 19', '63 − 9']) {
      const start = parse(text);
      let frontier = [start];
      for (let depth = 0; depth < 3; depth++) {
        frontier = frontier.flatMap(neighbours);
        for (const e of frontier) {
          expect(evaluate(e)).toBe(evaluate(start));
          expect(e[0].sign).toBe(1);
          const merged = mergeRoundPrefix(e);
          if (merged) expect(evaluate(merged)).toBe(evaluate(start));
        }
      }
    }
  });
});
