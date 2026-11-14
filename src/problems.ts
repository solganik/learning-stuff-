import type { Tag } from './smart';

export type Problem = { id: number; text: string; tag: Tag; smartPath: string; answer: number; hint?: string };

const MOVE_HINT = 'נסי להזיז מספר כדי להגיע לעשרת שלמה';
const SPLIT_HINT = 'נסי לפרק מספר כדי להשלים לעשרת שלמה';
const ROUND_HINT = 'מספר קרוב לעשרת? לחצי עליו פעמיים ועגלי';

// Grade 2: within 100, crossing tens, so finger-counting is slow and the trick genuinely pays off.
// Problems 1 and 5 are within-20 warm-ups for the move / split mechanics. 12–15 are mixed, no hint.
export const PROBLEMS: Problem[] = [
  { id: 1, text: '7 − 5 + 3', tag: 'reorder', smartPath: '7 + 3 − 5', answer: 5, hint: MOVE_HINT },
  { id: 2, text: '27 − 8 + 3', tag: 'reorder', smartPath: '27 + 3 − 8', answer: 22, hint: MOVE_HINT },
  { id: 3, text: '46 − 9 + 4', tag: 'reorder', smartPath: '46 + 4 − 9', answer: 41, hint: MOVE_HINT },
  { id: 4, text: '35 + 18 + 5', tag: 'reorder', smartPath: '35 + 5 + 18', answer: 58, hint: MOVE_HINT },
  { id: 5, text: '8 + 5', tag: 'make10', smartPath: '8 + 2 + 3', answer: 13, hint: SPLIT_HINT },
  { id: 6, text: '38 + 7', tag: 'make10', smartPath: '38 + 2 + 5', answer: 45, hint: SPLIT_HINT },
  { id: 7, text: '56 + 8', tag: 'make10', smartPath: '56 + 4 + 4', answer: 64, hint: SPLIT_HINT },
  { id: 8, text: '67 + 6', tag: 'make10', smartPath: '67 + 3 + 3', answer: 73, hint: SPLIT_HINT },
  { id: 9, text: '26 + 9', tag: 'round', smartPath: '26 + 10 − 1', answer: 35, hint: ROUND_HINT },
  { id: 10, text: '54 + 19', tag: 'round', smartPath: '54 + 20 − 1', answer: 73, hint: ROUND_HINT },
  { id: 11, text: '63 − 9', tag: 'round', smartPath: '63 − 10 + 1', answer: 54, hint: ROUND_HINT },
  { id: 12, text: '43 + 25', tag: 'none', smartPath: '43 + 25', answer: 68 },
  { id: 13, text: '29 − 6 + 1', tag: 'reorder', smartPath: '29 + 1 − 6', answer: 24 },
  { id: 14, text: '52 + 7', tag: 'none', smartPath: '52 + 7', answer: 59 },
  { id: 15, text: '48 + 9', tag: 'make10', smartPath: '48 + 2 + 7', answer: 57 },
];
