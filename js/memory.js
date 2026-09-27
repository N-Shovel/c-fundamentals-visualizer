'use strict';

const MEM_CODE = {
  overview: `#include <stdlib.h>

// STACK: locals, gone when the function returns
// HEAP:  malloc'd blocks, live until you free()
//
// int *p = malloc(n * sizeof(int));
// ... use p[0] .. p[n-1] ...
// free(p);
// p = NULL;
//
// Forget free → leak. Use after free → undefined.`,
  malloc: `int *p = malloc(n * sizeof(int));
if (p == NULL) return 1;       // out of memory
// malloc does not clear the block
for (int i = 0; i < n; i++)
    p[i] = i * 10;`,
  free: `free(p);        // give the block back to the heap
// p still holds the old address: "dangling"`,
  setNull: `p = NULL;       // p no longer points anywhere
// free(NULL) is safe; *NULL crashes`,
  read: `if (p != NULL)
    printf("%d\\n", p[0]);   // read the first int`,
  realloc: `int *tmp = realloc(p, (n + 2) * sizeof(int));
if (tmp != NULL)
    p = tmp;          // the block may have MOVED
// old contents copied, old block released`,
};

const HEAP_BASE = 0x5a00, P_ADDR = 0xff10, MAX_CELLS = 8, MAX_BLOCKS = 4;

class Memory extends DS {
  constructor() {
    super();
    this.key = 'memory';
    this.name = 'Dynamic Memory';
    this.about = 'Local variables live on the stack and disappear when their function returns. malloc hands out blocks from the heap that live until you call free. The pointer on the stack is the only way to reach a heap block: overwrite it and the block leaks. Free the block but keep using the pointer and you get a dangling pointer (use-after-free).';
    this.facts = [['malloc(n)', 'n bytes, uninitialized'], ['calloc(n, s)', 'zero-filled'], ['free(p)', 'release block'], ['realloc(p, n)', 'resize, may move'], ['Forgot free', 'memory leak']];
    this.code = MEM_CODE;
    this.placeholder = 'n (1-6)';
    this.controls = [
      { op: 'malloc', label: 'p = malloc(n)', arg: 'num', min: 1, max: 6 },
      { sep: true },
      { op: 'read', label: 'read p[0]' },
      { op: 'realloc', label: 'realloc +2' },
      { op: 'free', label: 'free(p)' },
      { op: 'setNull', label: 'p = NULL' },
    ];
    this.random();
  }

  sample() { return rand(2, 5); }
  clear() { this.blocks = []; this.p = null; this.top = HEAP_BASE; }
  random() {
    this.clear();
    const b = this.alloc(3);
    b.vals = [0, 10, 20];
    this.p = b.id;
  }
  stats() {
    const bytes = st => this.blocks.filter(b => b.state === st).reduce((s, b) => s + b.n * 4, 0);
    return `heap in use: ${bytes('live') + bytes('leaked')} B · leaked: ${bytes('leaked')} B`;
  }
  target() { return this.blocks.find(b => b.id === this.p) || null; }
  finish() {
    // freed blocks disappear once nothing points at them
    this.blocks = this.blocks.filter(b => b.state !== 'freed' || b.id === this.p);
    for (const b of this.blocks) b.cls = '';
  }
  alloc(n) {
    const b = { id: nextId(), addr: this.top, n, vals: Array(n).fill(null), state: 'live', cls: 'new' };
    this.top += Math.ceil((n * 4 + 16) / 16) * 16; // payload + allocator header, 16-byte aligned
    this.blocks.push(b);
    while (this.blocks.length > MAX_BLOCKS) {
      const i = this.blocks.findIndex(o => o.id !== this.p && o !== b);
      log(`(older block at ${hex(this.blocks[i].addr)} hidden to save space)`, 'warn');
      this.blocks.splice(i, 1);
    }
    return b;
  }

  layout() {
    const nodes = [], edges = [];
    const ROW = 104, HX = -150, HW = 600, HC = HX + HW / 2 - 60;
    const rows = Math.max(this.blocks.length, 1);
    const hh = Math.max(220, rows * ROW + 40);
    nodes.push({ id: 'stk', kind: 'cell', cls: 'region', x: -340, y: 0, w: 190, h: 220, label: '' });
    nodes.push({ id: 'heap', kind: 'cell', cls: 'region', x: HC, y: 0, w: HW, h: hh, label: '' });
    nodes.push({ id: 'stkT', kind: 'tag', cls: 'muted', x: -340, y: -128, label: 'STACK' });
    nodes.push({ id: 'heapT', kind: 'tag', cls: 'muted', x: HC, y: -hh / 2 - 18, label: 'HEAP' });

    const t = this.target();
    nodes.push({ id: 'p', kind: 'cell', cls: 'val ' + (this.m.p || ''), x: -340, y: 0, w: 130, h: 48, label: this.p ? hex(t.addr) : 'NULL', sub: hex(P_ADDR), subDy: 38 });
    nodes.push({ id: 'pT', kind: 'tag', cls: 'alt', x: -340, y: -44, label: 'int *p' });

    const y0 = -((this.blocks.length - 1) * ROW) / 2 + 10;
    this.blocks.forEach((b, k) => {
      const y = y0 + k * ROW;
      const status = { live: ['ok', 'allocated'], freed: ['bad', 'FREED'], leaked: ['bad', 'LEAKED: no pointer left'] }[b.state];
      const t2 = `${hex(b.addr)} · ${b.n * 4} bytes · ${status[1]}`;
      nodes.push({ id: 'bt' + b.id, kind: 'tag', cls: status[0], x: HX + tagWidth(t2) / 2 - 10, y: y - 34, label: t2 });
      b.vals.forEach((v, i) => nodes.push({
        id: `b${b.id}.${i}`, kind: 'cell',
        cls: (b.state === 'live' ? (v === null ? 'garbage ' : 'val ') : b.state === 'freed' ? 'garbage ' : 'del ') + (this.m[`b${b.id}.${i}`] || b.cls || ''),
        x: HX + 14 + i * 54, y: y + 8, w: 48, h: 38, label: v === null || b.state === 'freed' ? '?' : v, sub: `[${i}]`, subDy: 30,
      }));
    });
    if (t) edges.push({ id: 'pe', from: 'p', to: `b${t.id}.0`, arrow: true, cls: 'ptr' });
    return { nodes, edges };
  }

  async malloc(n) {
    const old = this.target();
    const b = this.alloc(n);
    await this.step(1, `malloc(${n} * 4) asks the heap for ${n * 4} bytes → gets a block at ${hex(b.addr)}`);
    this.p = b.id;
    this.mark('p', 'new');
    if (old && old.state === 'live') {
      old.state = 'leaked';
      await this.step(1, `p is overwritten, so the old block at ${hex(old.addr)} has no pointer left. It can never be freed: memory leak! (free(p) should come first)`, 'err');
    } else {
      await this.step(1, `p = ${hex(b.addr)}`, 'ok');
    }
    await this.step(2, 'p != NULL → the allocation succeeded');
    b.cls = '';
    await this.step(3, 'the block holds garbage until written (calloc would zero it)');
    for (let i = 0; i < n; i++) {
      b.vals[i] = i * 10;
      this.mark(`b${b.id}.${i}`, 'new');
      await this.step(5, `p[${i}] = ${i * 10}  (address ${hex(b.addr + 4 * i)})`);
      this.mark(`b${b.id}.${i}`, '');
    }
    App.out(`p → ${hex(b.addr)} [${b.vals.join(', ')}]`);
  }

  async free() {
    const b = this.target();
    if (!b) {
      await this.step(1, 'free(NULL) does nothing. It is always safe.', 'warn');
      App.out('free(NULL): no-op');
      return;
    }
    if (b.state === 'freed') {
      b.cls = 'del';
      await this.step(1, 'Double free! This block was already freed. Undefined behavior, often a crash or heap corruption.', 'err');
      App.out('double free detected');
      return;
    }
    b.state = 'freed';
    b.cls = 'del';
    await this.step(1, `the ${b.n * 4} bytes at ${hex(b.addr)} go back to the heap`, 'ok');
    this.mark('p', 'cmp');
    await this.step(2, `p still holds ${hex(b.addr)}: a dangling pointer. Set it to NULL.`, 'warn');
    App.out(`freed ${b.n * 4} bytes`);
  }

  async setNull() {
    const b = this.target();
    this.p = null;
    this.mark('p', 'new');
    if (b && b.state === 'live') {
      b.state = 'leaked';
      await this.step(1, `p = NULL, but the block at ${hex(b.addr)} was never freed. Nothing points to it now: memory leak!`, 'err');
      App.out('leaked ' + b.n * 4 + ' bytes');
      return;
    }
    await this.step(1, 'p = NULL. Any mistaken use of p now fails loudly instead of silently.', 'ok');
    App.out('p = NULL');
  }

  async read() {
    const b = this.target();
    this.mark('p', 'cmp');
    await this.step(1, `p != NULL → ${!!b}`);
    if (!b) {
      await this.step(1, 'p is NULL, so the read is skipped', 'warn');
      App.out('(nothing printed)');
      return;
    }
    this.mark(`b${b.id}.0`, b.state === 'live' ? 'found' : 'del');
    if (b.state !== 'live') {
      await this.step(2, `the check passes, yet the block at ${hex(b.addr)} was ${b.state === 'freed' ? 'freed' : 'lost'}. Use-after-free: undefined behavior. The memory may already belong to someone else.`, 'err');
      App.out(`${rand(-99999, 99999)}   (garbage: use after free!)`);
      return;
    }
    const v = b.vals[0];
    await this.step(2, v === null ? 'p[0] was never written: reading garbage' : `p[0] = ${v}`, v === null ? 'warn' : 'ok');
    App.out(v === null ? `${rand(-99999, 99999)} (garbage)` : String(v));
  }

  async realloc() {
    const old = this.target();
    if (!old || old.state !== 'live') {
      this.mark('p', 'del');
      await this.step(1, old ? 'p points to a freed block: realloc on it is undefined behavior' : 'p is NULL: realloc(NULL, size) acts like malloc. Try malloc first.', old ? 'err' : 'warn');
      App.out(old ? 'undefined behavior' : 'nothing to resize');
      return;
    }
    if (old.n + 2 > MAX_CELLS) {
      await this.step(1, `the block already holds ${old.n} ints. That's enough for this demo (max ${MAX_CELLS}).`, 'warn');
      return;
    }
    const b = this.alloc(old.n + 2);
    await this.step(1, `no free space right after ${hex(old.addr)}, so realloc finds a new ${b.n * 4}-byte block at ${hex(b.addr)}`);
    for (let i = 0; i < old.n; i++) {
      b.vals[i] = old.vals[i];
      this.mark(`b${old.id}.${i}`, 'cmp');
      this.mark(`b${b.id}.${i}`, 'new');
    }
    b.cls = '';
    await this.step(1, `copies the old ${old.n} ints across; the 2 new slots are garbage`);
    old.state = 'freed';
    old.cls = 'del';
    await this.step(1, `releases the old block at ${hex(old.addr)}`);
    this.p = b.id;
    this.mark('p', 'new');
    await this.step(3, `p = tmp = ${hex(b.addr)}. Any other pointer to the old block is now dangling.`, 'ok');
    App.out(`p → ${hex(b.addr)} (${b.n} ints)`);
  }
}
