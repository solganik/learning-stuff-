export const MAX_WRONG = 2;

export type Outcome =
  | { kind: 'correct'; stars: 1 | 3 }
  | { kind: 'retry' }
  | { kind: 'reveal'; stars: 1 };

/** Wrong answers never cost stars; after MAX_WRONG misses the answer is shown and she still gets 1★. */
export function judge(answer: number, expected: number, wrongSoFar: number, smart: boolean): Outcome {
  if (answer === expected) return { kind: 'correct', stars: smart ? 3 : 1 };
  return wrongSoFar + 1 >= MAX_WRONG ? { kind: 'reveal', stars: 1 } : { kind: 'retry' };
}
