import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSelection, saveSelection } from '../laylengths.js';

const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v) }; };
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

test('round-trips a selection', () => {
  const s = mem();
  saveSelection(s, new Set(['a|b|c', 'd|e|f']));
  assert.deepEqual([...loadSelection(s)].sort(), ['a|b|c', 'd|e|f']);
});
test('tolerates missing, broken and corrupt storage', () => {
  assert.equal(loadSelection(null).size, 0);
  assert.equal(loadSelection(broken).size, 0);
  const s = mem(); s.setItem('laylengths.selected', '{not json');
  assert.equal(loadSelection(s).size, 0);
  assert.doesNotThrow(() => saveSelection(broken, new Set(['x'])));
});
