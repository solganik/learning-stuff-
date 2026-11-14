/** Multiple-choice math questions in the style of the grade-2 gifted screening test (שלב א). */

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

export type MathType = 'arith' | 'missing' | 'pictures' | 'word' | 'compare' | 'sequence';
export type QType = MathType | 'reading';

export type Question = {
  type: QType;
  prompt: string;
  /** Equations / sequences shown big, left to right. */
  lines?: string[];
  options: string[];
  correct: number;
  explain: string;
  /** Options are math (render LTR). */
  mathOptions?: boolean;
  passageId?: string;
  /** For number answers: the value, so tests can check it independently. */
  value?: number;
};

export const TYPE_NAMES: Record<QType, string> = {
  arith: 'חשבון מהיר',
  missing: 'המספר החסר 😊',
  pictures: 'חידות ציורים',
  word: 'שאלות מילוליות',
  compare: 'מה גדול יותר',
  sequence: 'סדרות',
  reading: 'הבנת הנקרא',
};

/** Four options: the answer plus the 3 most plausible distinct wrong answers (whole numbers 0–100). */
export function numberChoice(r: Rng, answer: number, wrongs: number[]): Pick<Question, 'options' | 'correct' | 'value'> {
  const picked: number[] = [];
  const max = Math.max(100, answer);
  const ok = (w: number) => Number.isInteger(w) && w >= 0 && w <= max && w !== answer && !picked.includes(w);
  for (const w of wrongs) if (picked.length < 3 && ok(w)) picked.push(w);
  for (let k = 1; picked.length < 3; k++) {
    if (ok(answer + k)) picked.push(answer + k);
    if (picked.length < 3 && ok(answer - k)) picked.push(answer - k);
  }
  const options = shuffle(r, [answer, ...picked]);
  return { options: options.map(String), correct: options.indexOf(answer), value: answer };
}

// ---------- חשבון מהיר: the four operations, with the smart way as the explanation ----------

function arith(r: Rng): Question {
  const kind = pick(r, ['add10', 'sub10', 'add2', 'sub2', 'mul', 'div'] as const);
  const q = (line: string, answer: number, wrongs: number[], explain: string): Question => ({
    type: 'arith',
    prompt: 'כמה זה?',
    lines: [`${line} = ?`],
    explain,
    ...numberChoice(r, answer, wrongs),
  });

  if (kind === 'add10') {
    const a = int(r, 1, 8) * 10 + int(r, 5, 9);
    const need = 10 - (a % 10);
    const b = int(r, Math.max(2, need), 9);
    const ans = a + b;
    const explain =
      b === need
        ? `${L(`${a} + ${b} = ${ans}`)}, עשרת שלמה!`
        : `משלימים לעשרת: ${L(`${a} + ${need} = ${a + need}`)}, ועוד ${L(String(b - need))}: ${L(String(ans))}`;
    return q(`${a} + ${b}`, ans, [ans - 10, ans + 1, ans - 1, ans + 10], explain);
  }
  if (kind === 'sub10') {
    const a = int(r, 2, 9) * 10 + int(r, 1, 7);
    const u = a % 10;
    const b = int(r, u + 1, 9);
    const ans = a - b;
    const explain = `יורדים קודם לעשרת: ${L(`${a} − ${u} = ${a - u}`)}, ואז עוד ${L(`− ${b - u}`)}: ${L(String(ans))}`;
    return q(`${a} − ${b}`, ans, [ans + 10, ans - 1, ans + 1, ans - 10], explain);
  }
  if (kind === 'add2') {
    const a = int(r, 11, 59);
    const b = int(r, 11, Math.min(39, 99 - a));
    const ans = a + b;
    const tens = b - (b % 10);
    const explain =
      b % 10
        ? `קודם העשרות: ${L(`${a} + ${tens} = ${a + tens}`)}, ואז האחדות: ${L(`${a + tens} + ${b % 10} = ${ans}`)}`
        : `${L(`${a} + ${b} = ${ans}`)}`;
    const carried = (a % 10) + (b % 10) >= 10;
    return q(`${a} + ${b}`, ans, carried ? [ans - 10, ans + 1, ans + 10] : [ans + 10, ans - 1, ans - 10], explain);
  }
  if (kind === 'sub2') {
    const a = int(r, 40, 99);
    const b = int(r, 11, a - 10);
    const ans = a - b;
    const tens = b - (b % 10);
    // the classic mistake: subtracting the smaller digit from the larger one in each column
    const digitSlip = (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
    const explain =
      b % 10
        ? `קודם העשרות: ${L(`${a} − ${tens} = ${a - tens}`)}, ואז האחדות: ${L(`${a - tens} − ${b % 10} = ${ans}`)}`
        : `${L(`${a} − ${b} = ${ans}`)}`;
    return q(`${a} − ${b}`, ans, [digitSlip, ans + 10, ans - 1, ans + 1], explain);
  }
  const f = pick(r, [2, 3, 4, 5, 10]);
  const k = int(r, 2, 10);
  if (kind === 'mul') {
    const ans = f * k;
    const explain =
      k <= 5
        ? `${L(`${k} × ${f}`)} זה ${L(String(k))} פעמים ${L(String(f))}: ${L(`${Array(k).fill(f).join(' + ')} = ${ans}`)}`
        : `${L(`5 × ${f} = ${5 * f}`)}, ועוד ${L(String(k - 5))} פעמים ${L(String(f))}: ${L(`${5 * f} + ${(k - 5) * f} = ${ans}`)}`;
    return q(`${k} × ${f}`, ans, [f + k, ans + f, ans - f, ans + 1], explain);
  }
  const total = f * k;
  const explain = `כמה פעמים ${L(String(f))} נכנס ב־${L(String(total))}? ${L(`${k} × ${f} = ${total}`)}, אז ${L(`${total} : ${f} = ${k}`)}`;
  return q(`${total} : ${f}`, k, [k + 1, k - 1, total - f, f], explain);
}

// ---------- המספר החסר: an equation with a smiley instead of a number ----------

const SMILEY = '😊';

function missing(r: Rng): Question {
  const kind = pick(r, ['plus', 'minusFirst', 'minusMiddle', 'times'] as const);
  const flip = r() < 0.5; // the test often writes the result first: 13 = 😊 + 10
  const eq = (left: string, right: string) => (flip ? `${right} = ${left}` : `${left} = ${right}`);
  const q = (line: string, answer: number, wrongs: number[], explain: string): Question => ({
    type: 'missing',
    prompt: `איזה מספר מסתתר מאחורי ${SMILEY}?`,
    lines: [line],
    explain,
    ...numberChoice(r, answer, wrongs),
  });

  if (kind === 'plus') {
    const x = int(r, 3, 60);
    const b = int(r, 3, 39);
    const c = x + b;
    return q(eq(`${SMILEY} + ${b}`, String(c)), x, [c + b, x + 1, x - 1, x + 10],
      `הופכים לחיסור: ${L(`${c} − ${b} = ${x}`)}. בדיקה: ${L(`${x} + ${b} = ${c}`)} ✓`);
  }
  if (kind === 'minusFirst') {
    const x = int(r, 20, 99);
    const b = int(r, 3, x - 5);
    const c = x - b;
    return q(eq(`${SMILEY} − ${b}`, String(c)), x, [c - b, x + 1, x - 1, x - 10],
      `הופכים לחיבור: ${L(`${c} + ${b} = ${x}`)}. בדיקה: ${L(`${x} − ${b} = ${c}`)} ✓`);
  }
  if (kind === 'minusMiddle') {
    const a = int(r, 20, 99);
    const x = int(r, 3, a - 3);
    const c = a - x;
    return q(eq(`${a} − ${SMILEY}`, String(c)), x, [a + c, x + 1, x - 1, x + 10],
      `כמה צריך להוריד מ־${L(String(a))} כדי להגיע ל־${L(String(c))}? ${L(`${a} − ${c} = ${x}`)}`);
  }
  const f = pick(r, [2, 3, 4, 5, 10]);
  const x = int(r, 1, 10);
  const c = f * x;
  return q(eq(`${SMILEY} × ${f}`, String(c)), x, [c - f, x + 1, x - 1, f],
    `כמה פעמים ${L(String(f))} עושה ${L(String(c))}? ${L(`${x} × ${f} = ${c}`)}`);
}

// ---------- חידות ציורים: each picture stands for a number ----------

const PICS = ['🌸', '⭐', '🍓', '🦋', '🎀', '💎', '🧁', '🌈'];

function pictures(r: Rng): Question {
  const [p1, p2, p3] = shuffle(r, PICS);
  if (r() < 0.55) {
    const a = int(r, 3, 12);
    const k = pick(r, [2, 3]);
    const b = int(r, 5, 30);
    return {
      type: 'pictures',
      prompt: `כל ציור הוא מספר. כמה שווה ${p2}?`,
      lines: [`${Array(k).fill(p1).join(' + ')} = ${k * a}`, `${p2} + ${p1} = ${a + b}`],
      explain: `${L(`${k * a} : ${k} = ${a}`)}, אז ${p1} = ${L(String(a))}. ואז ${L(`${a + b} − ${a} = ${b}`)}, אז ${p2} = ${L(String(b))}`,
      ...numberChoice(r, b, [a + b, a, b + 1, b - 1]),
    };
  }
  const a = int(r, 2, 10);
  const b = int(r, 3, 20);
  const c = int(r, 3, 20);
  return {
    type: 'pictures',
    prompt: `כל ציור הוא מספר. כמה שווה ${p3}?`,
    lines: [`${p1} + ${p1} = ${2 * a}`, `${p1} + ${p2} = ${a + b}`, `${p2} + ${p3} = ${b + c}`],
    explain: `${p1} = ${L(String(a))}, אז ${p2} = ${L(`${a + b} − ${a} = ${b}`)}, ואז ${p3} = ${L(`${b + c} − ${b} = ${c}`)}`,
    ...numberChoice(r, c, [b, b + c - a, c + 1, c - 1]),
  };
}

// ---------- שאלות מילוליות ----------

type Person = { n: string; f: boolean };
const PEOPLE: Person[] = [
  { n: 'מאיה', f: true },
  { n: 'תמר', f: true },
  { n: 'שירה', f: true },
  { n: 'נועה', f: true },
  { n: 'יואב', f: false },
  { n: 'איתי', f: false },
  { n: 'עומר', f: false },
];
const g = (p: Person, m: string, f: string) => (p.f ? f : m);

function word(r: Rng): Question {
  const kind = pick(r, ['change', 'scale', 'groups', 'share', 'twoStep', 'age', 'line'] as const);
  const p = pick(r, PEOPLE);
  const q = (prompt: string, answer: number, wrongs: number[], explain: string): Question => ({
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
      [pay - (p1 + p2), total, pay - total + 1, pay - total + 2],
      `${L(`${k} × ${p2} = ${k * p2}`)}, ועוד ${L(String(p1))}: ${L(`${k * p2} + ${p1} = ${total}`)}. העודף: ${L(`${pay} − ${total} = ${pay - total}`)}`,
    );
  }
  if (kind === 'scale') {
    const w = pick(r, [100, 200, 300]);
    const f = pick(r, [2, 3]);
    const c = int(r, 4, 12);
    return q(
      `בחבילה של ${w} גרם יש ${c} עוגיות. כמה עוגיות יש בחבילה של ${w * f} גרם?`,
      c * f,
      [c + f, c * (f + 1), c + 10, c * f - 1],
      `החבילה הגדולה שוקלת פי ${L(String(f))}, אז גם יש בה פי ${L(String(f))} עוגיות: ${L(`${c} × ${f} = ${c * f}`)}`,
    );
  }
  if (kind === 'groups') {
    const a = int(r, 2, 6);
    const b = int(r, 2, 5);
    const text = pick(r, [
      `בכיתה יש ${a} שולחנות, וליד כל שולחן יושבים ${b} ילדים. כמה ילדים יושבים בכיתה?`,
      `בקופסה יש ${a} שורות, ובכל שורה ${b} עוגיות. כמה עוגיות יש בקופסה?`,
    ]);
    return q(text, a * b, [a + b, a * b + b, a * b - b, a * b + 1], `${L(String(a))} קבוצות של ${L(String(b))}: ${L(`${a} × ${b} = ${a * b}`)}`);
  }
  if (kind === 'share') {
    const k = pick(r, [2, 3, 4, 5]);
    const x = int(r, 2, 10);
    const t = k * x;
    return q(
      `ל${p.n} יש ${t} מדבקות. ${g(p, 'הוא', 'היא')} ${g(p, 'חילק', 'חילקה')} אותן שווה בשווה בין ${k} חברים. כמה מדבקות קיבל כל חבר?`,
      x,
      [t - k, x + 1, x - 1, k],
      `${L(`${t} : ${k} = ${x}`)}. בדיקה: ${L(`${k} × ${x} = ${t}`)} ✓`,
    );
  }
  if (kind === 'twoStep') {
    const [p1, p2] = shuffle(r, PEOPLE);
    const a = int(r, 15, 40);
    const d = int(r, 3, 15);
    return q(
      `ל${p1.n} יש ${a} גולות, ול${p2.n} יש ${d} גולות יותר. כמה גולות יש לשניהם יחד?`,
      2 * a + d,
      [a + d, 2 * a, 2 * a + d + 10, 2 * a + d - 1],
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
      [a + d, a + y, a + d + y + 1, a + d - y],
      `היום האחות בת ${L(`${a} + ${d} = ${a + d}`)}. בעוד ${L(String(y))} שנים: ${L(`${a + d} + ${y} = ${a + d + y}`)}`,
    );
  }
  const k = int(r, 3, 9);
  const m = int(r, 3, 9);
  return q(
    `ילדים עומדים בתור. ${p.n} ${g(p, 'עומד', 'עומדת')} במקום ה־${k} מההתחלה ובמקום ה־${m} מהסוף. כמה ילדים יש בתור?`,
    k + m - 1,
    [k + m, k + m - 2, k + m + 1],
    `לפני ${p.n} יש ${L(String(k - 1))} ילדים, אחרי ${g(p, 'הוא', 'היא')} עוד ${L(String(m - 1))}, ועוד ${p.n} ${g(p, 'עצמו', 'עצמה')}: ${L(`${k - 1} + ${m - 1} + 1 = ${k + m - 1}`)}. ${g(p, 'הוא נספר', 'היא נספרת')} רק פעם אחת!`,
  );
}

// ---------- מה גדול יותר: pick the exercise with the biggest / smallest result ----------

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
  const exprs = values.map((v) => ({ v, e: exprFor(r, v) }));
  const order = shuffle(r, exprs);
  return {
    type: 'compare',
    prompt: biggest ? 'באיזה תרגיל התוצאה הכי גדולה?' : 'באיזה תרגיל התוצאה הכי קטנה?',
    options: order.map((x) => x.e),
    correct: order.findIndex((x) => x.v === target),
    mathOptions: true,
    explain: order.map((x) => L(`${x.e} = ${x.v}`)).join(' · '),
  };
}

// ---------- סדרות ----------

function sequence(r: Rng): Question {
  if (r() < 0.35) {
    const a = int(r, 1, 5);
    const b = int(r, a + 1, 9);
    const start = int(r, 1, 20);
    const terms = [start];
    for (let i = 0; i < 5; i++) terms.push(terms[i] + (i % 2 === 0 ? a : b));
    const ans = terms[5];
    return {
      type: 'sequence',
      prompt: 'איזה מספר בא במקום סימן השאלה?',
      lines: [`${terms.slice(0, 5).join(', ')}, ?`],
      explain: `מוסיפים לסירוגין ${L(`+${a}`)} ואז ${L(`+${b}`)}: ${L(`${terms[4]} + ${a} = ${ans}`)}`,
      ...numberChoice(r, ans, [terms[4] + b, ans + 1, ans - 1]),
    };
  }
  const d = pick(r, [2, 3, 4, 5, 10]) * (r() < 0.3 ? -1 : 1);
  const start = d > 0 ? int(r, 1, 40) : int(r, 60, 99);
  const terms = Array.from({ length: 5 }, (_, i) => start + i * d);
  const hole = int(r, 2, 4);
  const ans = terms[hole];
  const shown = terms.map((t, i) => (i === hole ? '?' : String(t)));
  return {
    type: 'sequence',
    prompt: 'איזה מספר בא במקום סימן השאלה?',
    lines: [shown.join(', ')],
    explain: `כל פעם ${d > 0 ? 'מוסיפים' : 'מורידים'} ${L(String(Math.abs(d)))}`,
    ...numberChoice(r, ans, [ans + 1, ans - 1, ans + d, ans - d]),
  };
}

export const MATH_GENERATORS: Record<MathType, (r: Rng) => Question> = {
  arith,
  missing,
  pictures,
  word,
  compare,
  sequence,
};

/** 15 questions, about the size of the real math section, mixing all types. */
export const MATH_EXAM_PLAN: MathType[] = [
  'arith', 'missing', 'word', 'arith', 'pictures', 'word', 'missing', 'compare',
  'arith', 'word', 'sequence', 'missing', 'word', 'pictures', 'arith',
];

export function mathExam(seed: number): Question[] {
  const r = rng(seed);
  return MATH_EXAM_PLAN.map((t) => MATH_GENERATORS[t](r));
}

export function mathPractice(type: MathType | 'mix', seed: number, n = 10): Question[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => MATH_GENERATORS[type === 'mix' ? MATH_EXAM_PLAN[i % MATH_EXAM_PLAN.length] : type](r));
}
