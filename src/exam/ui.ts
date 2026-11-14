import { mathExam, mathPractice, TYPE_NAMES, type MathType, type Question } from './questions';
import { PASSAGES, passageById, passageQuestions, readingExam } from './reading';
import { printMockExam } from './print';
import { saveExam, type ExamRecord } from '../log';
import { openParentScreen } from '../parent';

const LETTERS = ['א', 'ב', 'ג', 'ד'];
/** Like the real test: each section has a time limit, but nobody announces how much time is left. */
export const SECTION_MINUTES = 20;
const PRACTICE_SIZE = 10;

type Section = { title: string; questions: Question[]; minutes: number };
type Run = {
  mode: 'exam' | 'practice';
  label: string;
  seed: number;
  sections: Section[];
  s: number;
  i: number;
  answers: (number | null)[][];
  flags: boolean[][];
  secs: number[][];
  shownAt: number;
  startedAt: number;
  timer: number;
  timedOut: boolean;
  passageOpen: boolean;
  again: () => void;
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
  const seed = Date.now() % 1_000_000_007;
  const screen = el('main', 'screen exam-home');
  screen.append(topBar('הכנה למבחן', home));

  screen.append(el('h2', 'sec-title', '⏱️ מבחן לדוגמה'));
  const exams = el('div', 'menu');
  exams.append(
    button('menu-btn big-btn', `📝 מבחן מלא · ${2 * SECTION_MINUTES} דקות`, () =>
      startRun('exam', 'מבחן מלא', seed, [
        { title: 'חלק 1: הבנת הנקרא', questions: readingExam(seed), minutes: SECTION_MINUTES },
        { title: 'חלק 2: חשבון', questions: mathExam(seed), minutes: SECTION_MINUTES },
      ]),
    ),
    button('menu-btn', `🔢 רק חשבון · ${SECTION_MINUTES} דקות`, () =>
      startRun('exam', 'מבחן חשבון', seed, [{ title: 'חשבון', questions: mathExam(seed), minutes: SECTION_MINUTES }]),
    ),
    button('menu-btn', `📖 רק הבנת הנקרא · ${SECTION_MINUTES} דקות`, () =>
      startRun('exam', 'מבחן הבנת הנקרא', seed, [
        { title: 'הבנת הנקרא', questions: readingExam(seed), minutes: SECTION_MINUTES },
      ]),
    ),
  );
  screen.append(exams);

  screen.append(el('h2', 'sec-title', '🎯 תרגול לפי נושא'));
  const topics = el('div', 'menu grid');
  const mathTopics: (MathType | 'mix')[] = ['arith', 'missing', 'pictures', 'word', 'compare', 'sequence', 'mix'];
  for (const t of mathTopics) {
    const name = t === 'mix' ? '🔀 הכל מעורבב' : TYPE_NAMES[t];
    topics.append(
      button('menu-btn', name, () =>
        startRun('practice', name, seed, [{ title: name, questions: mathPractice(t, seed, PRACTICE_SIZE), minutes: 0 }]),
      ),
    );
  }
  for (const p of PASSAGES) {
    const name = `📖 ${p.title}`;
    topics.append(
      button('menu-btn', name, () =>
        startRun('practice', name, seed, [{ title: name, questions: passageQuestions(p, seed), minutes: 0 }]),
      ),
    );
  }
  screen.append(topics);

  const tips = el('details', 'tips');
  tips.append(el('summary', '', '💡 טיפים למבחן'));
  const ul = el('ul');
  for (const tip of [
    'תמיד מסמנים תשובה, גם כשלא בטוחים. על טעות לא מורידים נקודות!',
    'לא יודעת? מסמנים ⭐ וחוזרים לשאלה בסוף.',
    'קודם פוסלים את התשובות שבטוח לא נכונות.',
    'בשאלה עם "לא", מחפשים את מה שלא כתוב בקטע.',
    'בתרגיל עם 😊 אפשר להציב כל תשובה ולבדוק אם היא מתאימה.',
    'נשאר זמן? בודקים שוב. אין פרס למי שמסיימת ראשונה.',
  ])
    ul.append(el('li', '', tip));
  tips.append(ul);
  screen.append(tips);

  screen.append(button('print-btn', '🖨️ הדפסת מבחן לדוגמה על דף (להורים)', () => printMockExam(seed)));
  app.replaceChildren(screen);
}

// ---------- running an exam / practice ----------

function startRun(mode: Run['mode'], label: string, seed: number, sections: Section[]): void {
  stopTimer();
  run = {
    mode,
    label,
    seed,
    sections,
    s: 0,
    i: 0,
    answers: sections.map((s) => s.questions.map(() => null)),
    flags: sections.map((s) => s.questions.map(() => false)),
    secs: sections.map((s) => s.questions.map(() => 0)),
    shownAt: Date.now(),
    startedAt: Date.now(),
    timer: 0,
    timedOut: false,
    passageOpen: true,
    again: () => {
      const fresh = Date.now() % 1_000_000_007;
      if (mode === 'practice' && sections[0].questions[0].type === 'reading') {
        const p = passageById(sections[0].questions[0].passageId!)!;
        startRun(mode, label, fresh, [{ ...sections[0], questions: passageQuestions(p, fresh) }]);
      } else if (mode === 'practice') {
        const t = sections[0].questions.every((q) => q.type === sections[0].questions[0].type)
          ? (sections[0].questions[0].type as MathType)
          : 'mix';
        startRun(mode, label, fresh, [{ ...sections[0], questions: mathPractice(t, fresh, PRACTICE_SIZE) }]);
      } else renderExamHome(app, goHome);
    },
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

function goTo(i: number): void {
  const r = run!;
  trackTime();
  const prev = r.sections[r.s].questions[r.i].passageId;
  r.i = i;
  const now = r.sections[r.s].questions[i].passageId;
  if (now !== prev) r.passageOpen = true;
  renderQuestion();
  window.scrollTo({ top: 0 });
}

function renderPassage(id: string): HTMLElement {
  const p = passageById(id)!;
  const box = el('details', 'passage');
  box.open = run!.passageOpen;
  box.addEventListener('toggle', () => (run!.passageOpen = box.open));
  box.append(el('summary', '', `📖 ${p.title}`));
  p.paragraphs.forEach((text, n) => {
    const para = el('p', 'para');
    para.append(el('span', 'para-num', String(n + 1)), document.createTextNode(text));
    box.append(para);
  });
  return box;
}

function renderQuestion(): void {
  const r = run!;
  const sec = r.sections[r.s];
  const q = sec.questions[r.i];
  const chosen = r.answers[r.s][r.i];
  const practice = r.mode === 'practice';
  const locked = practice && chosen !== null;
  const score = r.answers[r.s].filter((a, k) => a === sec.questions[k].correct).length;

  const screen = el('main', 'screen question');
  screen.append(
    topBar(sec.title, leaveRun, practice ? `⭐ ${score}` : `שאלה ${r.i + 1} מתוך ${sec.questions.length}`),
  );
  if (practice) screen.append(el('div', 'q-progress', `שאלה ${r.i + 1} מתוך ${sec.questions.length}`));
  if (q.passageId) screen.append(renderPassage(q.passageId));

  const card = el('section', 'q-card');
  card.append(el('p', 'q-prompt', q.prompt));
  if (q.lines) {
    const lines = el('div', 'q-lines');
    lines.dir = 'ltr';
    for (const line of q.lines) lines.append(el('div', 'q-line', line));
    card.append(lines);
  }
  screen.append(card);

  const opts = el('div', 'options');
  q.options.forEach((text, k) => {
    const cls = ['option'];
    if (chosen === k) cls.push('chosen');
    if (locked && k === q.correct) cls.push('right');
    if (locked && chosen === k && k !== q.correct) cls.push('wrong');
    const b = button(cls.join(' '), '', () => choose(k));
    b.disabled = locked;
    const t = el('span', 'opt-text', text);
    if (q.mathOptions) t.dir = 'ltr';
    b.append(el('span', 'letter', LETTERS[k]), t);
    opts.append(b);
  });
  screen.append(opts);

  if (practice) {
    if (locked) {
      const ok = chosen === q.correct;
      const fb = el('section', ok ? 'q-feedback ok' : 'q-feedback');
      fb.append(
        el('p', 'fb-title', ok ? 'נכון! ⭐' : `לא נורא! התשובה הנכונה: ${LETTERS[q.correct]}`),
        el('p', 'fb-explain', `💡 ${q.explain}`),
      );
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

function finishRun(): void {
  const r = run!;
  stopTimer();
  const items = r.sections.flatMap((sec, s) =>
    sec.questions.map((q, i) => ({
      type: q.type,
      prompt: [q.prompt, ...(q.lines ?? [])].join(' | ').replace(/[⁦⁩]/g, ''),
      chosen: r.answers[s][i],
      correct: q.correct,
      ok: r.answers[s][i] === q.correct,
      seconds: r.secs[s][i],
    })),
  );
  const rec: ExamRecord = {
    id: `${r.startedAt.toString(36)}`,
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
      const ok = sec.questions.filter((q, i) => r.answers[s][i] === q.correct).length;
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
    for (const [type, v] of byType) {
      const row = el('div', v.ok === v.n ? 'type-row good' : 'type-row');
      row.append(el('span', '', TYPE_NAMES[type as keyof typeof TYPE_NAMES]), el('span', '', `${v.ok}/${v.n}`));
      table.append(row);
    }
    screen.append(table);
  }

  const actions = el('div', 'menu');
  actions.append(button('cta', r.mode === 'practice' ? 'עוד סבב' : 'חזרה לתפריט', r.again));
  screen.append(actions);

  screen.append(el('h2', 'sec-title', 'בואי נעבור על התשובות'));
  r.sections.forEach((sec, s) =>
    sec.questions.forEach((q, i) => {
      const chosen = r.answers[s][i];
      const ok = chosen === q.correct;
      const box = el('details', ok ? 'review ok' : 'review');
      box.open = !ok;
      const head = `${ok ? '✅' : chosen === null ? '⬜' : '❌'} ${s > 0 ? `${s + 1}.` : ''}${i + 1}. ${q.prompt.replace(/[⁦⁩]/g, '')}`;
      box.append(el('summary', '', head));
      if (q.lines) {
        const lines = el('div', 'q-lines small');
        lines.dir = 'ltr';
        for (const line of q.lines) lines.append(el('div', 'q-line', line));
        box.append(lines);
      }
      const theirs = chosen === null ? 'לא סימנת' : `${LETTERS[chosen]}. ${q.options[chosen]}`;
      box.append(
        el('p', '', `התשובה שלך: ${theirs}`),
        el('p', 'right-ans', `התשובה הנכונה: ${LETTERS[q.correct]}. ${q.options[q.correct]}`),
        el('p', 'fb-explain', `💡 ${q.explain}`),
      );
      screen.append(box);
    }),
  );
  app.replaceChildren(screen);
  window.scrollTo({ top: 0 });
}
