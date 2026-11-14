/** Math questions in the style of the grade-2 gifted screening test (שלב א). All generated, seeded. */

export type Rng = () => number;

/** mulberry32: small seeded PRNG so an exam can be regenerated (and printed) from its seed. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (r: Rng, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
export const pick = <T>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)];
export function shuffle<T>(r: Rng, a: readonly T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Keep math left-to-right inside Hebrew sentences. */
export const L = (math: string): string => `⁦${math}⁩`;

export type MathType =
  | 'arith'
  | 'missing'
  | 'inequality'
  | 'pictures'
  | 'digit'
  | 'word'
  | 'proportion'
  | 'time'
  | 'sequence'
  | 'compare';
export type QType = MathType | 'reading';

export type Question = {
  type: QType;
  prompt: string;
  /** Equations / sequences shown big, left to right. */
  lines?: string[];
  /** Empty for open questions (she types the number). */
  options: string[];
  correct: number;
  explain: string;
  /** Per option: why a wrong option is tempting ('' when there's nothing to say). */
  traps?: string[];
  /** Options are math or clock times (render LTR). */
  mathOptions?: boolean;
  passageId?: string;
  /** The answer as a number (for open questions: one valid answer). */
  value?: number;
  /** Open question: which typed numbers count as correct. */
  accept?: (n: number) => boolean;
};

export const TYPE_NAMES: Record<QType, string> = {
  arith: 'תרגילי חשבון',
  missing: 'המספר החסר ⬜😊',
  inequality: 'גדול מ / קטן מ',
  pictures: 'חידות ציורים',
  digit: 'ספרה חסרה ☀',
  word: 'שאלות מילוליות',
  proportion: 'פי כמה?',
  time: 'שעון וזמן',
  sequence: 'סדרות',
  compare: 'איזה תרגיל גדול יותר',
  reading: 'הבנת הנקרא',
};

export const isOpen = (q: Question): boolean => Boolean(q.accept);
export const isRight = (q: Question, a: number | null): boolean =>
  a !== null && (q.accept ? q.accept(a) : a === q.correct);

export const TRAP = {
  step: 'זו תוצאה של שלב ביניים. צריך להמשיך עד הסוף!',
  carry: 'שכחת את העשרת שעוברת (ההמרה).',
  opposite: 'זו הפעולה ההפוכה. בודקים בהצבה!',
  sum: 'זה הסכום. צריך עוד לחלק.',
  equal: 'זה נותן שוויון, ולא "גדול מ" או "קטן מ".',
  flip: 'בחיסור הכיוון מתהפך: מורידים יותר, נשאר פחות.',
  other: 'זה הערך של הציור השני.',
  add: 'הוספת במקום להכפיל. שואלים "פי כמה?".',
  digits: 'חיסרת ספרה קטנה מגדולה בכל עמודה.',
  wrongOp: 'זו פעולה אחרת ממה שהשאלה מבקשת.',
} as const;

type Wrong = number | [number, string];

/** Four options: the answer plus the 3 most plausible distinct wrong answers, each with its trap. */
export function numberChoice(
  r: Rng,
  answer: number,
  wrongs: Wrong[],
  o: { min?: number; max?: number; fmt?: (n: number) => string } = {},
): Pick<Question, 'options' | 'correct' | 'value' | 'traps'> {
  const min = o.min ?? 0;
  const max = o.max ?? Math.max(120, answer);
  const fmt = o.fmt ?? String;
  const picked: [number, string][] = [];
  const ok = (w: number) => Number.isInteger(w) && w >= min && w <= max && w !== answer && !picked.some(([p]) => p === w);
  for (const w of wrongs) {
    const [v, why] = typeof w === 'number' ? [w, ''] : w;
    if (picked.length < 3 && ok(v)) picked.push([v, why]);
  }
  for (let k = 1; picked.length < 3; k++) {
    if (ok(answer + k)) picked.push([answer + k, '']);
    if (picked.length < 3 && ok(answer - k)) picked.push([answer - k, '']);
  }
  const all = shuffle(r, [[answer, ''] as [number, string], ...picked]);
  return {
    options: all.map(([v]) => fmt(v)),
    correct: all.findIndex(([v]) => v === answer),
    traps: all.map(([, why]) => why),
    value: answer,
  };
}

const open = (answer: number, accept: (n: number) => boolean = (n) => n === answer): Partial<Question> => ({
  options: [],
  correct: -1,
  traps: undefined,
  value: answer,
  accept,
});

// ---------- T1 תרגילי חשבון ----------

function arith(r: Rng): Question {
  const kind = pick(r, ['add10', 'sub10', 'add2', 'sub2', 'mul', 'div', 'mul10', 'hundred', 'chain'] as const);
  const q = (line: string, answer: number, wrongs: Wrong[], explain: string): Question => ({
    type: 'arith',
    prompt: 'כמה זה?',
    lines: [`${line} = ?`],
    explain,
    ...numberChoice(r, answer, wrongs),
  });

  if (kind === 'add10') {
    const a = int(r, 1, 9) * 10 + int(r, 5, 9);
    const need = 10 - (a % 10);
    const b = int(r, Math.max(2, need), 9);
    const ans = a + b;
    const explain =
      b === need
        ? `${L(`${a} + ${b} = ${ans}`)}, עשרת שלמה!`
        : `משלימים לעשרת: ${L(`${a} + ${need} = ${a + need}`)}, ועוד ${L(String(b - need))}: ${L(String(ans))}`;
    return q(`${a} + ${b}`, ans, [[ans - 10, TRAP.carry], ans + 1, ans - 1, ans + 10], explain);
  }
  if (kind === 'sub10') {
    const a = int(r, 2, 10) * 10 + int(r, 1, 7);
    const u = a % 10;
    const b = int(r, u + 1, 9);
    const ans = a - b;
    const explain = `יורדים קודם לעשרת: ${L(`${a} − ${u} = ${a - u}`)}, ואז עוד ${L(`− ${b - u}`)}: ${L(String(ans))}`;
    return q(`${a} − ${b}`, ans, [[ans + 10, TRAP.carry], ans - 1, ans + 1, ans - 10], explain);
  }
  if (kind === 'add2') {
    const a = int(r, 11, 69);
    const b = int(r, 11, Math.min(49, 110 - a));
    const ans = a + b;
    const tens = b - (b % 10);
    const explain =
      b % 10
        ? `קודם העשרות: ${L(`${a} + ${tens} = ${a + tens}`)}, ואז האחדות: ${L(`${a + tens} + ${b % 10} = ${ans}`)}`
        : `${L(`${a} + ${b} = ${ans}`)}`;
    const carried = (a % 10) + (b % 10) >= 10;
    return q(`${a} + ${b}`, ans, carried ? [[ans - 10, TRAP.carry], ans + 1, ans + 10] : [ans + 10, ans - 1, ans - 10], explain);
  }
  if (kind === 'sub2') {
    const a = int(r, 40, 99);
    const b = int(r, 11, a - 10);
    const ans = a - b;
    const tens = b - (b % 10);
    const digitSlip = (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
    const explain =
      b % 10
        ? `קודם העשרות: ${L(`${a} − ${tens} = ${a - tens}`)}, ואז האחדות: ${L(`${a - tens} − ${b % 10} = ${ans}`)}`
        : `${L(`${a} − ${b} = ${ans}`)}`;
    return q(`${a} − ${b}`, ans, [[digitSlip, TRAP.digits], ans + 10, ans - 1, ans + 1], explain);
  }
  if (kind === 'mul10') {
    const x = int(r, 2, 12);
    const line = r() < 0.5 ? `${x} × 10` : `10 × ${x}`;
    return q(line, 10 * x, [[x + 10, TRAP.wrongOp], x * 100, 10 * x + 10, 10 * (x - 1)],
      `כפול 10 מוסיפים אפס: ${L(`${x} × 10 = ${10 * x}`)}`);
  }
  if (kind === 'hundred') {
    const x = int(r, 11, 89);
    const ans = 100 - x;
    const up = 10 - (x % 10);
    const explain =
      x % 10
        ? `משלימים: מ־${L(String(x))} ל־${L(String(x + up))} זה ${L(String(up))}, ומ־${L(String(x + up))} ל־100 זה ${L(String(100 - x - up))}. יחד ${L(String(ans))}`
        : `${L(`100 − ${x} = ${ans}`)}`;
    const slip = (10 - Math.floor(x / 10)) * 10 + (10 - (x % 10)); // completes both digits to 10
    return q(`100 − ${x}`, ans, [[slip, TRAP.digits], ans + 10, ans - 1, ans + 1], explain);
  }
  if (kind === 'chain') {
    const a = int(r, 20, 60);
    const b = int(r, 5, a - 5);
    const c = int(r, 3, 20);
    const ans = a - b + c;
    return q(`${a} − ${b} + ${c}`, ans, [[a - b, TRAP.step], [a - b - c, TRAP.wrongOp], ans + 10, ans - 1],
      `משמאל לימין: ${L(`${a} − ${b} = ${a - b}`)}, ואז ${L(`${a - b} + ${c} = ${ans}`)}`);
  }
  const f = int(r, 2, 9);
  const k = int(r, 2, 10);
  if (kind === 'mul') {
    const ans = f * k;
    const explain =
      k <= 5
        ? `${L(`${k} × ${f}`)} זה ${L(String(k))} פעמים ${L(String(f))}: ${L(`${Array(k).fill(f).join(' + ')} = ${ans}`)}`
        : `${L(`5 × ${f} = ${5 * f}`)}, ועוד ${L(String(k - 5))} פעמים ${L(String(f))}: ${L(`${5 * f} + ${(k - 5) * f} = ${ans}`)}`;
    return q(`${k} × ${f}`, ans, [[f + k, TRAP.wrongOp], ans + f, ans - f, ans + 1], explain);
  }
  const total = f * k;
  const explain = `חילוק זה כפל הפוך: כמה פעמים ${L(String(f))} נכנס ב־${L(String(total))}? ${L(`${k} × ${f} = ${total}`)}, אז ${L(`${total} ÷ ${f} = ${k}`)}`;
  return q(`${total} ÷ ${f}`, k, [[total - f, TRAP.wrongOp], k + 1, k - 1, f], explain);
}

// ---------- T2 / T4 המספר החסר (⬜ or a smiley) ----------

function missing(r: Rng): Question {
  const kind = pick(r, ['plus', 'minusFirst', 'minusMiddle', 'times', 'timesFirst', 'divide'] as const);
  const box = r() < 0.5 ? '😊' : '⬜';
  const flip = r() < 0.4; // the test sometimes writes the result first: 13 = 😊 + 10
  const isOpen = r() < 0.3;
  const eq = (left: string, right: string) => (flip ? `${right} = ${left}` : `${left} = ${right}`);
  const q = (line: string, answer: number, wrongs: Wrong[], explain: string): Question => ({
    type: 'missing',
    prompt: box === '😊' ? 'איזה מספר מסתתר מאחורי 😊?' : 'איזה מספר חסר במקום ⬜?',
    lines: [line],
    explain,
    ...numberChoice(r, answer, wrongs),
    ...(isOpen ? open(answer) : {}),
  });

  if (kind === 'plus') {
    const x = int(r, 3, 70);
    const b = int(r, 3, 45);
    const c = x + b;
    return q(eq(`${box} + ${b}`, String(c)), x, [[c + b, TRAP.opposite], x + 1, x - 1, x + 10],
      `הופכים לחיסור: ${L(`${c} − ${b} = ${x}`)}. בדיקה: ${L(`${x} + ${b} = ${c}`)} ✓`);
  }
  if (kind === 'minusFirst') {
    const x = int(r, 20, 99);
    const b = int(r, 3, x - 5);
    const c = x - b;
    return q(eq(`${box} − ${b}`, String(c)), x, [[c - b, TRAP.opposite], x + 1, x - 1, x - 10],
      `הופכים לחיבור: ${L(`${c} + ${b} = ${x}`)}. בדיקה: ${L(`${x} − ${b} = ${c}`)} ✓`);
  }
  if (kind === 'minusMiddle') {
    const a = int(r, 20, 99);
    const x = int(r, 3, a - 3);
    const c = a - x;
    return q(eq(`${a} − ${box}`, String(c)), x, [[a + c, TRAP.opposite], x + 1, x - 1, x + 10],
      `כמה צריך להוריד מ־${L(String(a))} כדי להגיע ל־${L(String(c))}? ${L(`${a} − ${c} = ${x}`)}`);
  }
  const f = int(r, 2, 9);
  const x = int(r, 2, 10);
  const c = f * x;
  if (kind === 'divide') {
    return q(eq(`${box} ÷ ${f}`, String(x)), c, [[x + f, TRAP.wrongOp], [x - f, TRAP.opposite], c + f, c - f],
      `הופכים לכפל: ${L(`${x} × ${f} = ${c}`)}. בדיקה: ${L(`${c} ÷ ${f} = ${x}`)} ✓`);
  }
  const line = kind === 'times' ? eq(`${box} × ${f}`, String(c)) : eq(`${f} × ${box}`, String(c));
  return q(line, x, [[c - f, TRAP.wrongOp], x + 1, x - 1, f], `כמה פעמים ${L(String(f))} עושה ${L(String(c))}? ${L(`${x} × ${f} = ${c}`)}`);
}

// ---------- T3 אי-שוויון ----------

function inequality(r: Rng): Question {
  const kind = pick(r, ['add', 'sub', 'mul', 'div'] as const);
  const rel = r() < 0.5 ? '<' : '>';
  const a = int(r, 20, 60);
  const k = int(r, 2, 9);
  const b = kind === 'mul' ? int(r, 3, 8) : kind === 'div' ? k * int(r, 3, 8) : int(r, 5, 25);
  const step = kind === 'div' ? k : 1;
  // does a bigger ⬜ make the right side bigger? (not for subtraction, and ⬜ is on the left for division)
  let needBigger: boolean;
  let line: string;
  let why: string;
  if (kind === 'div') {
    line = `⬜ ÷ ${k} ${rel} ${b} ÷ ${k}`;
    needBigger = rel === '>';
    why = `צריך מספר ${needBigger ? 'גדול' : 'קטן'} מ־${L(String(b))} שמתחלק ב־${L(String(k))}`;
  } else {
    const op = { add: '+', sub: '−', mul: '×' }[kind];
    const left = kind === 'mul' ? `${k} × ${b}` : `${a} ${op} ${b}`;
    const right = kind === 'mul' ? `${k} × ⬜` : `${a} ${op} ⬜`;
    line = `${left} ${rel} ${right}`;
    needBigger = kind === 'sub' ? rel === '>' : rel === '<';
    why =
      kind === 'sub'
        ? `בחיסור הכיוון מתהפך: כדי ש${L(`${a} − ⬜`)} יהיה ${rel === '>' ? 'קטן' : 'גדול'} יותר, צריך להוריד ${needBigger ? 'יותר' : 'פחות'} מ־${L(String(b))}`
        : `צריך מספר ${needBigger ? 'גדול' : 'קטן'} מ־${L(String(b))}`;
  }
  const valid = (x: number) => (needBigger ? x > b : x < b) && x >= (kind === 'div' ? step : 0) && x % step === 0;
  const answer = needBigger ? b + step * int(r, 1, 3) : Math.max(step, b - step * int(r, 1, 3));
  const dir = needBigger ? -1 : 1;
  const flipTrap = kind === 'sub' ? TRAP.flip : '';
  const base: Question = {
    type: 'inequality',
    prompt: 'איזה מספר מתאים במקום ⬜?',
    lines: [line],
    explain: `${why}. למשל ${L(String(answer))}: ${L(line.replace('⬜', String(answer)))} ✓`,
    ...numberChoice(r, answer, [[b, TRAP.equal], [b + dir * step, flipTrap], [b + 2 * dir * step, flipTrap], [b + 3 * dir * step, flipTrap]], {
      min: kind === 'div' ? step : 0,
    }),
  };
  if (r() < 0.3) {
    return {
      ...base,
      prompt: 'כתבי מספר שמתאים במקום ⬜ (יש כמה תשובות נכונות)',
      ...open(answer, (x) => valid(x) && x <= (kind === 'sub' ? a : 120)),
    };
  }
  return base;
}

// ---------- T5 חידות בציורים ----------

const PICS = ['🌸', '⭐', '🍓', '🦋', '🎀', '💎', '🧁', '🌈', '🍎', '🍌', '🍇', '🌙'];

function pictures(r: Rng): Question {
  const [p1, p2, p3] = shuffle(r, PICS);
  const variant = pick(r, ['repeat', 'chain', 'group'] as const);
  if (variant === 'repeat') {
    const a = int(r, 3, 12);
    const k = pick(r, [2, 3]);
    const b = int(r, 5, 30);
    return {
      type: 'pictures',
      prompt: `כל ציור הוא מספר. כמה שווה ${p2}?`,
      lines: [`${Array(k).fill(p1).join(' + ')} = ${k * a}`, `${p2} + ${p1} = ${a + b}`],
      explain: `מתחילים מהשורה עם ציורים זהים: ${L(`${k * a} ÷ ${k} = ${a}`)}, אז ${p1} = ${L(String(a))}. ואז ${L(`${a + b} − ${a} = ${b}`)}, אז ${p2} = ${L(String(b))}`,
      ...numberChoice(r, b, [[a + b, TRAP.step], [a, TRAP.other], b + 1, b - 1]),
    };
  }
  if (variant === 'chain') {
    const a = int(r, 2, 10);
    const b = int(r, 3, 20);
    const c = int(r, 3, 20);
    return {
      type: 'pictures',
      prompt: `כל ציור הוא מספר. כמה שווה ${p3}?`,
      lines: [`${p1} + ${p1} = ${2 * a}`, `${p1} + ${p2} = ${a + b}`, `${p2} + ${p3} = ${b + c}`],
      explain: `${p1} = ${L(String(a))}, אז ${p2} = ${L(`${a + b} − ${a} = ${b}`)}, ואז ${p3} = ${L(`${b + c} − ${b} = ${c}`)}`,
      ...numberChoice(r, c, [[b, TRAP.other], b + c - a, c + 1, c - 1]),
    };
  }
  // a repeated group: (p1 + p2) appears twice in the second line
  const s = int(r, 5, 20);
  const c = int(r, 3, 25);
  const t = 2 * s + c;
  return {
    type: 'pictures',
    prompt: `כל ציור הוא מספר. כמה שווה ${p3}?`,
    lines: [`${p1} + ${p2} = ${s}`, `${p1} + ${p2} + ${p3} + ${p1} + ${p2} = ${t}`],
    explain: `בשורה השנייה ${L(`${p1} + ${p2}`)} מופיע פעמיים: ${L(`${s} + ${s} = ${2 * s}`)}. אז ${p3} = ${L(`${t} − ${2 * s} = ${c}`)}`,
    ...numberChoice(r, c, [[t - s, TRAP.step], [s, TRAP.other], c + 1, c - 1]),
  };
}

// ---------- T6 ספרה חסרה בתוך מספר ----------

const SUN = '☀';

function digit(r: Rng): Question {
  const d = int(r, 1, 9);
  if (r() < 0.3) {
    const add = int(r, 2, Math.min(30, 120 - 11 * d));
    const total = 11 * d + add;
    return {
      type: 'digit',
      prompt: `${SUN} היא ספרה. איזו ספרה היא?`,
      lines: [`${SUN}${SUN} + ${add} = ${total}`],
      explain: `${L(`${SUN}${SUN} = ${total} − ${add} = ${11 * d}`)}, אז ${SUN} = ${L(String(d))}`,
      mathOptions: true,
      ...numberChoice(r, d, [d + 1, d - 1, d + 2, Math.floor(add / 10)], { max: 9 }),
    };
  }
  let a: number;
  let b: number;
  do {
    a = int(r, 0, 9);
    b = int(r, 1, 9);
  } while (11 * d + a + 10 * b > 120);
  const total = 10 * d + a + 10 * b + d;
  const unitsFirst = r() < 0.5;
  const n1 = `${SUN}${a}`;
  const n2 = `${b}${SUN}`;
  const line = unitsFirst ? `${n2} + ${n1} = ${total}` : `${n1} + ${n2} = ${total}`;
  return {
    type: 'digit',
    prompt: `${SUN} היא אותה ספרה בשני המקומות. איזו ספרה היא?`,
    lines: [line],
    explain: `פותרים קודם את האחדות: ${L(`${a} + ${SUN}`)} צריך להיגמר ב־${L(String(total % 10))}, אז ${SUN} = ${L(String(d))}. בדיקה: ${L(`${10 * d + a} + ${10 * b + d} = ${total}`)} ✓`,
    mathOptions: true,
    ...numberChoice(r, d, [d + 1, d - 1, b, a], { max: 9 }),
  };
}

// ---------- T7 שאלות מילוליות ----------

type Person = { n: string; f: boolean };
const PEOPLE: Person[] = [
  { n: 'מאיה', f: true },
  { n: 'תמר', f: true },
  { n: 'שירה', f: true },
  { n: 'נועה', f: true },
  { n: 'הילה', f: true },
  { n: 'יואב', f: false },
  { n: 'איתי', f: false },
  { n: 'עומר', f: false },
  { n: 'רוני', f: false },
];
const g = (p: Person, m: string, f: string) => (p.f ? f : m);

function word(r: Rng): Question {
  const kind = pick(r, [
    'change', 'groups', 'share', 'twoStep', 'age', 'line', 'gaveGot', 'week', 'boxes', 'timesLess', 'sumShare', 'half',
  ] as const);
  const p = pick(r, PEOPLE);
  const q = (prompt: string, answer: number, wrongs: Wrong[], explain: string): Question => ({
    type: 'word',
    prompt,
    explain,
    ...numberChoice(r, answer, wrongs),
  });

  if (kind === 'change') {
    const one = pick(r, ['ספר', 'כדור', 'לחם', 'משחק']);
    const many = pick(r, ['מחברות', 'גבינות', 'מדבקות', 'בובות']);
    const p1 = int(r, 3, 15);
    const k = int(r, 2, 4);
    const p2 = int(r, 2, 8);
    const total = p1 + k * p2;
    const pay = total <= 20 ? 20 : 50;
    return q(
      `${p.n} ${g(p, 'קנה', 'קנתה')} ${one} ב־${p1} ₪ ו־${k} ${many} ב־${p2} ₪ כל אחת. ${g(p, 'הוא', 'היא')} ${g(p, 'שילם', 'שילמה')} ב־${pay} ₪. כמה עודף ${g(p, 'קיבל', 'קיבלה')}?`,
      pay - total,
      [[pay - (p1 + p2), `שכחת לכפול: יש ${k} ${many}, לא אחת.`], [total, TRAP.step], pay - total + 1],
      `${L(`${k} × ${p2} = ${k * p2}`)}, ועוד ${L(String(p1))}: ${L(`${k * p2} + ${p1} = ${total}`)}. העודף: ${L(`${pay} − ${total} = ${pay - total}`)}`,
    );
  }
  if (kind === 'groups') {
    const a = int(r, 2, 9);
    const b = int(r, 2, 9);
    const text = pick(r, [
      `בכיתה יש ${a} שולחנות, וליד כל שולחן יושבים ${b} ילדים. כמה ילדים יושבים בכיתה?`,
      `בקופסה יש ${a} שורות, ובכל שורה ${b} עוגיות. כמה עוגיות יש בקופסה?`,
      `בגינה של ${p.n} יש ${a} עציצים, ובכל עציץ ${b} פרחים. כמה פרחים יש בגינה?`,
    ]);
    return q(text, a * b, [[a + b, TRAP.wrongOp], a * b + b, a * b - b, a * b + 1], `${L(String(a))} קבוצות של ${L(String(b))}: ${L(`${a} × ${b} = ${a * b}`)}`);
  }
  if (kind === 'share') {
    const k = int(r, 2, 9);
    const x = int(r, 2, 10);
    const t = k * x;
    return q(
      `ל${p.n} יש ${t} מדבקות. ${g(p, 'הוא', 'היא')} ${g(p, 'חילק', 'חילקה')} אותן שווה בשווה בין ${k} חברים. כמה מדבקות קיבל כל חבר?`,
      x,
      [[t - k, TRAP.wrongOp], x + 1, x - 1, k],
      `${L(`${t} ÷ ${k} = ${x}`)}. בדיקה: ${L(`${k} × ${x} = ${t}`)} ✓`,
    );
  }
  if (kind === 'twoStep') {
    const [p1, p2] = shuffle(r, PEOPLE);
    const a = int(r, 15, 45);
    const d = int(r, 3, 15);
    return q(
      `ל${p1.n} יש ${a} גולות, ול${p2.n} יש ${d} גולות יותר. כמה גולות יש לשניהם יחד?`,
      2 * a + d,
      [[a + d, TRAP.step], [2 * a, `שכחת שלאחד יש ${d} יותר.`], 2 * a + d + 10, 2 * a + d - 1],
      `שני שלבים! ל${p2.n} יש ${L(`${a} + ${d} = ${a + d}`)}. יחד: ${L(`${a} + ${a + d} = ${2 * a + d}`)}`,
    );
  }
  if (kind === 'age') {
    const a = int(r, 6, 9);
    const d = int(r, 2, 6);
    const y = int(r, 2, 5);
    return q(
      `${p.n} ${g(p, 'בן', 'בת')} ${a}. ${g(p, 'אחותו', 'אחותה')} גדולה ${g(p, 'ממנו', 'ממנה')} ב־${d} שנים. בת כמה תהיה האחות בעוד ${y} שנים?`,
      a + d + y,
      [[a + d, TRAP.step], [a + y, `זה הגיל של ${p.n}, לא של האחות.`], a + d + y + 1, a + d - y],
      `היום האחות בת ${L(`${a} + ${d} = ${a + d}`)}. בעוד ${L(String(y))} שנים: ${L(`${a + d} + ${y} = ${a + d + y}`)}`,
    );
  }
  if (kind === 'line') {
    const k = int(r, 3, 12);
    const m = int(r, 3, 12);
    return q(
      `ילדים עומדים בתור. ${p.n} ${g(p, 'עומד', 'עומדת')} במקום ה־${k} מההתחלה ובמקום ה־${m} מהסוף. כמה ילדים יש בתור?`,
      k + m - 1,
      [[k + m, `ספרת את ${p.n} פעמיים!`], k + m - 2, k + m + 1],
      `לפני ${p.n} יש ${L(String(k - 1))} ילדים, אחרי ${g(p, 'הוא', 'היא')} עוד ${L(String(m - 1))}, ועוד ${p.n} ${g(p, 'עצמו', 'עצמה')}: ${L(`${k - 1} + ${m - 1} + 1 = ${k + m - 1}`)}`,
    );
  }
  if (kind === 'gaveGot') {
    const a = int(r, 20, 60);
    const b = int(r, 5, a - 5);
    const c = int(r, 3, 20);
    const [p2] = shuffle(r, PEOPLE.filter((x) => x !== p));
    return q(
      `ל${p.n} היו ${a} מדבקות. ${g(p, 'הוא נתן', 'היא נתנה')} ${b} ל${p2.n}, ואחר כך ${g(p, 'קיבל', 'קיבלה')} ${c} מחברה. כמה מדבקות יש ל${p.n} עכשיו?`,
      a - b + c,
      [[a - b, TRAP.step], [a + b + c, TRAP.wrongOp], [a - b - c, 'קיבלה = מוסיפים, לא מורידים.'], a - b + c + 10],
      `${L(`${a} − ${b} = ${a - b}`)}, ואז ${L(`${a - b} + ${c} = ${a - b + c}`)}`,
    );
  }
  if (kind === 'week') {
    const x = int(r, 2, 9);
    return q(
      `${p.n} ${g(p, 'קורא', 'קוראת')} ${x} עמודים בכל יום. כמה עמודים ${g(p, 'יקרא', 'תקרא')} בשבוע?`,
      7 * x,
      [[x + 7, TRAP.wrongOp], [6 * x, 'בשבוע יש 7 ימים.'], 8 * x, 7 * x + 1],
      `בשבוע יש ${L('7')} ימים: ${L(`7 × ${x} = ${7 * x}`)}`,
    );
  }
  if (kind === 'boxes') {
    const k = int(r, 2, 4);
    const rows = int(r, 2, 5);
    const per = int(r, 2, 5);
    return q(
      `יש ${k} קופסאות עוגיות. בכל קופסה ${rows} שורות, ובכל שורה ${per} עוגיות. כמה עוגיות יש בסך הכול?`,
      k * rows * per,
      [[rows * per, TRAP.step], [k + rows + per, TRAP.wrongOp], k * rows * per + per, k * per],
      `בקופסה אחת: ${L(`${rows} × ${per} = ${rows * per}`)}. ב־${L(String(k))} קופסאות: ${L(`${k} × ${rows * per} = ${k * rows * per}`)}`,
    );
  }
  if (kind === 'timesLess') {
    const [p1, p2, p3] = shuffle(r, PEOPLE);
    const a = int(r, 3, 9);
    const f = pick(r, [2, 3, 4]);
    const d = int(r, 2, a * f - 2);
    return q(
      `ל${p1.n} יש ${a} גולות. ל${p2.n} יש פי ${f} גולות מאשר ל${p1.n}. ל${p3.n} יש ${d} גולות פחות מאשר ל${p2.n}. כמה גולות יש ל${p3.n}?`,
      a * f - d,
      [[a * f, TRAP.step], [a + f - d, TRAP.add], [a * f + d, '"פחות" = מורידים.'], a * f - d + 1],
      `ל${p2.n}: ${L(`${a} × ${f} = ${a * f}`)}. ל${p3.n}: ${L(`${a * f} − ${d} = ${a * f - d}`)}`,
    );
  }
  if (kind === 'sumShare') {
    const [p1, p2] = shuffle(r, PEOPLE);
    const half = int(r, 6, 30);
    const a = int(r, 2, 2 * half - 2);
    const b = 2 * half - a;
    return q(
      `ל${p1.n} יש ${a} קלפים ול${p2.n} יש ${b} קלפים. הם שמו את כל הקלפים יחד וחילקו אותם שווה בשווה ביניהם. כמה קלפים יש עכשיו לכל אחד?`,
      half,
      [[a + b, TRAP.sum], Math.abs(a - b), half + 1, half - 1],
      `יחד: ${L(`${a} + ${b} = ${a + b}`)}. חצי לכל אחד: ${L(`${a + b} ÷ 2 = ${half}`)}`,
    );
  }
  const n = 2 * int(r, 10, 16);
  const k = int(r, 2, 6);
  return q(
    `בכיתה ${n} ילדים. חצי מהם יצאו לחוג, ועוד ${k} ילדים הלכו הביתה. כמה ילדים נשארו בכיתה?`,
    n / 2 - k,
    [[n / 2, TRAP.step], [n - k, 'שכחת שחצי יצאו לחוג.'], n / 2 + k, n / 2 - k + 1],
    `חצי מ־${L(String(n))} זה ${L(String(n / 2))}. ואז ${L(`${n / 2} − ${k} = ${n / 2 - k}`)}`,
  );
}

// ---------- T8 פרופורציה: פי 2 / 3 / 4 ----------

function proportion(r: Rng): Question {
  const kind = pick(r, ['weightToCount', 'countToWeight', 'price'] as const);
  const f = pick(r, [2, 3, 4]);
  if (kind === 'weightToCount') {
    const w = pick(r, [100, 200]);
    const c = int(r, 3, 12);
    return {
      type: 'proportion',
      prompt: `בחבילה של ${w} גרם יש ${c} עוגיות. כמה עוגיות יש בחבילה של ${w * f} גרם?`,
      explain: `${L(String(w * f))} זה פי ${L(String(f))} מ־${L(String(w))}, אז גם העוגיות פי ${L(String(f))}: ${L(`${c} × ${f} = ${c * f}`)}`,
      ...numberChoice(r, c * f, [[c + f, TRAP.add], c * (f + 1), c * f - c, c * f + 1]),
    };
  }
  if (kind === 'countToWeight') {
    const c1 = pick(r, [2, 4, 5]);
    const unit = pick(r, [10, 20]);
    const w1 = c1 * unit;
    const c2 = c1 * f;
    return {
      type: 'proportion',
      prompt: `${c1} עוגיות שוקלות ${w1} גרם. כמה שוקלות ${c2} עוגיות?`,
      explain: `${L(String(c2))} זה פי ${L(String(f))} מ־${L(String(c1))}, אז גם המשקל: ${L(`${w1} × ${f} = ${w1 * f}`)}`,
      ...numberChoice(r, w1 * f, [[w1 + c2 - c1, TRAP.add], w1 * (f + 1), w1 * (f - 1), w1 * f + 10], { max: w1 * (f + 1) }),
    };
  }
  const k = int(r, 2, 4);
  const u = int(r, 2, 6);
  const many = pick(r, ['מחברות', 'מדבקות', 'עפרונות', 'בלונים']);
  return {
    type: 'proportion',
    prompt: `${k} ${many} עולים ${k * u} ₪. כמה עולים ${k * f} ${many}?`,
    explain: `${L(String(k * f))} זה פי ${L(String(f))} מ־${L(String(k))}, אז גם המחיר: ${L(`${k * u} × ${f} = ${k * u * f}`)}`,
    ...numberChoice(r, k * u * f, [[k * u + k * f - k, TRAP.add], k * u * f + u, k * u * f - u, u * f]),
  };
}

// ---------- T9 זמן ----------

export const clock = (min: number): string => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

export function duration(min: number): string {
  const h = Math.floor(min / 60);
  const half = min % 60 === 30;
  if (h === 0) return 'חצי שעה';
  const hours = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  return half ? `${hours} וחצי` : hours;
}

function time(r: Rng): Question {
  const kind = pick(r, ['between', 'lesson', 'movie'] as const);
  const p = pick(r, PEOPLE);
  if (kind === 'between') {
    const start = int(r, 7, 12) * 60 + pick(r, [0, 30]);
    const dur = int(r, 2, 16) * 30;
    const end = start + dur;
    const hourOnly = (Math.floor(end / 60) - Math.floor(start / 60)) * 60;
    return {
      type: 'time',
      prompt: `${p.n} ${g(p, 'יצא', 'יצאה')} מהבית ב־${L(clock(start))} ${g(p, 'וחזר', 'וחזרה')} ב־${L(clock(end))}. כמה זמן ${g(p, 'הוא היה', 'היא הייתה')} מחוץ לבית?`,
      explain: `סופרים שעות שלמות ואז דקות: מ־${L(clock(start))} עד ${L(clock(end))} זה ${duration(dur)}`,
      ...numberChoice(r, dur, [[hourOnly, 'ספרת רק את השעות, בלי חצאי השעות.'], dur + 60, dur - 30, dur + 30], {
        min: 30,
        max: 9 * 60,
        fmt: duration,
      }),
    };
  }
  if (kind === 'lesson') {
    const start = 8 * 60 + pick(r, [0, 15, 30]);
    const brk = pick(r, [15, 20, 30]);
    const ans = start + 45 + brk;
    return {
      type: 'time',
      prompt: `השיעור מתחיל ב־${L(clock(start))} ונמשך 45 דקות. אחריו יש הפסקה של ${brk === 15 ? 'רבע שעה' : brk === 30 ? 'חצי שעה' : '20 דקות'}. מתי מתחיל השיעור הבא?`,
      mathOptions: true,
      explain: `השיעור נגמר ב־${L(clock(start + 45))}. ועוד ${L(String(brk))} דקות הפסקה: ${L(clock(ans))}`,
      ...numberChoice(r, ans, [[start + 45, 'זה סוף השיעור. שכחת את ההפסקה!'], ans + 15, ans - 15, start + 60 + brk], { fmt: clock, max: 24 * 60 }),
    };
  }
  const start = int(r, 15, 19) * 60 + pick(r, [0, 30]);
  const dur = pick(r, [60, 90, 120, 150]);
  const ans = start + dur;
  return {
    type: 'time',
    prompt: `הסרט מתחיל ב־${L(clock(start))} ונמשך ${duration(dur)}. מתי הוא נגמר?`,
    mathOptions: true,
    explain: `${L(clock(start))} ועוד ${duration(dur)} = ${L(clock(ans))}`,
    ...numberChoice(r, ans, [ans + 30, ans - 30, ans + 60, start + 60], { fmt: clock, max: 24 * 60 }),
  };
}

// ---------- T10 סדרות ----------

function sequence(r: Rng): Question {
  const kind = pick(r, ['step', 'alternate', 'double', 'growing', 'shrinking', 'twoSeries'] as const);
  const prompt = 'איזה מספר בא במקום סימן השאלה?';
  const mk = (terms: number[], ans: number, wrongs: Wrong[], explain: string, hole = terms.length): Question => {
    const shown = [...terms.slice(0, hole).map(String), '?', ...terms.slice(hole + 1).map(String)];
    return { type: 'sequence', prompt, lines: [shown.join(', ')], explain, ...numberChoice(r, ans, wrongs) };
  };

  if (kind === 'step') {
    const d = pick(r, [2, 3, 4, 5, 10]) * (r() < 0.3 ? -1 : 1);
    const start = d > 0 ? int(r, 1, 50) : int(r, 60, 110);
    const terms = Array.from({ length: 5 }, (_, i) => start + i * d);
    const hole = int(r, 2, 4);
    return mk(terms, terms[hole], [terms[hole] + 1, terms[hole] - 1, terms[hole] + d, terms[hole] - d],
      `כל פעם ${d > 0 ? 'מוסיפים' : 'מורידים'} ${L(String(Math.abs(d)))}`, hole);
  }
  if (kind === 'alternate') {
    const a = int(r, 1, 5);
    const b = int(r, a + 1, 9);
    const terms = [int(r, 1, 20)];
    for (let i = 0; i < 5; i++) terms.push(terms[i] + (i % 2 === 0 ? a : b));
    return mk(terms.slice(0, 5), terms[5], [terms[4] + b, terms[5] + 1, terms[5] - 1],
      `מוסיפים לסירוגין ${L(`+${a}`)} ואז ${L(`+${b}`)}: ${L(`${terms[4]} + ${a} = ${terms[5]}`)}`);
  }
  if (kind === 'double') {
    const start = int(r, 1, 6);
    const terms = Array.from({ length: 5 }, (_, i) => start * 2 ** i);
    const ans = terms[4];
    return mk(terms.slice(0, 4), ans, [[terms[3] + (terms[3] - terms[2]), 'כאן לא מוסיפים אותו מספר, אלא מכפילים.'], ans + 2, ans - 2],
      `כל מספר הוא פי 2 מהקודם: ${L(`${terms[3]} × 2 = ${ans}`)}`);
  }
  if (kind === 'growing' || kind === 'shrinking') {
    // growing: +2, +3, +4, +5 → +6 ; shrinking: −6, −5, −4, −3 → −2
    const growing = kind === 'growing';
    const d0 = growing ? int(r, 1, 4) : int(r, 6, 9);
    const diffs = Array.from({ length: 4 }, (_, i) => (growing ? d0 + i : -(d0 - i)));
    const terms = [growing ? int(r, 1, 20) : int(r, 40, 80)];
    for (let i = 0; i < 4; i++) terms.push(terms[i] + diffs[i]);
    const nextDiff = growing ? d0 + 4 : -(d0 - 4);
    const ans = terms[4] + nextDiff;
    return mk(terms, ans, [[terms[4] + diffs[3], 'ההפרש משתנה כל פעם, לא נשאר אותו דבר.'], ans + 1, ans - 1],
      `ההפרשים: ${L(diffs.map((d) => (d > 0 ? `+${d}` : `${d}`)).join(', '))}, אז עכשיו ${L(nextDiff > 0 ? `+${nextDiff}` : String(nextDiff))}: ${L(String(ans))}`);
  }
  // two interleaved series: 1, 4, 2, 8, 3, 12, ?
  const a0 = int(r, 1, 5);
  const m = int(r, 2, 5);
  const terms: number[] = [];
  for (let i = 0; i < 3; i++) terms.push(a0 + i, m * (a0 + i));
  const ans = a0 + 3;
  return mk(terms, ans, [[m * (a0 + 3), 'זה המספר הבא בסדרה השנייה. בודקים איזו סדרה ממשיכה.'], ans + 1, terms[5] + 1],
    `שתי סדרות לסירוגין: ${L(`${a0}, ${a0 + 1}, ${a0 + 2}`)} (עוד 1) ו־${L(`${m * a0}, ${m * (a0 + 1)}, ${m * (a0 + 2)}`)} (פי ${L(String(m))}). עכשיו תורה של הראשונה: ${L(String(ans))}`);
}

// ---------- איזה תרגיל גדול יותר ----------

function exprFor(r: Rng, v: number): string {
  if (r() < 0.5 && v > 15) {
    const a = int(r, 10, v - 5);
    return `${a} + ${v - a}`;
  }
  const b = int(r, 3, Math.min(25, 99 - v));
  return `${v + b} − ${b}`;
}

function compare(r: Rng): Question {
  const biggest = r() < 0.6;
  const top = int(r, 30, 85);
  const values = [top, ...shuffle(r, [1, 2, 3, 4, 5, 6]).slice(0, 3).map((d) => top - d)];
  const target = biggest ? top : Math.min(...values);
  const order = shuffle(r, values.map((v) => ({ v, e: exprFor(r, v) })));
  return {
    type: 'compare',
    prompt: biggest ? 'באיזה תרגיל התוצאה הכי גדולה?' : 'באיזה תרגיל התוצאה הכי קטנה?',
    options: order.map((x) => x.e),
    correct: order.findIndex((x) => x.v === target),
    mathOptions: true,
    explain: order.map((x) => L(`${x.e} = ${x.v}`)).join(' · '),
  };
}

export const MATH_GENERATORS: Record<MathType, (r: Rng) => Question> = {
  arith,
  missing,
  inequality,
  pictures,
  digit,
  word,
  proportion,
  time,
  sequence,
  compare,
};

/** 15 questions, about the size of the real math section, covering every type. */
export const MATH_EXAM_PLAN: MathType[] = [
  'arith', 'missing', 'word', 'inequality', 'pictures', 'arith', 'word', 'digit',
  'missing', 'time', 'proportion', 'sequence', 'word', 'compare', 'pictures',
];

export function mathExam(seed: number): Question[] {
  const r = rng(seed);
  return MATH_EXAM_PLAN.map((t) => MATH_GENERATORS[t](r));
}

export function mathPractice(type: MathType | 'mix', seed: number, n = 10): Question[] {
  const r = rng(seed);
  const types = type === 'mix' ? shuffle(r, MATH_EXAM_PLAN) : [];
  return Array.from({ length: n }, (_, i) => MATH_GENERATORS[type === 'mix' ? types[i % types.length] : type](r));
}
