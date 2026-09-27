'use strict';

const ARR_CODE = {
  overview: `#define N 6
int arr[N];         // N ints, side by side in memory

// arr[i] is defined as *(arr + i)
// &arr[i] == arr + i * sizeof(int) bytes
// sizeof(arr) == N * 4 == 24
// C never checks the index!`,
  access: `int v = arr[i];
// same as *(arr + i)
// address = arr + i * sizeof(int)
printf("%d\\n", v);`,
  pInc: `int *p = arr;       // &arr[0]
p++;                // +1 element = +4 bytes
printf("%d\\n", *p);`,
  sum: `int sum = 0;
for (int i = 0; i < N; i++) {
    sum += arr[i];
}
printf("%d\\n", sum);`,
  max: `int max = arr[0];
for (int i = 1; i < N; i++) {
    if (arr[i] > max)
        max = arr[i];
}
printf("%d\\n", max);`,
  reverse: `int *lo = arr, *hi = arr + N - 1;
while (lo < hi) {
    int tmp = *lo;
    *lo = *hi;
    *hi = tmp;
    lo++; hi--;
}`,
};

const ARR_N = 6, ARR_BASE = 0xfe00;

class Arrays extends DS {
  constructor() {
    super();
    this.key = 'arrays';
    this.name = 'Arrays';
    this.about = 'An array is one block of equal-sized elements with no gaps. The address of element i is base + i × sizeof(element), which is why indexing is constant time and why arr[i] and *(arr + i) mean the same thing. C does no bounds checking: reading past the end quietly returns whatever bytes live there.';
    this.facts = [['Access arr[i]', 'O(1)'], ['Search / sum / max', 'O(n)'], ['Reverse (in place)', 'O(n)'], ['sizeof(arr)', 'N × sizeof(int)'], ['Bounds checking', 'none']];
    this.code = ARR_CODE;
    this.placeholder = 'i (0-7)';
    this.controls = [
      { op: 'access', label: 'arr[i]', arg: 'num', min: 0, max: 7 },
      { sep: true },
      { op: 'pInc', label: 'p++' },
      { op: 'sum', label: 'Sum' },
      { op: 'max', label: 'Max' },
      { op: 'reverse', label: 'Reverse' },
    ];
    this.p = 0;
    this.random();
  }

  sample() { return rand(0, 7); }
  stats() { return `N = ${ARR_N} · sizeof(arr) = ${ARR_N * 4} bytes · p = arr + ${this.p}`; }
  clear() { this.arr = Array.from({ length: ARR_N }, () => ({ id: nextId(), val: 0 })); this.p = 0; this.finish(); }
  random() {
    this.arr = Array.from({ length: ARR_N }, () => ({ id: nextId(), val: rand(1, 99) }));
    this.p = 0;
    this.finish();
  }
  finish() { this.ghost = false; this.ptrs = null; this.info = null; }
  cx(i) { return (i - (ARR_N - 1) / 2) * 88; }

  layout() {
    const nodes = [], edges = [];
    const slots = this.ghost || this.p === ARR_N ? ARR_N + 2 : ARR_N;
    for (let i = 0; i < slots; i++) {
      const oob = i >= ARR_N;
      nodes.push({ id: 's' + i, kind: 'cell', cls: 'slot', x: this.cx(i), y: 0, w: 80, h: 54, sub: hex(ARR_BASE + 4 * i), subDy: -38 });
      nodes.push({ id: 'i' + i, kind: 'tag', cls: oob ? 'bad' : 'muted', x: this.cx(i), y: -64, label: `[${i}]` });
    }
    this.arr.forEach((it, i) => nodes.push({ id: 'v' + it.id, kind: 'cell', cls: 'val ' + (this.m['v' + it.id] || ''), x: this.cx(i), y: 0, w: 66, h: 40, label: it.val }));
    if (this.ghost) {
      this.junk.forEach((j, k) => nodes.push({ id: 'g' + k, kind: 'cell', cls: 'garbage ' + (this.m['g' + k] || ''), x: this.cx(ARR_N + k), y: 0, w: 66, h: 40, label: j }));
    }
    const ptrs = this.ptrs || { p: this.p };
    const byIdx = {};
    for (const [name, i] of Object.entries(ptrs)) (byIdx[i] ||= []).push(name);
    for (const [i, names] of Object.entries(byIdx)) {
      const label = names.length > 1 ? names.join(' = ') : names[0] === 'p' ? `p = ${hex(ARR_BASE + 4 * i)}` : names[0];
      nodes.push({ id: 'ptr' + names.join(), kind: 'tag', cls: 'alt', x: this.cx(+i), y: 96, label });
      edges.push({ id: 'e' + names.join(), from: 'ptr' + names.join(), to: 's' + i, arrow: true, cls: 'ptr' });
    }
    if (this.info) nodes.push({ id: 'info', kind: 'tag', cls: 'ok', x: 0, y: 150, label: this.info });
    return { nodes, edges };
  }

  async access(i) {
    const addr = ARR_BASE + 4 * i;
    if (i >= ARR_N) { this.ghost = true; this.junk = [rand(-30000, 30000), rand(-30000, 30000)]; }
    this.ptrs = { [`arr + ${i}`]: i };
    await this.step(1, `evaluate arr[${i}]`);
    await this.step(3, `address = ${hex(ARR_BASE)} + ${i} × 4 = ${hex(addr)}`);
    if (i >= ARR_N) {
      const g = this.junk[i - ARR_N];
      this.mark('g' + (i - ARR_N), 'del');
      await this.step(1, `arr[${i}] is past the end (valid indexes are 0..${ARR_N - 1}). C doesn't check, so it reads whatever bytes are there: undefined behavior.`, 'err');
      App.out(`${g}   (garbage: out of bounds!)`);
      return;
    }
    const it = this.arr[i];
    this.mark('v' + it.id, 'found');
    await this.step(1, `v = *(arr + ${i}) = ${it.val}`, 'ok');
    await this.step(4, `prints ${it.val}`);
    App.out(String(it.val));
  }

  async pInc() {
    if (this.p >= ARR_N) {
      this.p = 0;
      await this.step(1, 'p was one past the end, so start over: p = arr', 'warn');
    }
    const from = this.p;
    this.p++;
    await this.step(2, `p++ moves by one int: ${hex(ARR_BASE + 4 * from)} → ${hex(ARR_BASE + 4 * this.p)} (+4 bytes, not +1)`);
    if (this.p === ARR_N) {
      await this.step(3, 'p now points one past the end. Holding that address is allowed; reading *p is undefined behavior.', 'err');
      App.out('*p → out of bounds!');
      return;
    }
    const it = this.arr[this.p];
    this.mark('v' + it.id, 'found');
    await this.step(3, `*p = arr[${this.p}] = ${it.val}`, 'ok');
    App.out(String(it.val));
  }

  async sum() {
    let s = 0;
    this.info = 'sum = 0';
    await this.step(1, 'sum = 0');
    for (let i = 0; i < ARR_N; i++) {
      const it = this.arr[i];
      this.ptrs = { i };
      this.mark('v' + it.id, 'cmp');
      await this.step(2, `i = ${i}: ${i} < ${ARR_N} → true`);
      s += it.val;
      this.info = `sum = ${s}`;
      this.mark('v' + it.id, 'path');
      await this.step(3, `sum += arr[${i}] (${it.val}) → ${s}`);
    }
    this.ptrs = {};
    await this.step(2, `i = ${ARR_N}: ${ARR_N} < ${ARR_N} → false, loop ends`);
    await this.step(5, `prints ${s}`, 'ok');
    App.out(`sum = ${s}`);
  }

  async max() {
    let best = this.arr[0];
    this.ptrs = { i: 0 };
    this.mark('v' + best.id, 'found');
    this.info = `max = ${best.val}`;
    await this.step(1, `max = arr[0] = ${best.val}`);
    for (let i = 1; i < ARR_N; i++) {
      const it = this.arr[i];
      this.ptrs = { i };
      this.mark('v' + it.id, 'cmp');
      await this.step(3, `arr[${i}] (${it.val}) > max (${best.val})? ${it.val > best.val}`);
      if (it.val > best.val) {
        this.mark('v' + best.id, 'path');
        best = it;
        this.mark('v' + it.id, 'found');
        this.info = `max = ${best.val}`;
        await this.step(4, `new max = ${best.val}`, 'ok');
      } else {
        this.mark('v' + it.id, 'path');
      }
    }
    this.ptrs = {};
    await this.step(6, `prints ${best.val}`, 'ok');
    App.out(`max = ${best.val}`);
  }

  async reverse() {
    let lo = 0, hi = ARR_N - 1;
    this.ptrs = { lo, hi };
    await this.step(1, `lo = arr (${hex(ARR_BASE)}), hi = arr + ${hi} (${hex(ARR_BASE + 4 * hi)})`);
    for (;;) {
      const ok = lo < hi;
      await this.step(2, `lo < hi → ${hex(ARR_BASE + 4 * lo)} < ${hex(ARR_BASE + 4 * hi)} → ${ok} (pointers compare as addresses)`);
      if (!ok) break;
      const a = this.arr[lo], b = this.arr[hi];
      this.mark('v' + a.id, 'cmp');
      this.mark('v' + b.id, 'cmp');
      this.info = `tmp = ${a.val}`;
      await this.step(3, `tmp = *lo → ${a.val}`);
      this.arr[lo] = b;
      this.arr[hi] = a;
      this.mark('v' + a.id, 'new');
      this.mark('v' + b.id, 'new');
      await this.step(4, `*lo = *hi → ${b.val}`);
      await this.step(5, `*hi = tmp → ${a.val}`);
      this.mark('v' + a.id, 'path');
      this.mark('v' + b.id, 'path');
      lo++; hi--;
      this.ptrs = { lo, hi };
      this.info = null;
      await this.step(6, `lo++, hi-- (each moves 4 bytes)`);
    }
    this.ptrs = {};
    this.clearMarks();
    await this.step(7, 'reversed in place: no second array needed', 'ok');
    App.out(this.arr.map(it => it.val).join(' '));
  }
}
