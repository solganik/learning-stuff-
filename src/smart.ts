import { sameShape, type Expr } from './model';

export type Tag = 'reorder' | 'make10' | 'none';

/**
 * True if some left-to-right prefix of 2..n−1 terms sums to a positive multiple of 10.
 * Single-term prefixes are excluded so splitting 13 into 10 + 3 doesn't count as a trick,
 * zero is excluded because cancelling is a separate trick not taught here,
 * and the full expression is excluded because that's just the answer.
 */
export function hasRoundPrefix(e: Expr): boolean {
  if (e.length < 3) return false;
  let sum = e[0].sign * e[0].value;
  for (let k = 1; k < e.length - 1; k++) {
    sum += e[k].sign * e[k].value;
    if (sum > 0 && sum % 10 === 0) return true;
  }
  return false;
}

export function isSmartSolve(original: Expr, current: Expr, tag: Tag): boolean {
  if (tag === 'none') return sameShape(original, current);
  return hasRoundPrefix(current) && !hasRoundPrefix(original);
}
