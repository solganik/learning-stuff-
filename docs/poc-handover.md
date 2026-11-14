# Handover: Problem-Screen POC

*Written 2026-11-14. Read `docs/design.md` first for the full product picture; this doc narrows it to one POC.*

## 1. Why this POC

The riskiest part of the design is the core interaction (design.md §3): tap-to-move number tiles plus
smart-solve detection. Everything else (Street View, map, styling, hosting) is known tech. Build only the
problem screen, put it in front of her for ~15 minutes, and learn:

1. Can she operate tap-then-tap on a phone with small fingers? Are targets big enough?
2. Does she understand that moving a signed number doesn't change the answer?
3. Does she transform problems on her own, or just type the answer?
4. Does she game the bonus with random moves? (Tests the smart-solve rule.)
5. Does 3★ vs 1★ change her behaviour at all?

Target effort: one evening.

## 2. Scope

**In**
- One screen, Hebrew RTL UI, math rendered LTR.
- ~12 hard-coded problems, + and − only, two tricks: **Reorder** and **Make a 10**, plus a few no-shortcut ones.
- Tap-to-move tiles (sign travels with the number), split a number, undo/reset.
- Big on-screen number pad for the answer.
- Smart-solve detection and stars (1★ correct, 3★ smart) with a sparkle.
- End screen: total stars + placeholder reward ("קיבלת שפתון!").
- Session log saved to localStorage, viewable/exportable by the parent (see §6).

**Out** (do not build): character, map, friends, Street View, dance, ×/÷, Cancel-out trick, PWA/offline,
hosting, real art, sound. No friend data of any kind exists in this POC, so no privacy work is needed.

## 3. Tech (decided)

- **Vite + vanilla TypeScript**, no UI framework. Scaffold: `npm create vite@latest . -- --template vanilla-ts`.
- Node v20.15.1 / npm 10.7.0 are installed.
- **Vitest** for the pure model logic (no mocks; these are pure functions).
- Run on the phone over home Wi-Fi: `npx vite --host`, open the LAN URL on the phone.
- CSS: `<html dir="rtl" lang="he">`; the expression row gets `direction: ltr; unicode-bidi: isolate`.
- Tiles and keypad buttons at least 64×64 px; tile movement via CSS transform transition (FLIP technique).
- System font stack is fine (no web-font downloads).

**Repo note:** the project folder has a `.git` but `git status` fails with
"must be run in a work tree" and `main` has no commits. Check `git rev-parse --is-bare-repository` /
`git config core.bare` and fix before the first commit.

## 4. Model

Represent the expression as an ordered list of **signed terms**:

```ts
type Term = { id: string; sign: 1 | -1; value: number };   // value > 0
type Expr = Term[];
const evaluate = (e: Expr) => e.reduce((s, t) => s + t.sign * t.value, 0);
```

Because the value is just the sum of signed terms, every allowed move preserves equality by construction.
Unit-test that invariant anyway.

**Allowed moves**
| Move | Effect | Example |
|---|---|---|
| Move | Take term at index i, insert at index j. Sign travels with it. | `7 − 5 + 3` → `7 + 3 − 5` |
| Split | Replace term `n` with two terms `a`, `b` (a + b = n, a,b ≥ 1), same sign. | `8 + 5` → `8 + 2 + 3` |
| Undo / Reset | Pop history / restore original. | |

**Leading minus:** recommended rule is that a negative term may not move to position 0 (gentle shake +
hint "מספר עם מינוס לא יכול להיות ראשון"). A leading `−5` is confusing at age 7. Builder may revisit.

## 5. Interaction

- Tap a tile → it highlights. Tap a gap between tiles → selected tile slides there. Tap the selected tile
  again → split picker appears (e.g. for `5`: `1+4`, `2+3`, `3+2`, `4+1`). Tap elsewhere → deselect.
- Gaps between tiles must be visible tap targets while a tile is selected.
- Answer: on-screen keypad 0–9, ⌫, ✓. The answer can be submitted at any time (transforming is optional).
- **Wrong answer:** gentle, never harsh. "כמעט! נסי שוב" with a soft wobble; no stars lost. After a
  second wrong answer, show the answer calmly and move on with 1★ (a correct attempt always earns
  something; see anti-goals in design.md §2).
- Use feminine Hebrew forms throughout (נסי, מצאת, קיבלת). Put her name in one config constant.

## 6. Smart-solve rule (starting point; tune after watching her)

A solve is **smart** if, when she submits:
1. The problem has a shortcut, **and** her current expression contains a run of adjacent terms (starting
   at index 0, evaluated left to right) whose partial sum is a multiple of 10, **and** the original
   expression had no such prefix. Covers `7 + 3 − 5` (prefix 10) and `8 + 2 + 3` (prefix 10).
2. **Or** the problem is tagged `none` (no shortcut) and she answered without transforming. Spotting
   "no trick here" is also the skill. This closes the gap noted in design review: otherwise no-shortcut
   problems can never earn the bonus and teach "always move something".

Random moves that don't create a round prefix earn nothing extra, which is the anti-gaming check.
Put the rule in one pure function (`isSmartSolve(original, current, tag)`) with unit tests covering
each problem in the set plus a few "random moves" cases.

## 7. Problem set (hard-coded, in this order)

| # | Problem | Tag | Smart path | Answer |
|---|---|---|---|---|
| 1 | `7 − 5 + 3` | reorder | `7 + 3 − 5` | 5 |
| 2 | `8 − 3 + 2` | reorder | `8 + 2 − 3` | 7 |
| 3 | `6 − 2 + 4` | reorder | `6 + 4 − 2` | 8 |
| 4 | `13 − 6 + 7` | reorder | `13 + 7 − 6` | 14 |
| 5 | `8 + 5` | make10 | `8 + 2 + 3` | 13 |
| 6 | `9 + 4` | make10 | `9 + 1 + 3` | 13 |
| 7 | `7 + 6` | make10 | `7 + 3 + 3` | 13 |
| 8 | `9 + 6` | make10 | `9 + 1 + 5` | 15 |
| 9 | `4 + 3` | none | answer directly | 7 |
| 10 | `9 − 2 + 1` | reorder | `9 + 1 − 2` | 8 |
| 11 | `12 + 5` | none | answer directly | 17 |
| 12 | `8 + 7` | make10 | `8 + 2 + 5` | 15 |

Problems 1–8 are "learn" blocks (show a one-line hint per block: "נסי להזיז מספר כדי ליצור 10" /
"נסי לפרק מספר כדי להשלים ל־10"). Problems 9–12 are mixed with **no hint**. Keep the set in one data file.

## 8. Session log (for the parent)

Per problem, save: problem id, list of moves (type + resulting expression), wrong attempts, final
answer, smart yes/no, seconds spent. Store in localStorage. A small hidden parent screen (e.g. long-press
the title) shows a table and a "copy JSON" button. This is how questions 3–5 in §1 get answered.

## 9. Done when

- `npm test` passes (equality invariant, split, move, `isSmartSolve` for all 12 problems + gaming cases).
- All 12 problems playable end to end on a real phone over `vite --host`, in Hebrew RTL, math LTR.
- Tiles animate when moved; stars and sparkle show; end screen shows total and the placeholder reward.
- Session log viewable and copyable from the parent screen.
- Nothing about her friends, school, or address is in the repo.

## 10. Suggested build order

1. Fix the git repo state; scaffold Vite vanilla-ts; add Vitest.
2. `model.ts` (Term, evaluate, move, split) + tests.
3. `smart.ts` (`isSmartSolve`) + tests against the §7 table.
4. `problems.ts` data.
5. Static render of expression + keypad, RTL/LTR correct.
6. Tap-select, tap-gap-to-move with animation; split picker; undo/reset.
7. Answer checking, wrong-answer flow, stars, sparkle, end screen.
8. Session log + parent screen.
9. Try it on the phone; fix tap-target sizes.

## 11. After the POC

Watch her play, write down observations against the five questions in §1, then decide the smart-solve
rule, tile sizing, and whether tap-to-move stays, before planning v1 (design.md §10).
