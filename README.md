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

## Smart-solve rule (`src/smart.ts`)

- Problems with a trick: smart if her expression, read left to right, reaches a positive multiple of 10
  after 2 or more terms (and before the last term), and the original didn't. Splitting `13` into `10 + 3`
  doesn't count; neither does a running total of 0.
- No-trick problems: smart if she answers with the expression unchanged (undoing back to it counts).
- A negative number can never end up first, whether moved there or uncovered by moving the first number away.
- Two wrong answers reveal the answer with 1★. Wrong answers never cost stars, so smart on the second try is still 3★.
