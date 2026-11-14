/**
 * Dark-mode toggle for the parent. The choice lives in localStorage and is applied as a
 * `data-theme` attribute on <html>. Print stays paper-light regardless of the on-screen theme.
 */
const KEY = 'math-adventure.theme.v1';
export type Theme = 'light' | 'dark';

const root = (): HTMLElement => document.documentElement;

export function currentTheme(): Theme {
  return root().getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** The emoji the toggle button shows for the theme it will switch TO. */
export const toggleLabel = (): string => (currentTheme() === 'dark' ? '☀️' : '🌙');

function apply(theme: Theme): void {
  if (theme === 'dark') root().setAttribute('data-theme', 'dark');
  else root().removeAttribute('data-theme');
}

/** Read the saved choice (or fall back to the OS preference) and apply it before first paint. */
export function initTheme(): void {
  let saved: Theme | null = null;
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') saved = v;
  } catch {
    /* localStorage may be unavailable (private mode); fall back to OS preference */
  }
  const theme: Theme = saved ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  apply(theme);
}

/** Flip the theme instantly, persist it, and return the new theme. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  apply(next);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore write failures (private mode) */
  }
  return next;
}

/** A small, subtle 🌙/☀️ button for parent-facing bars. */
export function themeToggleButton(cls = 'theme-btn'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = toggleLabel();
  b.setAttribute('aria-label', 'החלפת ערכת נושא');
  b.addEventListener('click', () => {
    b.textContent = toggleTheme() === 'dark' ? '☀️' : '🌙';
  });
  return b;
}
