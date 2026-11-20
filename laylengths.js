// Shared logic for laylengths.html. Plain ES module: runs in the browser and under `node --test`.

export const MFR_ORDER = [
  'Sensus', 'Badger', 'Neptune', 'Hersey',
  'Master Meter', 'Metron-Farnier', 'Zenner', 'Elster/Kent',
];

export const TYPES = [
  'Compound', 'Turbine', 'PD', 'Ultrasonic', 'Mag',
  'Fire service', 'Fire assembly', 'Multi-jet', 'Single-jet', 'Bypass meter',
];

const CONFIDENCE = ['confirmed', 'unverified'];

/** Returns a list of human-readable problems with a laylengths data object; empty when valid. */
export function validate(data) {
  const errs = [];
  if (!data || typeof data !== 'object') return ['data is not an object'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.updated))) errs.push('updated must be YYYY-MM-DD');
  if (!Array.isArray(data.rows) || data.rows.length === 0) {
    errs.push('rows must be a non-empty array');
    return errs;
  }
  const seen = new Set();
  data.rows.forEach((r, i) => {
    const at = `row ${i} (${r && r.mfr} ${r && r.model} ${r && r.size})`;
    const problems = [];
    if (!MFR_ORDER.includes(r.mfr)) problems.push(`mfr "${r.mfr}" not in MFR_ORDER`);
    if (typeof r.model !== 'string' || !r.model.trim()) problems.push('model missing');
    if (!TYPES.includes(r.type)) problems.push(`type "${r.type}" not allowed`);
    if (typeof r.size !== 'string' || !r.size.trim()) problems.push('size missing');
    if (!Array.isArray(r.lengths) || r.lengths.length === 0) {
      problems.push('lengths must be a non-empty array');
    } else {
      r.lengths.forEach((l, j) => {
        if (!l || !Number.isFinite(l.in) || l.in <= 0) problems.push(`lengths[${j}].in must be a positive number`);
        if (l && l.note !== undefined && typeof l.note !== 'string') problems.push(`lengths[${j}].note must be a string`);
      });
    }
    if (!CONFIDENCE.includes(r.confidence)) problems.push(`confidence "${r.confidence}" not allowed`);
    if (r.popular !== undefined && typeof r.popular !== 'boolean') problems.push('popular must be boolean');
    const id = `${r.mfr}|${r.model}|${r.size}`;
    if (seen.has(id)) problems.push('duplicate mfr|model|size');
    seen.add(id);
    if (problems.length) errs.push(`${at}: ${problems.join('; ')}`);
  });
  return errs;
}

/** Parses a size string ("1 1/2", "10", "6x2", "4x1 1/2") into a sortable number: main size plus bypass/100. */
export function sizeKey(size) {
  const parsePart = (s) => {
    let total = 0;
    for (const tok of String(s).trim().split(/\s+/)) {
      if (!tok) continue;
      const m = tok.match(/^(\d+)\/(\d+)$/);
      total += m ? Number(m[1]) / Number(m[2]) : Number(tok) || 0;
    }
    return total;
  };
  const [main, bypass] = String(size).toLowerCase().split('x');
  return parsePart(main) + (bypass ? parsePart(bypass) / 100 : 0);
}

/** 15.25 → "15 1/4"; values that are not exact 32nds stay decimal ("19.7"). */
export function formatInches(n) {
  const thirtySeconds = Math.round(n * 32);
  if (Math.abs(thirtySeconds - n * 32) > 1e-9) return String(n);
  const whole = Math.floor(thirtySeconds / 32);
  let num = thirtySeconds - whole * 32;
  if (num === 0) return String(whole);
  let den = 32;
  while (num % 2 === 0) { num /= 2; den /= 2; }
  return whole ? `${whole} ${num}/${den}` : `${num}/${den}`;
}

/** [{in:17,note:'w/ strainer'},{in:10}] → "17 (w/ strainer) / 10" */
export function formatLengths(lengths) {
  return lengths.map(l => l.note ? `${formatInches(l.in)} (${l.note})` : formatInches(l.in)).join(' / ');
}

export function rowId(row) {
  return `${row.mfr}|${row.model}|${row.size}`;
}

function makeComparator(popularModels) {
  const isPop = (r) => popularModels.has(`${r.mfr}|${r.model}`) ? 1 : 0;
  return (a, b) => {
    const m = MFR_ORDER.indexOf(a.mfr) - MFR_ORDER.indexOf(b.mfr);
    if (m) return m;
    const pop = isPop(b) - isPop(a);
    if (pop) return pop;
    const mod = a.model.localeCompare(b.model);
    if (mod) return mod;
    return sizeKey(a.size) - sizeKey(b.size);
  };
}

/** "6", "6x2" and "6x1 1/2" all have main size "6". */
export function mainSize(size) {
  return String(size).toLowerCase().split('x')[0].trim();
}

/** A query made only of digits, spaces, slashes and an optional inch mark is a size lookup, not free text. */
function asSizeQuery(q) {
  const m = q.match(/^([\d\s\/]+)"?$/);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

/** Filters by mfr/type, main size, popular flag and a query (size lookup or plain text); returns rows sorted for display. */
export function filterRows(rows, f = {}) {
  const q = (f.query || '').trim().toLowerCase();
  const sizeQ = q ? asSizeQuery(q) : null;
  // A model counts as popular for ordering when any of its sizes is flagged, so its sizes stay together.
  const popularModels = new Set(rows.filter(r => r.popular).map(r => `${r.mfr}|${r.model}`));
  const base = rows.filter(r => {
    if (f.mfr && r.mfr !== f.mfr) return false;
    if (f.size && mainSize(r.size) !== mainSize(f.size)) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.popularOnly && !r.popular) return false;
    return true;
  });
  const textMatch = (r) =>
    [r.mfr, r.model, r.type, r.size, r.notes || '', formatLengths(r.lengths)].join(' ').toLowerCase().includes(q);
  let out = base;
  if (sizeQ !== null) {
    out = base.filter(r => mainSize(r.size) === sizeQ);
    if (!out.length) out = base.filter(textMatch); // e.g. "1/2" has no exact size; fall back to text
  } else if (q) {
    out = base.filter(textMatch);
  }
  return out.sort(makeComparator(popularModels));
}

/** Decides which rows print and how the footer labels them. */
export function printScope(visible, selectedIds, f = {}) {
  const selected = visible.filter(r => selectedIds.has(rowId(r)));
  let rows, label;
  if (selected.length) { rows = selected; label = 'Selected meters'; }
  else { rows = visible; label = f.popularOnly ? 'Popular meters' : 'All meters'; }
  if (f.mfr) label += ` · ${f.mfr}`;
  return { rows, label };
}

/** [[mfr, rows], ...] in MFR_ORDER, omitting manufacturers with no rows. */
export function groupByMfr(rows) {
  return MFR_ORDER
    .map(m => [m, rows.filter(r => r.mfr === m)])
    .filter(([, rs]) => rs.length);
}

const SELECTION_KEY = 'laylengths.selected';

/** Reads the saved row-id selection; empty Set when storage is missing, throws, or holds bad JSON. */
export function loadSelection(storage) {
  try {
    const raw = storage && storage.getItem(SELECTION_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Persists the selection; failures are ignored (private mode, quota). */
export function saveSelection(storage, ids) {
  try {
    storage && storage.setItem(SELECTION_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}
