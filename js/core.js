'use strict';

/* =========================================================
   Helpers
   ========================================================= */
const $ = (s, root = document) => root.querySelector(s);
const SVG_NS = 'http://www.w3.org/2000/svg';

function mk(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function setA(e, attrs) { for (const k in attrs) e.setAttribute(k, attrs[k]); }

let uid = 0;
const nextId = () => ++uid;
/* Addresses are shortened to 16 bits so they stay readable on screen:
   stack variables live near 0xff00 (growing down), heap blocks near 0x5a00. */
const hex = n => '0x' + n.toString(16);
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const tagWidth = label => String(label).length * 7.9 + 10;

/* =========================================================
   Scene: keyed SVG renderer with tweened transitions.
   Each draw() receives { nodes, edges }; nodes are matched by id,
   so moving a node animates it from its old position to the new one.
   ========================================================= */
class Scene {
  constructor(svg) {
    this.svg = svg;
    const defs = mk('defs', {}, svg);
    for (const [id, cls] of [['arrow', 'ah'], ['arrow-ptr', 'ah ptr']]) {
      const m = mk('marker', {
        id, viewBox: '0 0 10 10', refX: 8.5, refY: 5,
        markerWidth: 5.5, markerHeight: 5.5, orient: 'auto-start-reverse',
      }, defs);
      mk('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }, m);
    }
    this.gE = mk('g', {}, svg);
    this.gN = mk('g', {}, svg);
    this.nodes = new Map();
    this.edges = new Map();
    this.vb = { x: -320, y: -160, w: 640, h: 320 };
    this.raf = null;
  }

  reset() {
    this.gE.textContent = '';
    this.gN.textContent = '';
    this.nodes.clear();
    this.edges.clear();
  }

  makeNode(s) {
    const g = mk('g', {}, this.gN);
    const n = { el: g, kind: s.kind };
    if (s.kind === 'circle') n.shape = mk('circle', {}, g);
    else if (s.kind !== 'tag') n.shape = mk('rect', {}, g);
    if (s.kind === 'll') n.div = mk('line', { class: 'div' }, g);
    n.lbl = mk('text', { class: s.kind === 'tag' ? 'tagtxt' : 'lbl' }, g);
    if (s.kind === 'll') n.ptr = mk('text', { class: 'ptrtxt' }, g);
    n.sub = mk('text', { class: 'sub' }, g);
    return n;
  }

  updateNode(n, s) {
    n.spec = s;
    n.el.setAttribute('class', `node ${s.kind} ${s.cls || ''}`);
    n.lbl.textContent = s.label ?? '';
    n.sub.textContent = s.sub ?? '';
    const w = s.w ?? 44, h = s.h ?? 44;
    if (s.kind === 'circle') {
      const r = s.r ?? 22;
      n.shape.setAttribute('r', r);
      setA(n.lbl, { x: 0, y: 0 });
      setA(n.sub, { x: s.subDx ?? 0, y: s.subDy ?? r + 14 });
    } else if (s.kind === 'tag') {
      setA(n.lbl, { x: 0, y: 0 });
    } else {
      setA(n.shape, { x: -w / 2, y: -h / 2, width: w, height: h, rx: 7 });
      if (s.kind === 'll') {
        const dx = -w / 2 + (s.dataW ?? 50);
        setA(n.div, { x1: dx, y1: -h / 2, x2: dx, y2: h / 2 });
        setA(n.lbl, { x: (-w / 2 + dx) / 2, y: 0 });
        setA(n.ptr, { x: (dx + w / 2) / 2, y: 0, class: 'ptrtxt' + (s.ptr === 'NULL' ? ' null' : '') });
        n.ptr.textContent = s.ptr ?? '';
        setA(n.sub, { x: s.subDx ?? 0, y: s.subDy ?? -h / 2 - 10 });
      } else {
        setA(n.lbl, { x: 0, y: 0 });
        setA(n.sub, { x: s.subDx ?? 0, y: s.subDy ?? h / 2 + 14 });
      }
    }
  }

  draw(spec, dur = 350) {
    const seenN = new Set(), seenE = new Set();
    for (const s of spec.nodes) {
      let n = this.nodes.get(s.id);
      if (n && n.kind !== s.kind) { n.el.remove(); this.nodes.delete(s.id); n = null; }
      if (!n) {
        n = this.makeNode(s);
        n.cur = { x: s.x, y: s.y + (s.enter ?? -18), o: 0 };
        this.nodes.set(s.id, n);
      }
      this.updateNode(n, s);
      n.removing = false;
      n.from = { ...n.cur };
      n.to = { x: s.x, y: s.y, o: s.o ?? 1 };
      seenN.add(s.id);
    }
    for (const [id, n] of this.nodes) {
      if (seenN.has(id)) continue;
      n.removing = true;
      n.from = { ...n.cur };
      n.to = { ...n.cur, o: 0 };
    }

    for (const s of spec.edges) {
      const id = s.id || `${s.from}>${s.to}`;
      let e = this.edges.get(id);
      if (!e) {
        e = { el: mk('path', {}, this.gE), cur: { o: 0 } };
        this.edges.set(id, e);
      }
      e.spec = s;
      e.removing = false;
      e.el.setAttribute('class', `edge ${s.cls || ''}`);
      if (s.arrow) e.el.setAttribute('marker-end', `url(#${s.cls === 'ptr' ? 'arrow-ptr' : 'arrow'})`);
      else e.el.removeAttribute('marker-end');
      e.from = { ...e.cur };
      e.to = { o: 1 };
      seenE.add(id);
    }
    for (const [id, e] of this.edges) {
      if (seenE.has(id)) continue;
      e.removing = true;
      e.from = { ...e.cur };
      e.to = { o: 0 };
    }

    this.vbFrom = { ...this.vb };
    this.vbTo = this.fit(spec);
    this.t0 = performance.now();
    this.dur = Math.max(1, dur);
    if (!this.raf) this.raf = requestAnimationFrame(t => this.frame(t));
  }

  /* Choose a viewBox that contains everything, with a minimum zoom-out
     so tiny structures don't get blown up to giant size. */
  fit(spec) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of spec.nodes) {
      let w, h;
      if (s.kind === 'tag') { w = tagWidth(s.label); h = 20; }
      else if (s.kind === 'circle') { w = h = 2 * (s.r ?? 22); }
      else { w = s.w ?? 44; h = (s.h ?? 44) + (s.sub !== undefined && s.sub !== '' ? 34 : 0); }
      x0 = Math.min(x0, s.x - w / 2); x1 = Math.max(x1, s.x + w / 2);
      y0 = Math.min(y0, s.y - h / 2); y1 = Math.max(y1, s.y + h / 2);
    }
    if (!isFinite(x0)) { x0 = -100; x1 = 100; y0 = -50; y1 = 50; }
    const pad = 46, minW = 620, minH = 330;
    let w = Math.max(x1 - x0 + 2 * pad, minW);
    let h = Math.max(y1 - y0 + 2 * pad + 30, minH); // + room for the legend
    const ratio = this.svg.clientWidth / this.svg.clientHeight || 2;
    if (w / h > ratio) h = w / ratio; else w = h * ratio;
    return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2 + 12, w, h };
  }

  frame(now) {
    // rAF timestamps can predate draw(), so clamp both ends
    const t = Math.min(1, Math.max(0, (now - this.t0) / this.dur)), k = ease(t);
    const L = (a, b) => a + (b - a) * k;
    for (const n of this.nodes.values()) {
      n.cur = { x: L(n.from.x, n.to.x), y: L(n.from.y, n.to.y), o: L(n.from.o, n.to.o) };
      n.el.setAttribute('transform', `translate(${n.cur.x.toFixed(2)},${n.cur.y.toFixed(2)})`);
      n.el.style.opacity = n.cur.o;
    }
    for (const e of this.edges.values()) {
      e.cur = { o: L(e.from.o, e.to.o) };
      e.el.setAttribute('d', this.path(e.spec));
      e.el.style.opacity = e.cur.o;
    }
    const a = this.vbFrom, b = this.vbTo;
    this.vb = { x: L(a.x, b.x), y: L(a.y, b.y), w: L(a.w, b.w), h: L(a.h, b.h) };
    this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);

    if (t < 1) { this.raf = requestAnimationFrame(tt => this.frame(tt)); return; }
    this.raf = null;
    for (const [id, e] of this.edges) if (e.removing) { e.el.remove(); this.edges.delete(id); }
    for (const [id, n] of this.nodes) if (n.removing) { n.el.remove(); this.nodes.delete(id); }
  }

  /* Point on a node's border in the direction of (tx, ty). */
  clip(n, tx, ty) {
    const { x, y } = n.cur, dx = tx - x, dy = ty - y, s = n.spec;
    if (!dx && !dy) return [x, y];
    if (n.kind === 'circle') {
      const r = (s.r ?? 22) + 3, d = Math.hypot(dx, dy);
      return [x + (dx / d) * r, y + (dy / d) * r];
    }
    const w = n.kind === 'tag' ? tagWidth(s.label) : s.w ?? 44;
    const h = n.kind === 'tag' ? 20 : s.h ?? 44;
    const t = Math.min((w / 2 + 3) / Math.abs(dx || 1e-9), (h / 2 + 3) / Math.abs(dy || 1e-9));
    return [x + dx * t, y + dy * t];
  }

  path(s) {
    const a = this.nodes.get(s.from), b = this.nodes.get(s.to);
    if (!a || !b) return '';
    const port = a.kind === 'll';           // linked-list arrows leave from the "next" field
    let sx = a.cur.x, sy = a.cur.y;
    if (port) sx += (a.spec.w ?? 120) / 2 - 4;
    const c = s.curve || 0;
    const cx = (sx + b.cur.x) / 2, cy = (sy + b.cur.y) / 2 + c;
    const [ex, ey] = this.clip(b, c ? cx : sx, c ? cy : sy);
    if (!port) [sx, sy] = this.clip(a, c ? cx : b.cur.x, c ? cy : b.cur.y);
    const f = v => v.toFixed(2);
    return c
      ? `M${f(sx)},${f(sy)} Q${f(cx)},${f(cy)} ${f(ex)},${f(ey)}`
      : `M${f(sx)},${f(sy)} L${f(ex)},${f(ey)}`;
  }
}

/* =========================================================
   App state, timing & step control
   ========================================================= */
const SPEEDS = [1800, 1400, 1100, 900, 700, 550, 420, 300, 200, 120];

const App = {
  scene: null,
  ds: null,
  structures: [],
  delay: 700,
  stepMode: false,
  stepResolve: null,
  busy: false,
  tween() { return this.stepMode ? 380 : Math.min(480, this.delay * 0.75); },
  out(text) { $('#output').textContent = text || '—'; },
};

function wait(mult = 1) {
  return new Promise(resolve => {
    if (App.stepMode) {
      App.stepResolve = resolve;
      $('#next').disabled = false;
    } else {
      setTimeout(resolve, App.delay * mult);
    }
  });
}

function nextStep() {
  const r = App.stepResolve;
  if (!r) return;
  App.stepResolve = null;
  $('#next').disabled = true;
  r();
}

/* =========================================================
   Code panel with tiny C syntax highlighter
   ========================================================= */
const TOKENS = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)')|(#\w+)|\b(int|void|char|float|double|long|short|unsigned|signed|const|return|if|else|while|do|for|switch|case|default|break|continue|struct|typedef|sizeof|NULL|static)\b|\b(size_t|INT_MAX|N|Point|Bad|Good)\b|\b([A-Za-z_]\w*)(?=\s*\()|\b(\d+(?:\.\d+)?)\b/g;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlight(line) {
  let out = '', last = 0;
  for (const m of line.matchAll(TOKENS)) {
    out += esc(line.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] || m[4] ? 'k' : m[5] ? 't' : m[6] ? 'f' : 'n';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(line.slice(last));
}

const Code = {
  text: '',
  show(name, text) {
    this.text = text;
    $('#code-title').textContent = name;
    $('#code').innerHTML = text.split('\n').map((l, i) =>
      `<div class="ln" data-n="${i + 1}"><span class="no">${i + 1}</span><span class="src">${highlight(l) || ' '}</span></div>`
    ).join('');
    for (const b of document.querySelectorAll('#chips button')) b.classList.toggle('on', b.dataset.key === name);
  },
  hl(n) {
    const box = $('#code');
    let on = null;
    for (const el of box.children) {
      const hit = +el.dataset.n === n;
      el.classList.toggle('on', hit);
      if (hit) on = el;
    }
    if (!on) return;
    const top = on.offsetTop, bottom = top + on.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top - 10;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 10;
  },
};

function log(msg, type = '') {
  const li = document.createElement('li');
  li.className = type;
  li.textContent = msg;
  const ul = $('#log');
  ul.append(li);
  while (ul.children.length > 120) ul.firstChild.remove();
  ul.scrollTop = ul.scrollHeight;
}

/* =========================================================
   Base class for every data structure
   ========================================================= */
class DS {
  constructor() { this.m = {}; }
  mark(id, cls) { if (cls) this.m[id] = cls; else delete this.m[id]; }
  clearMarks() { this.m = {}; }
  finish() {}
  /** Value used when the input box is left empty. */
  sample(ctl) { return rand(Math.max(ctl.min ?? 1, 1), Math.min(ctl.max ?? 99, 99)); }
  render(dur = App.tween()) {
    App.scene.draw(this.layout(), dur);
    $('#stats').textContent = this.stats();
  }
  /** Highlight a code line, log a message, redraw, then pause. */
  async step(line, msg, type) {
    if (line) Code.hl(line);
    if (msg) log(msg, type);
    this.render();
    await wait();
  }
}
