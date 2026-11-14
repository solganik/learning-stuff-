# Math Adventure: Design

*Date: 2026-11-12. Status: draft for parent review.*

## 1. Intent: why this exists

A web game for a 7-year-old girl (Hebrew is her native language, and she reads Hebrew on her own).
It covers + − × ÷, from easy to hard.

**The real goal is number sense, not arithmetic speed.** Today she solves `7 − 5 + 3` by counting on
her fingers or by working strictly left to right. Her father wants her to **stop and look at a problem
before solving it**, and ask herself "is there an easier way? Do I already know something close to
this?" In his words, he wants to teach *creativity* with numbers.

So the game must reward **how** she solves, not only **whether** the answer is right.

### What she likes (this drives the reward design)
- Dancing
- Kids' movies
- Makeup, styling, and dress-up ("איפור")

## 2. Goals, non-goals, anti-goals

**Goals**
- Teach specific mental-math strategies ("tricks") one at a time, then train her to *spot* which trick
  fits a mixed problem with no hint.
- Make the smart path feel like a superpower: it earns more than counting does.
- Make it personal: her real classmates, her real city, real places in the world.
- Run well on a phone (the parent's) and on a tablet, in the browser.

**Non-goals for v1**
- TV / LG webOS support. This may come later; the tap-to-move control is chosen so it would also work
  with a TV pointer remote.
- Letting her add friends herself. Explicitly a later stage.
- Accounts, multiple players, cloud sync.
- Voice narration. She reads, so this is a nice-to-have only.

**Anti-goals (failure even if it "works")**
- Rewarding speed over thinking. No countdown timers or speed pressure.
- Punishing finger-counting or the long way. A correct answer always earns something; the smart path
  earns *more*.
- Harsh wrong-answer feedback that makes her feel stupid.
- Real children's photos, names, and home locations exposed publicly (see §8).
- A surprise Google bill (see §7).
- Unity, or any heavy engine: slow on phones and poor at Hebrew right-to-left text.

## 3. The learning model

### Two parts
1. **Learn a trick**: a guided demo of one strategy, then about five problems built so that trick applies.
2. **Spot the trick**: mixed problems with no hint. She decides whether a shortcut exists and which
   one. This is the core skill.

### Tricks (roughly easy → hard)
| Trick | Example |
|---|---|
| Reorder | `7 − 5 + 3` → `7 + 3 − 5` = `10 − 5` |
| Make a 10 | `8 + 5` → `8 + 2 + 3` = `10 + 3` |
| Near doubles | `6 + 7` → `6 + 6 + 1` |
| Round and fix | `9 + 6` → `10 + 6 − 1`; `29 + 15` → `30 + 15 − 1` |
| Cancel out | `14 + 6 − 6` → `14`, no computing |
| Build from a known fact (×) | `6 × 7` → `5 × 7 + 7` |
| Division as reverse multiplication | `24 ÷ 6` → "what × 6 = 24?" |

The builder may refine or add tricks, as long as each one is a genuine "find the easier path" strategy.

### The core interaction: moving numbers on screen
- The problem is shown as tappable tiles. **Tap a number, then tap where it should go** (no dragging,
  so it works with fingers and with a TV pointer later). The number slides over, **keeping its sign**.
- Allowed transformations (all must keep the expression equal): reorder terms, split a number
  (`5` → `2 + 3`), round and compensate (`9` → `10 − 1`), cancel a `+n … −n` pair, and for ×: split a
  factor (`6 × 7` → `5 × 7 + 1 × 7`).
- **Smart-solve detection:** if she applied a transformation that makes the problem simpler (created a
  10 or a round number, cancelled a pair, used a known fact) before answering, the solve counts as
  "smart" and earns the bigger reward. The exact rules are the builder's call.
- The problem generator must build problems **where the target trick genuinely helps**. In mixed mode,
  some problems should have no shortcut at all, so "just compute it" is sometimes the right call.

### Difficulty ladder
Chapter 1 covers + and − (within 20, then up to 100). Chapter 2 adds × and ÷ (times tables up to
10 × 10) along with harder mixed + and −. The builder tunes the exact ranges.

## 4. The game: her journey

### Her character
At the start she creates a girl character. The character is drawn in **layers** (face, hair, makeup,
outfit, accessories), so styling swaps a layer. Rewards are new makeup, hair, outfits, and accessories.
Dance moves are animations on the same layered character.

### Chapter 1: Find my friends (home city)
Her friends are **classmates**. They are hidden around a map of the family's real city.

1. **City map.** A street glows with a clue ("Noa lives near the big park"). She taps it.
2. **Arrive.** Google Street View opens, already pointed at the friend's real house. She doesn't have
   to navigate.
3. **Locked door.** A number lock: she solves a problem to open it. The friend's photo pops up in the
   window: "Hi! I'll teach you my secret trick!"
4. **Learn the trick.** The friend demos one trick, then about five practice problems. Smart solves
   earn styling items.
5. **Dance party.** Her styled character dances with the friend. *Proposed and not yet confirmed: the
   friend's photo face on a cartoon dancing body.*
6. **New travel buddy.** The friend joins her travel group.

Each friend teaches one trick. If there are more friends than + / − tricks, the extra friends give
review or mixed rounds of tricks she already learned.

### Chapter 2: The world trip
Once all her friends are found, they board a plane together.

- Each city is a set of **mixed "spot the trick" problems**, plus × and ÷ in later cities.
- **Friends are the hint system:** if she's stuck, she "calls a friend." To get a useful hint she has to
  pick the friend whose trick fits ("Noa says: look for a 10!"). Picking the friend *is* spotting the
  trick.
- **City reward:** she can freely spin around in that city's Street View, and she gets a souvenir for
  her collection.
- A world map fills up with the cities she has visited.
- Which cities: *my call* is famous, kid-recognizable landmarks (for example the Eiffel Tower, the
  Colosseum, Times Square, Big Ben, Tokyo), kept in an editable config list so the parent can swap in
  places the family has visited.

### Later stages (not v1)
- She adds a friend herself.
- The family's own trip photos as extra "places we've been" levels.
- LG TV (webOS) version.
- Voice narration.

## 5. Platform and technology (decided)
- **A web game**, mobile-first (phone and tablet browser), installable to the home screen.
- **TypeScript**, with a normal web stack (the builder picks the bundler and framework). Not Unity.
- **Hebrew UI, right-to-left.** Math expressions always render **left to right** inside the RTL page.
- **Big touch targets** for small phones.
- **Progress saved on the device** (local storage). No login for the child.
- The math and styling screens should work offline. The Street View parts need internet.

## 6. Content the parent provides
Kept in a config file plus an assets folder (not hard-coded):
- For each friend: Hebrew name, photo, home location (address or lat/lng plus Street View heading),
  a clue text, and an assigned trick.
- City list for Chapter 2 (a default list is provided).
- Her name, for in-game text.

## 7. Google Street View setup (decided)
- Use the parent's **personal** Google account (the one that already pays for storage). **Not** the
  work account.
- Create a Google Cloud project, attach a billing account (card required by Google), and enable the
  Maps JavaScript API (Street View).
- **Restrict the API key** to the game's own web address.
- **Set a hard daily quota cap** on the API, well below the free monthly allowance, so it can't bill.
  A budget alert alone is not enough, because alerts only send an email.

## 8. Privacy (decided as a requirement; mechanism is the builder's call)
The game contains classmates' photos, names, and home locations. It must **never be on a public
link**. Requirements:
- Hosting behind a login or password that only the family can pass. *My call: a static host with an
  access gate in front, for example Cloudflare Pages + Cloudflare Access (free, email login).*
- Friend photos and addresses are not committed to any public repository.
- Ask the friends' parents before using their kids' photos.

## 9. Art and sound
Cartoon, bright, "girly" styling matching her tastes. Art assets (character layers, makeup items, dance
animations, map markers) are the **builder's call**: free asset packs, simple vector or SVG art drawn
for the game, or generated art, all reviewed by the parent. v1 can start with a small item set and
grow.

## 10. Suggested first milestone (v1)
A playable slice to put in front of her quickly and learn from:
- Character creation with a small styling set.
- City map with **2–3 friends**, each teaching one trick (Reorder, Make a 10, Cancel out).
- The tap-to-move problem screen with smart-solve detection and rewards.
- A simple dance party.
- Street View arrival at each friend's house.

Then watch her play, adjust, and build out the rest of Chapter 1 and Chapter 2.

## 11. Left to the builder
Framework and bundler, problem-generator internals, exact smart-solve rules, number ranges, the reward
economy (how many items, unlock pacing), animation tech, art sourcing, the hosting provider (within §8),
and session length (target roughly 10–15 minutes per sitting).
