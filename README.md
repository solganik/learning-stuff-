# Math Adventure: problem-screen POC

See `docs/design.md` and `docs/poc-handover.md`.

```sh
nvm use                 # Node 24 (.nvmrc); Vite 8 / Vitest 5 don't run on Node 20.15
npm install
npm test                # model, smart-solve and scoring rules
npm run dev             # serves on the LAN; open the "Network" URL on the phone
```

Her name: put `VITE_PLAYER_NAME=...` in `.env.local` (gitignored). Without it the game says "אלופה".

Parent log: long-press the title (~1 s), or open the page with `#parent`. "העתקת JSON" copies the log; on a
plain-http LAN address the clipboard API is blocked, so it falls back to selecting the JSON box below the
tables. The log lives in the phone's localStorage for that exact address (IP + port), so copy it after each
session; if the computer's IP changes, the phone sees a fresh, empty log.

## How it pushes her to look before counting

- **Look first.** The keypad is locked until she builds a round ten or taps "אין פה קיצור". In hinted
  (learning) problems that do have a trick, the first "no shortcut" tap gets a nudge; the second always
  unlocks, so she can't get stuck.
- **Visible payoff.** When the numbers on the left add up to a round ten, they merge into one gold tile:
  `38 + 2 + 5` becomes `40 + 5`.
- **Grade-2 numbers.** 15 problems within 100, crossing tens, where counting on fingers is slow:
  reorder (1–4), complete to a ten (5–8), round and fix (9–11), then 4 mixed problems without hints.
  Problems 1 and 5 are small warm-ups for the mechanics.
- **The prize needs thinking.** Every correct answer earns ⭐, but the lipstick needs `SMART_FOR_REWARD` (6)
  smart solves in the session.

## Smart-solve rule (`src/smart.ts`)

- Smart if she built a shortcut: the numbers from the left reach a positive multiple of 10 after 2 or more
  terms (merged or not), or she used round-and-fix. Splitting `13` into `10 + 3` doesn't count; neither does
  a running total of 0. This also counts on "no trick" problems (`43 + 7 + 18`).
- On a "no trick" problem, answering with the expression unchanged is also smart (undoing back counts).
- Round-and-fix is offered only for numbers 1–2 below a ten (`9` → `10 − 1`, `48` → `50 − 2`).
- Splits: every ordered split up to 10; above 10 only "big + small" (small 1–9), to keep the picker short.
- A negative number can never end up first. Built (gold) tiles can't be split again.
- Two wrong answers reveal the answer with 1★. Wrong answers never cost stars, so smart on the second try is still 3★.

## Exam prep (מבחן מחוננים שלב א, grade 2)

Start screen → "📝 הכנה למבחן". Based on `/Users/sashas/Documents/gifted-test-prep/` (HANDOVER.md, study guide).
The commercial catalogs there are used only as style references; all content here is original or from the
study guide.

- **Mock exam**: full (reading then math), or one section, 20 minutes each with a hidden limit (the teacher
  doesn't announce time left). Navigate freely, mark ⭐ to come back; finishing with blanks prompts her to guess.
- **Practice by topic**: 10 fresh questions per round, instant feedback, the smart way to solve it, and when
  she picks a typical-mistake option, the trap is named ("זו תוצאה של שלב ביניים").
- **Math generators** (`src/exam/questions.ts`, seeded, unlimited): T1 arithmetic (± with carrying, ×, ÷, ×10,
  100 − x, chains), T2/T4 missing number with ⬜ or 😊, T3 inequalities, T5 picture puzzles (incl. repeated
  groups), T6 missing digit (☀), T7 multi-step word problems (12 templates), T8 proportion, T9 time,
  T10 sequences (+k, alternating, ×2, growing/shrinking differences, two interleaved series), comparisons.
  Missing-number and inequality questions are sometimes open (she types the number; any valid answer counts).
- **Study-guide bank** (`src/exam/bank.ts`): questions 1–25 from the guide.
- **Reading** (`src/exam/reading.ts`): 8 passages, 48 questions: 3 with numbered paragraphs, 5 with numbered
  lines like the real test (the guide's hedgehog + dolphins, sea turtles, Hanukkah, a new girl in class).
  Covers detail, synonym in context, "what is NOT said", paragraph topic, title, inference, "all correct".
- **Print**: a paper mock with an answer key on the last page.
- **Parent screen**: accuracy per question type, weakest first, plus every exam/practice run.

Tests (`src/exam/exam.test.ts`): 400 questions per generator; each is checked against an answer worked out
independently from the question text, and for multiple choice exactly one option may be valid. Reading tests
check that every quoted word/phrase really appears in the line the question cites.
