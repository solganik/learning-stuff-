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
