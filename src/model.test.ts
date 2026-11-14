import { describe, expect, it } from 'vitest';
import { evaluate, format, move, neighbours, parse, split, splitOptions, MAX_TERMS, type Expr } from './model';

const ok = (r: ReturnType<typeof move>): Expr => {
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

  it('lists every ordered split', () => {
    expect(splitOptions(5)).toEqual([[1, 4], [2, 3], [3, 2], [4, 1]]);
    expect(splitOptions(1)).toEqual([]);
  });
});

describe('equality invariant', () => {
  it('every expression within 3 operations keeps the value and a positive first term', () => {
    for (const text of ['7 − 5 + 3', '13 − 6 + 7', '9 + 6', '9 − 2 + 1']) {
      const start = parse(text);
      let frontier = [start];
      for (let depth = 0; depth < 3; depth++) {
        frontier = frontier.flatMap(neighbours);
        for (const e of frontier) {
          expect(evaluate(e)).toBe(evaluate(start));
          expect(e[0].sign).toBe(1);
        }
      }
    }
  });
});
