import { describe, expect, it } from 'vitest';
import { clock, MATH_GENERATORS, rng, type MathType, type Question } from './questions';
import { deal, dealDone, hintTexts, numbersIn, startDeal, type HintStep, type Visual } from './hints';
import { dealScene } from './visual';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
const HINTED = Object.keys(MATH_GENERATORS) as MathType[];
const HEBREW = /[\u0590-\u05ff]/;

function calc(expr: string): number {
  const js = expr.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  if (!/^[\d\s+\-*/()]+$/.test(js)) throw new Error(`not arithmetic: ${expr}`);
  return Function(`return (${js})`)() as number;
}
const visible = (s: string) => s.replace(/[⁦⁩]/g, '');
const toMin = (t: string) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);

/** `s` appears in `text` as a whole word or number (not inside a longer word, e.g. שעה inside השעה). */
function containsWord(text: string, s: string): boolean {
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\u0590-\\u05ff\\d])${esc}([^\\u0590-\\u05ff\\d]|$)`).test(visible(text));
}

/** Is the step true with its value? Equations are evaluated; "from 7:30 to 8:00 it's ⬜ minutes" is timed. */
function stepHolds(s: HintStep): boolean {
  const filled = s.text.replace('⬜', String(s.answer));
  if (!HEBREW.test(s.text)) {
    const [l, r] = filled.split(' = ');
    return calc(l) === calc(r);
  }
  const times = visible(s.text).match(/\d+:\d\d/g)!;
  expect(times, s.text).toHaveLength(2);
  const span = toMin(times[1]) - toMin(times[0]);
  if (s.text.includes('דקות')) return span === s.answer;
  if (s.text.includes('שעות')) return span === 60 * s.answer;
  throw new Error(`unknown step: ${s.text}`);
}
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
  if (v.kind === 'clock') {
    for (const f of v.faces) expect(f.caption, w).toContain(clock(f.t));
    let at = v.faces[0].t;
    for (const a of v.arcs ?? []) {
      expect(a.from, `${w} arcs follow each other`).toBe(at);
      at += a.min;
      // where the arc ends must not be where a hand of the answer time points
      if (q.mathOptions && a.ring === 'minute') expect(at % 60, `${w} arc ends on the answer`).not.toBe(q.value! % 60);
      if (q.mathOptions && a.ring === 'hour') expect(at % 720, `${w} arc ends on the answer`).not.toBe(q.value! % 720);
    }
    if (q.mathOptions) for (const f of v.faces) expect(f.t, `${w} a face shows the answer`).not.toBe(q.value);
  }
  if (v.kind === 'column') {
    const line = visible(q.lines![0]);
    for (const part of [v.top, v.add, v.result]) expect(line, w).toContain(part);
  }
}

describe.each(HINTED)('%s hints', (type) => {
  const questions = SEEDS.map((s) => MATH_GENERATORS[type](rng(s)));

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
      // options that aren't plain numbers (times, durations): the right one never appears as a word
      if (!q.accept && q.options.length && q.type !== 'compare') {
        const right = q.options[q.correct];
        if (!/^\d+$/.test(right))
          for (const text of hintTexts(q.hint!)) expect(containsWord(text, right), `${where(q)} shows "${right}" in "${visible(text)}"`).toBe(false);
      }
      // a duration answer is never a step's value in hours either
      if (q.type === 'time' && !q.mathOptions)
        for (const s of q.hint!.steps ?? []) if (s.text.includes('שעות')) expect(60 * s.answer, where(q)).not.toBe(q.value);
      // compare: the steps never do all the work; at least one option is left for her
      if (q.type === 'compare') expect((q.hint!.steps ?? []).length, where(q)).toBeLessThan(q.options.length);
    }
  });

  it('every step is one ⬜ that its value fills correctly', () => {
    for (const q of questions)
      for (const s of q.hint!.steps ?? []) {
        expect([...s.text].filter((c) => c === '⬜'), `${where(q)} ${s.text}`).toHaveLength(1);
        expect(Number.isInteger(s.answer) && s.answer >= 0, s.text).toBe(true);
        expect(stepHolds(s), `${where(q)} ${visible(s.text)} ← ${s.answer}`).toBe(true);
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
  it('most questions of these types get a drawing and steps', () => {
    for (const t of ['word', 'missing', 'sequence', 'inequality', 'proportion'] as const) {
      const qs = SEEDS.map((s) => MATH_GENERATORS[t](rng(s)));
      expect(qs.filter((q) => q.hint?.visual).length / qs.length, t).toBeGreaterThan(0.9);
      expect(qs.filter((q) => q.hint?.steps?.length).length / qs.length, t).toBeGreaterThan(0.6);
    }
  });
});

describe('dealing dots into groups (÷ drawings)', () => {
  const dealt = HINTED.flatMap((t) =>
    SEEDS.map((s) => MATH_GENERATORS[t](rng(s))).flatMap((q) => {
      const v = q.hint?.visual;
      return v?.kind === 'groups' && v.per === null ? [{ q, v }] : [];
    }),
  );

  it('is used by ÷, share, the missing × forms and proportion', () => {
    expect(new Set(dealt.map(({ q }) => q.type))).toEqual(new Set(['arith', 'word', 'missing', 'proportion']));
  });

  it('ends with every group holding total ÷ groups, and the pile empty', () => {
    for (const { q, v } of dealt) {
      expect(v.loose, where(q)).toBeDefined();
      let s = startDeal(v.loose!, v.n);
      let taps = 0;
      while (!dealDone(s)) {
        s = deal(s);
        taps++;
      }
      expect(s.pile, where(q)).toBe(0);
      expect(s.groups, where(q)).toEqual(Array(v.n).fill(v.loose! / v.n));
      expect(deal(s), where(q)).toBe(s);
      expect(taps, where(q)).toBe(v.loose! / v.n);
    }
  });

  it('never writes the per-group count: not in the data, not in any drawn text, at any point of the deal', () => {
    for (const { q, v } of dealt) {
      const per = v.loose! / v.n;
      expect(v.inner ?? v.cap ?? '', where(q)).toBe('');
      for (let s = startDeal(v.loose!, v.n); ; s = deal(s)) {
        const sc = dealScene(v, s);
        expect(sc.dots, where(q)).toHaveLength(v.loose!);
        expect(sc.dots.filter((d) => !d.dealt), where(q)).toHaveLength(s.pile);
        for (const text of sc.texts) expect(numbersIn(text), `${where(q)} "${text}"`).not.toContain(per);
        if (sc.done) break;
      }
    }
  });

  it('fits the drawing: dots inside their circles, circles inside the 320 wide frame', () => {
    for (const { q, v } of dealt) {
      let s = startDeal(v.loose!, v.n);
      while (!dealDone(s)) s = deal(s);
      const sc = dealScene(v, s);
      for (const c of sc.circles) {
        expect(c.cx - c.r, where(q)).toBeGreaterThanOrEqual(0);
        expect(c.cx + c.r, where(q)).toBeLessThanOrEqual(320);
      }
      for (const d of sc.dots) {
        const inside = sc.circles.some((c) => Math.hypot(d.x - c.cx, d.y - c.cy) + 3.4 <= c.r);
        expect(inside, where(q)).toBe(true);
      }
    }
  });
});
