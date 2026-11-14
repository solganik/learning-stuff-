import './style.css';
import { format, move, parse, sameShape, signText, split, splitOptions, type Expr, type OpError } from './model';
import { isSmartSolve } from './smart';
import { judge } from './game';
import { PROBLEMS, type Problem } from './problems';
import { PLAYER_NAME, REWARD_TEXT } from './config';
import { recordProblem, startSession, type ProblemLog, type Session } from './log';
import { openParentScreen } from './parent';

type Play = {
  problem: Problem;
  original: Expr;
  expr: Expr;
  history: Expr[];
  selected: string | null;
  input: string;
  startedAt: number;
  log: ProblemLog;
  done: boolean;
};

const app = document.querySelector<HTMLDivElement>('#app')!;
let session: Session;
let index = 0;
let totalStars = 0;
let play: Play;

const OP_MESSAGES: Record<Exclude<OpError, 'noop'>, string> = {
  'leading-negative': 'מספר עם מינוס לא יכול להיות ראשון',
  'cannot-split': 'את 1 אי אפשר לפרק',
  'too-many-terms': 'יש כבר הרבה מספרים, נסי לבטל צעד',
};

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

const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;

function replayAnimation(node: HTMLElement, cls: string): void {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

// ---------- header (shared) ----------

function header(progress: string): HTMLElement {
  const top = el('header', 'top');
  const title = el('h1', 'title', 'הרפתקת המספרים');
  let timer = 0;
  const cancel = () => clearTimeout(timer);
  title.addEventListener('pointerdown', () => (timer = window.setTimeout(openParentScreen, 900)));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) title.addEventListener(ev, cancel);
  title.addEventListener('contextmenu', (e) => e.preventDefault());
  top.append(title, el('div', 'progress', progress), el('div', 'star-count', `⭐ ${totalStars}`));
  return top;
}

// ---------- start / end ----------

function renderStart(): void {
  session = startSession();
  index = 0;
  totalStars = 0;
  const screen = el('main', 'screen center');
  screen.append(
    header(''),
    el('p', 'big', `שלום ${PLAYER_NAME}! 👋`),
    el('p', 'lead', 'פתרי תרגילים ואספי כוכבים.\nמצאת דרך חכמה? תקבלי ⭐⭐⭐'),
    button('cta', 'בואי נתחיל', () => renderProblem()),
  );
  app.replaceChildren(screen);
}

function renderEnd(): void {
  const screen = el('main', 'screen center');
  const total = el('p', 'total', `${totalStars} ⭐`);
  screen.append(
    header(''),
    el('p', 'big', `סיימת, ${PLAYER_NAME}! 🎉`),
    el('p', 'lead', 'אספת:'),
    total,
    el('p', 'reward', REWARD_TEXT),
    button('cta', 'עוד פעם', renderStart),
  );
  app.replaceChildren(screen);
  sparkle(total, 30);
}

// ---------- problem screen ----------

function renderProblem(): void {
  const problem = PROBLEMS[index];
  const original = parse(problem.text);
  play = {
    problem,
    original,
    expr: original,
    history: [],
    selected: null,
    input: '',
    startedAt: Date.now(),
    done: false,
    log: {
      problemId: problem.id,
      problem: problem.text,
      steps: [],
      wrongAttempts: [],
      finalAnswer: null,
      finalExpr: problem.text,
      smart: false,
      revealed: false,
      stars: 0,
      seconds: 0,
    },
  };

  const screen = el('main', 'screen problem');
  const exprEl = el('div', 'expr');
  exprEl.dir = 'ltr';
  exprEl.addEventListener('click', onExprClick);

  const tools = el('div', 'tools');
  tools.append(button('tool undo', '↩ ביטול צעד', undo), button('tool reset', '⟲ מההתחלה', reset));

  const answerRow = el('div', 'answer-row');
  answerRow.dir = 'ltr';
  answerRow.append(el('span', 'eq', '='), el('div', 'answer'));

  const keypad = el('div', 'keypad');
  keypad.dir = 'ltr';
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']) {
    const cls = k === '✓' ? 'key ok' : k === '⌫' ? 'key back' : 'key';
    keypad.append(button(cls, k, () => onKey(k)));
  }

  screen.append(
    header(`תרגיל ${index + 1} מתוך ${PROBLEMS.length}`),
    el('p', 'hint', problem.hint ?? ''),
    exprEl,
    el('p', 'toast'),
    tools,
    answerRow,
    el('div', 'feedback'),
    keypad,
  );
  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // re-rendering detaches the tapped node, so a disconnected target is never an "outside" tap
    if (play.selected && target.isConnected && !target.closest('.expr, .picker')) select(null);
  });
  app.replaceChildren(screen);
  renderExpr();
  renderAnswer();
}

function renderExpr(): void {
  const exprEl = $<HTMLDivElement>('.expr');
  const before = new Map<string, DOMRect>();
  exprEl.querySelectorAll<HTMLElement>('.tile').forEach((t) => before.set(t.dataset.id!, t.getBoundingClientRect()));

  const sel = play.expr.findIndex((t) => t.id === play.selected);
  const gap = (g: number) => {
    const active = sel >= 0 && g !== sel && g !== sel + 1;
    const b = el('button', active ? 'gap active' : 'gap');
    b.type = 'button';
    b.dataset.gap = String(g);
    b.disabled = !active;
    b.setAttribute('aria-label', 'להזיז לכאן');
    return b;
  };
  const nodes: HTMLElement[] = [];
  play.expr.forEach((t, i) => {
    nodes.push(gap(i));
    const tile = el('button', i === sel ? 'tile selected' : 'tile');
    tile.type = 'button';
    tile.dataset.id = t.id;
    const s = signText(t, i);
    if (s) tile.append(el('span', t.sign < 0 ? 'sign minus' : 'sign plus', s));
    tile.append(el('span', 'num', String(t.value)));
    nodes.push(tile);
  });
  nodes.push(gap(play.expr.length));
  exprEl.replaceChildren(...nodes);
  exprEl.classList.toggle('selecting', sel >= 0);

  // FLIP: slide each tile from where it (or the tile it was split from) used to be
  exprEl.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
    const id = tile.dataset.id!;
    const from = before.get(id) ?? before.get(id.slice(0, id.lastIndexOf('.')));
    if (!from) return;
    const to = tile.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    tile.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], {
      duration: 380,
      easing: 'cubic-bezier(.2,.9,.25,1.15)',
    });
  });

  const undoBtn = $<HTMLButtonElement>('.undo');
  const resetBtn = $<HTMLButtonElement>('.reset');
  undoBtn.disabled = play.done || play.history.length === 0;
  resetBtn.disabled = play.done || sameShape(play.expr, play.original);
}

function renderAnswer(): void {
  const box = $<HTMLDivElement>('.answer');
  box.textContent = play.input || '?';
  box.classList.toggle('empty', !play.input);
}

function toast(text: string): void {
  const t = $<HTMLParagraphElement>('.toast');
  t.textContent = text;
  replayAnimation(t, 'show');
}

function select(id: string | null): void {
  play.selected = id;
  renderExpr();
}

function apply(expr: Expr, type: 'move' | 'split'): void {
  play.history.push(play.expr);
  play.expr = expr;
  play.selected = null;
  play.log.steps.push({ type, expr: format(expr) });
  $<HTMLParagraphElement>('.toast').textContent = '';
  renderExpr();
}

function rejected(reason: OpError, tileId: string | null): void {
  if (reason === 'noop') return;
  toast(OP_MESSAGES[reason]);
  const tile = tileId && app.querySelector<HTMLElement>(`.tile[data-id="${CSS.escape(tileId)}"]`);
  if (tile) replayAnimation(tile, 'shake');
}

function onExprClick(e: MouseEvent): void {
  e.stopPropagation();
  if (play.done) return;
  const target = e.target as HTMLElement;
  const tile = target.closest<HTMLElement>('.tile');
  const gapEl = target.closest<HTMLElement>('.gap.active');
  if (tile) {
    const id = tile.dataset.id!;
    if (play.selected === id) openSplitPicker(id);
    else select(id);
  } else if (gapEl && play.selected) {
    const from = play.expr.findIndex((t) => t.id === play.selected);
    const r = move(play.expr, from, Number(gapEl.dataset.gap));
    if (r.ok) apply(r.expr, 'move');
    else rejected(r.reason, play.selected);
  } else if (play.selected) {
    select(null);
  }
}

function openSplitPicker(id: string): void {
  const i = play.expr.findIndex((t) => t.id === id);
  const term = play.expr[i];
  const options = splitOptions(term.value);
  if (!options.length) return rejected('cannot-split', id);
  if (split(play.expr, i, 1).ok === false) return rejected('too-many-terms', id);

  const backdrop = el('div', 'picker');
  const sheet = el('div', 'sheet');
  const grid = el('div', 'split-grid');
  grid.dir = 'ltr';
  const sign = term.sign < 0 ? '−' : '+';
  for (const [a, b] of options) {
    const label = term.sign < 0 ? `−${a} − ${b}` : `${a} ${sign} ${b}`;
    grid.append(
      button('split-opt', label, () => {
        backdrop.remove();
        const r = split(play.expr, i, a);
        if (r.ok) apply(r.expr, 'split');
        else rejected(r.reason, id);
      }),
    );
  }
  const close = () => {
    backdrop.remove();
    select(null);
  };
  sheet.append(el('p', 'sheet-title', `לפרק את ${term.value} ל־`), grid, button('tool', 'ביטול', close));
  backdrop.append(sheet);
  backdrop.addEventListener('click', (e) => e.target === backdrop && close());
  $<HTMLElement>('.screen').append(backdrop);
}

function undo(): void {
  const prev = play.history.pop();
  if (!prev || play.done) return;
  play.expr = prev;
  play.selected = null;
  play.log.steps.push({ type: 'undo', expr: format(prev) });
  renderExpr();
}

function reset(): void {
  if (play.done || sameShape(play.expr, play.original)) return;
  play.history.push(play.expr);
  play.expr = play.original;
  play.selected = null;
  play.log.steps.push({ type: 'reset', expr: format(play.original) });
  renderExpr();
}

// ---------- answering ----------

function onKey(k: string): void {
  if (play.done) return;
  if (k === '⌫') play.input = play.input.slice(0, -1);
  else if (k === '✓') return submit();
  else if (play.input.length < 3) play.input = play.input === '0' ? k : play.input + k;
  renderAnswer();
}

function submit(): void {
  if (!play.input) return;
  const answer = Number(play.input);
  const smart = isSmartSolve(play.original, play.expr, play.problem.tag);
  const out = judge(answer, play.problem.answer, play.log.wrongAttempts.length, smart);
  const feedback = $<HTMLDivElement>('.feedback');

  if (out.kind === 'retry') {
    play.log.wrongAttempts.push(answer);
    play.input = '';
    renderAnswer();
    feedback.textContent = 'כמעט! נסי שוב 💪';
    replayAnimation($<HTMLDivElement>('.answer'), 'wobble');
    return;
  }

  if (out.kind === 'reveal') {
    play.log.wrongAttempts.push(answer);
    play.log.revealed = true;
    play.input = String(play.problem.answer);
    renderAnswer();
    return finish(out.stars, false, null, `התשובה היא ${play.problem.answer}. בפעם הבאה תצליחי!`);
  }

  const message = !smart
    ? 'נכון! כל הכבוד'
    : play.problem.tag === 'none'
      ? 'מעולה! ראית שאין פה קיצור'
      : 'וואו! מצאת דרך חכמה!';
  finish(out.stars, smart, answer, message);
}

function finish(stars: number, smart: boolean, answer: number | null, message: string): void {
  play.done = true;
  play.selected = null;
  totalStars += stars;
  Object.assign(play.log, {
    finalAnswer: answer,
    finalExpr: format(play.expr),
    smart,
    stars,
    seconds: Math.round((Date.now() - play.startedAt) / 1000),
  });
  recordProblem(session, play.log);

  renderExpr();
  $<HTMLDivElement>('.keypad').classList.add('hidden');
  $<HTMLParagraphElement>('.toast').textContent = '';
  $<HTMLDivElement>('.star-count').textContent = `⭐ ${totalStars}`;

  const feedback = $<HTMLDivElement>('.feedback');
  const starsRow = el('div', 'stars');
  for (let s = 0; s < stars; s++) {
    const star = el('span', 'star', '⭐');
    star.style.animationDelay = `${s * 140}ms`;
    starsRow.append(star);
  }
  const last = index === PROBLEMS.length - 1;
  const next = button('cta next', last ? 'לסיום ←' : 'הבא ←', () => {
    index++;
    if (last) renderEnd();
    else renderProblem();
  });
  feedback.replaceChildren(starsRow, el('p', 'msg', message), next);
  sparkle(starsRow, stars === 3 ? 24 : 8);
}

function sparkle(anchor: HTMLElement, count: number): void {
  const r = anchor.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const glyphs = ['✨', '💖', '⭐', '🌸', '💫'];
  for (let i = 0; i < count; i++) {
    const p = el('span', 'sparkle', glyphs[i % glyphs.length]);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 60 + Math.random() * 90;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    document.body.append(p);
    p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(1.1)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.1,.8,.3,1)' },
    ).onfinish = () => p.remove();
  }
}

if (location.hash === '#parent') openParentScreen();
renderStart();
