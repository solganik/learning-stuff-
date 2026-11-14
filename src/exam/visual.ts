/** Hint drawings as inline SVG, built only from what the hint data holds (so they never show the answer). */
import type { BarRow, Seg, Visual } from './hints';

const NS = 'http://www.w3.org/2000/svg';
const W = 320;
const C = { ink: '#4a2361', pink: '#ff5fa2', soft: '#ffd6ec', purple: '#8e5cf7', lilac: '#ede4ff', teal: '#1fb6a6', gold: '#ffc531' };
const BAR_FILLS = ['#ffd6ec', '#e3d6ff', '#cff3ee', '#fff0bf'];

type Attrs = Record<string, string | number>;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, text = ''): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text) node.textContent = text;
  return node;
}

function label(x: number, y: number, text: string, o: { size?: number; color?: string; weight?: number; anchor?: string } = {}): SVGTextElement {
  const q = text === '?';
  const hebrew = /[\u0590-\u05ff]/.test(text);
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
  const m = svgEl('marker', { id: 'v-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  m.append(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: C.purple }));
  defs.append(m);
  svg.append(defs);
  return svg;
}

const textW = (s: string, size = 15) => [...s].length * size * 0.62 + 8;

// ---------- bar model (drawn right to left, like the Hebrew sentence) ----------

function bar(v: Extract<Visual, { kind: 'bar' }>): SVGSVGElement {
  const named = v.rows.some((r) => r.name);
  const nameW = named ? Math.max(...v.rows.map((r) => textW(r.name ?? '', 14))) + 6 : 0;
  const side = v.total && v.rows.length > 1 ? 34 : 0;
  const barW = W - nameW - side - 4;
  const minW = (s: Seg) => Math.max(26, textW(s.label));
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
  const rowH = 34;
  const top = v.total && v.rows.length === 1 ? 34 : 6;
  const h = top + v.rows.length * (rowH + 10) + 2;
  const svg = frame(h, 'מודל פסים');
  const right = W - nameW - 2;
  let widest = 0;
  v.rows.forEach((r, i) => {
    const y = top + i * (rowH + 10);
    if (r.name) svg.append(label(W - 2, y + rowH / 2, r.name, { anchor: 'end', size: 14 }));
    let x = right;
    r.segs.forEach((s, j) => {
      const w = Math.max(minW(s), s.v * scale);
      x -= w;
      svg.append(
        svgEl('rect', {
          x: x + 1,
          y,
          width: w - 2,
          height: rowH,
          rx: 7,
          fill: s.gap ? '#fff' : s.label === '?' ? '#fff' : BAR_FILLS[j % BAR_FILLS.length],
          stroke: s.label === '?' ? C.pink : C.purple,
          'stroke-width': 2,
          'stroke-dasharray': s.gap || s.label === '?' ? '5 4' : '',
        }),
        label(x + w / 2, y + rowH / 2, s.label),
      );
    });
    widest = Math.max(widest, right - x);
  });
  if (v.total) {
    const lab = v.total.label;
    if (v.rows.length === 1) {
      const x0 = right - widest;
      svg.append(
        svgEl('path', { d: `M${x0 + 2},26 v-6 h${widest - 4} v6`, fill: 'none', stroke: C.ink, 'stroke-width': 2 }),
        label(x0 + widest / 2, 10, lab),
      );
    } else {
      const x0 = right - widest - 8;
      const y1 = top + v.rows.length * (rowH + 10) - 10;
      svg.append(
        svgEl('path', { d: `M${x0 + 6},${top} h-6 V${y1} h6`, fill: 'none', stroke: C.ink, 'stroke-width': 2 }),
        label(x0 - 14, (top + y1) / 2, lab),
      );
    }
  }
  return svg;
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

function line(v: Extract<Visual, { kind: 'line' }>): SVGSVGElement {
  const pos = spread(v.points.map((p) => p.v), 30, W - 30, 54);
  const spans = v.jumps.map((_, i) => Math.abs(pos(v.points[i + 1].v) - pos(v.points[i].v)));
  const arcH = spans.map((s) => Math.min(56, 18 + s * 0.2));
  const top = Math.max(...arcH, 18) + 26;
  const y = top;
  const svg = frame(y + 34, 'ציר מספרים');
  svg.append(svgEl('line', { x1: 6, y1: y, x2: W - 6, y2: y, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
  v.jumps.forEach((j, i) => {
    const a = pos(v.points[i].v);
    const b = pos(v.points[i + 1].v);
    const hgt = arcH[i];
    const mid = (a + b) / 2;
    svg.append(
      svgEl('path', {
        d: `M${a},${y - 4} Q${mid},${y - 2 * hgt} ${b},${y - 4}`,
        fill: 'none',
        stroke: C.purple,
        'stroke-width': 2.5,
        'marker-end': 'url(#v-arrow)',
      }),
      label(mid, y - hgt - 12, j, { color: j === '?' ? C.pink : C.purple }),
    );
  });
  for (const p of v.points) {
    const x = pos(p.v);
    svg.append(svgEl('circle', { cx: x, cy: y, r: p.label === '?' ? 6 : 5, fill: p.label === '?' ? C.pink : C.ink }));
    if (p.label) svg.append(label(x, y + 18, p.label));
  }
  if (v.answers) {
    const eq = v.points.find((p) => p.label === '=');
    if (eq) {
      const x = pos(eq.v);
      const dir = v.answers === 'bigger' ? 1 : -1;
      svg.append(
        svgEl('line', { x1: x + dir * 12, y1: y + 18, x2: x + dir * 90, y2: y + 18, stroke: C.teal, 'stroke-width': 4, 'marker-end': 'url(#v-arrow)' }),
      );
    }
  }
  return svg;
}

// ---------- sequence chain ----------

function chain(v: Extract<Visual, { kind: 'chain' }>): SVGSVGElement {
  const n = v.items.length;
  const gap = 8;
  const bw = Math.min(46, (W - 8 - gap * (n - 1)) / n);
  const x0 = (W - (n * bw + (n - 1) * gap)) / 2;
  const cx = (i: number) => x0 + i * (bw + gap) + bw / 2;
  const hasBelow = v.arcs.some((a) => a.below);
  const by = 46;
  const svg = frame(by + 36 + (hasBelow ? 44 : 6), 'סדרה');
  for (const a of v.arcs) {
    const x1 = cx(a.from);
    const x2 = cx(a.to);
    const hgt = (a.to - a.from) * 12 + 10;
    const yy = a.below ? by + 36 : by;
    const d = a.below ? `M${x1},${yy + 2} Q${(x1 + x2) / 2},${yy + 2 * hgt} ${x2},${yy + 2}` : `M${x1},${yy - 2} Q${(x1 + x2) / 2},${yy - 2 * hgt} ${x2},${yy - 2}`;
    svg.append(
      svgEl('path', { d, fill: 'none', stroke: a.below ? C.teal : C.purple, 'stroke-width': 2.2, 'marker-end': 'url(#v-arrow)' }),
      label((x1 + x2) / 2, a.below ? yy + hgt + 10 : yy - hgt - 10, a.label, { size: 15 }),
    );
  }
  v.items.forEach((it, i) => {
    const x = cx(i) - bw / 2;
    svg.append(
      svgEl('rect', { x, y: by, width: bw, height: 36, rx: 8, fill: it === '?' ? '#fff' : C.lilac, stroke: it === '?' ? C.pink : C.purple, 'stroke-width': 2, 'stroke-dasharray': it === '?' ? '5 4' : '' }),
      label(cx(i), by + 18, it, { size: it.length > 2 ? 13 : 15 }),
    );
  });
  return svg;
}

// ---------- groups of dots ----------

const DOTS_MAX = 25;

function dotGrid(svg: SVGSVGElement, cx: number, cy: number, n: number, cols: number, step: number, r: number, color: string): void {
  const rows = Math.ceil(n / cols);
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = k % cols;
    svg.append(svgEl('circle', { cx: cx + (col - (inRow - 1) / 2) * step, cy: cy + (row - (rows - 1) / 2) * step, r, fill: color }));
  }
}

function groups(v: Extract<Visual, { kind: 'groups' }>): SVGSVGElement {
  const perRow = Math.min(v.n, 5);
  const cell = W / perRow;
  const dots = v.per !== null && v.per <= DOTS_MAX && !v.inner;
  const cols = v.cols ?? (v.per && v.per > 9 ? 5 : v.per && v.per > 4 ? 3 : 2);
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
  for (let k = 0; k < v.n; k++) {
    const row = Math.floor(k / perRow);
    const inRow = row === rows - 1 ? v.n - row * perRow : perRow;
    const cx = W / 2 + ((k % perRow) - (inRow - 1) / 2) * cell;
    const cy = y + row * (2 * r + 8) + r + 4;
    const unknown = v.per === null;
    svg.append(
      svgEl('circle', { cx, cy, r, fill: unknown ? '#fff' : C.lilac, stroke: unknown ? C.pink : C.purple, 'stroke-width': 2, 'stroke-dasharray': unknown ? '5 4' : '' }),
    );
    if (dots) dotGrid(svg, cx, cy, v.per!, Math.min(cols, v.per!), step, step > 8 ? 3.6 : 3, C.ink);
    else svg.append(label(cx, cy, unknown ? '?' : (v.inner ?? String(v.per)), { size: unknown ? 18 : 14 }));
  }
  if (v.total) svg.append(label(W / 2, h - 13, v.total === '?' ? 'בסך הכול: ?' : `בסך הכול: ${v.total}`, { size: 15, color: C.ink }));
  return svg;
}

export function renderVisual(v: Visual): SVGSVGElement | null {
  if (v.kind === 'bar') return bar(v);
  if (v.kind === 'line') return line(v);
  if (v.kind === 'chain') return chain(v);
  if (v.kind === 'groups') return groups(v);
  return null;
}
