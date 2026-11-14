import { mathExam, type Question } from './questions';
import { passageById, readingExam } from './reading';

const LETTERS = ['א', 'ב', 'ג', 'ד'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function printQuestion(q: Question, n: number): HTMLElement {
  const box = el('div', 'pq');
  box.append(el('p', 'pq-prompt', `${n}. ${q.prompt}`));
  if (q.lines) {
    const lines = el('div', 'pq-lines');
    lines.dir = 'ltr';
    for (const l of q.lines) lines.append(el('div', '', l));
    box.append(lines);
  }
  const opts = el('div', 'pq-opts');
  q.options.forEach((o, k) => {
    const opt = el('span', 'pq-opt');
    const t = el('span', '', o);
    if (q.mathOptions) t.dir = 'ltr';
    opt.append(el('b', '', `${LETTERS[k]}. `), t);
    opts.append(opt);
  });
  box.append(opts);
  return box;
}

/** A paper mock exam (reading + math) with an answer key on its own page, reproducible from the seed. */
export function printMockExam(seed: number): void {
  document.querySelector('.print-sheet')?.remove();
  const sheet = el('div', 'print-sheet');
  sheet.dir = 'rtl';
  sheet.append(el('h1', '', 'מבחן לדוגמה'), el('p', 'p-meta', `שם: ____________   תאריך: ____________   (מבחן מס׳ ${seed})`));

  const reading = readingExam(seed);
  sheet.append(el('h2', '', 'חלק 1: הבנת הנקרא (20 דקות)'));
  let lastPassage = '';
  reading.forEach((q, i) => {
    if (q.passageId !== lastPassage) {
      lastPassage = q.passageId!;
      const p = passageById(lastPassage)!;
      const box = el('div', 'p-passage');
      box.append(el('h3', '', p.title));
      p.paragraphs.forEach((t, n) => box.append(el('p', '', `(${n + 1}) ${t}`)));
      sheet.append(box);
    }
    sheet.append(printQuestion(q, i + 1));
  });

  const math = mathExam(seed);
  const mathTitle = el('h2', 'page-break', 'חלק 2: חשבון (20 דקות)');
  sheet.append(mathTitle);
  math.forEach((q, i) => sheet.append(printQuestion(q, i + 1)));

  const key = el('div', 'page-break p-key');
  key.append(el('h2', '', 'תשובות (להורים)'));
  const row = (title: string, qs: Question[]) => {
    key.append(el('h3', '', title));
    const ol = el('ol');
    for (const q of qs) ol.append(el('li', '', `${LETTERS[q.correct]}  ·  ${q.explain.replace(/[⁦⁩]/g, '')}`));
    key.append(ol);
  };
  row('הבנת הנקרא', reading);
  row('חשבון', math);
  sheet.append(key);

  document.body.append(sheet);
  const cleanup = () => sheet.remove();
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}
