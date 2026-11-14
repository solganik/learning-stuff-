/**
 * Hint drawings as inline SVG, built only from what the hint data holds (so they never show the answer). Most of them
 * are things she does with her finger; their state logic lives in interact.ts (pure, tested state by state).
 */
import { deal, dealDone, startDeal, type BarRow, type Deal, type Seg, type VisKeep, type Visual } from './hints';
import {
  BAR_NOT_HERE,
  barChips,
  barDrop,
  barScene,
  barSelect,
  barSlots,
  barStart,
  CHAIN_PICK,
  chainOpen,
  chainQuestion,
  chainScene,
  chainStart,
  chainTry,
  CLOCK_RESET,
  clockPress,
  clockScene,
  DIGIT_PICK,
  DIGITS,
  digitScene,
  GROUPS_TAP,
  LINE_AGAIN,
  lineScene,
  litToggle,
} from './interact';

const NS = 'http://www.w3.org/2000/svg';
const W = 320;
/** Palette reads CSS variables (set in style.css, overridden in dark mode) so the drawings stay legible on any theme. */
const C = { ink: 'var(--v-ink)', pink: 'var(--v-pink)', soft: 'var(--v-soft)', purple: 'var(--v-purple)', lilac: 'var(--v-lilac)', teal: 'var(--v-teal)', gold: 'var(--v-gold)' };
const FACE = 'var(--v-face)';
const BAR_FILLS = ['var(--v-bar-0)', 'var(--v-bar-1)', 'var(--v-bar-2)', 'var(--v-bar-3)'];

type Attrs = Record<string, string | number>;
type Of<K extends Visual['kind']> = Extract<Visual, { kind: K }>;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, text = ''): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  let style = '';
  for (const [k, v] of Object.entries(attrs)) {
    // CSS custom properties work in inline style but not in presentation attributes, so route
    // var()-based fill/stroke through style. Other attributes are set normally.
    if ((k === 'fill' || k === 'stroke') && typeof v === 'string' && v.startsWith('var(')) {
      style += `${k}:${v};`;
    } else {
      node.setAttribute(k, String(v));
    }
  }
  if (style) node.setAttribute('style', style);
  if (text) node.textContent = text;
  return node;
}

function html<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function btn(cls: string, text: string, onTap: () => void): HTMLButtonElement {
  const b = html('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onTap);
  return b;
}

/** Restart a one-shot CSS animation (wiggle) on an element. */
function replay(node: Element, cls: string): void {
  node.classList.remove(cls);
  void (node as HTMLElement).getBoundingClientRect();
  node.classList.add(cls);
}

function label(x: number, y: number, text: string, o: { size?: number; color?: string; weight?: number; anchor?: string } = {}): SVGTextElement {
  const q = text === '?';
  const hebrew = /[֐-׿]/.test(text);
  // in an rtl text run, "start" is the right edge
  const anchor = hebrew && o.anchor === 'end' ? 'start' : (o.anchor ?? 'middle');
  const node = svgEl(
    'text',
    {
      x,
      y,
      'text-anchor': anchor,
      'dominant-baseline': 'central',
      'font-size': o.size ?? (q ? 18 : 15),
      'font-weight': o.weight ?? (q ? 900 : 700),
      fill: o.color ?? (q ? C.pink : C.ink),
      class: 'v-text',
    },
    text,
  );
  if (hebrew) node.setAttribute('direction', 'rtl');
  return node;
}

function frame(h: number, title: string): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${h}`, width: '100%', role: 'img', 'aria-label': title, class: 'visual' });
  svg.setAttribute('direction', 'ltr');
  const defs = svgEl('defs');
  const m = svgEl('marker', { id: 'v-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 15, markerHeight: 15, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
  m.append(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: C.purple }));
  defs.append(m);
  svg.append(defs);
  return svg;
}

/** The box an interactive drawing lives in: an optional instruction line, the drawing, then its controls. */
function liveBox(cls: string, tip?: string): HTMLDivElement {
  const box = html('div', `vis ${cls}`);
  if (tip) box.append(html('p', 'vis-tip', tip));
  return box;
}

const textW = (s: string, size = 15) => [...s].length * size * 0.62 + 8;

// ---------- bar model (drawn right to left, like the Hebrew sentence) ----------

type BarDraw = { svg: SVGSVGElement; boxes: Map<string, { g: SVGGElement; rect: SVGRectElement; text: SVGTextElement }> };

/** `live`: taller boxes for fingers, and number boxes start empty (she fills them). */
function barDraw(v: Of<'bar'>, live: boolean): BarDraw {
  const named = v.rows.some((r) => r.name);
  const nameW = named ? Math.max(...v.rows.map((r) => textW(r.name ?? '', 14))) + 6 : 0;
  const side = v.total && v.rows.length > 1 ? 34 : 0;
  const barW = W - nameW - side - 4;
  const minW = (s: Seg) => Math.max(live ? 46 : 26, textW(s.label));
  // biggest scale at which every row still fits once small segments are widened to fit their labels
  let lo = 0;
  let hi = 100;
  const rowW = (r: BarRow, s: number) => r.segs.reduce((t, g) => t + Math.max(minW(g), g.v * s), 0);
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (v.rows.every((r) => rowW(r, mid) <= barW)) lo = mid;
    else hi = mid;
  }
  const scale = lo;
  const rowH = live ? 44 : 34;
  const top = v.total && v.rows.length === 1 ? (live ? 54 : 34) : 6;
  const h = top + v.rows.length * (rowH + 10) + 2;
  const svg = frame(h, 'מודל פסים');
  const boxes: BarDraw['boxes'] = new Map();
  const right = W - nameW - 2;
  let widest = 0;
  v.rows.forEach((r, i) => {
    const y = top + i * (rowH + 10);
    if (r.name) svg.append(label(W - 2, y + rowH / 2, r.name, { anchor: 'end', size: 14 }));
    let x = right;
    r.segs.forEach((s, j) => {
      const w = Math.max(minW(s), s.v * scale);
      x -= w;
      const open = s.gap || s.label === '?';
      const g = svgEl('g', { class: 'bar-box' });
      const rect = svgEl('rect', {
        x: x + 1,
        y,
        width: w - 2,
        height: rowH,
        rx: 7,
        fill: open ? FACE : BAR_FILLS[j % BAR_FILLS.length],
        stroke: s.label === '?' ? C.pink : C.purple,
        'stroke-width': 2,
        'stroke-dasharray': open ? '5 4' : '',
      });
      const text = label(x + w / 2, y + rowH / 2, s.label);
      g.append(rect, text);
      svg.append(g);
      boxes.set(`${i}:${j}`, { g, rect, text });
    });
    widest = Math.max(widest, right - x);
  });
  if (v.total) {
    const lab = v.total.label;
    const g = svgEl('g', { class: 'bar-box' });
    let rect: SVGRectElement;
    let text: SVGTextElement;
    if (v.rows.length === 1) {
      const x0 = right - widest;
      const by = top - 8;
      const bw = Math.max(54, textW(lab) + 10);
      const bh = live ? 34 : 22;
      const lift = live ? 11 : 6;
      rect = svgEl('rect', { x: x0 + widest / 2 - bw / 2, y: by - lift - bh, width: bw, height: bh, rx: 8, fill: 'transparent', stroke: 'none' });
      text = label(x0 + widest / 2, by - lift - bh / 2, lab);
      svg.append(svgEl('path', { d: `M${x0 + 2},${by} v-6 h${widest - 4} v6`, fill: 'none', stroke: C.ink, 'stroke-width': 2 }));
    } else {
      const x0 = right - widest - 8;
      const y1 = top + v.rows.length * (rowH + 10) - 10;
      rect = svgEl('rect', { x: x0 - 30, y: (top + y1) / 2 - 17, width: 32, height: 34, rx: 8, fill: 'transparent', stroke: 'none' });
      text = label(x0 - 14, (top + y1) / 2, lab);
      svg.append(svgEl('path', { d: `M${x0 + 6},${top} h-6 V${y1} h6`, fill: 'none', stroke: C.ink, 'stroke-width': 2 }));
    }
    g.append(rect, text);
    svg.append(g);
    boxes.set('T', { g, rect, text });
  }
  return { svg, boxes };
}

/** Tap a chip, then the box it belongs in. Right: it locks in green. Wrong: the box wiggles. '?' boxes take nothing. */
function barLive(v: Of<'bar'>, keep: VisKeep): HTMLElement {
  const slots = barSlots(v);
  const chips = barChips(v);
  keep.bar ??= barStart(v);
  const box = liveBox('bar-live');
  const tip = html('p', 'vis-tip');
  const { svg, boxes } = barDraw(v, true);
  const tray = html('div', 'chips');
  const msg = html('p', 'vis-msg');
  const chipBtns = chips.map((_, i) =>
    btn('chip', '', () => {
      keep.bar = barSelect(keep.bar!, i);
      paint();
    }),
  );
  chipBtns.forEach((b, i) => b.append(Object.assign(html('bdi'), { textContent: chips[i] })));
  tray.append(...chipBtns);
  const keyToSlot = new Map(slots.map((s, k) => [s.key, k]));
  for (const [key, b] of boxes) {
    const isQ = b.text.textContent === '?';
    const slot = keyToSlot.get(key);
    if (slot === undefined && !isQ) continue;
    b.g.classList.add(isQ ? 'bar-q' : 'bar-slot');
    b.g.addEventListener('click', () => {
      const s = keep.bar!;
      if (s.sel === null) {
        if (slot !== undefined && !s.placed[slot]) replay(tray, 'nudge');
        return;
      }
      const res = barDrop(v, s, slot ?? -1);
      if (res.ok) {
        keep.bar = res.s;
        msg.textContent = '';
      } else {
        replay(b.g, 'wiggle');
        msg.textContent = isQ ? BAR_NOT_HERE : '';
      }
      paint();
    });
  }
  const paint = () => {
    const s = keep.bar!;
    const sc = barScene(v, s);
    for (const [key, b] of boxes) {
      const k = keyToSlot.get(key);
      if (k === undefined) continue;
      b.text.textContent = sc.labels.get(key) ?? '';
      b.g.classList.toggle('placed', s.placed[k]);
      b.g.classList.toggle('empty', !s.placed[k]);
      b.g.classList.toggle('ready', s.sel !== null && !s.placed[k]);
    }
    chipBtns.forEach((c, i) => {
      c.hidden = s.used[i];
      c.classList.toggle('on', s.sel === i);
    });
    tip.textContent = sc.texts[sc.texts.length - 1];
    tip.classList.toggle('done', sc.done);
  };
  paint();
  box.append(tip, svg, tray, msg);
  return box;
}

// ---------- number line (left to right) ----------

/** x for each value: real order, but small gaps are widened so labels never collide. */
function spread(values: number[], x0: number, x1: number, minGap: number): (v: number) => number {
  const u = [...new Set(values)].sort((a, b) => a - b);
  const gaps = u.slice(1).map((v, i) => v - u[i]);
  let lo = 0;
  let hi = 100;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (gaps.reduce((t, g) => t + Math.max(minGap, g * mid), 0) <= x1 - x0) lo = mid;
    else hi = mid;
  }
  const xs = new Map<number, number>();
  let x = x0;
  u.forEach((v, i) => {
    if (i) x += Math.max(minGap, gaps[i - 1] * lo);
    xs.set(v, x);
  });
  const used = x - x0;
  const shift = (x1 - x0 - used) / 2;
  return (v) => xs.get(v)! + shift;
}

function lineGeom(v: Of<'line'>) {
  const n = new Set(v.points.map((p) => p.v)).size;
  const minGap = Math.min(54, (W - 60) / Math.max(1, n - 1));
  const pos = spread(v.points.map((p) => p.v), 30, W - 30, minGap);
  const spans = v.jumps.map((_, i) => Math.abs(pos(v.points[i + 1].v) - pos(v.points[i].v)));
  const arcH = spans.map((s) => Math.min(56, 18 + s * 0.2));
  const y = Math.max(...arcH, 18) + 26;
  return { pos, arcH, y, h: y + 34, size: minGap < 44 ? 13 : 15 };
}

/** The static line (the inequality's "=" point with an arrow to where the answers are). */
function line(v: Of<'line'>): SVGSVGElement {
  const { pos, arcH, y, h, size } = lineGeom(v);
  const svg = frame(h, 'ציר מספרים');
  svg.append(svgEl('line', { x1: 6, y1: y, x2: W - 6, y2: y, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
  v.jumps.forEach((j, i) => {
    const a = pos(v.points[i].v);
    const b = pos(v.points[i + 1].v);
    const mid = (a + b) / 2;
    svg.append(
      svgEl('path', { d: `M${a},${y - 4} Q${mid},${y - 2 * arcH[i]} ${b},${y - 4}`, fill: 'none', stroke: C.purple, 'stroke-width': 2.5, 'marker-end': 'url(#v-arrow)' }),
      label(mid, y - arcH[i] - 12, j, { color: j === '?' ? C.pink : C.purple, size }),
    );
  });
  for (const p of v.points) {
    const x = pos(p.v);
    svg.append(svgEl('circle', { cx: x, cy: y, r: p.label === '?' ? 6 : 5, fill: p.label === '?' ? C.pink : C.ink }));
    if (p.label) svg.append(label(x, y + 18, p.label, { size }));
  }
  if (v.answers) {
    const eq = v.points.find((p) => p.label === '=');
    if (eq) {
      const x = pos(eq.v);
      const dir = v.answers === 'bigger' ? 1 : -1;
      svg.append(
        svgEl('line', { x1: x + dir * 10, y1: y - 16, x2: x + dir * 110, y2: y - 16, stroke: C.teal, 'stroke-width': 4, 'marker-end': 'url(#v-arrow)' }),
        label(x + dir * 60, y - 34, 'התשובות כאן', { size: 14, color: C.teal }),
      );
    }
    svg.append(label(14, y + 18, 'קטן', { size: 13, color: C.purple }), label(W - 14, y + 18, 'גדול', { size: 13, color: C.purple }));
  }
  return svg;
}

/** She makes each hop with a button; the arc draws itself and the landing point appears ('?' stays '?'). */
function lineLive(v: Of<'line'>, keep: VisKeep): HTMLElement {
  keep.hops ??= 0;
  const { pos, arcH, y, h, size } = lineGeom(v);
  const box = liveBox('line-live');
  const svg = frame(h, 'ציר מספרים');
  svg.append(svgEl('line', { x1: 6, y1: y, x2: W - 6, y2: y, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
  const first = lineScene(v, keep.hops);
  const arcs = v.jumps.map((j, i) => {
    const a = pos(v.points[i].v);
    const b = pos(v.points[i + 1].v);
    const mid = (a + b) / 2;
    const cy = y - 2 * arcH[i];
    // arrowhead along the curve's end tangent (control point → end)
    const ang = (Math.atan2(y - 4 - cy, b - mid) * 180) / Math.PI;
    const g = svgEl('g', { class: `hop${first.arcs[i] ? ' on' : ''}` });
    g.append(
      svgEl('path', { d: `M${a},${y - 4} Q${mid},${cy} ${b},${y - 4}`, pathLength: 1, class: 'hop-arc', fill: 'none', stroke: C.purple, 'stroke-width': 2.5 }),
      svgEl('path', { d: 'M-9,-5 L0,0 L-9,5 z', class: 'hop-head', fill: C.purple, transform: `translate(${b},${y - 4}) rotate(${ang.toFixed(1)})` }),
      label(mid, y - arcH[i] - 12, j, { color: j === '?' ? C.pink : C.purple, size }),
    );
    return g;
  });
  const pts = v.points.map((p, i) => {
    const x = pos(p.v);
    const g = svgEl('g', { class: `hop-pt${first.shown[i] ? ' on' : ''}` });
    g.append(svgEl('circle', { cx: x, cy: y, r: p.label === '?' ? 6 : 5, fill: p.label === '?' ? C.pink : C.ink }));
    if (p.label) g.append(label(x, y + 18, p.label, { size }));
    return g;
  });
  svg.append(...arcs, ...pts);
  const row = html('div', 'vis-row');
  const go = btn('vis-btn', '', () => {
    keep.hops = Math.min(keep.hops! + 1, v.jumps.length);
    paint();
  });
  const again = btn('vis-btn ghost', LINE_AGAIN, () => {
    keep.hops = 0;
    paint();
  });
  const msg = html('p', 'vis-msg');
  row.append(go, again);
  const paint = () => {
    const sc = lineScene(v, keep.hops!);
    arcs.forEach((g, i) => g.classList.toggle('on', sc.arcs[i]));
    pts.forEach((g, i) => g.classList.toggle('on', sc.shown[i]));
    go.replaceChildren(...richText(sc.button));
    go.hidden = !sc.button;
    again.hidden = Boolean(sc.button);
    msg.textContent = sc.msg;
  };
  paint();
  box.append(svg, row, msg);
  return box;
}

/** Text with L(...) isolates as <bdi> runs (buttons mix Hebrew and numbers). */
function richText(s: string): Node[] {
  return s.split(/(⁦[^⁩]*⁩)/).filter(Boolean).map((part) =>
    part.startsWith('⁦') ? Object.assign(html('bdi'), { textContent: part.slice(1, -1), dir: 'ltr' }) : document.createTextNode(part),
  );
}

// ---------- sequence chain ----------

function chainDraw(v: Of<'chain'>) {
  const n = v.items.length;
  const gap = 8;
  const bw = Math.min(46, (W - 8 - gap * (n - 1)) / n);
  const x0 = (W - (n * bw + (n - 1) * gap)) / 2;
  const cx = (i: number) => x0 + i * (bw + gap) + bw / 2;
  const hgt = (a: { from: number; to: number }) => (a.to - a.from) * 12 + 12;
  const up = Math.max(0, ...v.arcs.filter((a) => !a.below).map(hgt));
  const down = Math.max(0, ...v.arcs.filter((a) => a.below).map(hgt));
  const by = up + 30;
  const svg = frame(by + 36 + (down ? down + 30 : 6), 'סדרה');
  const badges = v.arcs.map((a) => {
    const x1 = cx(a.from);
    const x2 = cx(a.to);
    const yy = a.below ? by + 36 : by;
    const hh = hgt(a);
    const d = a.below ? `M${x1},${yy + 2} Q${(x1 + x2) / 2},${yy + 2 * hh} ${x2},${yy + 2}` : `M${x1},${yy - 2} Q${(x1 + x2) / 2},${yy - 2 * hh} ${x2},${yy - 2}`;
    svg.append(svgEl('path', { d, fill: 'none', stroke: a.below ? C.teal : C.purple, 'stroke-width': 2.2, 'marker-end': 'url(#v-arrow)' }));
    const ly = a.below ? yy + hh + 12 : yy - hh - 12;
    const g = svgEl('g', { class: 'arc-badge' });
    const pill = svgEl('rect', { x: (x1 + x2) / 2 - 17, y: ly - 13, width: 34, height: 26, rx: 13, class: 'arc-pill' });
    const hit = svgEl('circle', { cx: (x1 + x2) / 2, cy: ly, r: 22, fill: 'transparent' });
    const text = label((x1 + x2) / 2, ly, a.label, { size: 15 });
    g.append(pill, text, hit);
    svg.append(g);
    return { g, pill, text, x: (x1 + x2) / 2 };
  });
  v.items.forEach((it, i) => {
    const x = cx(i) - bw / 2;
    svg.append(
      svgEl('rect', { x, y: by, width: bw, height: 36, rx: 8, fill: it === '?' ? FACE : C.lilac, stroke: it === '?' ? C.pink : C.purple, 'stroke-width': 2, 'stroke-dasharray': it === '?' ? '5 4' : '' }),
      label(cx(i), by + 18, it, { size: it.length > 2 ? 13 : 15 }),
    );
  });
  return { svg, badges };
}

/** Tap an arrow's '?', type its jump. Right: green. Wrong: wiggle (twice wrong: it is shown, it's never the answer). */
function chainLive(v: Of<'chain'>, keep: VisKeep): HTMLElement {
  keep.chain ??= chainStart(v);
  const asking = v.arcs.some((a) => a.jump !== undefined);
  const box = liveBox('chain-live', asking ? CHAIN_PICK : undefined);
  const { svg, badges } = chainDraw(v);
  const editor = html('div', 'chain-edit');
  badges.forEach((b, i) => {
    if (v.arcs[i].jump === undefined) return;
    b.g.classList.add('tap');
    b.g.addEventListener('click', () => {
      keep.chain = chainOpen(v, keep.chain!, i);
      paint();
      editor.querySelector('input')?.focus();
    });
  });
  const paint = (wrongNow = false) => {
    const s = keep.chain!;
    const sc = chainScene(v, s);
    badges.forEach((b, i) => {
      b.text.textContent = sc.labels[i];
      b.text.setAttribute('fill', sc.labels[i] === '?' ? C.pink : C.ink);
      b.pill.setAttribute('width', String(Math.max(34, textW(sc.labels[i], 15))));
      b.pill.setAttribute('x', String(b.x - Math.max(34, textW(sc.labels[i], 15)) / 2));
      b.g.classList.toggle('done', s.got[i] === 'done');
      b.g.classList.toggle('given', s.got[i] === 'given');
      b.g.classList.toggle('open', s.open === i);
    });
    editor.replaceChildren();
    if (s.open === null) return;
    const [before, after] = chainQuestion(v, v.arcs[s.open]).split('⬜');
    const row = html('div', 'h-step');
    const expr = html('div', 'h-expr');
    expr.dir = 'ltr';
    const input = html('input', 'h-input');
    input.inputMode = 'numeric';
    input.pattern = '[0-9]*';
    input.maxLength = 3;
    input.setAttribute('aria-label', 'הקפיצה');
    input.addEventListener('input', () => (input.value = input.value.replace(/\D/g, '')));
    const go = () => {
      if (!input.value) return;
      const res = chainTry(v, keep.chain!, Number(input.value));
      keep.chain = res.s;
      paint(!res.ok && res.s.open !== null);
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    expr.append(before.trim(), input, after.trim());
    row.append(expr, btn('h-ok', '✓', go));
    if (wrongNow) {
      row.append(html('span', 'h-try', 'נסי שוב 🙂'));
      replay(row, 'shake');
    }
    editor.append(row);
    if (wrongNow) input.focus();
  };
  paint();
  box.append(svg, editor);
  return box;
}

// ---------- groups of dots ----------

const DOTS_MAX = 25;

function dotGrid(svg: SVGElement, cx: number, cy: number, n: number, cols: number, step: number, r: number, color: string): void {
  const rows = Math.ceil(n / cols);
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = k % cols;
    svg.append(svgEl('circle', { cx: cx + (col - (inRow - 1) / 2) * step, cy: cy + (row - (rows - 1) / 2) * step, r, fill: color }));
  }
}

type Groups = Of<'groups'>;

/** Groups with known counts. `lit`: she taps a group to light it up while counting (no running total). */
function groups(v: Groups, keep?: VisKeep): Element {
  const perRow = Math.min(v.n, 5);
  const cell = W / perRow;
  const dots = v.per !== null && v.per <= DOTS_MAX && !v.inner;
  const cols = v.cols ?? 5;
  const step = v.per && v.per > 12 ? 8 : 10;
  const rDots = dots ? Math.hypot((Math.min(cols, v.per!) - 1) * step, (Math.ceil(v.per! / cols) - 1) * step) / 2 + 9 : 0;
  const r = Math.min(cell / 2 - 3, Math.max(24, rDots));
  const rows = Math.ceil(v.n / perRow);
  const looseRows = v.loose ? (v.loose <= 60 ? Math.ceil(v.loose / 15) : 1) : 0;
  const head = (v.note ? 24 : 0) + looseRows * 11 + (looseRows ? 14 : 0);
  const foot = v.total ? 28 : 4;
  const h = head + rows * (2 * r + 8) + foot;
  const svg = frame(h, 'קבוצות');
  let y = 4;
  if (v.note) {
    svg.append(label(W / 2, y + 9, v.note, { size: 14, color: C.purple }));
    y += 24;
  }
  if (v.loose) {
    if (v.loose <= 60) dotGrid(svg, W / 2, y + (looseRows * 11) / 2, v.loose, Math.min(15, v.loose), 11, 4, C.gold);
    else svg.append(label(W / 2, y + 6, `${v.loose} ●`, { color: C.ink }));
    y += looseRows * 11 + 14;
  }
  const live = keep && v.per !== null;
  if (live) keep.lit ??= Array<boolean>(v.n).fill(false);
  const cells: SVGGElement[] = [];
  for (let k = 0; k < v.n; k++) {
    const row = Math.floor(k / perRow);
    const inRow = row === rows - 1 ? v.n - row * perRow : perRow;
    const cx = W / 2 + ((k % perRow) - (inRow - 1) / 2) * cell;
    const cy = y + row * (2 * r + 8) + r + 4;
    const unknown = v.per === null;
    const g = svgEl('g', { class: 'grp' });
    g.append(
      svgEl('circle', { cx, cy, r, class: 'grp-ring', fill: unknown ? FACE : C.lilac, stroke: unknown ? C.pink : C.purple, 'stroke-width': 2, 'stroke-dasharray': unknown ? '5 4' : '' }),
    );
    if (dots) dotGrid(g, cx, cy, v.per!, Math.min(cols, v.per!), step, step > 8 ? 3.6 : 3, C.ink);
    else g.append(label(cx, cy, unknown ? '?' : (v.inner ?? String(v.per)), { size: unknown ? 18 : 14 }));
    svg.append(g);
    cells.push(g);
  }
  if (v.total) svg.append(label(W / 2, h - 13, v.total === '?' ? 'בסך הכול: ?' : `בסך הכול: ${v.total}`, { size: 15, color: C.ink }));
  if (!live) return svg;
  const box = liveBox('groups-live', GROUPS_TAP);
  const paint = () => cells.forEach((g, k) => g.classList.toggle('lit', keep.lit![k]));
  cells.forEach((g, k) => {
    g.classList.add('tap');
    g.addEventListener('click', () => {
      keep.lit = litToggle(keep.lit!, k);
      paint();
    });
  });
  paint();
  box.append(svg);
  return box;
}

// ---------- dealing: tap to give every group one more dot (the per-group count is never written) ----------

export const DEAL_BUTTON = '👆 תני לכל קבוצה אחת';
export const DEAL_DONE = 'כל הנקודות חולקו! כמה יש בכל קבוצה? 🤔';
const DOT_R = 3.4;
const STEP = 9;
const PILE_STEP = 11;
const FRAME_GAP = 10;

/** Smallest circle that holds c dots in rows of 5. */
const ringR = (c: number) =>
  c ? Math.max(14, Math.hypot((Math.min(c, 5) - 1) * STEP, (Math.ceil(c / 5) - 1) * STEP) / 2 + DOT_R + 5) : 14;

export type DealScene = {
  h: number;
  /** One entry per dot: where it is now, and whether it already sits in a group. */
  dots: { x: number; y: number; dealt: boolean }[];
  circles: { cx: number; cy: number; r: number }[];
  /** Every text the drawing shows (the button and messages included). */
  texts: string[];
  done: boolean;
};

/**
 * Where everything is for this deal state. Pure (no DOM), so tests can check it. The pile is ten-frames (two rows
 * of 5), filled right to left; dealing takes dots from the end of the pile, one round of k dots per tap.
 */
export function dealScene(v: Groups, s: Deal): DealScene {
  const total = s.pile + s.groups.reduce((t, g) => t + g, 0);
  const k = v.n;
  const per = Math.ceil(total / k);
  const frameW = 4 * PILE_STEP + 2 * DOT_R;
  const framesPerRow = Math.floor((W + FRAME_GAP) / (frameW + FRAME_GAP));
  const frames = Math.ceil(total / 10);
  const frameRows = Math.ceil(frames / framesPerRow);
  const frameH = PILE_STEP + 2 * DOT_R;
  const pileTop = 6;
  const pileH = frameRows * (frameH + 8) - 8;
  const pileAt = (i: number) => {
    const f = Math.floor(i / 10);
    const fr = Math.floor(f / framesPerRow);
    const inRow = Math.min(framesPerRow, frames - fr * framesPerRow);
    const rowW = inRow * frameW + (inRow - 1) * FRAME_GAP;
    const right = (W + rowW) / 2 - (f % framesPerRow) * (frameW + FRAME_GAP) - DOT_R;
    const j = i % 10;
    return { x: right - (j % 5) * PILE_STEP, y: pileTop + fr * (frameH + 8) + DOT_R + Math.floor(j / 5) * PILE_STEP };
  };
  const rMax = ringR(per);
  const cell = 2 * rMax + 8;
  const perRow = k <= 5 ? k : Math.ceil(k / 2);
  const rows = Math.ceil(k / perRow);
  const circlesTop = pileTop + pileH + 16;
  const centers = Array.from({ length: k }, (_, j) => {
    const row = Math.floor(j / perRow);
    const inRow = Math.min(perRow, k - row * perRow);
    return { cx: W / 2 + ((inRow - 1) / 2 - (j % perRow)) * cell, cy: circlesTop + row * cell + rMax + 4 };
  });
  const dealt = s.groups[0] ?? 0;
  const circles = centers.map((c) => ({ ...c, r: ringR(dealt) }));
  const inRing = (j: number, slot: number) => {
    const ringRows = Math.ceil(dealt / 5);
    const row = Math.floor(slot / 5);
    const inRow = Math.min(5, dealt - row * 5);
    return { x: centers[j].cx + ((inRow - 1) / 2 - (slot % 5)) * STEP, y: centers[j].cy + (row - (ringRows - 1) / 2) * STEP };
  };
  const dots = Array.from({ length: total }, (_, d) => {
    if (d < s.pile) return { ...pileAt(d), dealt: false };
    const e = total - 1 - d;
    return { ...inRing(e % k, Math.floor(e / k)), dealt: true };
  });
  const done = dealDone(s);
  const totalText = v.total ? [`בסך הכול: ${v.total}`] : [];
  return {
    h: circlesTop + rows * cell + (totalText.length ? 26 : 4),
    dots,
    circles,
    texts: [v.note ?? '', ...totalText, done ? DEAL_DONE : DEAL_BUTTON].filter(Boolean),
    done,
  };
}

/** The dealing drawing. `keep.deal` holds the state, so it survives the ladder re-rendering. */
function dealGroups(v: Groups, keep: { deal?: Deal }): HTMLElement {
  keep.deal ??= startDeal(v.loose!, v.n);
  const first = dealScene(v, keep.deal);
  const box = document.createElement('div');
  box.className = 'deal';
  if (v.note) box.append(Object.assign(document.createElement('p'), { className: 'deal-note', textContent: v.note }));
  const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'deal-btn', textContent: DEAL_BUTTON });
  const msg = Object.assign(document.createElement('p'), { className: 'deal-done', textContent: DEAL_DONE });
  const svg = frame(first.h, 'קבוצות');
  svg.classList.add('deal-svg');
  const rings = first.circles.map((c) => svgEl('circle', { cx: c.cx, cy: c.cy, r: c.r, class: 'deal-ring', 'stroke-width': 2 }));
  const dots = first.dots.map(() => svgEl('circle', { cx: 0, cy: 0, r: DOT_R, class: 'deal-dot' }));
  svg.append(...rings, ...dots);
  if (v.total) svg.append(label(W / 2, first.h - 13, `בסך הכול: ${v.total}`, { size: 15, color: C.ink }));
  const paint = (s: Deal) => {
    const sc = dealScene(v, s);
    sc.circles.forEach((c, j) => {
      rings[j].setAttribute('r', String(c.r));
      rings[j].style.setProperty('r', `${c.r}px`);
      rings[j].classList.toggle('full', sc.done);
    });
    sc.dots.forEach((d, i) => {
      dots[i].style.transform = `translate(${d.x}px, ${d.y}px)`;
      dots[i].classList.toggle('dealt', d.dealt);
    });
    btn.hidden = sc.done;
    msg.hidden = !sc.done;
  };
  btn.addEventListener('click', () => {
    keep.deal = deal(keep.deal!);
    paint(keep.deal);
  });
  paint(keep.deal);
  box.append(btn, msg, svg);
  return box;
}


// ---------- clock: buttons move the hands ----------

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

function dial(svg: SVGSVGElement, cx: number, cy: number, r: number): void {
  svg.append(svgEl('circle', { cx, cy, r, fill: FACE, stroke: C.purple, 'stroke-width': 3 }));
  for (let h = 1; h <= 12; h++) {
    const [x, y] = polar(cx, cy, r - 13, h * 30);
    svg.append(label(x, y, String(h), { size: 13, weight: 700 }));
  }
  for (let k = 0; k < 60; k++) {
    const big = k % 5 === 0;
    const [x1, y1] = polar(cx, cy, r - 2, k * 6);
    const [x2, y2] = polar(cx, cy, r - (big ? 6 : 4), k * 6);
    svg.append(svgEl('line', { x1, y1, x2, y2, stroke: C.purple, 'stroke-width': big ? 1.8 : 0.8 }));
  }
}

/** Hand angles that keep growing (no wrap), so a transition always turns the hands forward. */
const handDeg = (t: number) => ({ hour: t * 0.5, minute: t * 6 });

/** A pie for one press: a full disc for an hour, a slice for less. Countable, like dots; no number. */
function pie(cx: number, cy: number, r: number, m: number): SVGElement {
  if (m >= 60) return svgEl('circle', { cx, cy, r, fill: C.teal });
  const [x, y] = polar(cx, cy, r, m * 6);
  return svgEl('path', { d: `M${cx},${cy} V${cy - r} A${r},${r} 0 ${m > 30 ? 1 : 0} 1 ${x.toFixed(1)},${y.toFixed(1)} z`, fill: C.teal });
}

function clockLive(v: Of<'clock'>, keep: VisKeep): HTMLElement {
  keep.clock ??= [];
  const r = 70;
  const cx = W / 2;
  const cy = r + 6;
  const h = cy + r + 8;
  const box = liveBox('clock-live');
  const svg = frame(h, 'שעון');
  dial(svg, cx, cy, r);
  const hand = (len: number, width: number, color: string, extra: Attrs = {}) =>
    svgEl('line', { x1: cx, y1: cy, x2: cx, y2: cy - len, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', ...extra });
  if (v.target) {
    const d = handDeg(v.target.t);
    const ghost = { 'stroke-dasharray': '5 5', opacity: 0.55 };
    svg.append(
      hand(r * 0.48, 4.5, C.ink, { ...ghost, transform: `rotate(${d.hour % 360} ${cx} ${cy})` }),
      hand(r * 0.76, 3, C.pink, { ...ghost, transform: `rotate(${d.minute % 360} ${cx} ${cy})` }),
    );
  }
  const hourHand = hand(r * 0.48, 5.5, C.ink, { class: 'clock-hand' });
  const minHand = hand(r * 0.76, 3.5, C.pink, { class: 'clock-hand' });
  for (const hh of [hourHand, minHand]) hh.style.transformOrigin = `${cx}px ${cy}px`;
  svg.append(hourHand, minHand, svgEl('circle', { cx, cy, r: 4, fill: C.ink }));
  const tokens = html('div', 'clock-tokens');

  const caps = html('div', 'clock-caps');
  caps.append(html('span', 'clock-cap', v.caption));
  if (v.target) caps.append(html('span', 'clock-cap ghost', v.target.caption));
  const row = html('div', 'vis-row');
  const adds = v.adds.map((m) =>
    btn('vis-btn', '', () => {
      keep.clock = clockPress(keep.clock!, m);
      paint();
    }),
  );
  const reset = btn('vis-btn ghost', CLOCK_RESET, () => {
    keep.clock = [];
    svg.classList.add('instant');
    paint();
    void svg.getBoundingClientRect();
    svg.classList.remove('instant');
  });
  const msg = html('p', 'vis-msg');
  row.append(...adds, reset);
  const paint = () => {
    const sc = clockScene(v, keep.clock!);
    const d = handDeg(sc.at);
    hourHand.style.transform = `rotate(${d.hour}deg)`;
    minHand.style.transform = `rotate(${d.minute}deg)`;
    sc.buttons.forEach((b, i) => {
      adds[i].replaceChildren(...richText(b.label));
      adds[i].disabled = b.off;
    });
    reset.disabled = !keep.clock!.length;
    msg.replaceChildren(...richText(sc.msg));
    msg.classList.toggle('match', v.target !== undefined && sc.at === v.target.t);
    tokens.replaceChildren(
      ...(v.target ? keep.clock! : []).map((m) => {
        const t = svgEl('svg', { viewBox: '0 0 22 22', width: 22, height: 22, class: 'token' });
        t.append(svgEl('circle', { cx: 11, cy: 11, r: 9, fill: FACE, stroke: C.teal, 'stroke-width': 1.5 }), pie(11, 11, 9, m));
        return t;
      }),
    );
  };
  paint();
  box.append(svg, ...(v.target ? [tokens] : []), caps, row, msg);
  return box;
}

// ---------- column addition: she tries digits for ☀ ----------

function column(v: Of<'column'>): SVGSVGElement {
  const cw = 34;
  const rowH = 40;
  const sym = v.symbol ?? '☀';
  const cols = Math.max(...[v.top, v.add, v.result].map((s) => [...s].length));
  const x1 = W / 2 + (cols * cw) / 2;
  const svg = frame(rowH * 3 + 18, 'תרגיל במאונך');
  svg.append(svgEl('rect', { x: x1 - cw, y: 2, width: cw, height: rowH * 3 + 12, rx: 10, fill: '#fff1a8' }));
  const row = (s: string, y: number) =>
    [...s].reverse().forEach((ch, k) => svg.append(label(x1 - cw / 2 - k * cw, y, ch, { size: 26, weight: 800, color: ch === sym ? C.gold : C.ink })));
  row(v.top, 6 + rowH / 2);
  row(v.add, 6 + rowH * 1.5);
  svg.append(label(x1 - cols * cw - 16, 6 + rowH * 1.5, '+', { size: 26, weight: 800 }));
  svg.append(svgEl('line', { x1: x1 - cols * cw - 30, y1: 6 + rowH * 2, x2: x1 + 4, y2: 6 + rowH * 2, stroke: C.ink, 'stroke-width': 3 }));
  row(v.result, 12 + rowH * 2.5);
  return svg;
}

/** Digit chips 1–9: the chosen one shows the ones column with it ("6 + 4 = 10"). No ✓/✗: she compares herself. */
function columnLive(v: Of<'column'>, keep: VisKeep): HTMLElement {
  keep.pick ??= null;
  const box = liveBox('digit-live', DIGIT_PICK);
  const tray = html('div', 'chips digits');
  tray.dir = 'ltr';
  const out = html('p', 'digit-line');
  out.dir = 'ltr';
  const chips = DIGITS.map((d) =>
    btn('chip', String(d), () => {
      keep.pick = keep.pick === d ? null : d;
      paint();
    }),
  );
  tray.append(...chips);
  const paint = () => {
    const sc = digitScene(v, keep.pick!);
    chips.forEach((c, i) => c.classList.toggle('on', keep.pick === DIGITS[i]));
    out.textContent = sc.line;
    out.classList.toggle('empty', !sc.line);
    if (sc.line) replay(out, 'pop-in');
  };
  paint();
  box.append(column(v), tray, out);
  return box;
}

/** `keep` carries interactive state across re-renders of the same hint (pass none for a fresh drawing). */
export function renderVisual(v: Visual, keep: VisKeep = {}): Element {
  if (v.kind === 'bar') return barSlots(v).length ? barLive(v, keep) : barDraw(v, false).svg;
  if (v.kind === 'line') return v.jumps.length && !v.answers ? lineLive(v, keep) : line(v);
  if (v.kind === 'chain') return chainLive(v, keep);
  if (v.kind === 'groups') return v.per === null && v.loose ? dealGroups(v, keep) : groups(v, keep);
  if (v.kind === 'clock') return clockLive(v, keep);
  // column: interactive digit trial only for ☀; △ (triangle) gets a static drawing
  return v.symbol && v.symbol !== '☀' ? column(v) : columnLive(v, keep);
}
