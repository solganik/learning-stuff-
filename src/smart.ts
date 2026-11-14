import { roundPrefixLength, sameShape, type Expr } from './model';

export type Tag = 'reorder' | 'make10' | 'round' | 'none';

/**
 * A round prefix: 2..n−1 terms from the left summing to a positive multiple of 10.
 * Single-term prefixes are excluded so splitting 13 into 10 + 3 doesn't count as a trick,
 * zero is excluded because cancelling is a separate trick not taught here,
 * and the full expression is excluded because that's just the answer.
 */
export const hasRoundPrefix = (e: Expr): boolean => roundPrefixLength(e) !== null;

/** She built a ten (still unmerged, or already merged into a tile) or used round-and-fix. */
export const madeShortcut = (e: Expr): boolean => e.some((t) => t.made) || hasRoundPrefix(e);

/** Any shortcut she built counts, even on a "no trick" problem; there, leaving it untouched also counts. */
export function isSmartSolve(original: Expr, current: Expr, tag: Tag): boolean {
  if (!hasRoundPrefix(original) && madeShortcut(current)) return true;
  return tag === 'none' && sameShape(original, current);
}
