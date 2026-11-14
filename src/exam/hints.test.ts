import { describe, expect, it } from 'vitest';
import { MATH_GENERATORS, rng, type MathType, type Question } from './questions';
import { hintTexts, numbersIn, type Visual } from './hints';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
const HINTED: MathType[] = ['word', 'missing', 'sequence', 'arith'];
/** Kinds that get their hints in a later step. */
const later = (q: Question) => q.type === 'arith' && /[×÷]/.test(q.lines![0]);

function calc(expr: string): number {
  const js = expr.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  if (!/^[\d\s+\-*/()]+$/.test(js)) throw new Error(`not arithmetic: ${expr}`);
  return Function(`return (${js})`)() as number;
}
const visible = (s: string) => s.replace(/[⁦⁩]/g, '');
const where = (q: Question) => `${q.type}: ${visible(q.prompt)} ${q.lines?.join(' | ') ?? ''}`;

/** Every number the question already shows, and a test for "this number is (an) answer". */
function answerOf(q: Question) {
  const shown = new Set(numbersIn([q.prompt, ...(q.lines ?? [])].join(' ')));
  const isAnswer = (n: number) => n === q.value || Boolean(q.accept?.(n));
  return { shown, isAnswer };
}

function checkVisual(v: Visual, q: Question): void {
  const w = where(q);
  if (v.kind === 'bar') {
    for (const s of v.rows.flatMap((r) => r.segs)) {
      expect(s.v, w).toBeGreaterThan(0);
      if (/^[\d\s+−×÷]+$/.test(s.label)) expect(calc(s.label), `${w} bar label ${s.label}`).toBe(s.v);
    }
    if (v.total) expect(v.rows.flatMap((r) => r.segs).reduce((t, s) => t + s.v, 0), w).toBe(v.total.v);
    if (v.total && /^\d+$/.test(v.total.label)) expect(Number(v.total.label), w).toBe(v.total.v);
  }
  if (v.kind === 'line') {
    expect(v.jumps.length, w).toBe(v.points.length - 1);
    v.points.forEach((p, i) => {
      if (/^\d+$/.test(p.label)) expect(Number(p.label), w).toBe(p.v);
      if (i === 0) return;
      const j = v.jumps[i - 1];
      if (j !== '?') expect(calc(`${v.points[i - 1].v} ${j[0]} ${j.slice(1)}`), `${w} jump ${j}`).toBe(p.v);
    });
  }
  if (v.kind === 'chain') {
    const shown = numbersIn(q.lines!.join(' '));
    for (const it of v.items) if (it !== '?') expect(shown, w).toContain(Number(it));
    for (const a of v.arcs) {
      expect(a.from, w).toBeLessThan(a.to);
      expect(a.to, w).toBeLessThan(v.items.length);
    }
  }
  if (v.kind === 'groups') {
    expect(v.n, w).toBeGreaterThan(0);
    if (v.total && /^\d+$/.test(v.total)) expect(v.per === null ? v.loose : v.n * v.per, w).toBe(Number(v.total));
  }
}

describe.each(HINTED)('%s hints', (type) => {
  const questions = SEEDS.map((s) => MATH_GENERATORS[type](rng(s))).filter((q) => !later(q));

  it('every question has a hint with a guiding question', () => {
    for (const q of questions) {
      expect(q.hint, where(q)).toBeDefined();
      expect(q.hint!.ask.length, where(q)).toBeGreaterThan(5);
      expect(hintTexts(q.hint!).join(' '), where(q)).not.toMatch(/undefined|NaN|Infinity/);
    }
  });

  it('never shows the answer: not in a text, a label, or a step value', () => {
    for (const q of questions) {
      const { shown, isAnswer } = answerOf(q);
      for (const text of hintTexts(q.hint!))
        for (const n of numbersIn(text)) if (isAnswer(n)) expect(shown.has(n), `${where(q)} leaks ${n} in "${visible(text)}"`).toBe(true);
      for (const s of q.hint!.steps ?? []) expect(isAnswer(s.answer), `${where(q)} step ${s.text}`).toBe(false);
      if (!q.accept && q.options.length) {
        const right = q.options[q.correct];
        if (!/^\d+$/.test(right)) for (const text of hintTexts(q.hint!)) expect(visible(text), where(q)).not.toContain(right);
      }
    }
  });

  it('every step is one ⬜ that its value fills correctly', () => {
    for (const q of questions)
      for (const s of q.hint!.steps ?? []) {
        expect([...s.text].filter((c) => c === '⬜'), `${where(q)} ${s.text}`).toHaveLength(1);
        expect(Number.isInteger(s.answer) && s.answer >= 0, s.text).toBe(true);
        const [l, r] = s.text.replace('⬜', String(s.answer)).split(' = ');
        expect(calc(l), `${where(q)} ${s.text} ← ${s.answer}`).toBe(calc(r));
      }
  });

  it('drawings match the question numbers', () => {
    for (const q of questions) if (q.hint!.visual) checkVisual(q.hint!.visual, q);
  });

  it('highlighted words are really in the prompt', () => {
    for (const q of questions) for (const h of q.hint!.highlight ?? []) expect(q.prompt, where(q)).toContain(h);
  });
});

describe('hint ladders have substance', () => {
  it('most word, missing and sequence questions get a drawing and steps', () => {
    for (const t of ['word', 'missing', 'sequence'] as const) {
      const qs = SEEDS.map((s) => MATH_GENERATORS[t](rng(s)));
      expect(qs.filter((q) => q.hint?.visual).length / qs.length, t).toBeGreaterThan(0.9);
      expect(qs.filter((q) => q.hint?.steps?.length).length / qs.length, t).toBeGreaterThan(0.6);
    }
  });
});
