import { L, rng, shuffle, TRAP, type MathType, type Question } from './questions';

/** Questions 1–25 from 00-study-guide.md (original content written for this prep). */
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

const ITEMS: Item[] = [
  { type: 'arith', prompt: OPEN, lines: ['68 + 27 = ?'], answer: '95', wrong: [], explain: `${L('68 + 20 = 88')}, ועוד ${L('7')}: ${L('95')}` },
  { type: 'arith', prompt: OPEN, lines: ['83 − 46 = ?'], answer: '37', wrong: [], explain: `${L('83 − 40 = 43')}, ועוד ${L('− 6')}: ${L('37')}` },
  { type: 'arith', prompt: OPEN, lines: ['9 × 6 = ?'], answer: '54', wrong: [], explain: `${L('5 × 6 = 30')}, ועוד ${L('4 × 6 = 24')}: ${L('54')}` },
  { type: 'arith', prompt: OPEN, lines: ['56 ÷ 8 = ?'], answer: '7', wrong: [], explain: `חילוק זה כפל הפוך: ${L('8 × 7 = 56')}` },
  { type: 'arith', prompt: OPEN, lines: ['100 − 37 = ?'], answer: '63', wrong: [], explain: `משלימים: מ־${L('37')} ל־${L('40')} זה ${L('3')}, ומ־${L('40')} ל־${L('100')} זה ${L('60')}. יחד ${L('63')}` },
  { type: 'missing', prompt: OPEN, lines: ['⬜ + 18 = 45'], answer: '27', wrong: [], explain: `${L('45 − 18 = 27')}. בדיקה: ${L('27 + 18 = 45')} ✓` },
  { type: 'missing', prompt: OPEN, lines: ['60 − ⬜ = 24'], answer: '36', wrong: [], explain: `${L('60 − 24 = 36')}. בדיקה: ${L('60 − 36 = 24')} ✓` },
  { type: 'missing', prompt: OPEN, lines: ['4 × ⬜ = 36'], answer: '9', wrong: [], explain: `${L('36 ÷ 4 = 9')}. בדיקה: ${L('4 × 9 = 36')} ✓` },
  { type: 'missing', prompt: OPEN, lines: ['⬜ − 19 = 33'], answer: '52', wrong: [], explain: `הופכים לחיבור: ${L('33 + 19 = 52')}` },
  { type: 'missing', prompt: OPEN, lines: ['⬜ ÷ 3 = 7'], answer: '21', wrong: [], explain: `הופכים לכפל: ${L('7 × 3 = 21')}` },
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['6 × 4 < 6 × ⬜'], answer: '5',
    wrong: ['2', '3', ['4', TRAP.equal]], explain: `צריך יותר מ־${L('4')}. ${L('4')} נותן שוויון, לא "קטן מ"`,
  },
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['50 − 12 > 50 − ⬜'], answer: '13',
    wrong: [['9', TRAP.flip], ['10', TRAP.flip], ['11', TRAP.flip]], explain: 'בחיסור: כדי שיישאר פחות, צריך להוריד יותר מ־12',
  },
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['25 + 17 < 25 + ⬜'], answer: '18',
    wrong: ['15', '16', ['17', TRAP.equal]], explain: `צריך להוסיף יותר מ־${L('17')}`,
  },
  {
    type: 'inequality', prompt: 'בחרי את המספר המתאים', lines: ['⬜ ÷ 4 > 20 ÷ 4'], answer: '24',
    wrong: ['12', '16', ['20', TRAP.equal]], explain: `צריך מספר גדול מ־${L('20')}`,
  },
  {
    type: 'pictures', prompt: 'כל ציור הוא מספר. כמה שווה 🌙?', lines: ['⭐ + ⭐ = 14', '⭐ + 🌙 = 20'], answer: '13',
    wrong: ['5', '6', ['7', TRAP.other]], explain: `⭐ = ${L('7')}, אז 🌙 = ${L('20 − 7 = 13')}`,
  },
  {
    type: 'pictures', prompt: 'כל ציור הוא מספר. כמה שווה 🍇?', lines: ['🍎 + 🍌 = 11', '🍎 + 🍌 + 🍇 + 🍎 + 🍌 = 30'], answer: '8',
    wrong: ['9', ['19', TRAP.step], ['11', TRAP.other]], explain: `${L('🍎 + 🍌')} מופיע פעמיים: ${L('22')}. אז 🍇 = ${L('30 − 22 = 8')}`,
  },
  {
    type: 'pictures', prompt: 'כל ציור הוא מספר. כמה שווה 🔵?', lines: ['🔺 + 🔺 + 🔺 = 21', '🔺 + 🔵 = 15'], answer: '8',
    wrong: [['7', TRAP.other], '14', '6'], explain: `🔺 = ${L('21 ÷ 3 = 7')}, אז 🔵 = ${L('15 − 7 = 8')}`,
  },
  {
    type: 'digit', prompt: '☀ היא ספרה. איזו ספרה היא?', lines: ['☀4 + 2☀ = 68'], answer: '4',
    wrong: ['3', '5', '6'], explain: `${L('44 + 24 = 68')} ✓`,
  },
  {
    type: 'word', prompt: 'למאיה היו 35 מדבקות. היא נתנה 12 לאחיה, ואחר כך קיבלה 8 מחברה. כמה מדבקות יש לה עכשיו?',
    answer: '31', wrong: ['15', ['23', TRAP.step], ['55', TRAP.wrongOp]], explain: `${L('35 − 12 = 23')}, ועוד ${L('8')}: ${L('31')}`,
  },
  {
    type: 'word', prompt: 'נועה קוראת 6 עמודים בכל יום. כמה עמודים תקרא בשבוע?',
    answer: '42', wrong: [['13', TRAP.wrongOp], ['36', 'בשבוע יש 7 ימים.'], '48'], explain: `${L('7 × 6 = 42')}`,
  },
  {
    type: 'word', prompt: 'מחברת עולה 7 ₪, ושני עטים עולים 4 ₪ כל אחד. שילמתי 20 ₪. כמה עודף קיבלתי?',
    answer: '5', wrong: [['9', 'שכחת לכפול: יש שני עטים.'], ['13', 'שכחת את המחברת.'], '0'], explain: `${L('7 + 4 + 4 = 15')}, ואז ${L('20 − 15 = 5')}`,
  },
  {
    type: 'word', prompt: 'ב־3 קופסאות יש עוגיות. בכל קופסה 4 שורות, ובכל שורה 5 עוגיות. כמה עוגיות יש בסך הכול?',
    answer: '60', wrong: [['12', TRAP.wrongOp], ['20', TRAP.step], '45'], explain: `בקופסה: ${L('4 × 5 = 20')}. בשלוש: ${L('3 × 20 = 60')}`,
  },
  {
    type: 'word', prompt: 'ליואב 4 גולות. לדנה פי 3 גולות מליואב. לרוני 5 גולות פחות מדנה. כמה גולות לרוני?',
    answer: '7', wrong: [['12', TRAP.step], '17', '9'], explain: `לדנה ${L('4 × 3 = 12')}. לרוני ${L('12 − 5 = 7')}`,
  },
  {
    type: 'time', prompt: 'השיעור מתחיל ב־8:15 ומסתיים ב־9:00. אחריו הפסקה של רבע שעה. מתי מתחיל השיעור הבא?',
    answer: '9:15', wrong: [['9:00', 'זה סוף השיעור. שכחת את ההפסקה!'], '9:30', '8:45'], explain: `${L('9:00')} ועוד רבע שעה = ${L('9:15')}`,
  },
  {
    type: 'proportion', prompt: '5 עוגיות שוקלות 100 גרם. כמה שוקלות 20 עוגיות?',
    answer: '400', wrong: ['200', '300', '500'], explain: `${L('20')} זה פי ${L('4')} מ־${L('5')}, אז ${L('100 × 4 = 400')}`,
  },
];

export const BANK_SIZE = ITEMS.length;

export function bankQuestions(seed: number): Question[] {
  const r = rng(seed);
  return ITEMS.map((it) => {
    const base = { type: it.type, prompt: it.prompt, lines: it.lines, explain: it.explain };
    if (!it.wrong.length) {
      const v = Number(it.answer);
      return { ...base, options: [], correct: -1, value: v, accept: (n: number) => n === v };
    }
    const all: [string, string][] = shuffle(r, [[it.answer, ''], ...it.wrong.map((w): [string, string] => (typeof w === 'string' ? [w, ''] : w))]);
    return {
      ...base,
      options: all.map(([o]) => o),
      correct: all.findIndex(([o]) => o === it.answer),
      traps: all.map(([, t]) => t),
      mathOptions: it.type === 'time' || it.type === 'digit',
      value: Number.isNaN(Number(it.answer)) ? undefined : Number(it.answer),
    };
  });
}
