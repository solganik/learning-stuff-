import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentTheme, initTheme, toggleTheme } from './theme';

/**
 * Dark-mode toggle. The test stays DOM-only and fast by mocking the three browser primitives the
 * module touches — <html> attributes, localStorage and matchMedia — instead of pulling in jsdom.
 */

const KEY = 'math-adventure.theme.v1';

type Attrs = Record<string, string>;
const makeRoot = () => {
  const attrs: Attrs = {};
  return {
    getAttribute: (k: string) => attrs[k] ?? null,
    setAttribute: (k: string, v: string) => {
      attrs[k] = v;
    },
    removeAttribute: (k: string) => {
      delete attrs[k];
    },
    hasAttribute: (k: string) => k in attrs,
    _attrs: attrs,
  };
};

let store: Record<string, string> = {};
let mq: { matches: boolean };

beforeEach(() => {
  store = {};
  const root = makeRoot();
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  });
  mq = { matches: false };
  vi.stubGlobal('matchMedia', () => mq);
});

afterEach(() => vi.unstubAllGlobals());

const root = () => (globalThis as unknown as { document: { documentElement: ReturnType<typeof makeRoot> } }).document.documentElement;

describe('initTheme', () => {
  it('applies the theme saved in localStorage', () => {
    store[KEY] = 'dark';
    initTheme();
    expect(currentTheme()).toBe('dark');
    expect(root().getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to the OS preference when nothing is saved', () => {
    mq.matches = true;
    initTheme();
    expect(currentTheme()).toBe('dark');
  });

  it('defaults to light when nothing is saved and the OS prefers light', () => {
    initTheme();
    expect(currentTheme()).toBe('light');
    expect(root().hasAttribute('data-theme')).toBe(false);
  });
});

describe('toggleTheme', () => {
  it('flips light → dark and persists the choice', () => {
    initTheme();
    expect(currentTheme()).toBe('light');
    toggleTheme();
    expect(currentTheme()).toBe('dark');
    expect(store[KEY]).toBe('dark');
    expect(root().getAttribute('data-theme')).toBe('dark');
  });

  it('flips dark → light and removes the attribute', () => {
    store[KEY] = 'dark';
    initTheme();
    toggleTheme();
    expect(currentTheme()).toBe('light');
    expect(store[KEY]).toBe('light');
    expect(root().hasAttribute('data-theme')).toBe(false);
  });
});
