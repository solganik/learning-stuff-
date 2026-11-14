import type { Tag } from './smart';

export type Problem = { id: number; text: string; tag: Tag; smartPath: string; answer: number; hint?: string };

const MOVE_HINT = 'נסי להזיז מספר כדי ליצור 10';
const SPLIT_HINT = 'נסי לפרק מספר כדי להשלים ל־10';

export const PROBLEMS: Problem[] = [
  { id: 1, text: '7 − 5 + 3', tag: 'reorder', smartPath: '7 + 3 − 5', answer: 5, hint: MOVE_HINT },
  { id: 2, text: '8 − 3 + 2', tag: 'reorder', smartPath: '8 + 2 − 3', answer: 7, hint: MOVE_HINT },
  { id: 3, text: '6 − 2 + 4', tag: 'reorder', smartPath: '6 + 4 − 2', answer: 8, hint: MOVE_HINT },
  { id: 4, text: '13 − 6 + 7', tag: 'reorder', smartPath: '13 + 7 − 6', answer: 14, hint: MOVE_HINT },
  { id: 5, text: '8 + 5', tag: 'make10', smartPath: '8 + 2 + 3', answer: 13, hint: SPLIT_HINT },
  { id: 6, text: '9 + 4', tag: 'make10', smartPath: '9 + 1 + 3', answer: 13, hint: SPLIT_HINT },
  { id: 7, text: '7 + 6', tag: 'make10', smartPath: '7 + 3 + 3', answer: 13, hint: SPLIT_HINT },
  { id: 8, text: '9 + 6', tag: 'make10', smartPath: '9 + 1 + 5', answer: 15, hint: SPLIT_HINT },
  { id: 9, text: '4 + 3', tag: 'none', smartPath: '4 + 3', answer: 7 },
  { id: 10, text: '9 − 2 + 1', tag: 'reorder', smartPath: '9 + 1 − 2', answer: 8 },
  { id: 11, text: '12 + 5', tag: 'none', smartPath: '12 + 5', answer: 17 },
  { id: 12, text: '8 + 7', tag: 'make10', smartPath: '8 + 2 + 5', answer: 15 },
];
