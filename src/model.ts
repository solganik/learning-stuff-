export type Sign = 1 | -1;
export type Term = { id: string; sign: Sign; value: number };
export type Expr = Term[];

export const MAX_TERMS = 6;

export type OpError = 'noop' | 'leading-negative' | 'cannot-split' | 'too-many-terms';
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

export const splitOptions = (value: number): [number, number][] =>
  Array.from({ length: Math.max(0, value - 1) }, (_, i) => [i + 1, value - i - 1]);

/** Replace term `index` (value n) with two terms a and n−a, both keeping the original sign. */
export function split(e: Expr, index: number, a: number): OpResult {
  const t = e[index];
  if (!t) throw new RangeError(`bad split index ${index}`);
  if (a < 1 || a >= t.value) return { ok: false, reason: 'cannot-split' };
  if (e.length >= MAX_TERMS) return { ok: false, reason: 'too-many-terms' };
  const parts: Term[] = [
    { id: `${t.id}.a`, sign: t.sign, value: a },
    { id: `${t.id}.b`, sign: t.sign, value: t.value - a },
  ];
  return { ok: true, expr: [...e.slice(0, index), ...parts, ...e.slice(index + 1)] };
}

/** Every expression reachable with exactly one allowed move or split. */
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
  }
  return out;
}
