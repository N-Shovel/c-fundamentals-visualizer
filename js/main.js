'use strict';

App.scene = new Scene($('#svg'));
App.structures = [new Types(), new Flow(), new Calls(), new Arrays(), new Pointers(), new Strings(), new Structs(), new Memory()];

function setBusy(busy) {
  App.busy = busy;
  document.querySelectorAll('[data-lock], #tabs button, #chips button').forEach(el => { el.disabled = busy; });
  if (!busy) $('#next').disabled = true;
}

function readValue(ctl) {
  const inp = $('#val');
  const raw = inp.value.trim();
  if (raw === '') {
    const v = App.ds.sample(ctl);
    inp.value = v;
    return v;
  }
  if (ctl.arg === 'text') {
    if (/^[A-Za-z]{1,9}$/.test(raw)) return raw;
    log('Enter a word of 1 to 9 letters (a-z).', 'err');
    inp.focus();
    return null;
  }
  const v = Number(raw), lo = ctl.min ?? 0, hi = ctl.max ?? 999;
  if (!Number.isInteger(v) || v < lo || v > hi) {
    log(`${ctl.label} needs a whole number from ${lo} to ${hi}.`, 'err');
    inp.focus();
    return null;
  }
  return v;
}

async function runOp(op) {
  if (App.busy) return;
  const ds = App.ds, ctl = ds.controls.find(c => c.op === op);
  let v;
  if (ctl.arg) {
    v = readValue(ctl);
    if (v === null) return;
  }
  setBusy(true);
  ds.clearMarks();
  ds.finish();
  App.out('');
  Code.show(op, ds.code[op]);
  log(`▶ ${ctl.label}` + (v !== undefined ? `   (${ctl.arg === 'text' ? `"${v}"` : v})` : ''), 'op');
  try {
    await ds[op](v);
  } catch (err) {
    console.error(err);
    log('Internal error: ' + err.message, 'err');
  } finally {
    ds.clearMarks();
    ds.finish();
    ds.render();
    setBusy(false);
    if (ctl.arg === 'new') $('#val').value = '';
    $('#val').focus({ preventScroll: true });
  }
}

function select(ds) {
  if (App.busy) return;
  App.ds = ds;
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', b.dataset.key === ds.key);

  const ops = $('#ops');
  ops.textContent = '';
  for (const c of ds.controls) {
    if (c.sep) { const s = document.createElement('span'); s.className = 'sep'; ops.append(s); continue; }
    const b = document.createElement('button');
    b.className = 'btn' + (c.arg ? ' primary' : '');
    b.textContent = c.label;
    b.dataset.lock = '';
    b.addEventListener('click', () => runOp(c.op));
    ops.append(b);
  }
  const inp = $('#val');
  inp.type = ds.inputType || 'number';
  inp.placeholder = ds.placeholder || 'value';
  inp.value = '';
  inp.style.display = ds.controls.some(c => c.arg) ? '' : 'none';
  $('#random').style.display = ds.noRandom ? 'none' : '';

  const chips = $('#chips');
  chips.textContent = '';
  for (const k of Object.keys(ds.code)) {
    const b = document.createElement('button');
    b.textContent = k;
    b.dataset.key = k;
    b.addEventListener('click', () => { if (!App.busy) Code.show(k, ds.code[k]); });
    chips.append(b);
  }
  const first = Object.keys(ds.code)[0];
  Code.show(first, ds.code[first]);

  $('#about-title').textContent = ds.name;
  $('#about').textContent = ds.about;
  $('#cx').innerHTML = '<tbody>' + ds.facts.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('') + '</tbody>';

  $('#log').textContent = '';
  App.out('');
  App.scene.reset();
  ds.clearMarks();
  ds.finish();
  ds.render(0);
  if (location.hash.slice(1) !== ds.key) history.replaceState(null, '', '#' + ds.key);
}

/* ---------- wire up the static controls ---------- */
const tabs = $('#tabs');
App.structures.forEach((ds, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<small>${i + 1}</small>${esc(ds.name)}`;
  b.dataset.key = ds.key;
  b.setAttribute('role', 'tab');
  b.addEventListener('click', () => select(ds));
  tabs.append(b);
});

$('#random').addEventListener('click', () => {
  if (App.busy) return;
  App.ds.random();
  App.ds.clearMarks();
  App.ds.finish();
  App.ds.render();
  App.out('');
  log('Reset with random values');
});
$('#clear').addEventListener('click', () => {
  if (App.busy) return;
  App.ds.clear();
  App.ds.clearMarks();
  App.ds.finish();
  App.ds.render();
  App.out('');
  log('Cleared');
});

/* ---------- light / dark theme ---------- */
function setTheme(t, save) {
  document.documentElement.dataset.theme = t;
  const next = t === 'dark' ? 'light' : 'dark';
  $('#theme').setAttribute('aria-label', `Switch to ${next} mode`);
  $('#theme').title = `Switch to ${next} mode (T)`;
  if (save) { try { localStorage.setItem('cfv-theme', t); } catch {} }
}
const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
setTheme(document.documentElement.dataset.theme || 'dark', false);
$('#theme').addEventListener('click', toggleTheme);
// follow the OS setting until the user picks a theme themselves
matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  let saved = null;
  try { saved = localStorage.getItem('cfv-theme'); } catch {}
  if (!saved) setTheme(e.matches ? 'light' : 'dark', false);
});

const speed = $('#speed');
const applySpeed = () => {
  App.delay = SPEEDS[speed.value - 1];
  $('#speed-out').textContent = (App.delay / 1000).toFixed(App.delay < 1000 ? 2 : 1) + 's';
};
speed.addEventListener('input', applySpeed);
applySpeed();

$('#stepmode').addEventListener('change', e => {
  App.stepMode = e.target.checked;
  if (!App.stepMode) nextStep();
});
$('#next').addEventListener('click', nextStep);

$('#val').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const first = App.ds.controls.find(c => c.arg);
  if (first) runOp(first.op);
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'val') return;
  if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) { toggleTheme(); return; }
  if ((e.key === 'ArrowRight' || e.key === ' ') && App.stepResolve) { e.preventDefault(); nextStep(); }
});

$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(Code.text);
    $('#copy').textContent = 'Copied';
  } catch {
    $('#copy').textContent = 'Failed';
  }
  setTimeout(() => { $('#copy').textContent = 'Copy'; }, 1200);
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => App.ds && App.scene.draw(App.ds.layout(), 0), 100);
});

select(App.structures.find(d => d.key === location.hash.slice(1)) || App.structures[0]);
