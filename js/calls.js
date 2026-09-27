'use strict';

const CALLS_CODE = {
  overview: `// Every function call pushes a STACK FRAME
// holding its parameters and local variables.
// When the function returns, the frame is popped
// and everything in it is gone.
//
// C passes arguments BY VALUE: the callee gets
// copies. To let a function change the caller's
// variables, pass their addresses (pointers).`,
  factorial: `int factorial(int n) {
    if (n <= 1)
        return 1;                 // base case
    return n * factorial(n - 1);  // recursive case
}

int main(void) {
    int r = factorial(value);
    printf("%d\\n", r);
}`,
  swapValue: `void swap(int x, int y) {      // gets COPIES
    int tmp = x;
    x = y;
    y = tmp;
}                              // copies vanish here

int main(void) {
    int a = 1, b = 2;
    swap(a, b);
    printf("%d %d\\n", a, b);   // unchanged!
}`,
  swapPointer: `void swap(int *x, int *y) {    // gets ADDRESSES
    int tmp = *x;
    *x = *y;
    *y = tmp;
}

int main(void) {
    int a = 1, b = 2;
    swap(&a, &b);
    printf("%d %d\\n", a, b);   // swapped!
}`,
};

const ADDR_A = 0xff1c, ADDR_B = 0xff18;

class Calls extends DS {
  constructor() {
    super();
    this.key = 'calls';
    this.name = 'Functions & Stack';
    this.about = 'Each call gets its own frame on the call stack (drawn newest on top). Recursion stacks up one frame per call until the base case, then unwinds as each call returns its result to the one below. The swap demos show why C\'s pass-by-value needs pointers to change the caller\'s variables.';
    this.facts = [['Call', 'push a frame'], ['Return', 'pop the frame'], ['factorial(n) frames', 'n'], ['factorial(n) time', 'O(n)'], ['Arguments', 'passed by value']];
    this.code = CALLS_CODE;
    this.placeholder = 'n (0-8)';
    this.controls = [
      { op: 'factorial', label: 'factorial(n)', arg: 'num', min: 0, max: 8 },
      { sep: true },
      { op: 'swapValue', label: 'swap by value' },
      { op: 'swapPointer', label: 'swap by pointer' },
    ];
    this.random();
  }

  sample() { return rand(3, 6); }
  stats() { return `stack depth: ${this.frames.length} frame${this.frames.length > 1 ? 's' : ''}`; }
  clear() { this.a = 1; this.b = 2; this.mainWith(this.abVars()); }
  random() {
    this.a = rand(1, 99);
    do this.b = rand(1, 99); while (this.b === this.a);
    this.mainWith(this.abVars());
  }
  abVars() { return [{ name: 'a', val: this.a }, { name: 'b', val: this.b }]; }
  mainWith(vars) { this.frames = [{ id: nextId(), label: 'main()', vars, cls: '' }]; }
  finish() {
    for (const f of this.frames) { f.cls = ''; for (const v of f.vars) v.cls = ''; }
  }
  push(label, vars) {
    for (const f of this.frames) f.cls = 'path';
    const f = { id: nextId(), label, vars, cls: 'cur' };
    this.frames.push(f);
    return f;
  }
  v(f, name) { return f.vars.find(o => o.name === name); }

  layout() {
    const nodes = [], edges = [];
    const FW = 580, FH = 56, GAP = 70;
    const main = this.frames[0];
    this.frames.forEach((f, k) => {
      const y = -k * GAP;
      nodes.push({ id: 'f' + f.id, kind: 'cell', cls: 'frame ' + f.cls, x: 0, y, w: FW, h: FH, label: '' });
      nodes.push({ id: 'fh' + f.id, kind: 'tag', cls: 'alt', x: -FW / 2 + 16 + tagWidth(f.label) / 2, y, label: f.label });
      f.vars.forEach((v, j) => {
        nodes.push({ id: `v${f.id}.${v.name}`, kind: 'cell', cls: 'val wide ' + (v.cls || ''), x: -40 + j * 128, y, w: 118, h: 36, label: `${v.name} = ${v.val}` });
        if (v.ptr) edges.push({ from: `v${f.id}.${v.name}`, to: `v${main.id}.${v.ptr}`, arrow: true, cls: 'ptr' });
      });
      if (f.ret !== undefined) {
        const t = `return ${f.ret}`;
        nodes.push({ id: 'r' + f.id, kind: 'tag', cls: 'ok', x: FW / 2 + 16 + tagWidth(t) / 2, y, label: t });
      }
    });
    const g = '↑ each call pushes a new frame on top';
    nodes.push({ id: 'grow', kind: 'tag', cls: 'muted', x: 0, y: -(this.frames.length - 1) * GAP - 50, label: g });
    return { nodes, edges };
  }

  async factorial(n) {
    this.mainWith([{ name: 'r', val: '?' }]);
    this.frames[0].cls = 'cur';
    await this.step(8, `main calls factorial(${n})`);
    const res = await this.fact(n);
    const r = this.v(this.frames[0], 'r');
    r.val = res;
    r.cls = 'found';
    this.frames[0].cls = 'cur';
    await this.step(8, `r = ${res}. The stack is back to just main().`, 'ok');
    await this.step(9, `prints ${res}`);
    App.out(`factorial(${n}) = ${res}`);
  }

  async fact(n) {
    const f = this.push(`factorial(${n})`, [{ name: 'n', val: n, cls: 'new' }]);
    await this.step(1, `call factorial(${n}) → new frame, depth ${this.frames.length - 1}`);
    this.v(f, 'n').cls = 'cmp';
    await this.step(2, `n <= 1 → ${n} <= 1 → ${n <= 1}`);
    if (n <= 1) {
      f.ret = 1;
      await this.step(3, 'base case: return 1 (no more calls)', 'ok');
      this.frames.pop();
      return 1;
    }
    f.cls = 'path';
    this.v(f, 'n').cls = '';
    await this.step(4, `needs factorial(${n - 1}) first, so this frame waits with n = ${n}`);
    const r = await this.fact(n - 1);
    f.cls = 'cur';
    f.ret = n * r;
    await this.step(4, `back in factorial(${n}): ${n} * ${r} = ${f.ret} → return ${f.ret}`, 'ok');
    this.frames.pop();
    return f.ret;
  }

  async swapValue() {
    const a0 = this.a, b0 = this.b;
    this.mainWith(this.abVars());
    const main = this.frames[0];
    main.cls = 'cur';
    await this.step(8, `main: a = ${a0}, b = ${b0}`);
    const f = this.push('swap(a, b)', [{ name: 'x', val: a0, cls: 'new' }, { name: 'y', val: b0, cls: 'new' }]);
    await this.step(9, `call swap(a, b): the new frame gets COPIES, x = ${a0} and y = ${b0}`);
    const [x, y] = f.vars;
    x.cls = y.cls = '';
    f.vars.push({ name: 'tmp', val: a0, cls: 'new' });
    await this.step(2, `tmp = x → ${a0}`);
    f.vars[2].cls = '';
    x.val = b0; x.cls = 'new';
    await this.step(3, `x = y → ${b0}`);
    x.cls = '';
    y.val = a0; y.cls = 'new';
    await this.step(4, `y = tmp → ${a0}. x and y are swapped, but only inside swap()`);
    f.cls = 'del';
    await this.step(5, 'swap returns: its frame (x, y, tmp) is destroyed', 'warn');
    this.frames.pop();
    main.cls = 'cur';
    for (const v of main.vars) v.cls = 'del';
    await this.step(10, `a = ${a0}, b = ${b0}: nothing changed in main. Pass addresses instead.`, 'err');
    App.out(`${a0} ${b0}   (not swapped)`);
  }

  async swapPointer() {
    const a0 = this.a, b0 = this.b;
    this.mainWith(this.abVars());
    const main = this.frames[0];
    main.cls = 'cur';
    await this.step(8, `main: a = ${a0} at ${hex(ADDR_A)}, b = ${b0} at ${hex(ADDR_B)}`);
    const f = this.push('swap(&a, &b)', [
      { name: 'x', val: hex(ADDR_A), ptr: 'a', cls: 'new' },
      { name: 'y', val: hex(ADDR_B), ptr: 'b', cls: 'new' },
    ]);
    await this.step(9, 'call swap(&a, &b): the frame gets the ADDRESSES of a and b');
    const [x, y] = f.vars;
    const a = this.v(main, 'a'), b = this.v(main, 'b');
    x.cls = y.cls = '';
    a.cls = 'cmp';
    f.vars.push({ name: 'tmp', val: a0, cls: 'new' });
    await this.step(2, `tmp = *x → follow x to a → ${a0}`);
    f.vars[2].cls = '';
    a.val = b0; a.cls = 'new'; b.cls = 'cmp';
    await this.step(3, `*x = *y → writes ${b0} into main's a`);
    b.val = a0; b.cls = 'new'; a.cls = '';
    await this.step(4, `*y = tmp → writes ${a0} into main's b`);
    f.cls = 'del';
    await this.step(5, 'swap returns: its frame is destroyed, but the writes went to main\'s memory');
    this.frames.pop();
    main.cls = 'cur';
    a.cls = b.cls = 'found';
    this.a = b0; this.b = a0;
    await this.step(10, `a = ${b0}, b = ${a0}: swapped!`, 'ok');
    App.out(`${b0} ${a0}   (swapped)`);
  }
}
