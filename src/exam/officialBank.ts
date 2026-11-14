import { L, rng, shuffle, TRAP, type MathType, type Question } from './questions';
import { passageQuestions, passageById } from './reading';

/**
 * A fixed "official-style sample exam" bank: ~14 math questions across 4 משימות + 2 reading passages.
 * Fixed content (no generator), no hints (the real test has none). Option order is shuffled by seed, like bank.ts.
 */

type Item = {
  type: MathType;
  prompt: string;
  lines?: string[];
  answer: string;
  /** Wrong options with an optional trap. Empty for open questions. */
  wrong: (string | [string, string])[];
  explain: string;
};

const OPEN = 'כתבי את התשובה';

const MATH_ITEMS: Item[] = [
  // משימה א: תרגילים (open arithmetic + missing number)
  { type: 'arith', prompt: OPEN, lines: ['47 + 36 = ?'], answer: '83', wrong: [], explain: `${L('47 + 30 = 77')}, ועוד ${L('6')}: ${L('83')}` },
  { type: 'arith', prompt: OPEN, lines: ['92 − 48 = ?'], answer: '44', wrong: [], explain: `${L('92 − 40 = 52')}, ועוד ${L('− 8')}: ${L('44')}` },
  { type: 'missing', prompt: OPEN, lines: ['⬜ + 26 = 71'], answer: '45', wrong: [], explain: `${L('71 − 26 = 45')}. בדיקה: ${L('45 + 26 = 71')} ✓` },
  { type: 'arith', prompt: OPEN, lines: ['6 × 7 + 8 = ?'], answer: '50', wrong: [], explain: `קודם כפל: ${L('6 × 7 = 42')}, ואז חיבור: ${L('42 + 8 = 50')}` },
  // משימה ב: המספר החסר וגדול/קטן
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['8 × 3 < 8 × ⬜'], answer: '4',
    wrong: ['2', '1', ['3', TRAP.equal]], explain: `צריך יותר מ־${L('3')}. ${L('3')} נותן שוויון, לא "קטן מ"`,
  },
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['60 − 15 > 60 − ⬜'], answer: '16',
    wrong: [['14', TRAP.flip], ['15', TRAP.flip], ['13', TRAP.flip]], explain: 'בחיסור: כדי שיישאר פחות, צריך להוריד יותר מ־15',
  },
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['⬜ ÷ 5 > 30 ÷ 5'], answer: '35',
    wrong: ['20', '25', ['30', TRAP.equal]], explain: `צריך מספר גדול מ־${L('30')} שמתחלק ב־${L('5')}`,
  },
  // משימה ג: תרגילי משולשים △
  {
    type: 'triangle', prompt: 'כל △ מסתיר אותה ספרה. איזו ספרה היא △?', lines: ['2△ + 4△ = 66'], answer: '3',
    wrong: ['2', '4', '6'], explain: `האחדות: ${L('△ + △ = 6')}, והעשרות: ${L('20 + 40 = 60')}. יחד ${L('66')}, אז ${L('△ = 3')}`,
  },
  {
    type: 'triangle', prompt: 'כל △ מסתיר אותה ספרה. איזו ספרה היא △?', lines: ['△ × △ − △ = 20'], answer: '5',
    wrong: ['4', '6', '3'], explain: `מציבים ${L('△ = 5')}: ${L('5 × 5 − 5 = 25 − 5 = 20')} ✓`,
  },
  {
    type: 'triangle', prompt: 'כל △ מסתיר אותה ספרה. איזו ספרה היא △?', lines: ['△ + △ + △ = 27'], answer: '9',
    wrong: ['3', '6', '8'], explain: `${L('27 ÷ 3 = 9')}, אז ${L('△ = 9')}`,
  },
  // משימה ד: בעיות מילוליות
  {
    type: 'word', prompt: 'למאיה היו 40 מדבקות. היא נתנה 15 לאחיה, ואחר כך קיבלה 9 מחברה. כמה מדבקות יש לה עכשיו?',
    answer: '34', wrong: [['25', TRAP.step], ['49', TRAP.wrongOp], ['16', 'הורידת במקום להוסיף.']], explain: `${L('40 − 15 = 25')}, ועוד ${L('9')}: ${L('34')}`,
  },
  {
    type: 'word', prompt: 'נועה קוראת 5 עמודים בכל יום. כמה עמודים תקרא בשבוע?',
    answer: '35', wrong: [['12', TRAP.wrongOp], ['30', 'בשבוע יש 7 ימים.'], '40'], explain: `${L('7 × 5 = 35')}`,
  },
  {
    type: 'word', prompt: 'ב־4 קופסאות יש עוגיות. בכל קופסה 3 שורות, ובכל שורה 6 עוגיות. כמה עוגיות יש בסך הכול?',
    answer: '72', wrong: [['18', TRAP.step], ['13', TRAP.wrongOp], '24'], explain: `בקופסה: ${L('3 × 6 = 18')}. ב־${L('4')} קופסאות: ${L('4 × 18 = 72')}`,
  },
  {
    type: 'word', prompt: 'ליואב 5 גולות. לדנה פי 3 גולות מליואב. לרוני 4 גולות פחות מדנה. כמה גולות לרוני?',
    answer: '11', wrong: [['15', TRAP.step], ['8', '"פחות" = מורידים.'], '2'], explain: `לדנה ${L('5 × 3 = 15')}. לרוני ${L('15 − 4 = 11')}`,
  },
];

export const OFFICIAL_MATH_SIZE = MATH_ITEMS.length;

function mathItems(seed: number): Question[] {
  const r = rng(seed);
  return MATH_ITEMS.map((it) => {
    const base = { type: it.type, prompt: it.prompt, lines: it.lines, explain: it.explain };
    if (!it.wrong.length) {
      const v = Number(it.answer);
      return { ...base, options: [], correct: -1, value: v, accept: (n: number) => n === v, mathOptions: it.type === 'triangle' };
    }
    const all: [string, string][] = shuffle(r, [[it.answer, ''], ...it.wrong.map((w): [string, string] => (typeof w === 'string' ? [w, ''] : w))]);
    return {
      ...base,
      options: all.map(([o]) => o),
      correct: all.findIndex(([o]) => o === it.answer),
      traps: all.map(([, t]) => t),
      mathOptions: it.type === 'time' || it.type === 'digit' || it.type === 'triangle',
      value: Number.isNaN(Number(it.answer)) ? undefined : Number(it.answer),
    };
  });
}

/** The 2 reading passages used in the official sample exam (from the new passages). */
const OFFICIAL_PASSAGE_IDS = ['camel', 'peacock-fox'];

export function officialReading(seed: number): Question[] {
  return OFFICIAL_PASSAGE_IDS.flatMap((id, i) => {
    const p = passageById(id)!;
    return passageQuestions(p, seed + i);
  });
}

export const OFFICIAL_READING_SIZE = OFFICIAL_PASSAGE_IDS.reduce((n, id) => n + passageById(id)!.questions.length, 0);

/** The full official sample exam: reading section + math section. */
export function officialExam(seed: number): { math: Question[]; reading: Question[] } {
  return { math: mathItems(seed), reading: officialReading(seed) };
}

// ---------- a second official-style sample exam (100% original questions) ----------

const MATH_ITEMS_2: Item[] = [
  // משימה א: תרגילים (open arithmetic + missing number)
  { type: 'arith', prompt: OPEN, lines: ['58 + 27 = ?'], answer: '85', wrong: [], explain: `${L('58 + 20 = 78')}, ועוד ${L('7')}: ${L('85')}` },
  { type: 'arith', prompt: OPEN, lines: ['81 − 34 = ?'], answer: '47', wrong: [], explain: `${L('81 − 30 = 51')}, ועוד ${L('− 4')}: ${L('47')}` },
  { type: 'missing', prompt: OPEN, lines: ['⬜ + 38 = 92'], answer: '54', wrong: [], explain: `${L('92 − 38 = 54')}. בדיקה: ${L('54 + 38 = 92')} ✓` },
  { type: 'arith', prompt: OPEN, lines: ['7 × 6 + 9 = ?'], answer: '51', wrong: [], explain: `קודם כפל: ${L('7 × 6 = 42')}, ואז חיבור: ${L('42 + 9 = 51')}` },
  // משימה ב: המספר החסר וגדול/קטן
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['7 × 4 < 7 × ⬜'], answer: '5',
    wrong: ['3', '2', ['4', TRAP.equal]], explain: `צריך יותר מ־${L('4')}. ${L('4')} נותן שוויון, לא "קטן מ"`,
  },
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['50 − 12 > 50 − ⬜'], answer: '18',
    wrong: ['10', '11', ['12', TRAP.equal]], explain: 'בחיסור: כדי שיישאר פחות, צריך להוריד יותר מ־12',
  },
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['⬜ ÷ 6 > 24 ÷ 6'], answer: '30',
    wrong: ['18', ['24', TRAP.equal], '12'], explain: `צריך מספר גדול מ־${L('24')} שמתחלק ב־${L('6')}`,
  },
  // משימה ג: תרגילי משולשים △
  {
    type: 'triangle', prompt: 'כל △ מסתיר אותה ספרה. איזו ספרה היא △?', lines: ['3△ + 5△ = 88'], answer: '4',
    wrong: ['8', '3', '5'], explain: `האחדות: ${L('△ + △ = 8')}, והעשרות: ${L('30 + 50 = 80')}. יחד ${L('88')}, אז ${L('△ = 4')}`,
  },
  {
    type: 'triangle', prompt: 'כל △ מסתיר אותה ספרה. איזו ספרה היא △?', lines: ['△ × △ + △ = 42'], answer: '6',
    wrong: ['5', '7', '4'], explain: `מציבים ${L('△ = 6')}: ${L('6 × 6 + 6 = 36 + 6 = 42')} ✓`,
  },
  {
    type: 'triangle', prompt: 'כל △ מסתיר אותה ספרה. איזו ספרה היא △?', lines: ['△ + △ + △ = 18'], answer: '6',
    wrong: ['3', '9', '5'], explain: `${L('18 ÷ 3 = 6')}, אז ${L('△ = 6')}`,
  },
  // משימה ד: בעיות מילוליות
  {
    type: 'word', prompt: 'לתמר 36 מדבקות. היא נתנה 14 לאחיה, ואחר כך קיבלה 8 מחברה. כמה מדבקות יש לה עכשיו?',
    answer: '30', wrong: [['22', TRAP.step], ['44', TRAP.wrongOp], ['14', 'הורדת רק 14, שכחת את ה־8.']], explain: `${L('36 − 14 = 22')}, ועוד ${L('8')}: ${L('30')}`,
  },
  {
    type: 'word', prompt: 'יואב קורא 4 עמודים בכל יום. כמה יקרא בשבוע?',
    answer: '28', wrong: [['8', TRAP.wrongOp], ['24', 'בשבוע יש 7 ימים.'], '32'], explain: `${L('7 × 4 = 28')}`,
  },
  {
    type: 'word', prompt: 'ב־3 קופסאות יש עוגיות. בכל קופסה 4 שורות, ובכל שורה 5 עוגיות. כמה עוגיות יש בסך הכול?',
    answer: '60', wrong: [['20', TRAP.step], ['12', TRAP.wrongOp], '15'], explain: `בקופסה: ${L('4 × 5 = 20')}. ב־${L('3')} קופסאות: ${L('3 × 20 = 60')}`,
  },
  {
    type: 'word', prompt: 'לנועה 4 גולות. למאיה פי 3 גולות מנועה. לרוני 5 גולות פחות ממאיה. כמה גולות לרוני?',
    answer: '7', wrong: [['12', TRAP.step], ['2', '"פחות" = מורידים.'], '8'], explain: `למאיה ${L('4 × 3 = 12')}. לרוני ${L('12 − 5 = 7')}`,
  },
];

export const OFFICIAL_MATH_2_SIZE = MATH_ITEMS_2.length;

function mathItems2(seed: number): Question[] {
  const r = rng(seed);
  return MATH_ITEMS_2.map((it) => {
    const base = { type: it.type, prompt: it.prompt, lines: it.lines, explain: it.explain };
    if (!it.wrong.length) {
      const v = Number(it.answer);
      return { ...base, options: [], correct: -1, value: v, accept: (n: number) => n === v, mathOptions: it.type === 'triangle' };
    }
    const all: [string, string][] = shuffle(r, [[it.answer, ''], ...it.wrong.map((w): [string, string] => (typeof w === 'string' ? [w, ''] : w))]);
    return {
      ...base,
      options: all.map(([o]) => o),
      correct: all.findIndex(([o]) => o === it.answer),
      traps: all.map(([, t]) => t),
      mathOptions: it.type === 'time' || it.type === 'digit' || it.type === 'triangle',
      value: Number.isNaN(Number(it.answer)) ? undefined : Number(it.answer),
    };
  });
}

/** The 2 reading passages used in the second official sample exam (from the new passages). */
const OFFICIAL_PASSAGE_IDS_2 = ['ants', 'tug-of-war'];

export function officialReading2(seed: number): Question[] {
  return OFFICIAL_PASSAGE_IDS_2.flatMap((id, i) => {
    const p = passageById(id)!;
    return passageQuestions(p, seed + i);
  });
}

export const OFFICIAL_READING_2_SIZE = OFFICIAL_PASSAGE_IDS_2.reduce((n, id) => n + passageById(id)!.questions.length, 0);

/** The second official sample exam: reading section + math section. */
export function officialExam2(seed: number): { math: Question[]; reading: Question[] } {
  return { math: mathItems2(seed), reading: officialReading2(seed) };
}
