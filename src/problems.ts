import type { Tag } from './smart';

export type CoachUntil =
  | { ev: 'select' | 'open'; id: string }
  | { ev: 'apply'; kind: 'move' | 'split' | 'round' }
  | { ev: 'merge' };
/** One guided step: what to say, what to make glow (CSS selector), and the action that advances it. */
export type CoachStep = { say: string; target?: string; until?: CoachUntil };

export type Problem = {
  id: number;
  text: string;
  tag: Tag;
  smartPath: string;
  answer: number;
  hint?: string;
  coach?: CoachStep[];
};

/** Keep math left-to-right inside Hebrew sentences (`+3` must not render as `3+`). */
const L = (math: string) => `⁦${math}⁩`;
const tile = (id: string) => `.tile[data-id="${id}"]`;

const MOVE_COACH: CoachStep[] = [
  { say: `לחצי על ${L('+3')}`, target: tile('t2'), until: { ev: 'select', id: 't2' } },
  { say: `עכשיו לחצי על המקום שאחרי ה־${L('7')}`, target: '.gap[data-gap="1"]', until: { ev: 'merge' } },
  { say: `ראית? ${L('7 + 3 = 10')}. עכשיו ${L('10 − 5')} זה קל!` },
];

const SPLIT_COACH: CoachStep[] = [
  { say: `לחצי על ${L('+5')}`, target: tile('t1'), until: { ev: 'select', id: 't1' } },
  { say: 'לחצי עליו עוד פעם כדי לפרק אותו', target: tile('t1'), until: { ev: 'open', id: 't1' } },
  { say: `בחרי ${L('2 + 3')}, כי ${L('8 + 2 = 10')}`, target: '.split-opt[data-label="2 + 3"]', until: { ev: 'merge' } },
  { say: `ראית? עכשיו ${L('10 + 3')} זה קל!` },
];

const ROUND_COACH: CoachStep[] = [
  { say: `לחצי על ${L('+9')}`, target: tile('t1'), until: { ev: 'select', id: 't1' } },
  { say: 'לחצי עליו עוד פעם', target: tile('t1'), until: { ev: 'open', id: 't1' } },
  { say: `בחרי ${L('10 − 1')}: קל להוסיף 10, ואז להוריד 1`, target: '.round-opt', until: { ev: 'apply', kind: 'round' } },
  { say: `ראית? ${L('26 + 10 = 36')}, ועכשיו רק להוריד 1` },
];

const MOVE_HINT = 'נסי להזיז מספר כדי להגיע לעשרת שלמה';
const SPLIT_HINT = 'נסי לפרק מספר כדי להשלים לעשרת שלמה';
const ROUND_HINT = 'מספר קרוב לעשרת? לחצי עליו פעמיים ועגלי';

// Grade 2: within 100, crossing tens, so finger-counting is slow and the trick genuinely pays off.
// Problems 1 and 5 are within-20 warm-ups for the move / split mechanics. 12–15 are mixed, no hint.
export const PROBLEMS: Problem[] = [
  { id: 1, text: '7 − 5 + 3', tag: 'reorder', smartPath: '7 + 3 − 5', answer: 5, hint: MOVE_HINT, coach: MOVE_COACH },
  { id: 2, text: '27 − 8 + 3', tag: 'reorder', smartPath: '27 + 3 − 8', answer: 22, hint: MOVE_HINT },
  { id: 3, text: '46 − 9 + 4', tag: 'reorder', smartPath: '46 + 4 − 9', answer: 41, hint: MOVE_HINT },
  { id: 4, text: '35 + 18 + 5', tag: 'reorder', smartPath: '35 + 5 + 18', answer: 58, hint: MOVE_HINT },
  { id: 5, text: '8 + 5', tag: 'make10', smartPath: '8 + 2 + 3', answer: 13, hint: SPLIT_HINT, coach: SPLIT_COACH },
  { id: 6, text: '38 + 7', tag: 'make10', smartPath: '38 + 2 + 5', answer: 45, hint: SPLIT_HINT },
  { id: 7, text: '56 + 8', tag: 'make10', smartPath: '56 + 4 + 4', answer: 64, hint: SPLIT_HINT },
  { id: 8, text: '67 + 6', tag: 'make10', smartPath: '67 + 3 + 3', answer: 73, hint: SPLIT_HINT },
  { id: 9, text: '26 + 9', tag: 'round', smartPath: '26 + 10 − 1', answer: 35, hint: ROUND_HINT, coach: ROUND_COACH },
  { id: 10, text: '54 + 19', tag: 'round', smartPath: '54 + 20 − 1', answer: 73, hint: ROUND_HINT },
  { id: 11, text: '63 − 9', tag: 'round', smartPath: '63 − 10 + 1', answer: 54, hint: ROUND_HINT },
  { id: 12, text: '43 + 25', tag: 'none', smartPath: '43 + 25', answer: 68 },
  { id: 13, text: '29 − 6 + 1', tag: 'reorder', smartPath: '29 + 1 − 6', answer: 24 },
  { id: 14, text: '52 + 7', tag: 'none', smartPath: '52 + 7', answer: 59 },
  { id: 15, text: '48 + 9', tag: 'make10', smartPath: '48 + 2 + 7', answer: 57 },
];
