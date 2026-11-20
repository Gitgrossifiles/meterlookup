# Lay Length Quick Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a filterable, printable, offline-capable flanged lay-length reference page to the meterlookup GitHub Pages site.

**Architecture:** One static page (`laylengths.html`) loads `laylengths.json` and renders a table grouped by manufacturer. All data-shaping logic lives in `laylengths.js`, an ES module shared by the browser and the Node test runner. A network-first service worker (`sw.js`) caches the page and data for offline reuse.

**Tech Stack:** Plain HTML/CSS/JS (ES modules), JSON data, Node 24 `node --test` for tests, GitHub Pages hosting. No build step, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-20-lay-length-reference-design.md` (data: `docs/superpowers/specs/2026-11-20-lay-length-data-review.md`)

## Global Constraints

- Flanged lay lengths only; sizes 1 1/2" and up; lengths in inches.
- Manufacturer label is exactly one of: `Sensus`, `Badger`, `Neptune`, `Hersey`, `Master Meter`, `Metron-Farnier`, `Zenner`, `Elster/Kent`. Rockwell/Invensys rows go under `Sensus`; "Mueller/Hersey" is never written, only `Hersey`.
- Models with no found lay length are omitted (SRM, 125W, Trident Turbine, MHR, MHD, Recordall II Turbo, Metron S260/S440/S550, Elster C4000/H3000).
- Same visual language as `index.html` (system font, `#f7f7f9` page, white `.card`, pill `.nav` links, `#2b6ef2` accent).
- Must render at iPad portrait width (768px) and print on US Letter.
- No external scripts or fonts; works from `https://gitgrossifiles.github.io/meterlookup/laylengths.html`.
- Commit after each task; `git push` only in the final task.

## Review Focus

1. Decimal lengths such as 19.7 or 7.9 must print as decimals, never as a wrong fraction (Task 2 `formatInches`).
2. Sizes must order numerically: `1 1/2` before `2`, `8` before `10`, `6x2` with the 6" group (Task 2 `sizeKey`).
3. A search for `1/2`, `"`, or `C2+` must not throw or match nothing because of regex characters (Task 2 `filterRows`).
4. `localStorage` throwing (private mode) must not blank the page; selection just does not persist (Task 3 `loadSelection`/`saveSelection`).
5. If `laylengths.json` fails to load on first visit, the page shows a visible error line instead of an empty table (Task 3).

---

### Task 1: Data file and validator

**Files:**
- Create: `laylengths.json`
- Create: `laylengths.js` (only `MFR_ORDER` and `validate` for now)
- Test: `tests/data.test.mjs`

**Interfaces:**
- Produces: `laylengths.json` shaped `{ updated: "YYYY-MM-DD", rows: Row[] }` where
  `Row = { mfr, model, type, size, lengths: {in: number, note?: string}[], notes?: string, confidence: "confirmed"|"unverified", popular?: boolean, source?: string }`.
- Produces: `export const MFR_ORDER = ["Sensus","Badger","Neptune","Hersey","Master Meter","Metron-Farnier","Zenner","Elster/Kent"]`
- Produces: `export function validate(data): string[]` returning human-readable error strings, empty when valid.
- `type` is one of `Compound`, `Turbine`, `PD`, `Ultrasonic`, `Mag`, `Fire service`, `Fire assembly`, `Multi-jet`, `Single-jet`, `Bypass meter`.
- `size` is a string: `"1 1/2"`, `"2"`, `"3"`, ... `"20"`, or a combo like `"6x2"`, `"4x1 1/2"`, `"3x3/4"`.

- [ ] **Step 1: Write the failing test**

```js
// tests/data.test.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/`
Expected: FAIL, cannot find module `../laylengths.js`

- [ ] **Step 3: Create `laylengths.js` with `MFR_ORDER` and `validate(data)`**

`validate` checks: `updated` matches `/^\d{4}-\d{2}-\d{2}$/`; `rows` is a non-empty array; each row has `mfr` in `MFR_ORDER`, non-empty `model`, `type` in the allowed list, non-empty string `size`, `lengths` a non-empty array of `{in: finite number > 0}`, `confidence` in `["confirmed","unverified"]`; no duplicate `mfr|model|size`. Each error string names the row index and the field.

- [ ] **Step 4: Create `laylengths.json` from the review document**

Transcribe every row of `2026-11-20-lay-length-data-review.md` that has a number, one JSON row per model+size (expand "3 / 4 / 6" style rows into separate rows). Rules:
- H confidence → `confirmed`; M or L → `unverified`.
- Alternate lengths become separate `lengths[]` entries with a short `note` ("w/ strainer", "no strainer", "w/ spool", "w/ adapter kit", "compact", "meter only", "as shipped w/ strainer").
- Model names: `OMNI C2`, `OMNI T2`, `OMNI R2`, `OMNI F2`, `OMNI+ C2S`, `OMNI+ T2S`, `SRH Compound`, `SR / SR II`, `W-160 DR`, `W-160 DRS`, `Recordall Compound`, `Turbo 200`, `Disc M120`, `Disc M170`, `E-Series G2`, `T-10`, `HP Turbine`, `TRU/FLO Compound`, `HP PROTECTUS III`, `MACH 10`, `MVR 160`, `MCT II Compound`, `FM3 w/ bypass`, `MFM II`, `Spectrum 88D`, `Spectrum 88DL`, `Spectrum 130D`, `Spectrum 175D`, etc. Put the legacy alias in `notes` (e.g. "aka S88", "aka RCDL Comp / CSM").
- Hydrant meters (OMNI H2, FHZ, HT4000) and the M70 are omitted (not flanged / not 1 1/2").
- `popular: true` on exactly these rows: Sensus OMNI R2 1 1/2 & 2; OMNI C2 1 1/2, 2, 3, 4, 6; SRH Compound 2, 3, 4, 6; SR / SR II 1 1/2 & 2. Badger Disc M120 1 1/2; Disc M170 2; Recordall Compound 2, 3, 4, 6; E-Series G2 1 1/2, 2, 3, 4, 6, 8; Turbo 450 3. Neptune TRU/FLO Compound 2, 3, 4; T-10 1 1/2 & 2; HP Turbine 3; HP PROTECTUS III 6. Metron-Farnier Spectrum 88D & 88DL 1 1/2; Spectrum 130D 2; Spectrum 175D 3. Hersey MCT II Compound 2; MVR 160 2; FM3 w/ bypass 6x2; MFM II 6x3 and 8x4.
- `source` is the short document id or URL host from the review (e.g. "Sensus WDS-10017-10").
- `updated`: `"2026-11-20"`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/`
Expected: 5 passing

- [ ] **Step 6: Commit**

```bash
git add laylengths.json laylengths.js tests/data.test.mjs
git commit -m "Add flanged lay length dataset with validator"
```

---

### Task 2: Formatting, sorting and filtering logic

**Files:**
- Modify: `laylengths.js`
- Test: `tests/logic.test.mjs`

**Interfaces:**
- Consumes: `Row` shape from Task 1.
- Produces:
  - `export function sizeKey(size: string): number` — `"1 1/2"`→1.5, `"2"`→2, `"10"`→10, `"6x2"`→6.02, `"4x1 1/2"`→4.015, `"3x3/4"`→3.0075 (main size plus bypass/100).
  - `export function formatInches(n: number): string` — whole + fraction in lowest terms when `n*32` is an integer (`15.25`→`"15 1/4"`, `30.125`→`"30 1/8"`, `19.6875`→`"19 11/16"`, `13`→`"13"`), otherwise the decimal as written (`19.7`→`"19.7"`, `7.9`→`"7.9"`).
  - `export function formatLengths(lengths): string` — entries joined with `" / "`, each `formatInches(in)` plus `" (note)"` when a note exists.
  - `export function rowId(row): string` — `` `${mfr}|${model}|${size}` ``.
  - `export function filterRows(rows, f): Row[]` where `f = { mfr?: string, size?: string, type?: string, query?: string, popularOnly?: boolean }`. Empty/undefined filter fields match everything. `query` is a case-insensitive substring match against `mfr`, `model`, `type`, `size`, `notes` and the formatted lengths; it is plain text, never a regex. Result is sorted by `MFR_ORDER` index, then model (localeCompare), then `sizeKey`.
  - `export function printScope(visible: Row[], selectedIds: Set<string>, f): { rows: Row[], label: string }` — if any visible row's id is in `selectedIds`, rows are those and label is `"Selected meters"`; else rows are `visible` and label is `"Popular meters"` when `f.popularOnly` else `"All meters"`; when `f.mfr` is set, append `" · " + f.mfr`.
  - `export function groupByMfr(rows): [string, Row[]][]` — groups in `MFR_ORDER`, manufacturers without rows omitted.

- [ ] **Step 1: Write the failing tests**

```js
// tests/logic.test.mjs
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/logic.test.mjs`
Expected: FAIL, named exports not found

- [ ] **Step 3: Implement the seven functions in `laylengths.js`**

`sizeKey`: split on `x`; parse each part as whole plus optional fraction; main + bypass/100. `formatInches`: `Math.round(n*32)` equality check, then reduce by gcd. `filterRows`: build a lowercase haystack per row including `formatLengths` output; `String.prototype.includes` only.

- [ ] **Step 4: Run all tests to verify they pass**

Run: `node --test tests/`
Expected: 13 passing

- [ ] **Step 5: Commit**

```bash
git add laylengths.js tests/logic.test.mjs
git commit -m "Add lay length sorting, formatting and filter logic"
```

---

### Task 3: Screen page and navigation

**Files:**
- Create: `laylengths.html`
- Modify: `laylengths.js` (add `loadSelection`, `saveSelection`)
- Modify: `index.html:185` (nav), `readrecorder.html:174` (nav)
- Test: `tests/selection.test.mjs`

**Interfaces:**
- Consumes: everything from Task 2; `laylengths.json` via `fetch('laylengths.json', { cache: 'no-store' })`.
- Produces:
  - `export function loadSelection(storage): Set<string>` — reads key `laylengths.selected` (JSON array); returns empty Set if storage is null, throws, or holds bad JSON.
  - `export function saveSelection(storage, ids: Set<string>): void` — writes the key; swallows any exception.
  - DOM ids in `laylengths.html` used by Task 4 and 5: `#controls`, `#mfrChips`, `#sizeSel`, `#typeSel`, `#q`, `#popOnly`, `#printBtn`, `#clearSel`, `#status`, `#table`, `#printFooter`.

- [ ] **Step 1: Write the failing test**

```js
// tests/selection.test.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/selection.test.mjs`
Expected: FAIL, exports not found

- [ ] **Step 3: Implement `loadSelection` and `saveSelection` in `laylengths.js`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: 15 passing

- [ ] **Step 5: Create `laylengths.html`**

Copy the `<head>` styles pattern from `index.html` (same `:root`, `html, body`, `.container`, `h1`, `.nav`, `.card`). Title: `Meter Lookup &amp; Lay Lengths`. Body:
- `.nav` with links back to `index.html` ("← Test Recorder") and `readrecorder.html` ("Read Recorder").
- `h1` "Flanged Lay Length Reference" and a one-line subtitle: "Flange face to flange face, inches. 1 1/2" and up, flanged ends only. Verify against the meter before ordering."
- `#controls` card: `#mfrChips` (button per manufacturer plus "All", `aria-pressed` toggles), `#sizeSel` (All sizes + distinct sizes sorted by `sizeKey`), `#typeSel` (All types + distinct types), `#q` search input, `#popOnly` checkbox labelled "Popular only ★", `#printBtn` "Print", `#clearSel` "Clear selection (n)" hidden when n = 0, `#status` line ("142 meters · 3 selected").
- `#table`: `<table>` with `<thead>` columns `☐ | Model | Type | Size | Lay length(s) | Notes`; one `<tbody>` per manufacturer whose first row is a `th colspan=6` group header; each data row carries `data-id = rowId(row)`, a checkbox, a `★` after the model when `popular`, and a superscript `‡` after lengths when `confidence === "unverified"`. Legend under the table: "★ common in our fleet · ‡ from distributor guide, not a spec sheet".
- `#printFooter` (hidden on screen): "Scope: {label} · Data updated {updated} · Lay lengths are flanged face-to-face; confirm against the meter before ordering."
- `<script type="module">` imports from `./laylengths.js`, fetches the JSON, builds filter state from the controls, re-renders on any change, loads/saves selection with `localStorage` via `loadSelection`/`saveSelection`, and on fetch failure writes "Could not load lay length data. Check your connection and reload." into `#status`.
- Responsive: below 700px wrap the controls into two rows and let the table scroll horizontally inside the card.

- [ ] **Step 6: Add the nav links**

In `index.html:185` change the nav div to hold two pills: the existing Read Recorder link and `<a href="laylengths.html">Lay Lengths →</a>`. Same in `readrecorder.html:174`.

- [ ] **Step 7: Verify in a browser**

Run: `python3 -m http.server 8765 --bind 127.0.0.1 &` in the repo root, then `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8765/laylengths.html` → `200`. Then render a screenshot with headless Edge: `"/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless --screenshot=<scratchpad>/screen.png --window-size=768,1400 http://127.0.0.1:8765/laylengths.html` and look at the image: grouped table, chips, star markers, no console-visible error text. If Edge is unavailable, open the URL on the Windows side with `cmd.exe /c start` and inspect manually.

- [ ] **Step 8: Commit**

```bash
git add laylengths.html laylengths.js index.html readrecorder.html tests/selection.test.mjs
git commit -m "Add lay length reference page with filters and selection"
```

---

### Task 4: Print layout

**Files:**
- Modify: `laylengths.html` (add `@media print` block and print wiring)

**Interfaces:**
- Consumes: `printScope` from Task 2; DOM ids from Task 3.

- [ ] **Step 1: Add the print stylesheet**

`@media print`: hide `.nav`, `#controls`, the checkbox column and the subtitle; `@page { size: letter; margin: 0.5in }`; body white, 10pt font, table `width:100%`, `border-collapse: collapse`, 1px `#999` grid lines, `thead { display: table-header-group }`, `tbody { break-inside: avoid }`, group header rows shaded `#eee`, `#printFooter` shown as a fixed bottom block. Rows not in the print scope get class `no-print` → `display: none`.

- [ ] **Step 2: Wire the Print button**

`#printBtn` click: compute `printScope(visibleRows, selected, filters)`, set `no-print` on every rendered row whose id is not in `scope.rows`, set `#printFooter` text with `scope.label` and `data.updated`, call `window.print()`. On `afterprint`, remove the `no-print` classes. When `scope.rows` is empty, render a single row "No meters match the current filters" instead of calling print.

- [ ] **Step 3: Verify the PDF**

Run with the local server from Task 3: `"/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless --print-to-pdf=<scratchpad>/all.pdf --no-pdf-header-footer http://127.0.0.1:8765/laylengths.html` and open the PDF: letter pages, controls hidden, every manufacturer header present, footer line present, no group split mid-page where avoidable. Expected page count: 3 to 5. Then confirm via the screen build that checking two rows and pressing Print produces one short page (manual check in Windows browser, or temporarily append `?print=popular` handling — not required).

- [ ] **Step 4: Commit**

```bash
git add laylengths.html
git commit -m "Add letter-size print layout and print scope"
```

---

### Task 5: Offline caching

**Files:**
- Create: `sw.js`
- Modify: `laylengths.html` (register the worker)

- [ ] **Step 1: Create `sw.js`**

Cache name `laylengths-v1`. On `install`, pre-cache `['./laylengths.html', './laylengths.js', './laylengths.json']` and `skipWaiting()`. On `activate`, delete other `laylengths-*` caches and `clients.claim()`. On `fetch` (GET, same origin only): network-first, writing a successful response copy into the cache, falling back to `caches.match(request)` when the network fails. Requests for other pages pass through the same rule, so `index.html` keeps working exactly as before when online.

- [ ] **Step 2: Register it**

At the end of the module script in `laylengths.html`: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});`

- [ ] **Step 3: Verify**

`node --check sw.js` → no output. `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8765/sw.js` → `200`. Offline behaviour is verified after deploy in Task 6 (DevTools offline toggle or iPad airplane mode by the user).

- [ ] **Step 4: Commit**

```bash
git add sw.js laylengths.html
git commit -m "Cache lay length page for offline use"
```

---

### Task 6: Ship

**Files:**
- Create: `README.md` (repo has none)

- [ ] **Step 1: Write `README.md`**

Lead with the three live links: `https://gitgrossifiles.github.io/meterlookup/` (test recorder), `.../readrecorder.html`, `.../laylengths.html`. One paragraph per page. For lay lengths: how to update `laylengths.json` (edit, run `node --test tests/`, push; live in about a minute), the meaning of ★ and ‡, and that the page works offline after the first visit.

- [ ] **Step 2: Run the full test suite**

Run: `node --test tests/`
Expected: 15 passing

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "Document the three meterlookup pages"
git push origin main
```

- [ ] **Step 4: Confirm the deploy**

Poll `gh api repos/Gitgrossifiles/meterlookup/pages/builds/latest -q .status` until `built`, then `curl -s -o /dev/null -w '%{http_code}\n' https://gitgrossifiles.github.io/meterlookup/laylengths.html` → `200` and the same for `laylengths.json` and `sw.js`.
