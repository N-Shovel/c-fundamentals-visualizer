'use strict';

const TYPES_CODE = {
  overview: `// A variable is a named block of bytes.
// Its TYPE decides how many bytes it takes
// and how those bytes are interpreted.
//
//  type     sizeof   holds
//  char     1        -128 .. 127
//  int      4        -2147483648 .. 2147483647
//  double   8        ~15 significant digits
//
// x86 and ARM are little-endian:
// the lowest byte sits at the lowest address.`,
  int: `int x;                     // reserve 4 bytes
x = value;                 // store it, lowest byte first
printf("%d\\n", x);
printf("%zu\\n", sizeof(x));  // 4`,
  char: `char c;                    // reserve 1 byte
c = value;                 // only 8 bits: -128..127
printf("%d '%c'\\n", c, c);
printf("%zu\\n", sizeof(c));  // 1`,
  double: `double d;                  // reserve 8 bytes
d = value / 3.0;           // 3.0 forces floating point
printf("%f\\n", d);
printf("%zu\\n", sizeof(d));  // 8`,
  overflow: `int big = INT_MAX;         // 2147483647
big = big + 1;             // signed overflow: undefined!
printf("%d\\n", big);       // typically -2147483648`,
  division: `int a = 7, b = 2;
int q = a / b;             // int / int → 3 (truncated)
int r = a % b;             // remainder → 1
double f = (double)a / b;  // cast first → 3.5`,
};

const SIZES = { char: 1, int: 4, double: 8 };

/* The bytes a value really occupies, lowest address first. */
function bytesOf(type, v) {
  const dv = new DataView(new ArrayBuffer(8));
  if (type === 'char') dv.setInt8(0, v);
  else if (type === 'int') dv.setInt32(0, v, true);
  else dv.setFloat64(0, v, true);
  return Array.from({ length: SIZES[type] }, (_, i) => dv.getUint8(i).toString(16).padStart(2, '0'));
}
const charShow = c => (c >= 32 && c <= 126 ? `'${String.fromCharCode(c)}'` : String(c));

class Types extends DS {
  constructor() {
    super();
    this.key = 'types';
    this.name = 'Variables & Types';
    this.about = 'Every variable is a block of bytes at some address. The type fixes the size (sizeof) and how the bits are read: as a two\'s-complement integer, a character code, or an IEEE-754 floating-point number. Watch the actual bytes appear as values are stored, and see what happens when a value does not fit.';
    this.facts = [['sizeof(char)', '1 byte'], ['sizeof(int)', '4 bytes (typical)'], ['sizeof(double)', '8 bytes'], ['Byte order (x86 / ARM)', 'little-endian'], ['int / int', 'truncates']];
    this.code = TYPES_CODE;
    this.placeholder = 'value';
    this.controls = [
      { op: 'int', label: 'int x = v', arg: 'new' },
      { op: 'char', label: 'char c = v', arg: 'new' },
      { op: 'double', label: 'double d = v / 3.0', arg: 'new' },
      { sep: true },
      { op: 'overflow', label: 'Int overflow' },
      { op: 'division', label: 'Division & casts' },
    ];
    this.random();
  }

  clear() { this.vars = []; this.sp = 0xff00; }
  stats() { return `variables: ${this.vars.length} · bytes used: ${this.vars.reduce((s, v) => s + v.size, 0)}`; }
  finish() { for (const v of this.vars) v.cls = ''; }
  sample(ctl) { return ctl.op === 'char' ? rand(65, 122) : rand(1, 999); }

  random() {
    this.clear();
    this.set(this.declare('int', 'x'), rand(1, 999));
    const k = rand(65, 90);
    this.set(this.declare('char', 'c'), k, charShow(k));
    const n = rand(1, 99);
    this.set(this.declare('double', 'd'), n / 3, (n / 3).toFixed(6));
    this.finish();
  }

  /** Reserve (or reuse) a stack slot, aligned to its own size like a real compiler. */
  declare(type, name) {
    let v = this.vars.find(o => o.name === name);
    if (!v) {
      const size = SIZES[type];
      this.sp = (this.sp - size) & ~(size - 1);
      v = { id: nextId(), type, name, size, addr: this.sp };
      this.vars.push(v);
    }
    v.bytes = null;
    v.shown = undefined;
    v.cls = 'cmp';
    return v;
  }
  set(v, value, shown) { v.bytes = bytesOf(v.type, value); v.shown = shown ?? value; }

  layout() {
    const nodes = [], edges = [];
    const ROW = 58, BX = -40, BW = 44;
    const y0 = -((this.vars.length - 1) * ROW) / 2;
    if (!this.vars.length) {
      nodes.push({ id: 'empty', kind: 'tag', cls: 'muted', x: 0, y: 0, label: 'No variables yet. Declare one with the buttons above.' });
      return { nodes, edges };
    }
    const hdr = 'bytes in memory, lowest address first →';
    nodes.push({ id: 'hdr', kind: 'tag', cls: 'muted', x: BX - BW / 2 + tagWidth(hdr) / 2, y: y0 - 46, label: hdr });
    this.vars.forEach((v, r) => {
      const y = y0 + r * ROW;
      const decl = `${v.type} ${v.name}` + (v.shown !== undefined ? ` = ${v.shown}` : ';');
      nodes.push({ id: 'd' + v.id, kind: 'tag', cls: 'alt', x: BX - BW / 2 - 16 - tagWidth(decl) / 2, y, label: decl });
      for (let i = 0; i < v.size; i++) {
        nodes.push({
          id: `b${v.id}.${i}`, kind: 'cell', cls: 'byte ' + (v.bytes ? '' : 'garbage ') + (v.cls || ''),
          x: BX + i * (BW + 4), y, w: BW, h: 34, label: v.bytes ? v.bytes[i] : '??',
          sub: i === 0 ? hex(v.addr) : '', subDy: 27,
        });
      }
      const sz = `${v.size} B`;
      nodes.push({ id: 's' + v.id, kind: 'tag', cls: 'muted', x: BX + v.size * (BW + 4) - BW / 2 + 8 + tagWidth(sz) / 2, y, label: sz });
    });
    return { nodes, edges };
  }

  async int(v) {
    const x = this.declare('int', 'x');
    await this.step(1, `int x; → 4 bytes reserved at ${hex(x.addr)}. Until assigned they hold garbage.`);
    this.set(x, v);
    x.cls = 'new';
    await this.step(2, `x = ${v} = 0x${(v >>> 0).toString(16).padStart(8, '0')} → stored as ${x.bytes.join(' ')} (lowest byte first)`, 'ok');
    x.cls = 'found';
    await this.step(3, `printf("%d") reads the 4 bytes back → ${v}`);
    await this.step(4, 'sizeof(x) = 4');
    App.out(`x = ${v} · sizeof(x) = 4`);
  }

  async char(v) {
    const c = this.declare('char', 'c');
    await this.step(1, `char c; → 1 byte reserved at ${hex(c.addr)}`);
    const s = (v << 24) >> 24; // what a signed 8-bit char keeps
    this.set(c, v, charShow(s));
    if (s !== v) {
      c.cls = 'del';
      await this.step(2, `${v} needs more than 8 bits. Only the low byte 0x${c.bytes[0]} is kept, and as a signed char it reads back as ${s}.`, 'err');
    } else {
      c.cls = 'new';
      await this.step(2, `c = ${v} → byte 0x${c.bytes[0]}` + (s >= 32 && s <= 126 ? `, the ASCII code of ${charShow(s)}` : ''), 'ok');
    }
    c.cls = 'found';
    await this.step(3, `%d prints the number, %c prints the character with that code`);
    await this.step(4, 'sizeof(c) = 1');
    App.out(`${s}` + (s >= 32 && s <= 126 ? ` ${charShow(s)}` : '') + ' · sizeof(c) = 1');
  }

  async double(v) {
    const d = this.declare('double', 'd');
    await this.step(1, `double d; → 8 bytes reserved at ${hex(d.addr)}`);
    const val = v / 3;
    this.set(d, val, val.toFixed(6));
    d.cls = 'new';
    await this.step(2, `${v} / 3.0 = ${val} → stored as IEEE-754: 1 sign bit, 11 exponent bits, 52 fraction bits`, 'ok');
    if (v % 3) log('Thirds have no exact binary form, so the fraction is rounded to the nearest representable value.', 'warn');
    d.cls = 'found';
    await this.step(3, `%f prints 6 decimals → ${val.toFixed(6)}`);
    await this.step(4, 'sizeof(d) = 8');
    App.out(`d = ${val.toFixed(6)} · sizeof(d) = 8`);
  }

  async overflow() {
    const b = this.declare('int', 'big');
    this.set(b, 2147483647);
    b.cls = 'new';
    await this.step(1, 'big = INT_MAX = 2147483647 = 0x7fffffff → bytes ff ff ff 7f');
    this.set(b, -2147483648);
    b.cls = 'del';
    await this.step(2, 'big + 1 = 0x80000000: the top (sign) bit flips on. Signed overflow is undefined behavior in C; in practice it usually wraps.', 'err');
    b.cls = 'found';
    await this.step(3, 'Read as two\'s complement, 0x80000000 is -2147483648');
    App.out('-2147483648');
  }

  async division() {
    const a = this.declare('int', 'a'), b = this.declare('int', 'b');
    this.set(a, 7);
    this.set(b, 2);
    a.cls = b.cls = 'new';
    await this.step(1, 'a = 7, b = 2');
    a.cls = b.cls = 'cmp';
    const q = this.declare('int', 'q');
    this.set(q, 3);
    q.cls = 'found';
    await this.step(2, 'Both operands are int, so this is integer division: 7 / 2 = 3. The .5 is thrown away, not rounded.');
    q.cls = '';
    const r = this.declare('int', 'r');
    this.set(r, 1);
    r.cls = 'found';
    await this.step(3, '7 % 2 = 1 (the remainder)');
    r.cls = '';
    const f = this.declare('double', 'f');
    this.set(f, 3.5, '3.500000');
    f.cls = 'found';
    await this.step(4, '(double)a turns 7 into 7.0 first, so the division is floating point: 7.0 / 2 = 3.5', 'ok');
    App.out('q = 3 · r = 1 · f = 3.500000');
  }
}
