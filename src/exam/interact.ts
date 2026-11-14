/**
 * Pure state for the hint drawings she works with her finger. Each drawing has a start state, actions, and a scene
 * that lists every text it shows at that state, so tests can walk every state and check that none shows the answer.
 */
import { L, type ChainArc, type VisKeep, type Visual } from './hints';

type Of<K extends Visual['kind']> = Extract<Visual, { kind: K }>;
const sum = (a: number[]) => a.reduce((t, x) => t + x, 0);
const signed = (d: number) => (d >= 0 ? `+${d}` : `−${-d}`);
export const isNumberLabel = (s: string): boolean => /^\d[\d\s+−×÷]*$/.test(s);

// ---------- clock: buttons move the hands ----------

/** She can move the hands at most 12 hours ahead. */
export const CLOCK_MAX = 12 * 60;
export const CLOCK_RESET = '↺ מההתחלה';
export const CLOCK_MATCH = '🎯 המחוגים הגיעו! כמה זמן עבר?';
export const CLOCK_OVER = 'עברת את השעה. נסי שוב ↺';
export const addLabel = (m: number): string => (m === 60 ? '+שעה' : `${L(`+${m}`)} דק׳`);

/** "שעה ו־5 דקות": how much time she added (shown only when the answer is a clock time). */
export function spanText(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = h === 0 ? '' : h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${L(h)} שעות`;
  const mins = m ? `${L(m)} דקות` : '';
  return hours && mins ? `${hours} ו־${mins}` : hours || mins;
}

export type ClockScene = { at: number; added: number; buttons: { m: number; label: string; off: boolean }[]; msg: string; texts: string[] };

export function clockPress(s: number[], m: number): number[] {
  return sum(s) + m > CLOCK_MAX ? s : [...s, m];
}

export function clockScene(v: Of<'clock'>, s: number[]): ClockScene {
  const added = sum(s);
  const at = v.start + added;
  const t = v.target?.t;
  const msg =
    t === undefined ? (v.elapsed && added ? `עברו ${spanText(added)}` : '') : at === t ? CLOCK_MATCH : at > t ? CLOCK_OVER : '';
  const buttons = v.adds.map((m) => ({ m, label: addLabel(m), off: added + m > CLOCK_MAX }));
  return { at, added, buttons, msg, texts: [v.caption, v.target?.caption ?? '', ...buttons.map((b) => b.label), CLOCK_RESET, msg].filter(Boolean) };
}

// ---------- number line: she makes the hops ----------

export const LINE_LANDED = 'איפה נחתת? 🤔';
export const LINE_DONE = 'הגעת! 🎉';
export const LINE_AGAIN = '↺ שוב';

/** The button for hop i: where it lands when that point has a number, else its size when that is shown. */
export function hopLabel(v: Of<'line'>, i: number): string {
  const to = v.points[i + 1];
  const back = to.v < v.points[i].v;
  if (/^\d+$/.test(to.label)) return `קפצי ${back ? 'אחורה ' : ''}עד ${L(to.label)}`;
  const j = v.jumps[i];
  if (j !== '?') return `קפצי ${back ? 'אחורה' : 'עוד'} ${L(j.slice(1))}`;
  return back ? 'קפצי אחורה' : 'קפצי עוד';
}

export type LineScene = { shown: boolean[]; arcs: boolean[]; button: string; msg: string; texts: string[] };

/** After `done` hops: the start, the reached points and a numbered destination are drawn; arcs appear as she hops. */
export function lineScene(v: Of<'line'>, done: number): LineScene {
  const n = v.jumps.length;
  const shown = v.points.map((p, i) => i <= done || (i === n && /^\d+$/.test(p.label)));
  const arcs = v.jumps.map((_, i) => i < done);
  const button = done < n ? hopLabel(v, done) : '';
  const msg = done < n ? '' : v.points[n].label === '?' ? LINE_LANDED : LINE_DONE;
  const texts = [
    ...v.points.filter((_, i) => shown[i]).map((p) => p.label),
    ...v.jumps.filter((_, i) => arcs[i]),
    button,
    msg,
    done >= n ? LINE_AGAIN : '',
  ].filter(Boolean);
  return { shown, arcs, button, msg, texts };
}

// ---------- bar model: she puts the question's numbers in their boxes ----------

export const BAR_PICK = '👆 בחרי מספר, ואז לחצי על המקום שלו בציור';
export const BAR_DONE = 'בנית את הציור! 🎉';
export const BAR_NOT_HERE = 'כאן מה שמחפשים 🤔';

/** A box a chip can go in: a segment with a number (or an expression like 3 × 4), or the total over the bar. */
export type BarSlot = { key: string; label: string };

export function barSlots(v: Of<'bar'>): BarSlot[] {
  const out: BarSlot[] = [];
  v.rows.forEach((r, i) => r.segs.forEach((s, j) => isNumberLabel(s.label) && out.push({ key: `${i}:${j}`, label: s.label })));
  if (v.total && isNumberLabel(v.total.label)) out.push({ key: 'T', label: v.total.label });
  return out;
}

const labelValue = (s: string) => s.split('×').map(Number).reduce((a, b) => a * b, 1);

/** The chips: one per box, smallest first (not in box order). */
export const barChips = (v: Of<'bar'>): string[] =>
  barSlots(v)
    .map((s) => s.label)
    .sort((a, b) => labelValue(a) - labelValue(b) || a.localeCompare(b));

export type BarState = NonNullable<VisKeep['bar']>;

export const barStart = (v: Of<'bar'>): BarState => ({
  used: barChips(v).map(() => false),
  placed: barSlots(v).map(() => false),
  sel: null,
});

export const barSelect = (s: BarState, i: number): BarState => (s.used[i] ? s : { ...s, sel: s.sel === i ? null : i });

/** Drop the chosen chip on box `slot` (-1: a '?' box). A wrong box leaves the state as it was. */
export function barDrop(v: Of<'bar'>, s: BarState, slot: number): { s: BarState; ok: boolean } {
  if (s.sel === null || slot < 0 || s.placed[slot]) return { s, ok: false };
  if (barChips(v)[s.sel] !== barSlots(v)[slot].label) return { s, ok: false };
  return {
    s: { used: s.used.map((u, i) => u || i === s.sel), placed: s.placed.map((p, i) => p || i === slot), sel: null },
    ok: true,
  };
}

export type BarScene = { labels: Map<string, string>; done: boolean; texts: string[] };

/** What every box shows: placed numbers, '?' boxes, and word labels (e.g. "לפני"); empty boxes show nothing. */
export function barScene(v: Of<'bar'>, s: BarState): BarScene {
  const slots = barSlots(v);
  const labels = new Map<string, string>();
  v.rows.forEach((r, i) => r.segs.forEach((g, j) => labels.set(`${i}:${j}`, g.label)));
  if (v.total) labels.set('T', v.total.label);
  slots.forEach((sl, k) => !s.placed[k] && labels.set(sl.key, ''));
  const done = s.placed.every(Boolean);
  const chips = barChips(v).filter((_, i) => !s.used[i]);
  const names = v.rows.map((r) => r.name ?? '');
  return { labels, done, texts: [...names, ...labels.values(), ...chips, done ? BAR_DONE : BAR_PICK].filter(Boolean) };
}

// ---------- sequence arrows: she finds each jump ----------

export const CHAIN_PICK = '👆 לחצי על חץ וכתבי את הקפיצה';
export type ChainState = NonNullable<VisKeep['chain']>;

export const chainStart = (v: Of<'chain'>): ChainState => ({ open: null, got: v.arcs.map(() => null), wrong: 0 });

export const chainOpen = (v: Of<'chain'>, s: ChainState, i: number): ChainState =>
  v.arcs[i].jump === undefined || s.got[i] ? s : { ...s, open: i, wrong: 0 };

/** The jump she types is its size (the sign is shown). Two misses show it (it's never the answer). */
export function chainTry(v: Of<'chain'>, s: ChainState, n: number): { s: ChainState; ok: boolean } {
  if (s.open === null) return { s, ok: false };
  const jump = v.arcs[s.open].jump!;
  const right = n === Math.abs(jump);
  if (!right && s.wrong < 1) return { s: { ...s, wrong: s.wrong + 1 }, ok: false };
  const got = s.got.map((g, i) => (i === s.open ? (right ? 'done' : 'given') : g));
  return { s: { open: null, got, wrong: 0 }, ok: right };
}

/** "4 + ⬜ = 7" for the open arrow. */
export function chainQuestion(v: Of<'chain'>, a: ChainArc): string {
  const x = v.items[a.from];
  const y = v.items[a.to];
  return a.jump! >= 0 ? `${x} + ⬜ = ${y}` : `${x} − ⬜ = ${y}`;
}

export function chainScene(v: Of<'chain'>, s: ChainState): { labels: string[]; texts: string[] } {
  const labels = v.arcs.map((a, i) => (s.got[i] ? signed(a.jump!) : a.label));
  const asking = v.arcs.some((a) => a.jump !== undefined);
  const q = s.open !== null ? [chainQuestion(v, v.arcs[s.open])] : [];
  return { labels, texts: [...v.items, ...labels, ...q, asking ? CHAIN_PICK : ''].filter(Boolean) };
}

// ---------- column addition: she tries digits for ☀ ----------

export const SUN = '☀';
export const TRI = '△';
export const DIGIT_PICK = `👆 נסי ספרה במקום ${SUN}`;
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * The ones column with her digit in place of the hidden symbol (☀ or △), e.g. "6 + 4 = 10". It's the same kind of
 * line for every digit, with no ✓ or ✗, so it never tells which digit is right: she compares it with the result herself.
 */
export function digitLine(v: Of<'column'>, pick: number): string {
  const sym = v.symbol ?? SUN;
  const ones = [v.top, v.add].map((s) => [...s].pop()!);
  const vals = ones.map((c) => (c === sym ? pick : Number(c)));
  return `${vals[0]} + ${vals[1]} = ${vals[0] + vals[1]}`;
}

export function digitScene(v: Of<'column'>, pick: number | null): { line: string; texts: string[] } {
  const line = pick === null ? '' : digitLine(v, pick);
  return { line, texts: [v.top, v.add, v.result, v.symbol ?? '', DIGIT_PICK, ...DIGITS.map(String), line].filter(Boolean) };
}

// ---------- groups: tap to light a group up while counting ----------

export const GROUPS_TAP = '👆 לחצי על קבוצה כדי לסמן אותה';

export const litToggle = (s: boolean[], i: number): boolean[] => s.map((x, k) => (k === i ? !x : x));

/** The texts never change with what she lit: no running total. */
export function litTexts(v: Of<'groups'>): string[] {
  const inside = v.per === null ? '?' : (v.inner ?? (v.per > 25 ? String(v.per) : ''));
  return [v.note ?? '', inside, v.total ? `בסך הכול: ${v.total}` : '', GROUPS_TAP].filter(Boolean);
}
