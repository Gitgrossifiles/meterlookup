import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate, MFR_ORDER } from '../laylengths.js';

const data = JSON.parse(await readFile(new URL('../laylengths.json', import.meta.url), 'utf8'));

test('data file passes validation', () => {
  assert.deepEqual(validate(data), []);
});
test('validate reports a bad manufacturer and a missing length', () => {
  const bad = { updated: '2026-11-20', rows: [
    { mfr: 'Mueller/Hersey', model: 'X', type: 'Turbine', size: '2', lengths: [{ in: 10 }], confidence: 'confirmed' },
    { mfr: 'Sensus', model: 'Y', type: 'Turbine', size: '2', lengths: [], confidence: 'confirmed' },
  ]};
  const errs = validate(bad);
  assert.equal(errs.length, 2);
  assert.match(errs[0], /mfr/);
  assert.match(errs[1], /lengths/);
});
test('every manufacturer in the data is in MFR_ORDER and each has rows', () => {
  const present = new Set(data.rows.map(r => r.mfr));
  for (const m of present) assert.ok(MFR_ORDER.includes(m), m);
  for (const m of MFR_ORDER) assert.ok(present.has(m), `no rows for ${m}`);
});
test('confirmed Sensus rows the user signed off on are present', () => {
  const find = (model, size) => data.rows.find(r => r.mfr === 'Sensus' && r.model === model && r.size === size);
  assert.deepEqual(find('OMNI C2', '2').lengths.map(l => l.in), [15.25]);
  assert.deepEqual(find('OMNI T2', '2').lengths.map(l => l.in).sort(), [10, 17]);
  assert.deepEqual(find('SRH Compound', '6').lengths.map(l => l.in), [24]);
  assert.deepEqual(find('SR / SR II', '2').lengths.map(l => l.in), [17]);
});
test('popular rows exist and every popular row is confirmed', () => {
  const pop = data.rows.filter(r => r.popular);
  assert.ok(pop.length >= 25);
  for (const r of pop) assert.equal(r.confidence, 'confirmed', `${r.mfr} ${r.model} ${r.size}`);
});
