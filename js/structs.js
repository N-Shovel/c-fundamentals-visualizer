'use strict';

const STRUCT_CODE = {
  overview: `struct Point {
    int x;      // offset 0
    int y;      // offset 4
};              // sizeof(struct Point) == 8

struct Point pt = {3, 4};
struct Point *pp = &pt;

// pt.x    member of a struct
// pp->y   member through a pointer: (*pp).y`,
  setX: `pt.x = value;   // dot: pick a member of pt
// address = &pt + offsetof(struct Point, x) = +0
printf("(%d, %d)\\n", pt.x, pt.y);`,
  arrowY: `struct Point *pp = &pt;
pp->y = value;  // arrow: same as (*pp).y = value
// address = pp + offsetof(struct Point, y) = +4
printf("(%d, %d)\\n", pt.x, pt.y);`,
  copy: `struct Point q = pt;   // copies ALL members
q.x = q.x + 100;       // changes q only
printf("pt=(%d,%d) q=(%d,%d)\\n",
       pt.x, pt.y, q.x, q.y);`,
  padding: `struct Bad  { char a; int b; char c; };
struct Good { int b; char a; char c; };

// an int must start at an offset that is a
// multiple of 4, so the compiler adds padding.
// sizeof(struct Bad)  == 12
// sizeof(struct Good) == 8`,
};

const PT_ADDR = 0xff10, Q_ADDR = 0xff08;
const BAD = ['a', '', '', '', 'b', 'b', 'b', 'b', 'c', '', '', ''];
const GOOD = ['b', 'b', 'b', 'b', 'a', 'c', '', ''];

class Structs extends DS {
  constructor() {
    super();
    this.key = 'structs';
    this.name = 'Structs';
    this.about = 'A struct groups several members into one block of memory, each at a fixed offset from the start. The dot operator reaches a member of a struct; the arrow operator does the same through a pointer. Assigning one struct to another copies every byte. The compiler may insert padding so each member stays aligned, so member order can change sizeof.';
    this.facts = [['s.m', 'member access'], ['p->m', '(*p).m'], ['sizeof(struct Point)', '8 bytes'], ['struct Bad / Good', '12 / 8 bytes'], ['q = pt', 'copies all bytes']];
    this.code = STRUCT_CODE;
    this.placeholder = 'value';
    this.controls = [
      { op: 'setX', label: 'pt.x = v', arg: 'new' },
      { op: 'arrowY', label: 'pp->y = v', arg: 'new' },
      { sep: true },
      { op: 'copy', label: 'q = pt' },
      { op: 'padding', label: 'Padding' },
    ];
    this.random();
  }

  stats() { return `sizeof(struct Point) = 8` + (this.badN ? ` · Bad = ${this.badN} B, Good = ${this.goodN} B` : ''); }
  clear() { this.pt = { x: 0, y: 0 }; this.reset(); }
  random() { this.pt = { x: rand(1, 9), y: rand(1, 9) }; this.reset(); }
  reset() { this.q = null; this.pp = null; this.badN = 0; this.goodN = 0; }

  layout() {
    const nodes = [], edges = [];
    const block = (key, s, y, title, addr) => {
      nodes.push({ id: key, kind: 'cell', cls: 'region', x: 60, y, w: 330, h: 70, label: '' });
      nodes.push({ id: key + 't', kind: 'tag', cls: 'alt', x: 60, y: y - 52, label: `${title} · 8 bytes @ ${hex(addr)}` });
      [['x', 0], ['y', 4]].forEach(([f, off], k) => nodes.push({
        id: key + f, kind: 'cell', cls: 'val wide ' + (this.m[key + f] || ''), x: -17 + k * 154, y, w: 140, h: 46,
        label: `${f} = ${s[f]}`, sub: `+${off} · ${hex(addr + off)}`, subDy: 46,
      }));
    };
    block('pt', this.pt, -110, 'struct Point pt', PT_ADDR);
    if (this.q) block('q', this.q, 40, 'struct Point q', Q_ADDR);
    if (this.pp) {
      nodes.push({ id: 'pp', kind: 'cell', cls: 'val ' + (this.m.pp || ''), x: -290, y: -110, w: 110, h: 46, label: hex(PT_ADDR) });
      nodes.push({ id: 'ppt', kind: 'tag', cls: 'alt', x: -290, y: -162, label: 'struct Point *pp' });
      edges.push({ id: 'ppe', from: 'pp', to: this.pp, arrow: true, cls: 'ptr' });
    }
    const bytes = (key, layout, n, y, title) => {
      const x0 = -150;
      nodes.push({ id: key + 't', kind: 'tag', cls: 'alt', x: x0 - 40 - tagWidth(title) / 2, y, label: title });
      for (let i = 0; i < n; i++) {
        const f = layout[i];
        nodes.push({ id: key + i, kind: 'cell', cls: 'byte ' + (f ? 'val ' : 'slot ') + (this.m[key + i] || ''), x: x0 + i * 40, y, w: 36, h: 36, label: f || 'pad', sub: i, subDy: 28 });
      }
      if (n === layout.length) {
        const t = `sizeof = ${n}`;
        nodes.push({ id: key + 's', kind: 'tag', cls: 'ok', x: x0 + n * 40 + tagWidth(t) / 2, y, label: t });
      }
    };
    const top = this.q ? 180 : 60;
    if (this.badN) bytes('B', BAD, this.badN, top, 'struct Bad');
    if (this.goodN) bytes('G', GOOD, this.goodN, top + 80, 'struct Good');
    return { nodes, edges };
  }

  out() {
    App.out(`pt = (${this.pt.x}, ${this.pt.y})` + (this.q ? `   q = (${this.q.x}, ${this.q.y})` : ''));
  }

  async setX(v) {
    this.mark('ptx', 'cmp');
    await this.step(2, `pt.x lives at ${hex(PT_ADDR)} + 0 = ${hex(PT_ADDR)}`);
    this.pt.x = v;
    this.mark('ptx', 'new');
    await this.step(1, `pt.x = ${v}`, 'ok');
    await this.step(3, `pt = (${this.pt.x}, ${this.pt.y})`);
    this.out();
  }

  async arrowY(v) {
    this.pp = 'pt';
    this.mark('pp', 'new');
    await this.step(1, `pp = &pt = ${hex(PT_ADDR)} (the address of the whole struct)`);
    this.mark('pp', 'cur');
    this.pp = 'pty';
    this.mark('pty', 'cmp');
    await this.step(3, `pp->y: follow pp, then add y's offset → ${hex(PT_ADDR)} + 4 = ${hex(PT_ADDR + 4)}`);
    this.pt.y = v;
    this.mark('pty', 'new');
    await this.step(2, `pp->y = ${v}, the same as (*pp).y = ${v}`, 'ok');
    await this.step(4, `pt = (${this.pt.x}, ${this.pt.y})`);
    this.out();
  }

  async copy() {
    this.q = { ...this.pt };
    this.mark('qx', 'new');
    this.mark('qy', 'new');
    await this.step(1, `q = pt copies all 8 bytes: q = (${this.q.x}, ${this.q.y}). q is a separate block.`);
    this.clearMarks();
    this.q.x += 100;
    this.mark('qx', 'new');
    this.mark('ptx', 'found');
    await this.step(2, `q.x = ${this.q.x}, but pt.x is still ${this.pt.x}: structs are copied by value`, 'ok');
    await this.step(3, 'print both');
    this.out();
  }

  async padding() {
    const reveal = async (key, from, to, line, msg, cls = 'new') => {
      for (let i = from; i < to; i++) this.mark(key + i, cls);
      if (key === 'B') this.badN = to; else this.goodN = to;
      await this.step(line, msg);
      for (let i = from; i < to; i++) this.mark(key + i, '');
    };
    this.badN = this.goodN = 0;
    await reveal('B', 0, 1, 1, 'Bad: char a at offset 0 (1 byte)');
    await reveal('B', 1, 4, 1, 'int b needs an offset that is a multiple of 4 → 3 padding bytes', 'del');
    await reveal('B', 4, 8, 1, 'int b at offset 4 (4 bytes)');
    await reveal('B', 8, 9, 1, 'char c at offset 8');
    await reveal('B', 9, 12, 1, 'tail padding: sizeof must be a multiple of 4 so b stays aligned in an array of Bad → 12 bytes', 'del');
    await reveal('G', 0, 4, 2, 'Good: int b first, at offset 0');
    await reveal('G', 4, 6, 2, 'char a at 4, char c at 5: chars need no alignment');
    await reveal('G', 6, 8, 2, 'only 2 tail padding bytes → 8 bytes', 'del');
    await this.step(7, 'Same members, 4 bytes saved: order members from largest to smallest.', 'ok');
    App.out('sizeof(struct Bad) = 12 · sizeof(struct Good) = 8');
  }
}
