'use strict';

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const matches = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(matches, 'index.html must contain a script block');
assert.ok(!/<script[^>]*src=/.test(html), 'index.html must not load external scripts');

const vm = require('node:vm');
const sandbox = {};
vm.runInNewContext(matches[1], sandbox);
const EBT = sandbox.EBT;
assert.ok(EBT, 'script must export EBT');

test('date math helpers', () => {
  assert.strictEqual(EBT.addDaysISO('2026-03-01', 1), '2026-03-02');
  assert.strictEqual(EBT.addDaysISO('2026-03-01', -1), '2026-02-28');
  assert.strictEqual(EBT.addDaysISO('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(EBT.dayIndex('2026-03-01'), 0, '2026-03-01 is a Sunday');
  assert.strictEqual(EBT.dayIndex('2026-03-07'), 6, '2026-03-07 is a Saturday');
  assert.strictEqual(EBT.daysBetween('2026-03-01', '2026-03-08'), 7);
  assert.strictEqual(EBT.daysBetween('2026-03-08', '2026-03-01'), -7);
});

test('nextDayISO finds upcoming day, skipping forward when already on it', () => {
  assert.strictEqual(EBT.nextDayISO('2026-03-04', 0), '2026-03-08');
  assert.strictEqual(EBT.nextDayISO('2026-03-08', 0), '2026-03-15');
  assert.strictEqual(EBT.nextDayISO('2026-03-07', 6), '2026-03-14');
});

test('nextWeekend returns Fri/Sat/Sun trio', () => {
  const we = EBT.nextWeekend('2026-03-04');
  assert.strictEqual(we.saturday, '2026-03-07');
  assert.strictEqual(we.sunday, '2026-03-08');
  assert.strictEqual(we.friday, '2026-03-06');
});

test('mondayOf rolls back to Monday for every weekday', () => {
  assert.strictEqual(EBT.mondayOf('2026-03-02'), '2026-03-02');
  assert.strictEqual(EBT.mondayOf('2026-03-01'), '2026-02-23');
  assert.strictEqual(EBT.mondayOf('2026-03-07'), '2026-03-02');
});

test('scoreEndSlot: Sunday evening is the gold slot', () => {
  const sun7pm = EBT.scoreEndSlot(0, 19);
  assert.ok(sun7pm.score >= 90, 'Sunday 7 PM scores 90+');
  assert.ok(sun7pm.chips.some(c => /Sunday/i.test(c.label)));
  assert.ok(sun7pm.chips.some(c => c.tone === 'good'));
});

test('scoreEndSlot: overnight and garage-sale hours score badly', () => {
  assert.ok(EBT.scoreEndSlot(0, 3).score <= 20);
  assert.ok(EBT.scoreEndSlot(6, 10).score <= 20, 'Saturday 10 AM loses to the flea market');
  assert.ok(EBT.scoreEndSlot(6, 10).chips.some(c => /garage/i.test(c.label)));
});

test('scoreEndSlot: weekday evening beats weekday dawn', () => {
  assert.ok(EBT.scoreEndSlot(2, 20).score > EBT.scoreEndSlot(2, 7).score);
  assert.ok(EBT.scoreEndSlot(3, 19).chips.some(c => /Weeknight/i.test(c.label)));
});

test('scoreEndSlot: is total and stable across the whole week', () => {
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const s = EBT.scoreEndSlot(d, h);
      assert.strictEqual(typeof s.score, 'number');
      assert.ok(s.score >= 0 && s.score <= 100);
      assert.ok(Array.isArray(s.chips) && s.chips.length > 0);
      assert.strictEqual(EBT.scoreEndSlot(d, h).score, s.score);
    }
  }
});

test('verdict bands', () => {
  assert.strictEqual(EBT.verdict(96), 'Gold');
  assert.strictEqual(EBT.verdict(72), 'Good');
  assert.strictEqual(EBT.verdict(52), 'So-so');
  assert.strictEqual(EBT.verdict(15), 'Risky');
});

test('suggestEndSlots sorts descending and labels hours', () => {
  const slots = EBT.suggestEndSlots(0);
  assert.strictEqual(slots.length, 24);
  for (let i = 1; i < slots.length; i++) {
    assert.ok(slots[i - 1].score >= slots[i].score);
  }
  assert.strictEqual(slots[0].hour >= 17 && slots[0].hour <= 21, true);
  assert.ok(/PM|AM/.test(slots[0].text));
});

test('bestSlotsAllDays: Sunday is the best day of the week', () => {
  const best = EBT.bestSlotsAllDays();
  assert.strictEqual(best.length, 7);
  const sunday = best[0];
  assert.strictEqual(sunday.day, 0);
  for (const b of best) assert.ok(sunday.score >= b.score);
});

test('cadencePlan: early fast-category item is told to wait', () => {
  const p = EBT.cadencePlan('2026-10-01', '2026-10-02', 'fast');
  assert.strictEqual(p.action, 'wait');
  assert.strictEqual(p.age, 1);
  assert.strictEqual(p.targetDate, '2026-10-04');
});

test('cadencePlan: fast category past day 7 relists on a Sunday evening slot', () => {
  const p = EBT.cadencePlan('2026-10-01', '2026-10-08', 'fast');
  assert.strictEqual(p.action, 'relist');
  assert.strictEqual(EBT.dayIndex(p.targetDate), 0, 'target lands on a Sunday');
  assert.ok(p.chips.some(c => /Sunday/i.test(c.label)));
});

test('cadencePlan: slow category rotates to a midweek evening', () => {
  const p = EBT.cadencePlan('2026-10-01', '2026-10-10', 'slow');
  assert.strictEqual(p.action, 'relist');
  assert.strictEqual(EBT.dayIndex(p.targetDate), 3, 'rotate to Wednesday');
  assert.ok(p.chips.some(c => /Rotate|midweek/i.test(c.label)));
});

test('cadencePlan: 30-day mark triggers renew-or-retire for every mode', () => {
  for (const behavior of ['fast', 'slow', 'unsure']) {
    const p = EBT.cadencePlan('2026-09-01', '2026-10-31', behavior);
    assert.strictEqual(p.action, 'renew-or-retire', 'behavior ' + behavior);
    assert.strictEqual(p.targetDate, '2026-10-31');
    assert.ok(p.chips.some(c => /Renew|renewal|Best Match|GTC/i.test(c.label)));
  }
});

test('cadencePlan: unsure mode waits a full first run', () => {
  const p = EBT.cadencePlan('2026-10-01', '2026-10-05', 'unsure');
  assert.strictEqual(p.action, 'wait');
  assert.strictEqual(p.targetDate, '2026-10-08');
});

test('cadencePlan: negative age is caught', () => {
  const p = EBT.cadencePlan('2026-10-10', '2026-10-01', 'fast');
  assert.strictEqual(p.action, 'fix-dates');
});

test('nextRelistDate modes land on Sunday vs Wednesday', () => {
  assert.strictEqual(EBT.dayIndex(EBT.nextRelistDate('2026-10-05', 'sunday-evening')), 0);
  assert.strictEqual(EBT.dayIndex(EBT.nextRelistDate('2026-10-05', 'rotate-midweek')), 3);
});

test('renewalNudges: ordered and toned', () => {
  const ns = EBT.renewalNudges([
    { name: 'far', date: '2026-12-01' },
    { name: 'week', date: '2026-10-05' },
    { name: 'today', date: '2026-10-02' },
    { name: 'past', date: '2026-09-25' }
  ], '2026-10-02');
  assert.deepStrictEqual(ns.map(n => n.name), ['past', 'today', 'week', 'far']);
  assert.deepStrictEqual(ns.map(n => n.tone), ['overdue', 'now', 'soon', 'ok']);
});

test('summarizeDay counts only that day and builds a relist nudge', () => {
  const entries = [
    { date: '2026-10-02', kind: 'listed', text: 'lamp' },
    { date: '2026-10-02', kind: 'sold', text: 'camera' },
    { date: '2026-10-02', kind: 'unsold', text: 'VHS lot' },
    { date: '2026-10-01', kind: 'sold', text: 'old sale' }
  ];
  const s = EBT.summarizeDay(entries, '2026-10-02');
  assert.deepStrictEqual({ ...s.counts }, { listed: 1, sold: 1, unsold: 1, sourced: 0, note: 0 });
  assert.ok(s.tomorrow);
  assert.ok(/Relist tomorrow: VHS lot/.test(s.tomorrow.text));
  assert.strictEqual(EBT.dayIndex(s.tomorrow.targetDate), 0);
  const quiet = EBT.summarizeDay(entries, '2026-10-03');
  assert.strictEqual(quiet.tomorrow, null);
});

test('buildWeekSchedule buckets items into the 7 columns', () => {
  const week = EBT.buildWeekSchedule('2026-03-02', [
    { date: '2026-03-08', time: '7:00 PM', text: 'duffel ends' },
    { date: '2026-03-04', time: '9:00 AM', text: 'sourcing run' },
    { date: '2026-03-04', time: '2:00 PM', text: 'photography' }
  ]);
  assert.strictEqual(week.days.length, 7);
  assert.strictEqual(week.days[0].full, 'Monday', 'grid runs Monday through Sunday');
  assert.strictEqual(week.days[6].full, 'Sunday');
  assert.strictEqual(week.days[2].items.length, 2, 'Wednesday bucket');
  assert.strictEqual(week.days[2].items[0].text, 'sourcing run', 'time-sorted chronologically');
  assert.strictEqual(week.days[6].items[0].text, 'duffel ends');
});

test('timeKey sorts times chronologically, untimed entries last', () => {
  assert.strictEqual(EBT.timeKey('12:00 AM'), 0);
  assert.strictEqual(EBT.timeKey('12:00 PM'), 720);
  assert.strictEqual(EBT.timeKey('1:30 PM'), 810);
  assert.ok(EBT.timeKey('8:00 PM') > EBT.timeKey('9:00 AM'));
  assert.ok(EBT.timeKey('8:00 PM') > EBT.timeKey('8:00 AM'));
  assert.ok(EBT.timeKey('') > EBT.timeKey('11:59 PM'), 'untimed renewals land after timed tasks');
  assert.strictEqual(EBT.timeKey('junk'), EBT.timeKey(null));
});

test('behaviorForCategory reads manual notes case-insensitively, with forgiving partial matches', () => {
  const notes = [{ category: 'Video Games', behavior: 'fast', text: 'end Sunday 8 PM' }];
  assert.strictEqual(EBT.behaviorForCategory('video games', notes).behavior, 'fast');
  assert.strictEqual(EBT.behaviorForCategory('VIDEO GAMES', notes).note, 'end Sunday 8 PM');
  assert.strictEqual(EBT.behaviorForCategory('used video games', notes).behavior, 'fast', 'substring match in the typed name');
  assert.strictEqual(EBT.behaviorForCategory('games', notes).behavior, 'fast', 'substring match in the saved category');
  assert.strictEqual(EBT.behaviorForCategory('cameras', notes).behavior, 'unsure');
  assert.strictEqual(EBT.behaviorForCategory('', notes).behavior, 'unsure');
});

test('weekendFlipperWindows produces sourcing and listing scopes', () => {
  const w = EBT.weekendFlipperWindows('2026-03-04');
  assert.match(w.saturday.scope, /Flea market/);
  assert.match(w.sunday.scope, /schedule listings/);
  assert.strictEqual(EBT.dayIndex(w.saturday.date), 6);
  assert.strictEqual(EBT.dayIndex(w.sunday.date), 0);
});
