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
  /**
   * A row of boxes (a sequence) with arrows between pairs of boxes. `jump` (never drawn until she finds it) makes an
   * arrow tappable: she types the jump. Arrows whose jump is the answer, or that touch the '?', have none.
   */
  | { kind: 'chain'; items: string[]; arcs: ChainArc[] }
  /** n circles, each with `per` dots, or `inner` text, or '?' when per is null. `loose` dots wait above to be shared. */
  | { kind: 'groups'; n: number; per: number | null; inner?: string; cap?: string; cols?: number; loose?: number; total?: string; note?: string }
  /**
   * A clock she moves (minutes since midnight). Buttons add `adds` minutes each. `target` (dashed hands, only when
   * the answer is a duration) is the end time from the question. `elapsed` shows how much time she added (only when
   * the answer is a clock time, so the added time is not the answer). The hands' time is never written.
   */
  | { kind: 'clock'; start: number; caption: string; target?: { t: number; caption: string }; adds: number[]; elapsed: boolean }
  /** A vertical (column) addition with the ones column highlighted. */
  | { kind: 'column'; top: string; add: string; result: string };

export type ChainArc = { from: number; to: number; label: string; below?: boolean; jump?: number };

/** `lead` is shown before the blank expression and is not part of it (e.g. "🍎 ="). */
export type HintStep = { text: string; answer: number; lead?: string };

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
  const out = [h.ask, h.after ?? '', ...(h.highlight ?? []), ...(h.steps ?? []).flatMap((s) => [s.lead ?? '', s.text])];
  const v = h.visual;
  if (!v) return out;
  if (v.kind === 'bar') out.push(...v.rows.flatMap((r) => [r.name ?? '', ...r.segs.map((s) => s.label)]), v.total?.label ?? '');
  if (v.kind === 'line') out.push(...v.points.map((p) => p.label), ...v.jumps);
  if (v.kind === 'chain') out.push(...v.items, ...v.arcs.map((a) => a.label));
  if (v.kind === 'groups') out.push(v.inner ?? '', v.cap ?? '', v.total ?? '', v.note ?? '', v.per !== null ? String(v.per) : '');
  if (v.kind === 'clock') out.push(v.caption, v.target?.caption ?? '');
  if (v.kind === 'column') out.push(v.top, v.add, v.result);
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
 * (one per hop). A landing point equal to `avoid` is skipped so the drawing never shows the answer. The total jump
 * is the answer, so hop sizes are labeled only when there are 2+ hops (each one is then smaller than the total).
 */
export function countUp(lo: number, hi: number, avoid: (n: number) => boolean): { visual: Visual; steps: HintStep[] } {
  const marks = [lo];
  for (const t of [tenUp(lo), tenDown(hi)]) if (t > marks[marks.length - 1] && t < hi && !avoid(t)) marks.push(t);
  marks.push(hi);
  const hops = marks.slice(1).map((m, i) => ({ from: marks[i], to: m }));
  return {
    visual: {
      kind: 'line',
      points: marks.map((v) => ({ v, label: String(v) })),
      jumps: hops.map((h) => (hops.length > 1 && !avoid(h.to - h.from) ? `+${h.to - h.from}` : '?')),
    },
    steps: hops.length > 1 ? hops.map((h) => ({ text: `${h.from} + ⬜ = ${h.to}`, answer: h.to - h.from })) : [],
  };
}

/** A number line through `start` with labeled hops. She makes the hops; landing points are labeled, the last is '?'. */
export function hopLine(start: number, hops: number[]): Visual {
  const points: LinePoint[] = [{ v: start, label: String(start) }];
  let at = start;
  hops.forEach((d, i) => {
    at += d;
    points.push({ v: at, label: i === hops.length - 1 ? '?' : String(at) });
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

/** The times fact next to t ÷ k = x: k × (x − 1), or k × (x + 1) when x − 1 is too small or hits the answer. */
export function nearbyFact(k: number, x: number): { steps: HintStep[]; after: string } {
  const ref = [x - 1, x + 1].find((m) => m >= 2 && m !== x && k * m !== x)!;
  return {
    steps: [{ text: `${k} × ${ref} = ⬜`, answer: k * ref }],
    after: `צריך להגיע ל־${L(k * x)}. אז יותר או פחות מ־${L(ref)}? 😉`,
  };
}

// ---------- dealing dots into groups (÷ drawings) ----------

/** Dots still in the pile, and how many each group got so far. */
export type Deal = { pile: number; groups: number[] };

export const startDeal = (total: number, k: number): Deal => ({ pile: total, groups: Array<number>(k).fill(0) });

/** The pile can't give every group one more dot. */
export const dealDone = (s: Deal): boolean => s.pile < s.groups.length;

/** Interactive state of a question's drawing, kept across re-renders of the ladder. */
export type VisKeep = {
  deal?: Deal;
  clock?: number[];
  hops?: number;
  bar?: { used: boolean[]; placed: boolean[]; sel: number | null };
  chain?: { open: number | null; got: ('done' | 'given' | null)[]; wrong: number };
  pick?: number | null;
  lit?: boolean[];
};

/** One tap: one dot from the pile into each group. */
export function deal(s: Deal): Deal {
  if (dealDone(s)) return s;
  return { pile: s.pile - s.groups.length, groups: s.groups.map((g) => g + 1) };
}
