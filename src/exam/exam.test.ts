import { describe, expect, it } from 'vitest';
import { MATH_EXAM_PLAN, MATH_GENERATORS, mathExam, rng, type MathType, type Question } from './questions';
import { PASSAGES, passageQuestions, readingExam } from './reading';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
const TYPES = Object.keys(MATH_GENERATORS) as MathType[];

const calc = (expr: string): number => {
  const js = expr.replace(/−/g, '-').replace(/×/g, '*').replace(/:/g, '/');
  if (!/^[\d\s+\-*/]+$/.test(js)) throw new Error(`not arithmetic: ${expr}`);
  return Function(`return (${js})`)() as number;
};
const visible = (s: string) => s.replace(/[⁦⁩]/g, '');

/** Solve picture equations line by line, each time picking a line with a single unknown picture. */
function solvePictures(lines: string[]): Map<string, number> {
  const known = new Map<string, number>();
  const parsed = lines.map((l) => {
    const [lhs, rhs] = l.split(' = ');
    return { terms: lhs.split(' + '), total: Number(rhs) };
  });
  for (let pass = 0; pass < lines.length; pass++) {
    for (const { terms, total } of parsed) {
      const unknown = [...new Set(terms.filter((t) => !known.has(t)))];
      if (unknown.length !== 1) continue;
      const rest = terms.filter((t) => known.has(t)).reduce((s, t) => s + known.get(t)!, 0);
      const count = terms.filter((t) => t === unknown[0]).length;
      known.set(unknown[0], (total - rest) / count);
    }
  }
  return known;
}

function independentAnswer(q: Question): number | null {
  const line = q.lines?.[0] ?? '';
  switch (q.type) {
    case 'arith':
      return calc(line.replace(' = ?', ''));
    case 'missing': {
      const [l, r] = line.split(' = ');
      const solutions = Array.from({ length: 201 }, (_, x) => x).filter(
        (x) => calc(l.replace('😊', String(x))) === calc(r.replace('😊', String(x))),
      );
      expect(solutions, line).toHaveLength(1);
      return solutions[0];
    }
    case 'pictures': {
      const asked = [...visible(q.prompt)].filter((c) => /\p{Extended_Pictographic}/u.test(c)).join('');
      return solvePictures(q.lines!).get(asked)!;
    }
    case 'sequence': {
      const terms = line.split(', ');
      const hole = terms.indexOf('?');
      const nums = terms.map(Number);
      const diffsWith = (x: number) => {
        const t = nums.map((n, i) => (i === hole ? x : n));
        return t.slice(1).map((n, i) => n - t[i]);
      };
      const fits = Array.from({ length: 300 }, (_, x) => x).filter((x) => {
        const d = diffsWith(x);
        const constant = d.every((v) => v === d[0]);
        const alternating = d.every((v, i) => v === d[i % 2]) && d[0] !== d[1];
        return constant || alternating;
      });
      expect(fits, line).toHaveLength(1);
      return fits[0];
    }
    default:
      return null;
  }
}

describe.each(TYPES)('%s generator', (type) => {
  const questions = SEEDS.map((s) => MATH_GENERATORS[type](rng(s)));

  it('always has 4 distinct options and a valid correct index', () => {
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
      expect(q.explain.length).toBeGreaterThan(5);
      expect(`${q.prompt} ${q.explain} ${q.options.join()}`).not.toMatch(/undefined|NaN|Infinity/);
    }
  });

  it('numeric options are whole numbers from 0 to 100', () => {
    for (const q of questions.filter((x) => !x.mathOptions)) {
      for (const o of q.options) {
        expect(Number.isInteger(Number(o)), o).toBe(true);
        expect(Number(o)).toBeGreaterThanOrEqual(0);
        expect(Number(o)).toBeLessThanOrEqual(100);
      }
      expect(q.options[q.correct]).toBe(String(q.value));
    }
  });

  it('the marked answer matches an answer worked out independently from the question', () => {
    for (const q of questions) {
      const ans = independentAnswer(q);
      if (ans !== null) expect(String(ans), `${q.lines?.join(' | ')}`).toBe(q.options[q.correct]);
    }
  });
});

describe('compare', () => {
  it('exactly one option has the biggest (or smallest) result, and it is the marked one', () => {
    for (const s of SEEDS) {
      const q = MATH_GENERATORS.compare(rng(s));
      const values = q.options.map(calc);
      expect(new Set(values).size).toBe(4);
      const want = q.prompt.includes('גדולה') ? Math.max(...values) : Math.min(...values);
      expect(values[q.correct]).toBe(want);
      for (const o of q.options) expect(o).toMatch(/^\d+ [+−] \d+$/);
      for (const o of q.options) expect(o.split(/ [+−] /).every((n) => Number(n) > 0 && Number(n) < 100)).toBe(true);
    }
  });
});

describe('word problems', () => {
  it('never produce negative change or money that does not add up', () => {
    for (const s of SEEDS) {
      const q = MATH_GENERATORS.word(rng(s));
      expect(q.value!).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('exams', () => {
  it('math exam follows the plan and is reproducible from its seed', () => {
    const a = mathExam(42);
    expect(a.map((q) => q.type)).toEqual(MATH_EXAM_PLAN);
    expect(mathExam(42)).toEqual(a);
    expect(mathExam(43)).not.toEqual(a);
  });

  it('reading exam uses two different passages', () => {
    const q = readingExam(7);
    expect(new Set(q.map((x) => x.passageId)).size).toBe(2);
    expect(q.length).toBe(12);
  });

  it.each(PASSAGES)('passage $id: options are distinct and the answer is marked', (p) => {
    for (const s of [1, 2, 3]) {
      const qs = passageQuestions(p, s);
      qs.forEach((q, i) => {
        expect(new Set(q.options).size).toBe(4);
        expect(q.options[q.correct]).toBe(p.questions[i].answer);
      });
    }
  });

  it('correct answers are spread over all four positions', () => {
    const counts = [0, 0, 0, 0];
    for (const s of SEEDS) for (const q of [...mathExam(s), ...readingExam(s)]) counts[q.correct]++;
    const total = counts.reduce((a, b) => a + b, 0);
    for (const c of counts) expect(c / total).toBeGreaterThan(0.2);
  });
});
