'use strict';

// Deterministic, conservative parser for OCR text from food labels.
// This module does not perform OCR and never mutates application data.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NutriTraceLabelImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SPECS = [
    { key: 'kcal', aliases: ['valore energetico', 'energia', 'energy', 'calorie'], units: ['kcal', 'kj'] },
    { key: 'fat', aliases: ['grassi', 'lipidi', 'fat', 'lipids'], units: ['g'] },
    { key: 'saturatedFat', aliases: ['di cui acidi grassi saturi', 'di cui grassi saturi', 'di cui saturi', 'acidi grassi saturi', 'grassi saturi', 'saturi', 'saturates'], units: ['g'] },
    { key: 'carbs', aliases: ['carboidrati', 'carbohydrate', 'carbohydrates'], units: ['g'] },
    { key: 'sugar', aliases: ['di cui zuccheri', 'zuccheri', 'sugars'], units: ['g'] },
    { key: 'fiber', aliases: ['fibre', 'fibra', 'fiber'], units: ['g'] },
    { key: 'protein', aliases: ['proteine', 'proteins', 'protein'], units: ['g'] },
    { key: 'salt', aliases: ['sale', 'salt'], units: ['g'] },
    { key: 'sodium', aliases: ['sodio', 'sodium'], units: ['mg', 'g'] }
  ];
  const NUMBER_UNIT = /(\d+(?:[.,]\d+)?|[.,]\d+)\s*(kcal|kj|mg|g)\b/ig;

  function clean(value) { return String(value == null ? '' : value).trim(); }
  function norm(value) {
    return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9µ]+/g, ' ').trim();
  }
  function hasPhrase(text, phrase) {
    const n = ` ${norm(text)} `, p = ` ${norm(phrase)} `;
    return n.includes(p);
  }
  function detectBasis(text) {
    const n = norm(text);
    const g = /\b(per|in)\s*100\s*g\b/.test(n);
    const ml = /\b(per|in)\s*100\s*ml\b/.test(n);
    const portion = /\b(per|in)\s*porzione\b|\bper serving\b|\bporzione\b/.test(n);
    if (g && (ml || portion)) return { kind: 'multiple', label: 'più basi presenti', importable: false, reason: 'Sono indicate più basi: serve identificare con certezza la colonna del valore.' };
    if (ml) return { kind: 'per100ml', label: 'per 100 ml', importable: false, reason: 'Valori per 100 ml: non convertirli in g senza densità verificata.' };
    if (portion) return { kind: 'portion', label: 'per porzione', importable: false, reason: 'Valori per porzione: non equivalgono a valori per 100 g.' };
    if (g) return { kind: 'per100g', label: 'per 100 g', importable: true };
    return { kind: 'unknown', label: 'base non identificata', importable: false, reason: 'Base quantitativa non identificata con sufficiente certezza.' };
  }
  function parseNumber(raw) {
    const s = clean(raw).replace(/\s/g, '').replace(',', '.');
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function identifyNutrient(label) {
    const n = norm(label);
    // Longest phrases first; “di cui saturi” is a common shortened label.
    const ordered = SPECS.flatMap(spec => spec.aliases.map(alias => ({ spec, alias })))
      .sort((a, b) => norm(b.alias).length - norm(a.alias).length);
    for (const item of ordered) if (n === norm(item.alias) || n.startsWith(`${norm(item.alias)} `)) return item.spec;
    return null;
  }
  function parseMeasurements(text) {
    const out = [];
    NUMBER_UNIT.lastIndex = 0;
    let match;
    while ((match = NUMBER_UNIT.exec(text))) {
      const amount = parseNumber(match[1]);
      if (amount !== null) out.push({ amount, unit: match[2].toLowerCase(), start: match.index, end: NUMBER_UNIT.lastIndex });
    }
    return out;
  }
  function cells(line) {
    // Preserve columns only where there is an explicit table delimiter. OCR whitespace
    // is not enough evidence to infer which value belongs to which heading.
    if (line.includes('|')) return line.split('|').map(clean);
    if (line.includes('\t')) return line.split('\t').map(clean);
    return null;
  }
  function headerColumns(line) {
    const parts = cells(line);
    if (!parts || parts.length < 2) return null;
    const kinds = parts.map(part => {
      const n = norm(part);
      if (/\b100\s*g\b/.test(n)) return 'per100g';
      if (/\b100\s*ml\b/.test(n)) return 'per100ml';
      if (/\bporzione\b|\bserving\b/.test(n)) return 'portion';
      return 'unknown';
    });
    if (!kinds.includes('per100g') && !kinds.includes('per100ml') && !kinds.includes('portion')) return null;
    return kinds;
  }
  function parseNutrientLine(line, basis, columnKinds) {
    let label = line;
    let valueCells = null;
    const split = cells(line);
    if (split && split.length >= 2) { label = split[0]; valueCells = split.slice(1); }
    const spec = identifyNutrient(label);
    if (!spec) return null;
    if (valueCells && columnKinds) {
      const values = valueCells.map(parseMeasurements);
      const matches = [];
      values.forEach((list, index) => {
        for (const value of list) matches.push({ ...value, column: columnKinds[index + 1] || 'unknown' });
      });
      const gValues = matches.filter(x => x.column === 'per100g');
      const value = spec.key === 'kcal' ? gValues.find(x => x.unit === 'kcal') : gValues[0];
      if (gValues.length && value && (spec.key !== 'kcal' || value.unit === 'kcal')) {
        if (!spec.units.includes(value.unit)) return { key: spec.key, status: 'unparsed', raw: clean(line), reason: 'Unità incompatibile.' };
        return { key: spec.key, status: 'candidate', amount: value.amount, unit: value.unit, raw: clean(line), basis: 'per100g' };
      }
      return { key: spec.key, status: 'ambiguous', raw: clean(line), reason: 'La riga non contiene un valore associabile con certezza alla colonna per 100 g.' };
    }
    const measurements = parseMeasurements(line.slice(label.length));
    if (!measurements.length) return { key: spec.key, status: 'unparsed', raw: clean(line), reason: 'Valore o unità non riconosciuti.' };
    if (spec.key === 'kcal') {
      const kcal = measurements.find(x => x.unit === 'kcal');
      if (kcal && basis.kind === 'per100g') return { key: spec.key, status: 'candidate', amount: kcal.amount, unit: 'kcal', raw: clean(line), basis: 'per100g' };
      if (kcal) return { key: spec.key, status: 'review', amount: kcal.amount, unit: 'kcal', raw: clean(line), basis: basis.kind, reason: basis.reason || 'Base non verificata.' };
    }
    if (measurements.length > 1 || basis.kind === 'multiple') return { key: spec.key, status: 'ambiguous', raw: clean(line), reason: 'Sono presenti più valori e non è certa la loro associazione alla base nutrizionale.' };
    const value = measurements[0];
    if (!spec.units.includes(value.unit)) return { key: spec.key, status: 'unparsed', raw: clean(line), reason: 'Unità incompatibile o valore non valido.' };
    if (!basis.importable) return { key: spec.key, status: 'review', amount: value.amount, unit: value.unit, raw: clean(line), basis: basis.kind, reason: basis.reason };
    return { key: spec.key, status: 'candidate', amount: value.amount, unit: value.unit, raw: clean(line), basis: 'per100g' };
  }
  function isNutritionHeading(line) {
    const n = norm(line);
    return /^(valori nutrizionali|dichiarazione nutrizionale|nutrition facts|nutrition information|informazioni nutrizionali)\b/.test(n);
  }
  function parseLabelText(text) {
    const lines = clean(text).split(/\r?\n/).map(clean).filter(Boolean);
    const allText = lines.join('\n');
    const globalBasis = detectBasis(allText);
    const ingredients = [], rows = [], unrecognized = [];
    let section = 'other', tableColumns = null, activeBasis = globalBasis;
    for (const line of lines) {
      const n = norm(line);
      const ingredientHead = /^(ingredienti|ingredients?|composition)\b/.test(n);
      if (ingredientHead) {
        section = 'ingredients';
        const rest = line.replace(/^\s*(ingredienti|ingredients?|composition)\s*:?\s*/i, '').trim();
        if (rest) ingredients.push(rest);
        continue;
      }
      const cols = headerColumns(line);
      if (isNutritionHeading(line) || cols) {
        section = 'nutrition';
        if (cols) tableColumns = cols;
        const localBasis = detectBasis(line);
        if (localBasis.kind !== 'unknown') activeBasis = localBasis;
        continue;
      }
      const row = parseNutrientLine(line, activeBasis, tableColumns);
      if (row) { section = 'nutrition'; rows.push(row); continue; }
      if (section === 'ingredients') ingredients.push(line);
      else if (section === 'nutrition') unrecognized.push(line);
      else unrecognized.push(line);
    }
    // Conflicting duplicate nutrient rows must remain visible as an ambiguity; never silently pick one.
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.key)) grouped.set(row.key, []);
      grouped.get(row.key).push(row);
    }
    const nutrients = [];
    const ambiguities = [];
    for (const [key, list] of grouped) {
      const usable = list.filter(x => x.status === 'candidate');
      const distinct = new Set(usable.map(x => `${x.amount}|${x.unit}|${x.basis}`));
      if (list.length > 1 && distinct.size > 1) {
        const issue = { key, rows: list.map(x => ({ ...x, status: 'ambiguous' })), reason: 'Nutriente ripetuto con valori differenti: scegliere manualmente il dato corretto.' };
        ambiguities.push(issue); nutrients.push(...issue.rows);
      } else if (list.length > 1 && distinct.size === 1 && usable.length) {
        nutrients.push(usable[0]);
      } else nutrients.push(...list);
    }
    const explicitBasis = lines.map(line => detectBasis(line)).find(x => x.kind !== 'unknown');
    const basis = explicitBasis || globalBasis;
    return {
      rawText: allText,
      ingredientsText: ingredients.join('\n').replace(/\s*[,;]\s*/g, ', ').trim(),
      basis,
      nutrients,
      ambiguities,
      unrecognized,
      warnings: basis.importable ? [] : [basis.reason]
    };
  }
  // Pure proposal function. Only confirmed per-100-g candidates can be applied.
  function reconcile(existing, parsed, selectedKeys, explicitOverwriteKeys = []) {
    const source = existing || {}, selected = new Set(selectedKeys || []), overwrite = new Set(explicitOverwriteKeys || []);
    const changes = {}, conflicts = [], skipped = [];
    for (const row of parsed && parsed.nutrients || []) {
      if (row.status !== 'candidate' || row.basis !== 'per100g') {
        skipped.push({ key: row.key, reason: row.reason || 'Dato non importabile senza verifica.' });
        continue;
      }
      if (!selected.has(row.key)) continue;
      const current = source[row.key];
      const hasCurrent = current !== '' && current !== null && current !== undefined;
      if (hasCurrent && !overwrite.has(row.key)) { conflicts.push({ key: row.key, current, proposed: row.amount, unit: row.unit }); continue; }
      changes[row.key] = row.amount;
    }
    return { changes, conflicts, skipped };
  }
  return { detectBasis, parseLabelText, reconcile };
});
