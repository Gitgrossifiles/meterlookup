import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeKey, formatInches, formatLengths, rowId, filterRows, printScope, groupByMfr } from '../laylengths.js';

const row = (mfr, model, size, lengths, extra = {}) =>
  ({ mfr, model, type: 'Turbine', size, lengths: lengths.map(n => ({ in: n })), confidence: 'confirmed', ...extra });
const rows = [
  row('Badger', 'Turbo 200', '2', [10, 17]),
  row('Sensus', 'OMNI C2', '10', [41.125]),
  row('Sensus', 'OMNI C2', '2', [15.25], { popular: true }),
  row('Sensus', 'OMNI C2', '1 1/2', [13], { popular: true, notes: 'integral strainer' }),
  row('Hersey', 'FM3 w/ bypass', '6x2', [45]),
];

test('sizeKey orders fractional, whole and combo sizes', () => {
  assert.equal(sizeKey('1 1/2'), 1.5);
  assert.ok(sizeKey('8') < sizeKey('10'));
  assert.ok(sizeKey('6') < sizeKey('6x2') && sizeKey('6x2') < sizeKey('8'));
  assert.ok(sizeKey('4x1') < sizeKey('4x1 1/2'));
});
test('formatInches uses fractions only for exact 32nds', () => {
  assert.equal(formatInches(15.25), '15 1/4');
  assert.equal(formatInches(30.125), '30 1/8');
  assert.equal(formatInches(19.6875), '19 11/16');
  assert.equal(formatInches(13), '13');
  assert.equal(formatInches(19.7), '19.7');
  assert.equal(formatInches(7.9), '7.9');
});
test('formatLengths joins alternates with notes', () => {
  assert.equal(formatLengths([{ in: 17, note: 'w/ strainer' }, { in: 10, note: 'no strainer' }]), '17 (w/ strainer) / 10 (no strainer)');
});
test('rowId is mfr|model|size', () => {
  assert.equal(rowId(rows[2]), 'Sensus|OMNI C2|2');
});
test('filterRows sorts by manufacturer order, model, then numeric size', () => {
  assert.deepEqual(filterRows(rows, {}).map(r => `${r.mfr} ${r.size}`),
    ['Sensus 1 1/2', 'Sensus 2', 'Sensus 10', 'Badger 2', 'Hersey 6x2']);
});
test('filterRows applies mfr, size, popularOnly and plain-text query', () => {
  assert.equal(filterRows(rows, { mfr: 'Sensus', size: '2' }).length, 1);
  assert.equal(filterRows(rows, { popularOnly: true }).length, 2);
  assert.equal(filterRows(rows, { query: '1/2' }).length, 1);
  assert.equal(filterRows(rows, { query: 'C2+' }).length, 0);
  assert.equal(filterRows(rows, { query: '15 1/4' }).length, 1);
  assert.equal(filterRows(rows, { query: 'strainer' }).length, 1);
});
test('printScope prefers selection, then popular, then all, and names the manufacturer', () => {
  const visible = filterRows(rows, { mfr: 'Sensus' });
  assert.deepEqual(printScope(visible, new Set(['Sensus|OMNI C2|2']), { mfr: 'Sensus' }),
    { rows: [rows[2]], label: 'Selected meters · Sensus' });
  assert.equal(printScope(visible, new Set(), { mfr: 'Sensus', popularOnly: true }).label, 'Popular meters · Sensus');
  assert.equal(printScope(visible, new Set(), {}).label, 'All meters');
  assert.equal(printScope(visible, new Set(['Badger|Turbo 200|2']), {}).label, 'All meters');
});
test('groupByMfr follows MFR_ORDER and skips empty manufacturers', () => {
  assert.deepEqual(groupByMfr(filterRows(rows, {})).map(([m, rs]) => [m, rs.length]),
    [['Sensus', 3], ['Badger', 1], ['Hersey', 1]]);
});
