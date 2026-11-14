import { describe, expect, it } from 'vitest';
import { evaluate, format, mergeRoundPrefix, move, neighbours, parse, round, split, type Expr, type OpResult } from './model';
import { isSmartSolve } from './smart';
import { PROBLEMS } from './problems';

const ok = (r: OpResult): Expr => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.expr;
};

function reachableWithin(start: Expr, depth: number): Map<string, Expr> {
  const seen = new Map([[format(start), start]]);
  let frontier = [start];
  for (let d = 0; d < depth; d++) {
    frontier = frontier.flatMap(neighbours).filter((e) => !seen.has(format(e)));
    for (const e of frontier) seen.set(format(e), e);
  }
  return seen;
}

describe('problem set', () => {
  it('ids are 1..n in order', () => {
    expect(PROBLEMS.map((p) => p.id)).toEqual(PROBLEMS.map((_, i) => i + 1));
  });

  it.each(PROBLEMS)('#$id $text: answer is right and the smart path is reachable and smart', (p) => {
    const original = parse(p.text);
    expect(evaluate(original)).toBe(p.answer);
    const target = reachableWithin(original, 2).get(p.smartPath);
    expect(target, `${p.smartPath} not reachable from ${p.text}`).toBeDefined();
    expect(isSmartSolve(original, target!, p.tag)).toBe(true);
    const merged = mergeRoundPrefix(target!);
    if (merged) expect(isSmartSolve(original, merged, p.tag)).toBe(true);
  });

  it.each(PROBLEMS.filter((p) => p.tag !== 'none'))('#$id $text: answering untouched earns no bonus', (p) => {
    const original = parse(p.text);
    expect(isSmartSolve(original, original, p.tag)).toBe(false);
  });

  // With two-digit numbers some split can almost always build a ten (43 + 17 + 8 → 60), and that counts.
  // What matters is that a random single step rarely gets there.
  it.each(PROBLEMS.filter((p) => p.tag === 'none'))('#$id $text: random single steps rarely earn the bonus', (p) => {
    const original = parse(p.text);
    const all = neighbours(original);
    const smart = all.filter((e) => isSmartSolve(original, e, p.tag));
    expect(smart.length / all.length).toBeLessThan(0.15);
  });
});

describe('gaming cases', () => {
  it('splitting a teen into 10 + rest is not a trick', () => {
    const original = parse('13 − 6 + 7');
    expect(isSmartSolve(original, ok(split(original, 0, 10)), 'reorder')).toBe(false);
  });

  it('a running total of 0 does not count', () => {
    const original = parse('7 − 5 + 3');
    const e = ok(move(ok(split(original, 0, 2)), 0, 3));
    expect(format(e)).toBe('5 − 5 + 2 + 3');
    expect(isSmartSolve(original, e, 'reorder')).toBe(false);
  });

  it('only the split that completes 10 is smart for 8 + 5', () => {
    const original = parse('8 + 5');
    const smart = [1, 2, 3, 4].filter((a) => isSmartSolve(original, ok(split(original, 1, a)), 'make10'));
    expect(smart).toEqual([2]);
  });

  it('on 27 − 8 + 3 exactly the genuine strategies earn the bonus', () => {
    const original = parse('27 − 8 + 3');
    const smart = new Set(neighbours(original).filter((e) => isSmartSolve(original, e, 'reorder')).map(format));
    expect([...smart].sort()).toEqual(
      [
        '27 + 3 − 8', // reorder to 30
        '3 + 27 − 8', // reorder to 30
        '27 − 7 − 1 + 3', // subtract down to 20 first
        '27 − 8 + 1 + 2', // 19 + 1 = 20
        '27 − 10 + 2 + 3', // round and fix
      ].sort(),
    );
  });

  it('round-and-fix counts, and stays counted after the ten merges', () => {
    const original = parse('48 + 9');
    expect(isSmartSolve(original, ok(round(original, 1)), 'make10')).toBe(true);
    expect(isSmartSolve(original, ok(round(original, 0)), 'make10')).toBe(true);
  });

  it('a no-shortcut problem is smart when left as is, even after undoing back', () => {
    const original = parse('4 + 3');
    const swapped = ok(move(original, 1, 0));
    expect(isSmartSolve(original, swapped, 'none')).toBe(false);
    expect(isSmartSolve(original, ok(move(swapped, 1, 0)), 'none')).toBe(true);
  });

  it('building a ten on a "no trick" problem still counts', () => {
    const original = parse('43 + 25');
    const e = ok(move(ok(split(original, 1, 18)), 2, 1));
    expect(format(e)).toBe('43 + 7 + 18');
    expect(isSmartSolve(original, e, 'none')).toBe(true);
  });
});
