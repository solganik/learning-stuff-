import { describe, expect, it } from 'vitest';
import { clock, MATH_GENERATORS, rng, type MathType, type Question } from './questions';
import { deal, dealDone, hintTexts, numbersIn, startDeal, type HintStep, type Visual } from './hints';
import { dealScene } from './visual';
import {
  barChips,
  barDrop,
  barScene,
  barSelect,
  barSlots,
  barStart,
  chainOpen,
  chainScene,
  chainStart,
  chainTry,
  CLOCK_MATCH,
  CLOCK_MAX,
  CLOCK_OVER,
  clockPress,
  clockScene,
  DIGITS,
  digitScene,
  lineScene,
  litTexts,
  litToggle,
  type BarState,
  type ChainState,
} from './interact';

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
    expect(v.caption, w).toContain(clock(v.start));
    expect(v.adds.length, w).toBeGreaterThan(0);
    if (q.mathOptions) {
      // the answer is a clock time: no target hands, and she starts away from the answer
      expect(v.target, w).toBeUndefined();
      expect(v.start, `${w} the clock starts on the answer`).not.toBe(q.value);
    } else {
      // the answer is a duration: the target is the end time from the question, the added time is never written,
      // and no button adds exactly the answer
      expect(v.target, w).toBeDefined();
      expect(v.target!.caption, w).toContain(clock(v.target!.t));
      expect(visible(q.prompt), w).toContain(clock(v.target!.t));
      expect(v.elapsed, w).toBe(false);
      expect(v.adds, w).not.toContain(q.value);
    }
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

// ---------- drawings she works with her finger: walk every state ----------

type Of<K extends Visual['kind']> = Extract<Visual, { kind: K }>;
const ALL = HINTED.flatMap((t) => SEEDS.map((s) => MATH_GENERATORS[t](rng(s))));
const withVisual = <K extends Visual['kind']>(kind: K, qs: Question[] = ALL) =>
  qs.flatMap((q) => (q.hint?.visual?.kind === kind ? [{ q, v: q.hint.visual as Of<K> }] : []));

/** Same rule as the static hint texts: no answer number that the question doesn't show, no right option as a word. */
function expectNoLeak(q: Question, texts: string[], ctx: string): void {
  const { shown, isAnswer } = answerOf(q);
  for (const t of texts)
    for (const n of numbersIn(t)) if (isAnswer(n)) expect(shown.has(n), `${where(q)} ${ctx} leaks ${n} in "${visible(t)}"`).toBe(true);
  if (!q.accept && q.options.length && q.type !== 'compare') {
    const right = q.options[q.correct];
    if (!/^\d+$/.test(right)) for (const t of texts) expect(containsWord(t, right), `${where(q)} ${ctx} shows "${right}" in "${visible(t)}"`).toBe(false);
  }
}

describe('moving the clock hands (time)', () => {
  const clocks = withVisual('clock');

  it('every time question gets a clock', () => {
    expect(clocks).toHaveLength(SEEDS.length);
  });

  it('every reachable hand position: no answer, no readout of the hands, and the goal is reachable', () => {
    for (const { q, v } of clocks) {
      const fixed = new Set([...clockScene(v, []).texts, CLOCK_MATCH, CLOCK_OVER]);
      // the texts depend only on how much time she added, so one state per total is every text there is
      const seen = new Set([0]);
      const queue: number[][] = [[]];
      let goal = false;
      while (queue.length) {
        const s = queue.shift()!;
        const sc = clockScene(v, s);
        const ctx = `after +${sc.added} min`;
        expectNoLeak(q, sc.texts, ctx);
        if (sc.at !== v.start && sc.at !== v.target?.t)
          for (const t of sc.texts) expect(visible(t), `${where(q)} ${ctx} writes the hands' time`).not.toContain(clock(sc.at));
        if (q.mathOptions) {
          for (const t of sc.texts) expect(visible(t), `${where(q)} ${ctx}`).not.toContain(clock(q.value!));
          if (sc.at === q.value) goal = true;
        } else {
          // a duration answer: nothing that grows with the added time is ever written
          for (const t of sc.texts) expect(fixed.has(t), `${where(q)} ${ctx} writes "${visible(t)}"`).toBe(true);
          expect(sc.msg === CLOCK_MATCH, `${where(q)} ${ctx}`).toBe(sc.at === v.target!.t);
          if (sc.at === v.target!.t) goal = true;
        }
        for (const b of sc.buttons) {
          const next = clockPress(s, b.m);
          expect(next === s, `${where(q)} ${ctx}`).toBe(b.off);
          expect(sc.added + (b.off ? 0 : b.m), where(q)).toBeLessThanOrEqual(CLOCK_MAX);
          if (next !== s && !seen.has(sc.added + b.m)) {
            seen.add(sc.added + b.m);
            queue.push(next);
          }
        }
      }
      expect(goal, `${where(q)} can't reach the goal with the buttons`).toBe(true);
    }
  });

  it('whole-hour trips (8:00 → 14:00) have no "⬜ hours" step: the clock is the hint', () => {
    for (const { q, v } of clocks)
      if (v.target && (v.target.t - v.start) % 60 === 0) expect(q.hint!.steps, where(q)).toBeUndefined();
  });
});

describe('making the hops on a number line', () => {
  const lines = withVisual('line').filter(({ v }) => v.jumps.length && !v.answers);

  it('is used by arith, missing and word', () => {
    expect(new Set(lines.map(({ q }) => q.type))).toEqual(new Set(['arith', 'missing', 'word']));
  });

  it('every hop: reached points get their label, the answer never shows, the button says where it goes', () => {
    for (const { q, v } of lines) {
      const n = v.jumps.length;
      const { shown, isAnswer } = answerOf(q);
      for (const p of v.points) if (/^\d+$/.test(p.label)) expect(isAnswer(p.v) && !shown.has(p.v), `${where(q)} point ${p.v}`).toBe(false);
      for (let done = 0; done <= n; done++) {
        const sc = lineScene(v, done);
        expectNoLeak(q, sc.texts, `after ${done} hops`);
        sc.shown.forEach((on, i) => i <= done && expect(on, where(q)).toBe(true));
        expect(sc.arcs.filter(Boolean), where(q)).toHaveLength(done);
        expect(Boolean(sc.button), where(q)).toBe(done < n);
        if (done < n && /^\d+$/.test(v.points[done + 1].label)) expect(visible(sc.button), where(q)).toContain(v.points[done + 1].label);
      }
    }
  });

  it('⬜ + b = c and a − ⬜ = c: one hop (the whole answer) has no size; with 2+ hops each size shows', () => {
    for (const { q, v } of lines.filter(({ q }) => q.type === 'missing')) {
      if (v.jumps.length === 1) expect(v.jumps[0], where(q)).toBe('?');
      else for (const j of v.jumps) expect(Number(j.slice(1)), where(q)).toBeLessThan(q.value!);
    }
  });

  it('47 + 30 and 77 − 30: hops of 10, and the hint says nothing about ones', () => {
    const noOnes = lines.filter(({ q }) => q.type === 'arith' && /^\d+ [+−] \d0 = \?$/.test(q.lines![0]));
    expect(noOnes.length).toBeGreaterThan(5);
    for (const { q, v } of noOnes) {
      expect(q.hint!.ask, where(q)).not.toContain('אחדות');
      if (v.jumps.length > 1) for (const j of v.jumps) expect(j.slice(1), where(q)).toBe('10');
    }
  });
});

describe('building the bar model with number chips', () => {
  const bars = withVisual('bar').filter(({ v }) => barSlots(v).length);

  it('is used by word, missing and proportion; chips are exactly the box numbers', () => {
    expect(new Set(bars.map(({ q }) => q.type))).toEqual(new Set(['word', 'missing', 'proportion']));
    for (const { v } of bars) expect([...barChips(v)].sort()).toEqual(barSlots(v).map((s) => s.label).sort());
  });

  it('every placement: the right box locks, a wrong box or a ? box takes nothing, nothing leaks', () => {
    for (const { q, v } of bars) {
      const key = (s: BarState) => `${s.used.join()}|${s.placed.join()}`;
      const seen = new Set<string>();
      const queue = [barStart(v)];
      let done = false;
      const chips = barChips(v);
      const slots = barSlots(v);
      while (queue.length) {
        const s = queue.shift()!;
        if (seen.has(key(s))) continue;
        seen.add(key(s));
        const sc = barScene(v, s);
        expectNoLeak(q, sc.texts, 'bar');
        for (const sl of slots) if (sc.labels.get(sl.key)) expect(s.placed[slots.indexOf(sl)], where(q)).toBe(true);
        if (sc.done) done = true;
        chips.forEach((c, i) => {
          if (s.used[i]) return expect(barSelect(s, i), where(q)).toBe(s);
          const picked = barSelect(s, i);
          expectNoLeak(q, barScene(v, picked).texts, 'bar picked');
          expect(barDrop(v, picked, -1), `${where(q)} a ? box took a chip`).toEqual({ s: picked, ok: false });
          slots.forEach((sl, t) => {
            const res = barDrop(v, picked, t);
            expect(res.ok, `${where(q)} chip ${c} → box ${sl.label}`).toBe(sl.label === c && !s.placed[t]);
            if (!res.ok) expect(res.s, where(q)).toBe(picked);
            else queue.push(res.s);
          });
        });
      }
      expect(done, `${where(q)} the model can't be finished`).toBe(true);
    }
  });

  it('the queue drawing uses the person from the question', () => {
    const queues = withVisual('bar').filter(({ q }) => q.prompt.includes('עומדים בתור'));
    expect(queues.length).toBeGreaterThan(5);
    for (const { q, v } of queues) {
      const name = v.rows[0].segs[1].label;
      expect(q.prompt, where(q)).toContain(`${name} `);
      expect(q.hint!.ask, where(q)).toContain(name);
    }
  });
});

describe('finding the jumps on sequence arrows', () => {
  const chains = withVisual('chain');

  it('a tappable arrow joins two shown numbers, its jump is right, and its size is never the answer', () => {
    let tappable = 0;
    for (const { q, v } of chains)
      for (const a of v.arcs) {
        expect(a.label, where(q)).toBe('?');
        if (a.jump === undefined) continue;
        tappable++;
        expect(Number(v.items[a.to]) - Number(v.items[a.from]), where(q)).toBe(a.jump);
        expect(Math.abs(a.jump), where(q)).not.toBe(q.value);
      }
    expect(tappable / chains.length).toBeGreaterThan(2);
  });

  it('every arrow state: right turns it green, two misses show it, nothing leaks', () => {
    for (const { q, v } of chains) {
      const seen = new Set<string>();
      const queue: ChainState[] = [chainStart(v)];
      while (queue.length) {
        const s = queue.shift()!;
        if (seen.has(s.got.join())) continue;
        seen.add(s.got.join());
        expectNoLeak(q, chainScene(v, s).texts, 'arrows');
        v.arcs.forEach((a, i) => {
          const opened = chainOpen(v, s, i);
          if (a.jump === undefined || s.got[i]) return expect(opened, where(q)).toBe(s);
          expectNoLeak(q, chainScene(v, opened).texts, 'arrow open');
          const right = chainTry(v, opened, Math.abs(a.jump));
          expect(right.ok && right.s.got[i] === 'done', where(q)).toBe(true);
          const miss = chainTry(v, opened, Math.abs(a.jump) + 1);
          expect(miss.ok || miss.s.got[i] !== null, where(q)).toBe(false);
          expectNoLeak(q, chainScene(v, miss.s).texts, 'arrow missed');
          const twice = chainTry(v, miss.s, Math.abs(a.jump) + 1);
          expect(twice.s.got[i], where(q)).toBe('given');
          queue.push(right.s, twice.s);
        });
      }
    }
  });
});

describe('trying digits for ☀ (digit)', () => {
  const columns = withVisual('column');

  it('every digit gets the same kind of line, with no ✓ or ✗: it never tells which digit is right', () => {
    for (const { q, v } of columns) {
      const shapes = new Set(DIGITS.map((p) => digitScene(v, p).texts.map((t) => visible(t).replace(/\d+/g, '#')).join('|')));
      expect(shapes.size, where(q)).toBe(1);
      for (const p of [null, ...DIGITS]) for (const t of digitScene(v, p).texts) expect(t, where(q)).not.toMatch(/[✓✗✔✘❌✅👍🎉]|נכון|טעות/u);
    }
  });

  it('the line is the ones column with her digit, and only the right digit ends like the result', () => {
    for (const { q, v } of columns) {
      const [left, total] = visible(q.lines![0]).split(' = ');
      const ones = left.split(' + ').map((n) => n[n.length - 1]);
      for (const p of DIGITS) {
        const [x, y] = ones.map((c) => (c === '☀' ? p : Number(c)));
        expect(digitScene(v, p).line, where(q)).toBe(`${x} + ${y} = ${x + y}`);
        expect((x + y) % 10 === Number(total) % 10, `${where(q)} digit ${p}`).toBe(p === q.value);
      }
    }
  });

  it('☀☀: the example numbers never use the answer digit', () => {
    const twins = columns.filter(({ v }) => v.top === '☀☀');
    expect(twins.length).toBeGreaterThan(50);
    for (const { q } of twins) {
      const inQuestion = new Set(numbersIn(q.lines![0]));
      const examples = numbersIn(q.hint!.ask).filter((n) => n % 11 === 0 && n < 100 && !inQuestion.has(n));
      expect(examples, where(q)).toHaveLength(2);
      for (const n of examples) expect(n % 10, where(q)).not.toBe(q.value);
    }
  });
});

describe('lighting groups while counting (×)', () => {
  const lit = withVisual('groups').filter(({ v }) => v.per !== null);

  it('tapping lights one group; the written texts never change and never show the answer', () => {
    expect(lit.length).toBeGreaterThan(100);
    for (const { q, v } of lit) {
      expectNoLeak(q, litTexts(v), 'groups');
      expect(litTexts(v).join(' '), where(q)).not.toMatch(/נדלקו|סימנת|\d+ קבוצות/);
      let s = Array<boolean>(v.n).fill(false);
      for (let k = 0; k < v.n; k++) {
        const next = litToggle(s, k);
        expect(next.filter((x, i) => x !== s[i]), where(q)).toHaveLength(1);
        s = next;
      }
      expect(s.every(Boolean), where(q)).toBe(true);
    }
  });
});

describe('review fixes', () => {
  it('compare: only the first option is worked, the rest are hers', () => {
    for (const q of SEEDS.map((s) => MATH_GENERATORS.compare(rng(s)))) {
      expect(q.hint!.steps, where(q)).toHaveLength(1);
      expect(q.hint!.steps![0].text, where(q)).toBe(`${q.options[0]} = ⬜`);
      expect(q.hint!.after, where(q)).toContain('עכשיו חשבי את האחרים באותה דרך');
    }
  });

  it('÷: the nearby fact is the next one, k × (q − 1) or k × (q + 1)', () => {
    const div = ALL.filter((q) => withVisual('groups', [q]).some(({ v }) => v.per === null) && q.hint!.steps?.length && q.type !== 'proportion');
    expect(div.length).toBeGreaterThan(100);
    for (const q of div) {
      const [k, ref] = numbersIn(q.hint!.steps![0].text);
      expect(Math.abs(ref - q.value!), `${where(q)} ${q.hint!.steps![0].text}`).toBe(1);
      expect(k * ref, where(q)).not.toBe(q.value);
    }
  });

  it('"פי 2" is "the same number twice", "פי 3" is "the same number 3 times"', () => {
    const times = ALL.filter((q) => q.type === 'word' && /פי \d/.test(q.prompt) && q.prompt.includes('פחות'));
    expect(times.length).toBeGreaterThan(5);
    for (const q of times) {
      const f = Number(q.prompt.match(/פי (\d)/)![1]);
      expect(visible(q.hint!.ask), where(q)).toContain(f === 2 ? 'אותו מספר פעמיים' : `אותו מספר ${f} פעמים`);
    }
  });
});
