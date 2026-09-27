'use strict';

const STR_CODE = {
  overview: `// C has no string type. A string is a char array
// whose end is marked by the null character '\\0'.
//
// char s[10] = "cat";
//   → 'c' 'a' 't' '\\0' '\\0' ... (10 bytes)
//
// Every string function (strlen, strcpy, printf %s)
// walks the chars until it finds '\\0'.
// No '\\0'? It keeps reading past the array.`,
  set: `char s[10] = "...";   // your word
// each char is copied, then '\\0' is added,
// and the rest of the array is zero-filled
printf("%s\\n", s);`,
  strlen: `size_t len = 0;
while (s[len] != '\\0')
    len++;
printf("%zu\\n", len);`,
  upper: `for (int i = 0; s[i] != '\\0'; i++) {
    if (s[i] >= 'a' && s[i] <= 'z')
        s[i] = s[i] - 32;     // 'a' (97) → 'A' (65)
}
printf("%s\\n", s);`,
  reverse: `int i = 0, j = strlen(s) - 1;
while (i < j) {
    char tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
    i++; j--;
}`,
  strcpy: `char d[10];                  // uninitialized: garbage
int i = 0;
while ((d[i] = s[i]) != '\\0')  // copy, then test
    i++;
printf("%s\\n", d);           // '\\0' was copied too`,
};

const SLEN = 10;
const WORDS = ['hello', 'world', 'clang', 'pointer', 'array', 'stack', 'level', 'racecar', 'bytes', 'Code'];
const chr = c => String.fromCharCode(c);

class Strings extends DS {
  constructor() {
    super();
    this.key = 'strings';
    this.name = 'Strings';
    this.about = 'A C string is just a char array ending in \'\\0\' (byte value 0). Characters are small integers (their ASCII codes, shown under each cell), which is why s[i] - 32 turns a lowercase letter into uppercase. The length is not stored anywhere, so strlen has to walk to the terminator. Bytes after the terminator are ignored.';
    this.facts = [['strlen(s)', 'O(n)'], ['s[i]', 'O(1)'], ['Bytes for "cat"', '4 (incl. \\0)'], ['\'a\' - \'A\'', '32'], ['Length stored?', 'no']];
    this.code = STR_CODE;
    this.inputType = 'text';
    this.placeholder = 'word';
    this.controls = [
      { op: 'set', label: 's = "word"', arg: 'text' },
      { sep: true },
      { op: 'strlen', label: 'strlen' },
      { op: 'upper', label: 'toupper' },
      { op: 'reverse', label: 'reverse' },
      { op: 'strcpy', label: 'strcpy(d, s)' },
    ];
    this.random();
  }

  sample() { return WORDS[rand(0, WORDS.length - 1)]; }
  garbage() { return Array(SLEN).fill(null); }
  load(word) {
    this.s = Array(SLEN).fill(0);
    [...word].forEach((c, i) => { this.s[i] = c.charCodeAt(0); });
  }
  clear() { this.s = this.garbage(); this.d = this.garbage(); this.finish(); }
  random() { this.load(this.sample()); this.d = this.garbage(); this.finish(); }
  finish() { this.ptrs = []; this.info = null; }
  len() { const i = this.s.indexOf(0); return i; }
  text(a) { let r = ''; for (const c of a) { if (c === 0 || c === null) break; r += chr(c); } return r; }
  stats() { const n = this.len(); return n < 0 ? 's has no terminator!' : `strlen(s) = ${n} · bytes used: ${n + 1} of ${SLEN}`; }
  cx(i) { return (i - (SLEN - 1) / 2) * 54; }

  layout() {
    const nodes = [], edges = [];
    const row = (key, arr, y, decl) => {
      nodes.push({ id: key + 'lbl', kind: 'tag', cls: 'alt', x: this.cx(0) - 44 - tagWidth(decl) / 2, y, label: decl });
      arr.forEach((c, i) => {
        nodes.push({
          id: key + i, kind: 'cell', cls: (c === null ? 'garbage ' : c === 0 ? 'nul ' : '') + (this.m[key + i] || ''),
          x: this.cx(i), y, w: 48, h: 44, label: c === null ? '?' : c === 0 ? '\\0' : `'${chr(c)}'`,
          sub: c === null ? '' : String(c), subDy: 34,
        });
        nodes.push({ id: key + 'i' + i, kind: 'tag', cls: 'muted', x: this.cx(i), y: y - 38, label: i });
      });
    };
    row('s', this.s, -70, 'char s[10]');
    row('d', this.d, 110, 'char d[10]');
    const at = {};
    for (const p of this.ptrs) (at[p.row + p.i] ||= { ...p, names: [] }).names.push(p.name);
    for (const p of Object.values(at)) {
      const y = (p.row === 's' ? -70 : 110) - 64;
      nodes.push({ id: 'p' + p.row + p.names.join(), kind: 'tag', cls: 'alt', x: this.cx(p.i), y, label: p.names.join(',') + ' ↓' });
    }
    if (this.info) nodes.push({ id: 'info', kind: 'tag', cls: 'ok', x: 0, y: 20, label: this.info });
    return { nodes, edges };
  }

  /** Stops the op when s has no terminator. */
  async needTerminator() {
    if (this.len() >= 0) return true;
    for (let i = 0; i < SLEN; i++) this.mark('s' + i, 'del');
    await this.step(0, 's has no \'\\0\'. Every string function would read past the end of the array: undefined behavior.', 'err');
    App.out('no terminator: undefined behavior');
    return false;
  }

  async set(word) {
    this.s = this.garbage();
    this.ptrs = [];
    await this.step(1, 'char s[10]: 10 bytes reserved');
    for (let i = 0; i < word.length; i++) {
      this.s[i] = word.charCodeAt(i);
      this.clearMarks();
      this.mark('s' + i, 'new');
      await this.step(1, `s[${i}] = '${word[i]}' (${this.s[i]})`);
    }
    this.clearMarks();
    this.s[word.length] = 0;
    this.mark('s' + word.length, 'found');
    await this.step(2, `s[${word.length}] = '\\0': the terminator marks the end`, 'ok');
    for (let i = word.length + 1; i < SLEN; i++) { this.s[i] = 0; this.mark('s' + i, 'path'); }
    await this.step(3, 'the leftover bytes are zero-filled');
    await this.step(4, `prints ${word}`);
    App.out(word);
  }

  async strlen() {
    let n = 0;
    this.ptrs = [{ name: 'len', row: 's', i: 0 }];
    await this.step(1, 'len = 0');
    for (;;) {
      if (n >= SLEN) {
        this.ptrs = [];
        await this.step(2, `len reached ${SLEN} with no '\\0'. strlen would keep reading past the array.`, 'err');
        App.out('no terminator: undefined behavior');
        return;
      }
      const c = this.s[n];
      this.ptrs = [{ name: 'len', row: 's', i: n }];
      const ok = c !== 0;
      this.mark('s' + n, ok ? 'cmp' : 'found');
      await this.step(2, `s[${n}] = ${c === null ? 'garbage' : c === 0 ? "'\\0'" : `'${chr(c)}'`} != '\\0' → ${ok}`);
      if (!ok) break;
      this.mark('s' + n, 'path');
      n++;
      this.info = `len = ${n}`;
      await this.step(3, `len++ → ${n}`);
    }
    this.info = `len = ${n}`;
    await this.step(4, `strlen = ${n} (the '\\0' is not counted)`, 'ok');
    App.out(String(n));
  }

  async upper() {
    if (!await this.needTerminator()) return;
    for (let i = 0; this.s[i] !== 0; i++) {
      const c = this.s[i];
      this.ptrs = [{ name: 'i', row: 's', i }];
      const lower = c >= 97 && c <= 122;
      this.mark('s' + i, 'cmp');
      await this.step(2, `'${chr(c)}' (${c}) is ${lower ? '' : 'not '}between 'a' (97) and 'z' (122)`);
      if (lower) {
        this.s[i] = c - 32;
        this.mark('s' + i, 'new');
        await this.step(3, `${c} - 32 = ${c - 32} → '${chr(c - 32)}'`);
      } else {
        this.mark('s' + i, 'path');
      }
    }
    this.ptrs = [{ name: 'i', row: 's', i: this.len() }];
    await this.step(1, 'reached \'\\0\' → loop ends');
    await this.step(5, `prints ${this.text(this.s)}`, 'ok');
    App.out(this.text(this.s));
  }

  async reverse() {
    if (!await this.needTerminator()) return;
    let i = 0, j = this.len() - 1;
    this.ptrs = [{ name: 'i', row: 's', i }, { name: 'j', row: 's', i: Math.max(j, 0) }];
    await this.step(1, `i = 0, j = strlen(s) - 1 = ${j} (stop before '\\0')`);
    for (;;) {
      const ok = i < j;
      await this.step(2, `i < j → ${i} < ${j} → ${ok}`);
      if (!ok) break;
      const a = this.s[i], b = this.s[j];
      this.mark('s' + i, 'cmp');
      this.mark('s' + j, 'cmp');
      this.info = `tmp = '${chr(a)}'`;
      await this.step(3, `tmp = s[${i}] → '${chr(a)}'`);
      this.s[i] = b;
      this.mark('s' + i, 'new');
      await this.step(4, `s[${i}] = s[${j}] → '${chr(b)}'`);
      this.s[j] = a;
      this.mark('s' + j, 'new');
      await this.step(5, `s[${j}] = tmp → '${chr(a)}'`);
      this.mark('s' + i, 'path');
      this.mark('s' + j, 'path');
      i++; j--;
      this.info = null;
      this.ptrs = [{ name: 'i', row: 's', i }, { name: 'j', row: 's', i: j }];
      await this.step(6, `i++, j-- → i = ${i}, j = ${j}`);
    }
    this.clearMarks();
    await this.step(7, `reversed in place: "${this.text(this.s)}". The '\\0' stayed where it was.`, 'ok');
    App.out(this.text(this.s));
  }

  async strcpy() {
    if (!await this.needTerminator()) return;
    this.d = this.garbage();
    await this.step(1, 'char d[10]: uninitialized, so it holds garbage');
    let i = 0;
    await this.step(2, 'i = 0');
    for (;;) {
      this.ptrs = [{ name: 'i', row: 's', i }, { name: 'i', row: 'd', i }];
      this.d[i] = this.s[i];
      this.mark('s' + i, 'cmp');
      this.mark('d' + i, 'new');
      const done = this.s[i] === 0;
      await this.step(3, `d[${i}] = s[${i}] = ${done ? "'\\0'" : `'${chr(this.s[i])}'`}` + (done ? ' → it was the terminator, stop' : ''));
      this.mark('s' + i, 'path');
      this.mark('d' + i, done ? 'found' : 'path');
      if (done) break;
      i++;
    }
    this.ptrs = [];
    await this.step(5, `d = "${this.text(this.d)}". The bytes after d's '\\0' are still garbage, which is fine.`, 'ok');
    App.out(this.text(this.d));
  }
}
