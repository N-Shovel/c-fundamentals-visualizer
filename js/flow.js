'use strict';

const FLOW_CODE = {
  overview: `// Control flow decides which line runs next.
//
// for (init; test; update) { body }
//   init once, then: test → body → update → test ...
// while (test) { body }
//   test first; the body may run zero times
// if / else if / else
//   tests top to bottom, runs the FIRST true branch
// switch (x) { case ...: }
//   jumps straight to the matching case`,
  forSum: `int sum = 0;
for (int i = 1; i <= n; i++) {
    sum += i;
}
printf("sum = %d\\n", sum);`,
  whileDigits: `int total = 0;
while (n > 0) {
    total += n % 10;    // last digit
    n = n / 10;         // chop it off
}
printf("digit sum = %d\\n", total);`,
  ifGrade: `char grade;
if (score >= 90)       grade = 'A';
else if (score >= 80)  grade = 'B';
else if (score >= 70)  grade = 'C';
else if (score >= 60)  grade = 'D';
else                   grade = 'F';
printf("%c\\n", grade);`,
  switchDay: `switch (day) {
    case 1:                 // no break: falls through
    case 7:
        puts("Weekend");
        break;
    case 2: case 3: case 4: case 5: case 6:
        puts("Weekday");
        break;
    default:
        puts("Invalid day");
}`,
};

class Flow extends DS {
  constructor() {
    super();
    this.key = 'flow';
    this.name = 'Control Flow';
    this.about = 'Loops repeat a body while a test stays true; branches pick exactly one path. Each run shows the variables changing, the condition being evaluated with real numbers, and a trail of iterations, so you can see exactly why a loop stops or a branch is skipped.';
    this.facts = [['for loop', 'init; test; update'], ['while', 'test before body'], ['if / else if', 'first true wins'], ['switch', 'jump + fall through'], ['break', 'leave loop / switch']];
    this.code = FLOW_CODE;
    this.placeholder = 'n';
    this.noRandom = true;
    this.controls = [
      { op: 'forSum', label: 'for: sum 1..n', arg: 'num', min: 1, max: 10 },
      { op: 'whileDigits', label: 'while: digit sum', arg: 'num', min: 0, max: 99999 },
      { op: 'ifGrade', label: 'if/else: grade', arg: 'num', min: 0, max: 100 },
      { op: 'switchDay', label: 'switch: day', arg: 'num', min: 0, max: 9 },
    ];
    this.clear();
  }

  sample(ctl) {
    return { forSum: rand(3, 6), whileDigits: rand(100, 9999), ifGrade: rand(40, 100), switchDay: rand(1, 8) }[ctl.op];
  }
  clear() { this.vars = []; this.cond = null; this.branches = null; this.trail = []; }
  random() { this.clear(); }
  stats() { return this.trail.length ? `iterations: ${this.trail.length}` : ''; }

  begin(vars) {
    this.clear();
    this.vars = Object.entries(vars).map(([name, val]) => ({ name, val, cls: '' }));
  }
  setVar(name, val, cls = 'new') {
    for (const v of this.vars) {
      if (v.name === name) { v.val = val; v.cls = cls; } else v.cls = '';
    }
  }

  layout() {
    const nodes = [], edges = [];
    const nv = this.vars.length;
    if (!nv) {
      nodes.push({ id: 'empty', kind: 'tag', cls: 'muted', x: 0, y: 0, label: 'Pick a program above. Leave the box empty for a random input.' });
      return { nodes, edges };
    }
    this.vars.forEach((v, k) => nodes.push({
      id: 'v' + v.name, kind: 'cell', cls: 'val ' + v.cls, x: (k - (nv - 1) / 2) * 130, y: -150,
      w: 110, h: 46, label: v.val, sub: v.name, subDy: -36,
    }));
    if (this.cond) nodes.push({ id: 'cond', kind: 'tag', cls: this.cond.cls, x: 0, y: -88, label: this.cond.label });
    if (this.branches) {
      this.branches.forEach((b, k) => nodes.push({ id: 'br' + k, kind: 'cell', cls: 'wide ' + (b.cls || ''), x: 0, y: -34 + k * 46, w: 360, h: 36, label: b.label }));
    } else {
      this.trail.forEach((t, k) => {
        const row = Math.floor(k / 10), col = k % 10;
        nodes.push({ id: 't' + t.id, kind: 'cell', cls: t.cls || '', x: (col - 4.5) * 56, y: -26 + row * 72, w: 48, h: 40, label: t.label, sub: t.sub, subDy: 33 });
      });
    }
    return { nodes, edges };
  }

  async forSum(n) {
    this.begin({ n, i: '—', sum: '?' });
    this.setVar('sum', 0);
    await this.step(1, 'sum = 0');
    this.setVar('i', 1);
    await this.step(2, 'init: i = 1 (runs only once)');
    let sum = 0, i = 1;
    for (; ; i++) {
      const ok = i <= n;
      this.cond = { label: `i <= n  →  ${i} <= ${n}  →  ${ok}`, cls: ok ? 'ok' : 'bad' };
      this.setVar('i', i, 'cmp');
      await this.step(2, `test: ${i} <= ${n} is ${ok}`);
      if (!ok) break;
      sum += i;
      this.setVar('sum', sum);
      for (const t of this.trail) t.cls = '';
      this.trail.push({ id: nextId(), label: `+${i}`, sub: `=${sum}`, cls: 'new' });
      await this.step(3, `body: sum += ${i} → ${sum}`);
      this.setVar('i', i + 1);
      await this.step(2, `update: i++ → ${i + 1}`);
    }
    for (const t of this.trail) t.cls = '';
    this.setVar('i', '—', '');
    this.setVar('sum', sum, 'found');
    await this.step(5, `loop ends (i goes out of scope). sum = ${sum}` + (n > 1 ? `, which is n(n+1)/2 = ${n * (n + 1) / 2}` : ''), 'ok');
    App.out(`sum = ${sum}`);
  }

  async whileDigits(n) {
    this.begin({ n, total: '?' });
    this.setVar('total', 0);
    await this.step(1, 'total = 0');
    let total = 0;
    for (;;) {
      const ok = n > 0;
      this.cond = { label: `n > 0  →  ${n} > 0  →  ${ok}`, cls: ok ? 'ok' : 'bad' };
      this.setVar('n', n, 'cmp');
      await this.step(2, `test: ${n} > 0 is ${ok}` + (!ok && !this.trail.length ? ' — the body never runs' : ''));
      if (!ok) break;
      const d = n % 10;
      total += d;
      this.setVar('total', total);
      for (const t of this.trail) t.cls = '';
      this.trail.push({ id: nextId(), label: d, sub: 'digit', cls: 'new' });
      await this.step(3, `${n} % 10 = ${d} → total = ${total}`);
      n = Math.floor(n / 10);
      this.setVar('n', n);
      await this.step(4, `n / 10 → ${n} (integer division drops the last digit)`);
    }
    for (const t of this.trail) t.cls = '';
    this.setVar('total', total, 'found');
    await this.step(6, `digit sum = ${total}`, 'ok');
    App.out(`digit sum = ${total}`);
  }

  async ifGrade(score) {
    const rows = [[90, 'A'], [80, 'B'], [70, 'C'], [60, 'D'], [null, 'F']];
    this.begin({ score, grade: '?' });
    this.branches = rows.map(([t, g], k) => ({
      label: (t === null ? 'else' : `${k ? 'else if' : 'if'} (score >= ${t})`) + `  grade = '${g}'`, cls: '',
    }));
    await this.step(1, 'char grade; (no value yet)');
    for (let k = 0; k < rows.length; k++) {
      const [t, g] = rows[k];
      const ok = t === null || score >= t;
      this.branches[k].cls = 'cmp';
      this.cond = { label: t === null ? 'else: no test, always taken' : `score >= ${t}  →  ${score} >= ${t}  →  ${ok}`, cls: ok ? 'ok' : 'bad' };
      await this.step(k + 2, t === null ? 'every test failed → else runs' : `test ${score} >= ${t} → ${ok}`);
      if (ok) {
        this.branches[k].cls = 'found';
        for (let j = k + 1; j < rows.length; j++) this.branches[j].cls = 'garbage';
        this.setVar('grade', `'${g}'`);
        await this.step(k + 2, `grade = '${g}'` + (k < rows.length - 1 ? '. The remaining branches are skipped, never tested.' : ''), 'ok');
        break;
      }
      this.branches[k].cls = 'path';
    }
    const g = this.vars[1].val;
    this.setVar('grade', g, 'found');
    await this.step(7, `prints ${g}`);
    App.out(`grade = ${g}`);
  }

  async switchDay(d) {
    this.begin({ day: d });
    this.branches = [
      { label: 'case 1:   (falls through)' },
      { label: 'case 7:   puts("Weekend"); break;' },
      { label: 'case 2..6:   puts("Weekday"); break;' },
      { label: 'default:   puts("Invalid day");' },
    ];
    const k = d === 1 ? 0 : d === 7 ? 1 : d >= 2 && d <= 6 ? 2 : 3;
    this.cond = { label: `switch (${d})  →  jump to ${['case 1', 'case 7', `case ${d}`, 'default'][k]}`, cls: 'ok' };
    this.setVar('day', d, 'cmp');
    await this.step(1, `switch evaluates day once (${d}) and jumps straight to the matching label. No chain of tests.`);
    this.branches[k].cls = 'found';
    let out;
    if (k <= 1) {
      if (k === 0) {
        await this.step(2, 'landed on case 1');
        this.branches[0].cls = 'path';
        this.branches[1].cls = 'found';
        await this.step(3, 'case 1 has no break, so execution falls through into case 7', 'warn');
      } else {
        await this.step(3, 'landed on case 7');
      }
      out = 'Weekend';
      await this.step(4, 'puts("Weekend")');
      await this.step(5, 'break → leave the switch', 'ok');
    } else if (k === 2) {
      await this.step(6, `landed on case ${d}`);
      out = 'Weekday';
      await this.step(7, 'puts("Weekday")');
      await this.step(8, 'break → leave the switch', 'ok');
    } else {
      await this.step(9, `no case matches ${d} → default`);
      out = 'Invalid day';
      await this.step(10, 'puts("Invalid day")', 'ok');
    }
    App.out(out);
  }
}
