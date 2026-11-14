export type Sign = 1 | -1;
/** `made` marks a tile she built with a trick: a merged round ten, or the rounded part of round-and-fix. */
export type Term = { id: string; sign: Sign; value: number; made?: 'ten' | 'round' };
export type Expr = Term[];

export const MAX_TERMS = 6;

export type OpError = 'noop' | 'leading-negative' | 'cannot-split' | 'too-many-terms' | 'locked';
export type OpResult = { ok: true; expr: Expr } | { ok: false; reason: OpError };

export const evaluate = (e: Expr): number => e.reduce((s, t) => s + t.sign * t.value, 0);

export function parse(text: string): Expr {
  const tokens = text.replace(/−/g, '-').match(/[+-]|\d+/g) ?? [];
  const expr: Expr = [];
  let sign: Sign = 1;
  for (const tok of tokens) {
    if (tok === '+') sign = 1;
    else if (tok === '-') sign = -1;
    else {
      expr.push({ id: `t${expr.length}`, sign, value: Number(tok) });
      sign = 1;
    }
  }
  return expr;
}

export const signText = (t: Term, index: number): string => (t.sign < 0 ? '−' : index === 0 ? '' : '+');

export const format = (e: Expr): string =>
  e
    .map((t, i) => {
      const s = signText(t, i);
      return i === 0 ? `${s}${t.value}` : `${s} ${t.value}`;
    })
    .join(' ');

export const sameShape = (a: Expr, b: Expr): boolean => format(a) === format(b);

/** Move term `from` into gap `gap` (gaps are 0..length; gap k sits before term k). The sign travels with it. */
export function move(e: Expr, from: number, gap: number): OpResult {
  if (from < 0 || from >= e.length || gap < 0 || gap > e.length) throw new RangeError(`bad move ${from}->${gap}`);
  if (gap === from || gap === from + 1) return { ok: false, reason: 'noop' };
  const rest = e.filter((_, i) => i !== from);
  const at = gap > from ? gap - 1 : gap;
  const expr = [...rest.slice(0, at), e[from], ...rest.slice(at)];
  if (expr[0].sign < 0) return { ok: false, reason: 'leading-negative' };
  return { ok: true, expr };
}

/**
 * Up to 10, every ordered split. Above 10 only "big + small" (small = 1..9), which covers
 * completing to the next ten without a 40-button picker; order can be changed with a move.
 */
export const splitOptions = (value: number): [number, number][] =>
  value <= 10
    ? Array.from({ length: Math.max(0, value - 1) }, (_, i) => [i + 1, value - i - 1])
    : Array.from({ length: 9 }, (_, i) => [value - i - 1, i + 1]);

function checkEditable(e: Expr, index: number): OpError | null {
  const t = e[index];
  if (!t) throw new RangeError(`bad index ${index}`);
  if (t.made) return 'locked';
  if (e.length >= MAX_TERMS) return 'too-many-terms';
  return null;
}

/** Replace term `index` (value n) with two terms a and n−a, both keeping the original sign. */
export function split(e: Expr, index: number, a: number): OpResult {
  const err = checkEditable(e, index);
  if (err) return { ok: false, reason: err };
  const t = e[index];
  if (a < 1 || a >= t.value) return { ok: false, reason: 'cannot-split' };
  const parts: Term[] = [
    { id: `${t.id}.a`, sign: t.sign, value: a },
    { id: `${t.id}.b`, sign: t.sign, value: t.value - a },
  ];
  return { ok: true, expr: [...e.slice(0, index), ...parts, ...e.slice(index + 1)] };
}

/** Round-and-fix is only offered for numbers 1–2 below a ten (…8, …9), where it actually saves work. */
export function roundOption(value: number): { up: number; fix: number } | null {
  const fix = (10 - (value % 10)) % 10;
  return fix === 1 || fix === 2 ? { up: value + fix, fix } : null;
}

/** `+9` → `+10 − 1`, `−19` → `−20 + 1`. */
export function round(e: Expr, index: number): OpResult {
  const err = checkEditable(e, index);
  if (err) return { ok: false, reason: err };
  const t = e[index];
  const r = roundOption(t.value);
  if (!r) return { ok: false, reason: 'cannot-split' };
  const parts: Term[] = [
    { id: `${t.id}.r`, sign: t.sign, value: r.up, made: 'round' },
    { id: `${t.id}.f`, sign: t.sign === 1 ? -1 : 1, value: r.fix },
  ];
  return { ok: true, expr: [...e.slice(0, index), ...parts, ...e.slice(index + 1)] };
}

/** Length (≥2, < whole expression) of the shortest left-to-right prefix summing to a positive multiple of 10. */
export function roundPrefixLength(e: Expr): number | null {
  if (e.length < 3) return null;
  let sum = e[0].sign * e[0].value;
  for (let k = 1; k < e.length - 1; k++) {
    sum += e[k].sign * e[k].value;
    if (sum > 0 && sum % 10 === 0) return k + 1;
  }
  return null;
}

/** Collapse that prefix into one `made` tile, e.g. `38 + 2 + 5` → `40 + 5`. */
export function mergeRoundPrefix(e: Expr): Expr | null {
  const k = roundPrefixLength(e);
  if (k === null) return null;
  const head = e.slice(0, k);
  const merged: Term = { id: `${head[0].id}.m`, sign: 1, value: evaluate(head), made: 'ten' };
  return [merged, ...e.slice(k)];
}

/** Every expression reachable with exactly one move, split or round. */
export function neighbours(e: Expr): Expr[] {
  const out: Expr[] = [];
  for (let from = 0; from < e.length; from++) {
    for (let gap = 0; gap <= e.length; gap++) {
      const r = move(e, from, gap);
      if (r.ok) out.push(r.expr);
    }
    for (const [a] of splitOptions(e[from].value)) {
      const r = split(e, from, a);
      if (r.ok) out.push(r.expr);
    }
    const r = round(e, from);
    if (r.ok) out.push(r.expr);
  }
  return out;
}
