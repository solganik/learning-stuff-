/**
 * The 💡 hint ladder: data types and small builders. Every hint is computed from the question's own numbers.
 * Hard rule: a hint never shows the final answer (not in text, not in a drawing, not as a step's value).
 */

/** One bar segment. `v` is the true size (used only for the drawing's proportions); `label` is what she sees. */
export type Seg = { v: number; label: string; gap?: boolean };
export type BarRow = { name?: string; segs: Seg[] };
/** A line point: `label` is a number, '?', '=' or '' (an unlabeled dot). */
export type LinePoint = { v: number; label: string };

export type Visual =
  /** Bar model. `total` is a brace over all rows (the sum of every segment). */
  | { kind: 'bar'; rows: BarRow[]; total?: Seg }
  /** Number line, left to right. jumps[i] labels the hop from points[i] to points[i+1] ('+3', '−5' or '?'). */
  | { kind: 'line'; points: LinePoint[]; jumps: string[]; answers?: 'bigger' | 'smaller' }
  /** A row of boxes (a sequence) with arrows between pairs of boxes. */
  | { kind: 'chain'; items: string[]; arcs: { from: number; to: number; label: string; below?: boolean }[] }
  /** n circles, each with `per` dots, or `inner` text, or '?' when per is null. `loose` dots wait above to be shared. */
  | { kind: 'groups'; n: number; per: number | null; inner?: string; cap?: string; cols?: number; loose?: number; total?: string; note?: string }
  /** Analog clock faces (minutes since midnight), an optional arc on the first face, and a note. */
  | { kind: 'clock'; faces: { t: number; caption: string }[]; arc?: { from: number; min: number; label: string }; note?: string }
  /** A vertical (column) addition with the ones column highlighted. */
  | { kind: 'column'; rows: string[] };

export type HintStep = { text: string; answer: number };

export type Hint = {
  /** Step 1: a guiding question (may use L(...)). */
  ask: string;
  /** Words in the prompt to <mark> at step 1. */
  highlight?: string[];
  /** Step 2. */
  visual?: Visual;
  /** Step 3: each text contains exactly one ⬜. */
  steps?: HintStep[];
  /** Shown after the last step (or right away when there are no steps). */
  after?: string;
};

/** Keep math left-to-right inside Hebrew sentences. */
export const L = (math: string | number): string => `⁦${math}⁩`;

export const numbersIn = (s: string): number[] => (s.replace(/[⁦⁩]/g, '').match(/\d+/g) ?? []).map(Number);

/** Every text and label a hint can display (for the no-leak rule). */
export function hintTexts(h: Hint): string[] {
  const out = [h.ask, h.after ?? '', ...(h.highlight ?? []), ...(h.steps ?? []).map((s) => s.text)];
  const v = h.visual;
  if (!v) return out;
  if (v.kind === 'bar') out.push(...v.rows.flatMap((r) => [r.name ?? '', ...r.segs.map((s) => s.label)]), v.total?.label ?? '');
  if (v.kind === 'line') out.push(...v.points.map((p) => p.label), ...v.jumps);
  if (v.kind === 'chain') out.push(...v.items, ...v.arcs.map((a) => a.label));
  if (v.kind === 'groups') out.push(v.inner ?? '', v.cap ?? '', v.total ?? '', v.note ?? '', v.per !== null ? String(v.per) : '');
  if (v.kind === 'clock') out.push(...v.faces.map((f) => f.caption), v.arc?.label ?? '', v.note ?? '');
  if (v.kind === 'column') out.push(...v.rows);
  return out;
}

/**
 * Drops any step that would give the answer away for these particular numbers: its value is the answer (or an
 * accepted answer), or its text shows the answer and the question itself doesn't.
 */
export function safeSteps(
  steps: HintStep[] | undefined,
  q: { prompt: string; lines?: string[]; value?: number; accept?: (n: number) => boolean },
): HintStep[] | undefined {
  const shown = new Set(numbersIn([q.prompt, ...(q.lines ?? [])].join(' ')));
  const bad = (n: number) => n === q.value || Boolean(q.accept?.(n));
  const kept = steps?.filter((s) => !bad(s.answer) && !numbersIn(s.text).some((n) => bad(n) && !shown.has(n)));
  return kept?.length ? kept : undefined;
}

// ---------- builders ----------

export const tenUp = (n: number): number => Math.floor(n / 10) * 10 + 10;
export const tenDown = (n: number): number => Math.floor(n / 10) * 10;
const signed = (d: number) => (d >= 0 ? `+${d}` : `−${-d}`);

/**
 * Counting up from lo to hi via round tens (lo → next ten → hi's ten → hi), as a number line and as steps
 * (one per hop). A landing point equal to `avoid` is skipped so the drawing never shows the answer.
 */
export function countUp(lo: number, hi: number, avoid: (n: number) => boolean): { visual: Visual; steps: HintStep[] } {
  const marks = [lo];
  for (const t of [tenUp(lo), tenDown(hi)]) if (t > marks[marks.length - 1] && t < hi && !avoid(t)) marks.push(t);
  marks.push(hi);
  const hops = marks.slice(1).map((m, i) => ({ from: marks[i], to: m }));
  return {
    visual: { kind: 'line', points: marks.map((v) => ({ v, label: String(v) })), jumps: hops.map(() => '?') },
    steps: hops.length > 1 ? hops.map((h) => ({ text: `${h.from} + ⬜ = ${h.to}`, answer: h.to - h.from })) : [],
  };
}

/** A number line through `start` with labeled hops; intermediate points get `mid` labels, the last point is '?'. */
export function hopLine(start: number, hops: number[], showMid = true): Visual {
  const points: LinePoint[] = [{ v: start, label: String(start) }];
  let at = start;
  hops.forEach((d, i) => {
    at += d;
    points.push({ v: at, label: i === hops.length - 1 ? '?' : showMid ? String(at) : '' });
  });
  return { kind: 'line', points, jumps: hops.map(signed) };
}

/** a + b, done the grade-2 way: via the ten when b is small, else tens first. Steps stop before the last move. */
export function addSteps(x: number, y: number): { steps: HintStep[]; hops: number[]; start: number } {
  const [a, b] = x >= y ? [x, y] : [y, x];
  if (b < 10) {
    const need = tenUp(a) - a;
    if (a % 10 === 0 || b <= need) return { steps: [], hops: [b], start: a };
    return {
      steps: [{ text: `${a} + ⬜ = ${a + need}`, answer: need }, { text: `${b} = ${need} + ⬜`, answer: b - need }],
      hops: [need, b - need],
      start: a,
    };
  }
  const tens = tenDown(b);
  const ones = b % 10;
  return { steps: [{ text: `${a} + ${tens} = ⬜`, answer: a + tens }], hops: ones ? [tens, ones] : [tens], start: a };
}

/** k groups of f, broken into easy facts (never the full product). */
export function mulSteps(k: number, f: number): { steps: HintStep[]; after?: string } {
  if (k <= 2) return { steps: [] };
  if (k === 3) return { steps: [{ text: `2 × ${f} = ⬜`, answer: 2 * f }], after: `ועוד קבוצה אחת של ${L(f)} 😉` };
  if (k === 4) return { steps: [{ text: `2 × ${f} = ⬜`, answer: 2 * f }], after: '4 קבוצות זה פעמיים 2 קבוצות. הכפילי! 😉' };
  if (k === 5)
    return {
      steps: [{ text: `2 × ${f} = ⬜`, answer: 2 * f }, { text: `${2 * f} + ${2 * f} = ⬜`, answer: 4 * f }],
      after: `ועוד קבוצה אחת של ${L(f)} 😉`,
    };
  if (k === 6) return { steps: [{ text: `5 × ${f} = ⬜`, answer: 5 * f }], after: `ועוד קבוצה אחת של ${L(f)} 😉` };
  if (k === 10) return { steps: [{ text: `5 × ${f} = ⬜`, answer: 5 * f }], after: '10 קבוצות זה פעמיים 5 קבוצות 😉' };
  return {
    steps: [{ text: `5 × ${f} = ⬜`, answer: 5 * f }, { text: `${k - 5} × ${f} = ⬜`, answer: (k - 5) * f }],
    after: 'עכשיו חברי את שני החלקים 😉',
  };
}

/** A nearby times fact for t ÷ k = x: k × ref, with ref ≠ x and k × ref ≠ x. */
export function nearbyFact(k: number, x: number): { steps: HintStep[]; after: string } {
  const order = x <= 3 ? [3, 2, 4] : [5, 4, 6, 3];
  const ref = order.find((m) => m !== x && k * m !== x)!;
  return { steps: [{ text: `${k} × ${ref} = ⬜`, answer: k * ref }], after: `צריך יותר או פחות מ־${L(ref)}?` };
}
