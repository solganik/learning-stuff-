import { describe, expect, it } from 'vitest';
import { MATH_EXAM_PLAN, MATH_GENERATORS, isRight, mathExam, rng, type MathType, type Question } from './questions';
import { ALL_CORRECT, PASSAGES, passageQuestions, readingExam } from './reading';
import { BANK_SIZE, bankQuestions } from './bank';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
const TYPES = Object.keys(MATH_GENERATORS) as MathType[];
const BLANKS = /[⬜😊]/u;

/** Evaluate + − × ÷ with normal precedence; numbers lose leading zeros (☀ = 0 gives "02"). */
function calc(expr: string): number {
  const js = expr
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\d+/g, (t) => String(Number(t)));
  if (!/^[\d\s+\-*/]+$/.test(js)) throw new Error(`not arithmetic: ${expr}`);
  return Function(`return (${js})`)() as number;
}
const visible = (s: string) => s.replace(/[⁦⁩]/g, '');
const emojis = (s: string) => [...visible(s)].filter((c) => /\p{Extended_Pictographic}/u.test(c) && c !== '☀');

function equationHolds(line: string): boolean {
  const [l, r] = line.split(' = ');
  return Math.abs(calc(l) - calc(r)) < 1e-9;
}

function relationHolds(line: string, x: number): boolean {
  const filled = line.replace('⬜', String(x));
  const [l, rel, r] = filled.split(/ ([<>]) /);
  return rel === '<' ? calc(l) < calc(r) : calc(l) > calc(r);
}

/** Can the asked picture equal v, with every other picture some whole number 0..60? */
function picturesFeasible(lines: string[], asked: string, v: number): boolean {
  const others = [...new Set(lines.flatMap(emojis))].filter((e) => e !== asked);
  const check = (vals: Map<string, number>) =>
    lines.every((line) => {
      const [lhs, rhs] = line.split(' = ');
      return lhs.split(' + ').reduce((s, t) => s + vals.get(t)!, 0) === Number(rhs);
    });
  const search = (i: number, vals: Map<string, number>): boolean => {
    if (i === others.length) return check(vals);
    for (let n = 0; n <= 60; n++) if (search(i + 1, new Map(vals).set(others[i], n))) return true;
    return false;
  };
  return search(0, new Map([[asked, v]]));
}

function fitsSequenceRule(nums: number[]): boolean {
  const d = nums.slice(1).map((n, i) => n - nums[i]);
  const dd = d.slice(1).map((n, i) => n - d[i]);
  const evens = nums.filter((_, i) => i % 2 === 0);
  const odds = nums.filter((_, i) => i % 2 === 1);
  const arithmetic = (a: number[]) => a.every((n, i) => i < 2 || n - a[i - 1] === a[1] - a[0]);
  return (
    d.every((v) => v === d[0]) ||
    (d.every((v, i) => v === d[i % 2]) && d[0] !== d[1]) ||
    nums.every((n, i) => i === 0 || n === 2 * nums[i - 1]) ||
    (dd.every((v) => v === dd[0]) && dd[0] !== 0) ||
    (arithmetic(evens) && arithmetic(odds) && evens.length >= 3 && odds.length >= 3)
  );
}

/** For multiple choice: which options are actually valid, judged only from the question's text. */
function validOptions(q: Question): number[] | null {
  const line = q.lines?.[0] ?? '';
  const valid = (pred: (o: string) => boolean) => q.options.map((o, i) => (pred(o) ? i : -1)).filter((i) => i >= 0);
  switch (q.type) {
    case 'arith':
      return valid((o) => calc(line.replace(' = ?', '')) === Number(o));
    case 'missing':
      return valid((o) => equationHolds(line.replace(BLANKS, o)));
    case 'inequality':
      return valid((o) => relationHolds(line, Number(o)));
    case 'pictures': {
      const asked = emojis(q.prompt)[0];
      return valid((o) => picturesFeasible(q.lines!, asked, Number(o)));
    }
    case 'digit':
      return valid((o) => equationHolds(line.replace(/☀/g, o)));
    case 'sequence': {
      const terms = line.split(', ');
      return valid((o) => fitsSequenceRule(terms.map((t) => (t === '?' ? Number(o) : Number(t)))));
    }
    case 'compare': {
      const values = q.options.map(calc);
      const want = q.prompt.includes('גדולה') ? Math.max(...values) : Math.min(...values);
      expect(values.filter((v) => v === want)).toHaveLength(1);
      return valid((o) => calc(o) === want);
    }
    default:
      return null;
  }
}

function checkQuestion(q: Question): void {
  const where = `${q.type}: ${visible(q.prompt)} ${q.lines?.join(' | ') ?? ''}`;
  expect(`${q.prompt} ${q.explain} ${q.options.join()}`, where).not.toMatch(/undefined|NaN|Infinity/);
  expect(q.explain.length, where).toBeGreaterThan(5);

  if (q.accept) {
    expect(q.options, where).toEqual([]);
    expect(q.accept(q.value!), where).toBe(true);
    const line = q.lines?.[0] ?? '';
    for (let x = 0; x <= 120; x++) {
      if (!q.accept(x)) continue;
      if (q.type === 'inequality') expect(relationHolds(line, x), `${where} accepts ${x}`).toBe(true);
      if (q.type === 'missing' || q.type === 'arith') expect(x, where).toBe(q.value);
    }
    if (q.type === 'missing') expect(equationHolds(line.replace(BLANKS, String(q.value))), where).toBe(true);
    if (q.type === 'arith') expect(calc(line.replace(' = ?', '')), where).toBe(q.value);
    return;
  }

  expect(q.options, where).toHaveLength(4);
  expect(new Set(q.options).size, where).toBe(4);
  expect(q.correct, where).toBeGreaterThanOrEqual(0);
  expect(q.correct, where).toBeLessThan(4);
  if (q.traps) expect(q.traps[q.correct], where).toBe('');
  const valid = validOptions(q);
  if (valid) expect(valid, `${where} options ${q.options.join(',')}`).toEqual([q.correct]);
}

describe.each(TYPES)('%s generator', (type) => {
  const questions = SEEDS.map((s) => MATH_GENERATORS[type](rng(s)));

  it('every question is well formed, and exactly the marked answer is valid', () => {
    for (const q of questions) checkQuestion(q);
  });

  it('numbers stay in the grade-2 range', () => {
    const cap = type === 'proportion' ? 600 : type === 'digit' ? 9 : 120;
    for (const q of questions.filter((x) => type !== 'time' && (!x.mathOptions || x.type === 'digit'))) {
      for (const o of q.options) {
        expect(Number.isInteger(Number(o)), o).toBe(true);
        expect(Number(o)).toBeGreaterThanOrEqual(0);
        expect(Number(o)).toBeLessThanOrEqual(cap);
      }
      for (const n of (q.lines ?? []).join(' ').match(/\d+/g) ?? []) expect(Number(n)).toBeLessThanOrEqual(120);
      if (q.options.length && q.value !== undefined) expect(q.options[q.correct]).toBe(String(q.value));
    }
  });
});

describe('variety', () => {
  it('missing number and inequality are sometimes open questions', () => {
    for (const t of ['missing', 'inequality'] as const) {
      const qs = SEEDS.map((s) => MATH_GENERATORS[t](rng(s)));
      const open = qs.filter((q) => q.accept).length / qs.length;
      expect(open).toBeGreaterThan(0.15);
      expect(open).toBeLessThan(0.45);
    }
  });

  it('many wrong options explain the trap they set', () => {
    const qs = SEEDS.flatMap((s) => mathExam(s)).filter((q) => q.traps);
    const withTrap = qs.filter((q) => q.traps!.some((t) => t)).length;
    expect(withTrap / qs.length).toBeGreaterThan(0.6);
  });

  it('a generator produces many different questions', () => {
    for (const t of TYPES) {
      const distinct = new Set(SEEDS.map((s) => {
        const q = MATH_GENERATORS[t](rng(s));
        return JSON.stringify([q.prompt, q.lines, q.options]);
      }));
      expect(distinct.size, t).toBeGreaterThan(150);
    }
  });
});

describe('study-guide bank', () => {
  it('has the 25 math questions, all well formed and correct', () => {
    const qs = bankQuestions(5);
    expect(qs).toHaveLength(BANK_SIZE);
    expect(BANK_SIZE).toBe(25);
    for (const q of qs) checkQuestion(q);
  });

  it('isRight works for open and multiple choice', () => {
    const [first] = bankQuestions(1);
    expect(isRight(first, 95)).toBe(true);
    expect(isRight(first, 94)).toBe(false);
    const mc = bankQuestions(1)[10];
    expect(isRight(mc, mc.correct)).toBe(true);
    expect(isRight(mc, null)).toBe(false);
  });
});

describe('exams', () => {
  it('math exam follows the plan and is reproducible from its seed', () => {
    const a = mathExam(42);
    expect(a.map((q) => q.type)).toEqual(MATH_EXAM_PLAN);
    expect(JSON.stringify(mathExam(42))).toBe(JSON.stringify(a));
    expect(JSON.stringify(mathExam(43))).not.toBe(JSON.stringify(a));
  });

  it('reading exam uses two different passages', () => {
    for (const s of SEEDS.slice(0, 50)) {
      const q = readingExam(s);
      expect(new Set(q.map((x) => x.passageId)).size).toBe(2);
      expect(q.length).toBeGreaterThanOrEqual(12);
      expect(q.length).toBeLessThanOrEqual(14);
    }
  });

  it('correct answers are spread over all four positions', () => {
    const counts = [0, 0, 0, 0];
    for (const s of SEEDS) for (const q of [...mathExam(s), ...readingExam(s)]) if (q.correct >= 0) counts[q.correct]++;
    const total = counts.reduce((a, b) => a + b, 0);
    for (const c of counts) expect(c / total).toBeGreaterThan(0.18);
  });
});

describe('reading passages', () => {
  it('there are at least 8, each with 5–7 questions', () => {
    expect(PASSAGES.length).toBeGreaterThanOrEqual(8);
    for (const p of PASSAGES) {
      expect(p.questions.length).toBeGreaterThanOrEqual(5);
      expect(p.questions.length).toBeLessThanOrEqual(7);
    }
  });

  it.each(PASSAGES)('$id: options are distinct, the answer is marked, "all correct" is last', (p) => {
    for (const s of [1, 2, 3]) {
      passageQuestions(p, s).forEach((q, i) => {
        expect(new Set(q.options).size).toBe(4);
        expect(q.options[q.correct]).toBe(p.questions[i].answer);
        if (q.options.includes(ALL_CORRECT)) expect(q.options[3]).toBe(ALL_CORRECT);
      });
    }
  });

  it.each(PASSAGES.filter((p) => p.lines))('$id: every cited line really contains what is quoted', (p) => {
    const numbered = p.lines!.filter((l) => l !== '');
    const strip = (s: string) => s.replace(/[.,!?:;'"–־\-()]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const raw of p.questions) {
      for (const text of [raw.q, raw.explain]) {
        const ref = text.match(/שור(?:ה|ות) (\d+)(?:(?:–| ו־)(\d+))?/);
        if (!ref) continue;
        const from = Number(ref[1]);
        const to = Number(ref[2] ?? ref[1]);
        expect(to, `${p.id}: ${text}`).toBeLessThanOrEqual(numbered.length);
        const span = strip(numbered.slice(from - 1, to).join(' '));
        const allLines = numbered.slice(from - 1, to);
        for (const quote of text.match(/"([^"]+)"/g) ?? []) {
          const words = strip(quote);
          // a quoted word in the question ("ממעט") or a quoted phrase in the explanation must be in the cited lines
          const found = span.includes(words) || allLines.some((l) => strip(l).includes(words));
          if (text === raw.q || words.split(' ').length > 1) expect(found, `${p.id}: "${words}" not in lines ${from}–${to}`).toBe(true);
        }
      }
    }
  });
});
