'use strict';

const PTR_CODE = {
  overview: `int x = 10;
int y = 20;
int *p = &x;       // p holds the ADDRESS of x
int **pp = &p;     // pp holds the address of p

// &v   "address of v"
// *p   "the int that p points to"
// a pointer is 8 bytes on a 64-bit machine`,
  pointX: `p = &x;            // store x's address in p
printf("%p\\n", (void *)p);`,
  pointY: `p = &y;            // same pointer, new target
printf("%p\\n", (void *)p);`,
  write: `*p = value;        // follow p, write there
printf("x=%d y=%d\\n", x, y);`,
  read: `int v = *p;        // follow p, read the int
printf("%d\\n", v);`,
  viaPP: `**pp = value;      // pp → p → target
// *pp is p itself; **pp is what p points to
printf("x=%d y=%d\\n", x, y);`,
  setNull: `p = NULL;          // points at nothing
// reading or writing *p now crashes`,
};

const PADDR = { x: 0xff1c, y: 0xff18, p: 0xff10, pp: 0xff08 };
const PPOS = { x: [-170, -80], y: [170, -80], p: [-170, 100], pp: [170, 100] };

class Pointers extends DS {
  constructor() {
    super();
    this.key = 'pointers';
    this.name = 'Pointers';
    this.about = 'A pointer is a variable whose value is an address. & takes the address of a variable, and * follows an address to the value stored there. Changing p changes what it points at; changing *p changes the target itself. A pointer to a pointer (int **) just adds one more hop. NULL means "points nowhere", and dereferencing it crashes.';
    this.facts = [['&x', 'address of x'], ['*p', 'value at p'], ['sizeof(int *)', '8 bytes (64-bit)'], ['**pp', 'two hops'], ['*NULL', 'segfault']];
    this.code = PTR_CODE;
    this.placeholder = 'value';
    this.controls = [
      { op: 'write', label: '*p = v', arg: 'new' },
      { op: 'viaPP', label: '**pp = v', arg: 'new' },
      { sep: true },
      { op: 'read', label: 'read *p' },
      { op: 'pointX', label: 'p = &x' },
      { op: 'pointY', label: 'p = &y' },
      { op: 'setNull', label: 'p = NULL' },
    ];
    this.random();
  }

  stats() { return `p → ${this.target ?? 'NULL'} · pp → p`; }
  clear() { this.x = 10; this.y = 20; this.target = 'x'; }
  random() { this.x = rand(1, 99); this.y = rand(1, 99); this.target = 'x'; }

  layout() {
    const nodes = [], edges = [];
    const t = this.target;
    const cell = (k, label, decl, cls, note) => {
      const [x, y] = PPOS[k], top = y < 0;
      // address sits on the outer side, away from the arrows
      nodes.push({ id: k, kind: 'cell', cls: cls + ' ' + (this.m[k] || ''), x, y, w: 116, h: 48, label, sub: hex(PADDR[k]), subDx: x < 0 ? -94 : 94, subDy: 0 });
      nodes.push({ id: k + 't', kind: 'tag', cls: 'alt', x, y: top ? y - 42 : y + 42, label: decl });
      if (note) nodes.push({ id: k + 'n', kind: 'tag', cls: 'muted', x, y: y + 66, label: note });
    };
    cell('x', this.x, 'int x', '');
    cell('y', this.y, 'int y', '');
    cell('p', t ? hex(PADDR[t]) : 'NULL', 'int *p', 'val', t ? `*p == ${this[t]}` : '*p → crash');
    cell('pp', hex(PADDR.p), 'int **pp', 'val', t ? `**pp == ${this[t]}` : '**pp → crash');
    if (t) edges.push({ from: 'p', to: t, arrow: true, cls: 'ptr' });
    edges.push({ from: 'pp', to: 'p', arrow: true, cls: 'ptr' });
    return { nodes, edges };
  }

  async aim(t, line = 1) {
    this.mark(t, 'cmp');
    await this.step(line, `&${t} = ${hex(PADDR[t])} (where ${t} lives)`);
    this.target = t;
    this.mark('p', 'new');
    await this.step(line, `p = ${hex(PADDR[t])} → p now points to ${t}`, 'ok');
    await this.step(2, `prints ${hex(PADDR[t])}`);
    App.out(`p = ${hex(PADDR[t])} (points to ${t})`);
  }
  pointX() { return this.aim('x'); }
  pointY() { return this.aim('y'); }

  /** Follows p; logs a segfault and returns null if p is NULL. */
  async deref(line) {
    this.mark('p', 'cur');
    if (!this.target) {
      this.mark('p', 'del');
      await this.step(line, 'p is NULL → dereferencing it is a Segmentation fault. The program crashes.', 'err');
      App.out('Segmentation fault (core dumped)');
      return null;
    }
    this.mark(this.target, 'cmp');
    await this.step(line, `p holds ${hex(PADDR[this.target])} → follow the arrow to ${this.target}`);
    return this.target;
  }

  async write(v) {
    const t = await this.deref(1);
    if (!t) return;
    this[t] = v;
    this.mark(t, 'new');
    await this.step(1, `*p = ${v} → writes into ${t}. p itself did not change.`, 'ok');
    await this.step(2, `x = ${this.x}, y = ${this.y}`);
    App.out(`x=${this.x} y=${this.y}`);
  }

  async read() {
    const t = await this.deref(1);
    if (!t) return;
    this.mark(t, 'found');
    await this.step(1, `v = *p = ${this[t]}`, 'ok');
    await this.step(2, `prints ${this[t]}`);
    App.out(String(this[t]));
  }

  async viaPP(v) {
    this.mark('pp', 'cur');
    await this.step(1, `pp holds ${hex(PADDR.p)} → that is p (first hop)`);
    this.mark('p', 'cmp');
    await this.step(2, `*pp is p, which holds ${this.target ? hex(PADDR[this.target]) : 'NULL'}`);
    const t = await this.deref(1);
    if (!t) return;
    this[t] = v;
    this.mark(t, 'new');
    await this.step(1, `**pp = ${v} → writes into ${t} (second hop)`, 'ok');
    await this.step(3, `x = ${this.x}, y = ${this.y}`);
    App.out(`x=${this.x} y=${this.y}`);
  }

  async setNull() {
    this.target = null;
    this.mark('p', 'del');
    await this.step(1, 'p = NULL (address 0). p no longer points at anything.', 'warn');
    await this.step(2, 'Any *p or **pp now would crash. Check p != NULL first.');
    App.out('p = NULL');
  }
}
