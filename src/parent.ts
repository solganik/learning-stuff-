import { clearSessions, loadSessions, type Session } from './log';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function sessionTable(s: Session): HTMLElement {
  const box = el('section', 'p-session');
  const stars = s.problems.reduce((n, p) => n + p.stars, 0);
  const smart = s.problems.filter((p) => p.smart && !p.revealed).length;
  const transformed = s.problems.filter((p) => p.steps.length > 0).length;
  const secs = s.problems.reduce((n, p) => n + p.seconds, 0);
  box.append(
    el('h3', '', new Date(s.startedAt).toLocaleString('he-IL')),
    el(
      'p',
      'p-summary',
      `${s.problems.length} תרגילים · ${stars}⭐ · חכם ${smart} · שינתה ביטוי ב־${transformed} · ${Math.round(secs / 60)} דק׳`,
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
  const json = JSON.stringify(sessions, null, 2);

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
    overlay.remove();
  };

  const bar = el('div', 'p-bar');
  bar.append(el('h2', '', 'יומן הורים'), copy, clear, close, status);
  overlay.append(bar);
  if (!sessions.length) overlay.append(el('p', '', 'אין עדיין נתונים.'));
  for (const s of sessions) overlay.append(sessionTable(s));
  overlay.append(ta);
  document.body.append(overlay);
}
