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
