'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const matches = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(matches, 'index.html must contain a script block');
const bootScript = matches[1];

function makeElement(id) {
  const listeners = {};
  const el = {
    id: id || '',
    dataset: {},
    style: {},
    value: '',
    innerHTML: '',
    textContent: '',
    classList: { add() { }, remove() { } },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    appendChild() { }
  };
  el.click = function () {
    (listeners.click || []).forEach(fn => fn.call(el, { preventDefault() { } }));
  };
  return el;
}

function buildSandbox(storageMap) {
  const ids = [
    'end-day', 'item-title', 'rank-btn', 'ranked-out', 'cheat-out',
    'weekend-out', 'weekend-sched-btn',
    'rp-item', 'rp-listed', 'rp-today', 'rp-behavior', 'rp-btn', 'rp-out',
    'note-cat', 'note-behavior', 'note-text', 'note-save-btn', 'notes-out',
    'rn-name', 'rn-date', 'rn-note', 'rn-add-btn', 'rn-preset-store', 'rn-preset-gtc', 'rn-out',
    'ss-date', 'ss-text', 'ss-kind', 'ss-add-btn', 'ss-out',
    'print-btn', 'sched-prev-btn', 'sched-next-btn', 'sched-clear-btn', 'sched-grid',
    'schedule-weeklabel'
  ];
  const byId = {};
  for (const id of ids) byId[id] = makeElement(id);

  const tabNames = ['panel-hours', 'panel-weekend', 'panel-relist', 'panel-notes', 'panel-renew', 'panel-sunset', 'panel-schedule', 'panel-about'];
  const tabButtons = tabNames.map(t => {
    const b = makeElement();
    b.dataset.tab = t;
    return b;
  });

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    confirm: () => true,
    localStorage: {
      getItem: k => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, v),
      removeItem: k => storageMap.delete(k)
    },
    document: {
      getElementById: id => byId[id] || makeElement(id),
      querySelectorAll: sel => (sel === '#tabs button' ? tabButtons : []),
      createElement: tag => makeElement(),
      body: makeElement('body'),
      addEventListener() { }
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return { sandbox, byId, tabButtons };
}

test('app boots in a bare offline environment with no external calls', () => {
  const storageMap = new Map();
  const { sandbox, byId } = buildSandbox(storageMap);
  assert.doesNotThrow(() => vm.runInContext(bootScript, sandbox), 'boot with empty storage must not throw');

  assert.strictEqual(storageMap.size, 0, 'empty storage is clean');
  assert.strictEqual(storageMap.has('ebt.schedule.v1'), false);
  assert.strictEqual(storageMap.has('ebt.notes.v1'), false);
  assert.strictEqual(storageMap.has('ebt.renewals.v1'), false);
  assert.strictEqual(storageMap.has('ebt.log.v1'), false);
});

test('cheat sheet renders a ranked day table on boot', () => {
  const { sandbox, byId } = buildSandbox(new Map());
  vm.runInContext(bootScript, sandbox);
  assert.ok(byId['cheat-out'].innerHTML.includes('Gold'), 'cheat sheet must show the gold verdict');
  assert.ok(byId['cheat-out'].innerHTML.includes('Sunday'));
});

test('ranking hours produces table with chips and verdicts', () => {
  const { sandbox, byId } = buildSandbox(new Map());
  vm.runInContext(bootScript, sandbox);
  byId['rank-btn'].click();
  const out = byId['ranked-out'].innerHTML;
  assert.ok(out.includes('Sunday'), 'ranked table names the day');
  assert.ok(out.includes('Gold'), 'best slot is verdict Gold');
  assert.ok(out.includes('chip good'), 'reason chips render');
  assert.ok(out.includes('Schedule this'), 'offers scheduling buttons for good slots');
});

test('relist planner end to end with a category note feeding behavior', () => {
  const storageMap = new Map();
  const { sandbox, byId } = buildSandbox(storageMap);
  vm.runInContext(bootScript, sandbox);

  byId['note-cat'].value = 'Vintage cameras';
  byId['note-text'].value = 'Collector crowd - pace it';
  byId['note-save-btn'].click();
  assert.ok(byId['notes-out'].innerHTML.includes('Vintage cameras'));
  assert.strictEqual(storageMap.has('ebt.notes.v1'), true);

  byId['rp-item'].value = 'vintage camera';
  byId['rp-listed'].value = '2026-10-01';
  byId['rp-today'].value = '2026-10-20';
  byId['rp-behavior'].value = 'unsure';
  byId['rp-btn'].click();
  const out = byId['rp-out'].innerHTML;
  assert.ok(out.includes('relist') || out.includes('rotate'), 'plan proposes a relist');
  assert.ok(out.includes('Action:'), 'plain-English action line renders');
  assert.ok(/Collector crowd/.test(out), 'note text surfaces in the plan');
  assert.strictEqual(storageMap.has('ebt.schedule.v1'), false, 'schedule only written when scheduling');
});

test('weekend rhythm button writes schedule items and re-renders grid', () => {
  const storageMap = new Map();
  const { sandbox, byId } = buildSandbox(storageMap);
  vm.runInContext(bootScript, sandbox);
  byId['weekend-sched-btn'].click();
  const grid = byId['sched-grid'].innerHTML;
  assert.ok(grid.includes('Sourcing run'), 'sourcing task on the grid');
  assert.ok(grid.includes('Batch photography'), 'photography task on the grid');
  assert.strictEqual(JSON.parse(storageMap.get('ebt.schedule.v1')).length, 3);
});

test('renewal presets write targets and render countdown nudges', () => {
  const storageMap = new Map();
  const { sandbox, byId } = buildSandbox(storageMap);
  vm.runInContext(bootScript, sandbox);
  byId['rn-preset-gtc'].click();
  const out = byId['rn-out'].innerHTML;
  assert.ok(out.includes('Til-Cancelled'), 'GTC target listed');
  assert.ok(out.includes('days out'), 'countdown renders');
  assert.strictEqual(JSON.parse(storageMap.get('ebt.renewals.v1')).length, 1);
});

test('sunset summary counts entries and stores the log', () => {
  const storageMap = new Map();
  const { sandbox, byId } = buildSandbox(storageMap);
  vm.runInContext(bootScript, sandbox);
  byId['ss-kind'].value = 'unsold';
  byId['ss-text'].value = 'VHS lot';
  byId['ss-add-btn'].click();
  const out = byId['ss-out'].innerHTML;
  assert.ok(out.includes('today in numbers'), 'summary headline');
  assert.ok(out.includes('Relist tomorrow'), 'nudges the relist');
  assert.ok(out.includes('7:00 PM') || out.includes('7&ndash;8 PM'), 'proposes the evening slot');
  assert.strictEqual(JSON.parse(storageMap.get('ebt.log.v1')).length, 1);
});

test('week navigation shifts the label across weeks', () => {
  const { sandbox, byId } = buildSandbox(new Map());
  vm.runInContext(bootScript, sandbox);
  const before = byId['schedule-weeklabel'].textContent;
  byId['sched-next-btn'].click();
  const after = byId['schedule-weeklabel'].textContent;
  assert.ok(after.includes('Coming up'));
  assert.notStrictEqual(before, after);
  byId['sched-prev-btn'].click();
  assert.ok(byId['schedule-weeklabel'].textContent.includes('This week'));
});

test('schedule items persist across a full boot cycle', () => {
  const storageMap = new Map();
  const { sandbox, byId } = buildSandbox(storageMap);
  vm.runInContext(bootScript, sandbox);
  byId['weekend-sched-btn'].click();
  const { byId: fresh, sandbox: sandbox2 } = buildSandbox(storageMap);
  assert.doesNotThrow(() => vm.runInContext(bootScript, sandbox2), 'reboot with saved data must not throw');
  assert.ok(fresh['sched-grid'].innerHTML.includes('Sourcing run'), 'saved items reappear on reboot');
});

test('tab switching wires to every declared panel', () => {
  const { sandbox, tabButtons, byId } = buildSandbox(new Map());
  vm.runInContext(bootScript, sandbox);
  for (const btn of tabButtons) {
    assert.doesNotThrow(() => btn.click());
  }
});
