import { isOpen, isRight, mathExam, mathPractice, TYPE_NAMES, type MathType, type Question } from './questions';
import { PASSAGES, passageById, passageQuestions, readingExam } from './reading';
import { bankQuestions } from './bank';
import { printMockExam } from './print';
import { saveExam, type ExamRecord } from '../log';
import { openParentScreen } from '../parent';
import type { Hint } from './hints';
import { renderVisual } from './visual';

const LETTERS = ['א', 'ב', 'ג', 'ד'];
/** Like the real test: each section has a time limit, but nobody announces how much time is left. */
export const SECTION_MINUTES = 20;
const PRACTICE_SIZE = 10;
const MATH_TOPICS: MathType[] = ['arith', 'missing', 'inequality', 'pictures', 'digit', 'word', 'proportion', 'time', 'sequence', 'compare'];

type Section = { title: string; questions: Question[]; minutes: number };
/** Practice hint progress for one question: rungs opened, steps solved, wrong tries on the current step. */
type HintState = { level: number; solved: number; wrong: number; given: boolean[] };
type Run = {
  mode: 'exam' | 'practice';
  label: string;
  seed: number;
  make: (seed: number) => Section[];
  sections: Section[];
  s: number;
  i: number;
  /** MC: option index. Open: the typed number. */
  answers: (number | null)[][];
  flags: boolean[][];
  secs: number[][];
  typed: string;
  shownAt: number;
  startedAt: number;
  timer: number;
  timedOut: boolean;
  passageOpen: boolean;
  hints: HintState[][];
  /** Practice: the first wrong answer (she gets a second try), or null. */
  firstWrong: (number | null)[][];
};

let app: HTMLElement;
let goHome: () => void;
let run: Run | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function button(cls: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.onclick = onClick;
  return b;
}

const newSeed = () => Date.now() % 1_000_000_007;

/** Append text whose L(...) math parts become LTR spans that never wrap mid-expression. */
function appendRich(node: HTMLElement, text: string): void {
  text.split(/(\u2066[^\u2069]*\u2069)/).forEach((part) => {
    if (part.startsWith('\u2066')) {
      const m = el('bdi', 'm', part.slice(1, -1));
      m.dir = 'ltr';
      node.append(m);
    } else if (part) node.append(document.createTextNode(part));
  });
}

function rich(tag: 'p' | 'span' | 'summary', cls: string, text: string): HTMLElement {
  const node = el(tag, cls);
  appendRich(node, text);
  return node;
}

function mathLines(lines: string[], cls = 'q-lines'): HTMLElement {
  const box = el('div', cls);
  box.dir = 'ltr';
  for (const line of lines) box.append(el('div', [...line].length > 18 ? 'q-line long' : 'q-line', line));
  return box;
}
const plain = (s: string) => s.replace(/[⁦⁩]/g, '');

function topBar(title: string, back: (() => void) | null, right = ''): HTMLElement {
  const top = el('header', 'top');
  const t = el('h1', 'title', title);
  let timer = 0;
  t.addEventListener('pointerdown', () => (timer = window.setTimeout(openParentScreen, 900)));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) t.addEventListener(ev, () => clearTimeout(timer));
  t.addEventListener('contextmenu', (e) => e.preventDefault());
  top.append(t);
  if (right) top.append(el('div', 'progress', right));
  if (back) top.append(button('back-btn', 'חזרה', back));
  return top;
}

function stopTimer(): void {
  if (run) clearTimeout(run.timer);
}

const leaveRun = () => {
  stopTimer();
  run = null;
  renderExamHome(app, goHome);
};

// ---------- home ----------

export function renderExamHome(root: HTMLElement, home: () => void): void {
  app = root;
  goHome = home;
  stopTimer();
  run = null;
  const screen = el('main', 'screen exam-home');
  screen.append(topBar('הכנה למבחן', home));

  screen.append(el('h2', 'sec-title', '⏱️ מבחן לדוגמה'));
  const exams = el('div', 'menu');
  exams.append(
    button('menu-btn big-btn', `📝 מבחן מלא · ${2 * SECTION_MINUTES} דקות`, () =>
      startRun('exam', 'מבחן מלא', (seed) => [
        { title: 'חלק 1: הבנת הנקרא', questions: readingExam(seed), minutes: SECTION_MINUTES },
        { title: 'חלק 2: חשבון', questions: mathExam(seed), minutes: SECTION_MINUTES },
      ]),
    ),
    button('menu-btn', `🔢 רק חשבון · ${SECTION_MINUTES} דקות`, () =>
      startRun('exam', 'מבחן חשבון', (seed) => [{ title: 'חשבון', questions: mathExam(seed), minutes: SECTION_MINUTES }]),
    ),
    button('menu-btn', `📖 רק הבנת הנקרא · ${SECTION_MINUTES} דקות`, () =>
      startRun('exam', 'מבחן הבנת הנקרא', (seed) => [{ title: 'הבנת הנקרא', questions: readingExam(seed), minutes: SECTION_MINUTES }]),
    ),
  );
  screen.append(exams);

  screen.append(el('h2', 'sec-title', '🎯 תרגול חשבון לפי נושא'));
  const topics = el('div', 'menu grid');
  for (const t of MATH_TOPICS) {
    topics.append(
      button('menu-btn', TYPE_NAMES[t], () =>
        startRun('practice', TYPE_NAMES[t], (seed) => [{ title: TYPE_NAMES[t], questions: mathPractice(t, seed, PRACTICE_SIZE), minutes: 0 }]),
      ),
    );
  }
  topics.append(
    button('menu-btn', '🔀 הכל מעורבב', () =>
      startRun('practice', 'הכל מעורבב', (seed) => [{ title: 'הכל מעורבב', questions: mathPractice('mix', seed, PRACTICE_SIZE), minutes: 0 }]),
    ),
    button('menu-btn', '📚 25 שאלות מהמדריך', () =>
      startRun('practice', 'שאלות מהמדריך', (seed) => [{ title: 'שאלות מהמדריך', questions: bankQuestions(seed), minutes: 0 }]),
    ),
  );
  screen.append(topics);

  screen.append(el('h2', 'sec-title', '📖 תרגול הבנת הנקרא'));
  const reading = el('div', 'menu grid');
  for (const p of PASSAGES)
    reading.append(
      button('menu-btn', p.title, () =>
        startRun('practice', p.title, (seed) => [{ title: p.title, questions: passageQuestions(p, seed), minutes: 0 }]),
      ),
    );
  screen.append(reading);

  const tips = el('details', 'tips');
  tips.append(el('summary', '', '💡 טיפים למבחן'));
  const ul = el('ul');
  for (const tip of [
    'תמיד מסמנים תשובה, גם כשלא בטוחים. על טעות לא מורידים נקודות!',
    'לא יודעת? מסמנים ⭐ וחוזרים לשאלה בסוף.',
    'קודם פוסלים את התשובות שבטוח לא נכונות.',
    'מלכודת: תוצאה של שלב ביניים מופיעה בתשובות. ממשיכים עד הסוף!',
    'בשאלה עם "לא", מחפשים את מה שלא כתוב בקטע.',
    'מילה נרדפת: מציבים כל תשובה במשפט ובודקים אם הוא נשאר נכון.',
    'בתרגיל עם ⬜ או 😊 אפשר להציב כל תשובה ולבדוק אם היא מתאימה.',
    'בחיסור הכיוון מתהפך: מורידים יותר, נשאר פחות.',
    'נשאר זמן? בודקים שוב. אין פרס למי שמסיימת ראשונה.',
  ])
    ul.append(el('li', '', tip));
  tips.append(ul);
  screen.append(tips);

  screen.append(button('print-btn', '🖨️ הדפסת מבחן לדוגמה על דף (להורים)', () => printMockExam(newSeed())));
  app.replaceChildren(screen);
}

// ---------- running an exam / practice ----------

function startRun(mode: Run['mode'], label: string, make: (seed: number) => Section[]): void {
  stopTimer();
  const seed = newSeed();
  const sections = make(seed);
  run = {
    mode,
    label,
    seed,
    make,
    sections,
    s: 0,
    i: 0,
    answers: sections.map((s) => s.questions.map(() => null)),
    flags: sections.map((s) => s.questions.map(() => false)),
    secs: sections.map((s) => s.questions.map(() => 0)),
    typed: '',
    shownAt: Date.now(),
    startedAt: Date.now(),
    timer: 0,
    timedOut: false,
    passageOpen: true,
    hints: sections.map((s) => s.questions.map(() => ({ level: 0, solved: 0, wrong: 0, given: [] }))),
    firstWrong: sections.map((s) => s.questions.map(() => null)),
  };
  if (mode === 'exam') renderSectionIntro();
  else renderQuestion();
}

function renderSectionIntro(): void {
  const r = run!;
  const sec = r.sections[r.s];
  const screen = el('main', 'screen center');
  screen.append(
    topBar(r.label, leaveRun),
    el('p', 'big', sec.title),
    el('p', 'lead', `${sec.questions.length} שאלות · ${sec.minutes} דקות\nבכל שאלה בוחרים תשובה אחת מתוך 4.\nלא יודעת? מסמנים ⭐ וחוזרים בסוף.`),
    button('cta', 'מתחילים!', () => {
      r.i = 0;
      r.passageOpen = true;
      r.shownAt = Date.now();
      r.timer = window.setTimeout(timeUp, sec.minutes * 60_000);
      loadTyped();
      renderQuestion();
    }),
  );
  app.replaceChildren(screen);
}

function trackTime(): void {
  const r = run!;
  r.secs[r.s][r.i] += Math.round((Date.now() - r.shownAt) / 1000);
  r.shownAt = Date.now();
}

/** The keypad shows what's saved for this question. */
function loadTyped(): void {
  const r = run!;
  const a = r.answers[r.s][r.i];
  r.typed = isOpen(r.sections[r.s].questions[r.i]) && a !== null ? String(a) : '';
}

function goTo(i: number): void {
  const r = run!;
  trackTime();
  const prev = r.sections[r.s].questions[r.i].passageId;
  r.i = i;
  if (r.sections[r.s].questions[i].passageId !== prev) r.passageOpen = true;
  loadTyped();
  renderQuestion();
  window.scrollTo({ top: 0 });
}

function renderPassage(id: string): HTMLElement {
  const p = passageById(id)!;
  const box = el('details', 'passage');
  box.open = run!.passageOpen;
  box.addEventListener('toggle', () => (run!.passageOpen = box.open));
  box.append(el('summary', '', `📖 ${p.title}`));
  if (p.lines) {
    let n = 0;
    let para = el('div', 'para lines');
    for (const line of p.lines) {
      if (line === '') {
        box.append(para);
        para = el('div', 'para lines');
        continue;
      }
      const row = el('div', 'line');
      row.append(el('span', 'line-num', String(++n)), el('span', '', line));
      para.append(row);
    }
    box.append(para);
  } else {
    p.paragraphs!.forEach((text, k) => {
      const para = el('p', 'para');
      para.append(el('span', 'para-num', String(k + 1)), document.createTextNode(text));
      box.append(para);
    });
  }
  return box;
}

function renderKeypad(q: Question, locked: boolean): HTMLElement {
  const r = run!;
  const wrap = el('div', 'open-answer');
  const box = el('div', r.typed ? 'answer' : 'answer empty', r.typed || '?');
  wrap.append(box);
  if (locked) return wrap;
  const pad = el('div', 'keypad');
  pad.dir = 'ltr';
  const keys = r.mode === 'practice' ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'] : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''];
  for (const k of keys) {
    if (!k) {
      pad.append(el('span'));
      continue;
    }
    pad.append(
      button(k === '✓' ? 'key ok' : k === '⌫' ? 'key back' : 'key', k, () => {
        if (k === '✓') {
          if (r.typed) choose(Number(r.typed));
          return;
        }
        r.typed = k === '⌫' ? r.typed.slice(0, -1) : r.typed.length < 3 ? (r.typed === '0' ? k : r.typed + k) : r.typed;
        // in an exam the typed number is the answer; in practice it's committed with ✓
        if (r.mode === 'exam') r.answers[r.s][r.i] = r.typed ? Number(r.typed) : null;
        renderQuestion();
      }),
    );
  }
  void q;
  wrap.append(pad);
  return wrap;
}

// ---------- 💡 hint ladder (practice only) ----------

type Rung = 'ask' | 'visual' | 'steps';
const rungs = (h: Hint): Rung[] => ['ask', ...(h.visual ? ['visual' as const] : []), ...(h.steps || h.after ? ['steps' as const] : [])];
const RUNG_TITLE: Record<Rung, string> = { ask: '🔍 מה שואלים?', visual: '✏️ בואי נצייר', steps: '👣 צעד אחר צעד' };
/** Only the rung that was just opened fades in (the ladder re-renders on every step). */
let justOpened = false;

/** Wrap each highlighted word of the prompt in <mark>. */
function markWords(node: HTMLElement, words: string[]): void {
  for (const w of words) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
      const at = t.data.indexOf(w);
      if (at < 0 || t.parentElement?.tagName === 'MARK') continue;
      const rest = t.splitText(at);
      rest.splitText(w.length);
      const mark = el('mark', 'hl');
      rest.replaceWith(mark);
      mark.append(rest);
      break;
    }
  }
}

/** "47 + ⬜ = 50" with the ⬜ as an input (current step), a filled box (solved) or a hint value (given). */
function stepRow(text: string, lead: string, state: 'todo' | 'done' | 'given', value: number, onTry: (n: number, row: HTMLElement) => void): HTMLElement {
  const row = el('div', `h-step ${state}`);
  // equations read left to right; a Hebrew sentence ("from 7:30 to 8:00 it's ⬜ minutes") right to left
  const words = /[\u0590-\u05ff]/.test(text);
  const expr = el('div', words ? 'h-expr words' : 'h-expr');
  expr.dir = words ? 'rtl' : 'ltr';
  const [before, after] = text.split('⬜');
  if (lead) expr.append(el('span', 'h-lead', lead));
  appendRich(expr, before);
  if (state === 'todo') {
    const input = el('input', 'h-input');
    input.inputMode = 'numeric';
    input.pattern = '[0-9]*';
    input.maxLength = 3;
    input.setAttribute('aria-label', 'המספר החסר');
    const go = () => input.value && onTry(Number(input.value), row);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    input.addEventListener('input', () => (input.value = input.value.replace(/\D/g, '')));
    expr.append(input);
    row.append(expr, button('h-ok', '✓', go));
  } else {
    expr.append(el('span', 'h-val', String(value)));
    row.append(expr, el('span', 'h-mark', state === 'done' ? '✓' : '👀'));
  }
  appendRich(expr, after);
  return row;
}

function renderHint(q: Question, st: HintState, prompt: HTMLElement): HTMLElement {
  const h = q.hint!;
  const all = rungs(h);
  const box = el('section', 'hints');
  if (st.level >= 1 && h.highlight?.length) markWords(prompt, h.highlight);
  all.slice(0, st.level).forEach((rung, k) => {
    const part = el('div', `h-rung h-${rung}${justOpened && k === st.level - 1 ? ' new' : ''}`);
    part.append(el('p', 'h-title', RUNG_TITLE[rung]));
    if (rung === 'ask') part.append(rich('p', 'h-text', h.ask));
    if (rung === 'visual') {
      part.append(renderVisual(h.visual!));
    }
    if (rung === 'steps') {
      const steps = h.steps ?? [];
      steps.slice(0, st.solved + 1).forEach((step, k) => {
        const state = k < st.solved ? (st.given[k] ? 'given' : 'done') : 'todo';
        part.append(
          stepRow(step.text, step.lead ?? '', state, step.answer, (n, row) => {
            if (n === step.answer) {
              st.solved++;
              st.wrong = 0;
              renderQuestion();
              return;
            }
            st.wrong++;
            if (st.wrong >= 2) {
              st.given[k] = true;
              st.solved++;
              st.wrong = 0;
              renderQuestion();
              return;
            }
            row.classList.remove('shake');
            void row.offsetWidth;
            row.classList.add('shake');
            row.querySelector('.h-try')?.remove();
            row.append(el('span', 'h-try', 'נסי שוב 🙂'));
            const input = row.querySelector('input')!;
            input.value = '';
            input.focus();
          }),
        );
      });
      if (st.solved >= steps.length && h.after) part.append(rich('p', 'h-after', h.after));
    }
    box.append(part);
  });
  const done = st.level >= all.length;
  const more = button('hint-btn', done ? 'זהו, עכשיו את! 💪' : st.level ? '💡 עוד רמז' : '💡 רמז', () => {
    st.level++;
    justOpened = true;
    renderQuestion();
    document.querySelector('.h-rung:last-of-type')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  more.disabled = done;
  box.append(more);
  justOpened = false;
  return box;
}

function renderQuestion(): void {
  const r = run!;
  const sec = r.sections[r.s];
  const q = sec.questions[r.i];
  const chosen = r.answers[r.s][r.i];
  const practice = r.mode === 'practice';
  const locked = practice && chosen !== null;
  const score = r.answers[r.s].filter((a, k) => isRight(sec.questions[k], a)).length;

  const screen = el('main', 'screen question');
  screen.append(topBar(sec.title, leaveRun, practice ? `⭐ ${score}` : `שאלה ${r.i + 1} מתוך ${sec.questions.length}`));
  if (practice) screen.append(el('div', 'q-progress', `שאלה ${r.i + 1} מתוך ${sec.questions.length}`));
  if (q.passageId) screen.append(renderPassage(q.passageId));

  const card = el('section', 'q-card');
  const prompt = rich('p', 'q-prompt', q.prompt);
  card.append(prompt);
  if (q.lines) card.append(mathLines(q.lines));
  screen.append(card);
  if (practice && !locked && q.hint) screen.append(renderHint(q, r.hints[r.s][r.i], prompt));

  const tried = practice ? r.firstWrong[r.s][r.i] : null;
  if (isOpen(q)) {
    screen.append(renderKeypad(q, locked));
  } else {
    const opts = el('div', 'options');
    q.options.forEach((text, k) => {
      const cls = ['option'];
      if (chosen === k) cls.push('chosen');
      if (locked && k === q.correct) cls.push('right');
      if ((locked && chosen === k && k !== q.correct) || tried === k) cls.push('wrong');
      if (!locked && tried === k) cls.push('tried');
      const b = button(cls.join(' '), '', () => choose(k));
      b.disabled = locked || tried === k;
      const t = el('span', 'opt-text', text);
      if (q.mathOptions) t.dir = 'ltr';
      b.append(el('span', 'letter', LETTERS[k]), t);
      opts.append(b);
    });
    screen.append(opts);
  }

  if (practice && !locked && tried !== null) {
    const nudge = el('section', 'q-nudge');
    const trap = isOpen(q) ? '' : q.traps?.[tried];
    nudge.append(el('p', 'fb-title', isOpen(q) ? `🤔 כמעט! זה לא ${tried}.` : '🤔 כמעט!'));
    nudge.append(el('p', trap ? 'fb-trap' : 'lead small', trap ? `⚠️ ${trap}` : q.hint ? 'לא בדיוק. רוצה רמז? 💡' : 'לא בדיוק. נסי שוב 🙂'));
    if (trap) nudge.append(el('p', 'lead small', 'נסי שוב 🙂'));
    screen.append(nudge);
  }

  if (practice) {
    if (locked) {
      const ok = isRight(q, chosen);
      const fb = el('section', ok ? 'q-feedback ok' : 'q-feedback');
      const right = isOpen(q) ? String(q.value) : LETTERS[q.correct];
      fb.append(el('p', 'fb-title', ok ? 'נכון! ⭐' : `לא נורא! התשובה הנכונה: ${right}`));
      const trap = !ok && !isOpen(q) && chosen !== null ? q.traps?.[chosen] : '';
      if (trap) fb.append(el('p', 'fb-trap', `⚠️ ${trap}`));
      fb.append(rich('p', 'fb-explain', `💡 ${q.explain}`));
      const last = r.i === sec.questions.length - 1;
      fb.append(button('cta next', last ? 'לסיכום ←' : 'הבאה ←', () => (last ? finishRun() : goTo(r.i + 1))));
      screen.append(fb);
    }
  } else {
    const nav = el('div', 'q-nav');
    const flag = button(r.flags[r.s][r.i] ? 'flag on' : 'flag', r.flags[r.s][r.i] ? '⭐ אחזור אליה' : '☆ לחזור אליה', () => {
      r.flags[r.s][r.i] = !r.flags[r.s][r.i];
      renderQuestion();
    });
    const prev = button('nav-btn', '→ הקודמת', () => goTo(r.i - 1));
    prev.disabled = r.i === 0;
    const last = r.i === sec.questions.length - 1;
    const next = button('nav-btn primary', last ? 'סיום החלק' : 'הבאה ←', () => (last ? confirmEndSection() : goTo(r.i + 1)));
    nav.append(prev, flag, next);
    screen.append(nav);

    const dots = el('div', 'q-dots');
    sec.questions.forEach((_, k) => {
      const cls = ['dot'];
      if (r.answers[r.s][k] !== null) cls.push('answered');
      if (r.flags[r.s][k]) cls.push('flagged');
      if (k === r.i) cls.push('current');
      dots.append(button(cls.join(' '), String(k + 1), () => goTo(k)));
    });
    screen.append(dots);
  }
  app.replaceChildren(screen);
}

function choose(k: number): void {
  const r = run!;
  const q = r.sections[r.s].questions[r.i];
  // practice: the first wrong answer gets a nudge and a second try (like the tile game's "2 wrong → reveal")
  if (r.mode === 'practice' && !isRight(q, k) && r.firstWrong[r.s][r.i] === null) {
    r.firstWrong[r.s][r.i] = k;
    r.typed = '';
    renderQuestion();
    document.querySelector('.q-nudge')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  r.answers[r.s][r.i] = k;
  renderQuestion();
  if (r.mode === 'practice') document.querySelector('.q-feedback')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function confirmEndSection(): void {
  const r = run!;
  const missing = r.answers[r.s].filter((a) => a === null).length;
  if (!missing) return endSection();
  const backdrop = el('div', 'picker');
  const sheet = el('div', 'sheet');
  sheet.append(
    el('p', 'sheet-title', `יש ${missing} שאלות בלי תשובה`),
    el('p', 'lead small', 'במבחן תמיד מסמנים תשובה, גם כשלא בטוחים. ניחוש יכול להיות נכון, ושאלה ריקה תמיד נספרת כטעות!'),
    button('cta', 'לחזור לשאלות', () => {
      backdrop.remove();
      goTo(r.answers[r.s].findIndex((a) => a === null));
    }),
    button('tool', 'לסיים בכל זאת', () => {
      backdrop.remove();
      endSection();
    }),
  );
  backdrop.append(sheet);
  app.querySelector('.screen')!.append(backdrop);
}

function timeUp(): void {
  const r = run;
  if (!r) return;
  r.timedOut = true;
  trackTime();
  app.querySelector('.picker')?.remove();
  const backdrop = el('div', 'picker');
  const sheet = el('div', 'sheet');
  sheet.append(
    el('p', 'sheet-title', '⏰ הזמן של החלק הזה נגמר'),
    el('p', 'lead small', 'בדיוק כמו במבחן האמיתי: כשהזמן נגמר עוברים הלאה.'),
    button('cta', 'המשך', () => {
      backdrop.remove();
      endSection();
    }),
  );
  backdrop.append(sheet);
  app.querySelector('.screen')?.append(backdrop);
}

function endSection(): void {
  const r = run!;
  stopTimer();
  trackTime();
  if (r.s < r.sections.length - 1) {
    r.s++;
    renderSectionIntro();
  } else finishRun();
}

// ---------- results ----------

/** Exam review: how to approach a question she got wrong (the hint's question and drawing, not its steps). */
function approach(h: Hint): HTMLElement {
  const box = el('details', 'approach');
  box.append(el('summary', '', 'איך ניגשים? 📖'));
  box.append(rich('p', 'h-text', h.ask));
  if (h.visual) box.append(renderVisual(h.visual));
  return box;
}

const answerText = (q: Question, a: number | null): string =>
  a === null ? 'לא סימנת' : isOpen(q) ? String(a) : `${LETTERS[a]}. ${q.options[a]}`;
const correctText = (q: Question): string =>
  isOpen(q) ? `${q.value}${q.type === 'inequality' ? ' (יש עוד תשובות נכונות)' : ''}` : `${LETTERS[q.correct]}. ${q.options[q.correct]}`;

function finishRun(): void {
  const r = run!;
  stopTimer();
  const items = r.sections.flatMap((sec, s) =>
    sec.questions.map((q, i) => ({
      type: q.type,
      prompt: plain([q.prompt, ...(q.lines ?? [])].join(' | ')),
      chosen: r.answers[s][i],
      correct: isOpen(q) ? q.value! : q.correct,
      ok: isRight(q, r.answers[s][i]),
      seconds: r.secs[s][i],
      ...(r.mode === 'practice' ? { hintsUsed: r.hints[s][i].level, tries: r.firstWrong[s][i] === null ? 1 : 2 } : {}),
    })),
  );
  const rec: ExamRecord = {
    id: r.startedAt.toString(36),
    startedAt: new Date(r.startedAt).toISOString(),
    mode: r.mode,
    label: r.label,
    seed: r.seed,
    durationSec: Math.round((Date.now() - r.startedAt) / 1000),
    timedOut: r.timedOut,
    items,
  };
  saveExam(rec);

  const screen = el('main', 'screen results');
  screen.append(topBar(r.label, leaveRun));
  const total = items.filter((x) => x.ok).length;
  screen.append(el('p', 'big', `${total} מתוך ${items.length} ${total / items.length >= 0.8 ? '🌟' : '💪'}`));
  if (r.sections.length > 1)
    r.sections.forEach((sec, s) => {
      const ok = sec.questions.filter((q, i) => isRight(q, r.answers[s][i])).length;
      screen.append(el('p', 'lead', `${sec.title}: ${ok} מתוך ${sec.questions.length}`));
    });
  const blanks = items.filter((x) => x.chosen === null).length;
  if (blanks) screen.append(el('p', 'warn', `${blanks} שאלות נשארו בלי תשובה. בפעם הבאה: תמיד לסמן משהו!`));

  const byType = new Map<string, { ok: number; n: number }>();
  for (const x of items) {
    const v = byType.get(x.type) ?? { ok: 0, n: 0 };
    v.n++;
    if (x.ok) v.ok++;
    byType.set(x.type, v);
  }
  if (byType.size > 1) {
    const table = el('div', 'type-table');
    for (const [type, v] of [...byType].sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)) {
      const row = el('div', v.ok === v.n ? 'type-row good' : 'type-row');
      row.append(el('span', '', TYPE_NAMES[type as keyof typeof TYPE_NAMES]), el('span', '', `${v.ok}/${v.n}`));
      table.append(row);
    }
    screen.append(table);
  }

  const actions = el('div', 'menu');
  actions.append(
    button('cta', r.mode === 'practice' ? 'עוד סבב (שאלות חדשות)' : 'חזרה לתפריט', () =>
      r.mode === 'practice' ? startRun(r.mode, r.label, r.make) : renderExamHome(app, goHome),
    ),
  );
  screen.append(actions);

  screen.append(el('h2', 'sec-title', 'בואי נעבור על התשובות'));
  r.sections.forEach((sec, s) =>
    sec.questions.forEach((q, i) => {
      const chosen = r.answers[s][i];
      const ok = isRight(q, chosen);
      const box = el('details', ok ? 'review ok' : 'review');
      box.open = !ok;
      const head = `${ok ? '✅' : chosen === null ? '⬜' : '❌'} ${r.sections.length > 1 ? `${s + 1}.` : ''}${i + 1}. ${plain(q.prompt)}`;
      box.append(el('summary', '', head));
      if (q.lines) box.append(mathLines(q.lines, 'q-lines small'));
      box.append(el('p', '', `התשובה שלך: ${answerText(q, chosen)}`), el('p', 'right-ans', `התשובה הנכונה: ${correctText(q)}`));
      const trap = !ok && !isOpen(q) && chosen !== null ? q.traps?.[chosen] : '';
      if (trap) box.append(el('p', 'fb-trap', `⚠️ ${trap}`));
      box.append(rich('p', 'fb-explain', `💡 ${q.explain}`));
      if (!ok && q.hint && r.mode === 'exam') box.append(approach(q.hint));
      screen.append(box);
    }),
  );
  app.replaceChildren(screen);
  window.scrollTo({ top: 0 });
}
