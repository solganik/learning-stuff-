import { clearExams, clearSessions, loadExams, loadSessions, type ExamRecord, type Session } from './log';
import { TYPE_NAMES, type QType } from './exam/questions';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function examSection(exams: ExamRecord[]): HTMLElement {
  const box = el('section', 'p-session');
  box.append(el('h3', '', 'הכנה למבחן: דיוק לפי סוג שאלה (כל הזמן)'));
  type Stat = { ok: number; n: number; secs: number; hinted: number; hints: number; hintedOk: number; withLog: number };
  const byType = new Map<string, Stat>();
  for (const e of exams)
    for (const x of e.items) {
      const v = byType.get(x.type) ?? { ok: 0, n: 0, secs: 0, hinted: 0, hints: 0, hintedOk: 0, withLog: 0 };
      v.n++;
      v.secs += x.seconds;
      if (x.ok) v.ok++;
      // hint use is logged for practice only (and not in logs from before hints)
      if (x.hintsUsed !== undefined) {
        v.withLog++;
        v.hints += x.hintsUsed;
        if (x.hintsUsed > 0) {
          v.hinted++;
          if (x.ok) v.hintedOk++;
        }
      }
      byType.set(x.type, v);
    }
  const t1 = el('table');
  const h1 = el('tr');
  for (const h of ['סוג', 'נכונות', 'אחוז', 'שנ׳ לשאלה', '💡 לשאלה', 'נכון אחרי רמז']) h1.append(el('th', '', h));
  t1.append(h1);
  // weakest first, so the parent sees what to practise next
  for (const [type, v] of [...byType].sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)) {
    const row = el('tr');
    const avgHints = v.withLog ? (v.hints / v.withLog).toFixed(1) : '—';
    const afterHint = v.hinted ? `${Math.round((100 * v.hintedOk) / v.hinted)}% (${v.hintedOk}/${v.hinted})` : '—';
    for (const c of [TYPE_NAMES[type as QType] ?? type, `${v.ok}/${v.n}`, `${Math.round((100 * v.ok) / v.n)}%`, String(Math.round(v.secs / v.n)), avgHints, afterHint])
      row.append(el('td', '', c));
    t1.append(row);
  }
  box.append(t1, el('h3', '', 'מבחנים ותרגולים'));
  const t2 = el('table');
  const h2 = el('tr');
  for (const h of ['תאריך', 'מה', 'ציון', 'בלי תשובה', 'דקות', 'נגמר הזמן']) h2.append(el('th', '', h));
  t2.append(h2);
  for (const e of [...exams].reverse()) {
    const row = el('tr');
    const ok = e.items.filter((x) => x.ok).length;
    for (const c of [
      new Date(e.startedAt).toLocaleString('he-IL'),
      e.label,
      `${ok}/${e.items.length}`,
      String(e.items.filter((x) => x.chosen === null).length),
      String(Math.round(e.durationSec / 60)),
      e.timedOut ? 'כן' : '',
    ])
      row.append(el('td', '', c));
    t2.append(row);
  }
  box.append(t2);
  return box;
}

function sessionTable(s: Session): HTMLElement {
  const box = el('section', 'p-session');
  const stars = s.problems.reduce((n, p) => n + p.stars, 0);
  const smart = s.problems.filter((p) => p.smart && !p.revealed).length;
  const transformed = s.problems.filter((p) => p.steps.some((m) => m.type !== 'no-shortcut')).length;
  const claims = s.problems.filter((p) => p.steps.some((m) => m.type === 'no-shortcut')).length;
  const secs = s.problems.reduce((n, p) => n + p.seconds, 0);
  box.append(
    el('h3', '', new Date(s.startedAt).toLocaleString('he-IL')),
    el(
      'p',
      'p-summary',
      `${s.problems.length} תרגילים · ${stars}⭐ · חכם ${smart} · שינתה ביטוי ב־${transformed} · "אין קיצור" ב־${claims} · ${Math.round(secs / 60)} דק׳`,
    ),
  );
  const table = el('table');
  const head = el('tr');
  for (const h of ['#', 'תרגיל', 'צעדים', 'ביטוי סופי', 'טעויות', 'תשובה', 'חכם', '⭐', 'שנ׳']) head.append(el('th', '', h));
  table.append(head);
  for (const p of s.problems) {
    const row = el('tr');
    const steps = p.steps.map((m) => `${m.type}: ${m.expr}`).join('\n');
    const cells = [
      String(p.problemId),
      p.problem,
      steps || '—',
      p.finalExpr,
      p.wrongAttempts.join(', ') || '—',
      p.revealed ? 'נחשפה' : String(p.finalAnswer),
      p.smart ? '✓' : '',
      String(p.stars),
      String(p.seconds),
    ];
    cells.forEach((c, i) => {
      const td = el('td', i === 1 || i === 2 || i === 3 ? 'ltr' : '', c);
      row.append(td);
    });
    table.append(row);
  }
  box.append(table);
  return box;
}

async function copyText(text: string, fallback: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // navigator.clipboard is missing on plain-http LAN addresses; fall back to selecting the textarea
    fallback.focus();
    fallback.select();
    fallback.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  }
}

export function openParentScreen(): void {
  if (document.querySelector('.parent')) return;
  const sessions = loadSessions().reverse();
  const exams = loadExams();
  const json = JSON.stringify({ sessions, exams }, null, 2);

  const overlay = el('div', 'parent');
  const close = el('button', 'p-btn', 'סגירה');
  const copy = el('button', 'p-btn primary', 'העתקת JSON');
  const clear = el('button', 'p-btn danger', 'מחיקת היומן');
  const status = el('span', 'p-status');
  const ta = el('textarea', 'p-json');
  ta.value = json;
  ta.readOnly = true;
  ta.dir = 'ltr';

  close.onclick = () => overlay.remove();
  copy.onclick = async () => {
    status.textContent = (await copyText(json, ta)) ? 'הועתק ✓' : 'סמנו והעתיקו ידנית מהתיבה למטה';
  };
  clear.onclick = () => {
    if (!confirm('למחוק את כל היומן?')) return;
    clearSessions();
    clearExams();
    overlay.remove();
  };

  const bar = el('div', 'p-bar');
  bar.append(el('h2', '', 'יומן הורים'), copy, clear, close, status);
  overlay.append(bar);
  if (!sessions.length && !exams.length) overlay.append(el('p', '', 'אין עדיין נתונים.'));
  if (exams.length) overlay.append(examSection(exams));
  for (const s of sessions) overlay.append(sessionTable(s));
  overlay.append(ta);
  document.body.append(overlay);
}
