'use strict';

// V3 interpretation, validation and proposal layer. Parsing never mutates app state.
(function (root, factory) {
  const parser = typeof module === 'object' && module.exports
    ? require('./label-import.js')
    : root && root.NutriTraceLabelImport;
  const api = factory(parser);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NutriTraceLabelImportV3 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (baseParser) {
  const MACRO_KEYS = new Set(['kcal', 'fat', 'saturatedFat', 'carbs', 'sugar', 'fiber', 'protein', 'salt']);
  const PRODUCT_LABELS = [
    { key: 'name', pattern: /^(?:nome\s+prodotto|prodotto|product\s+name|product)\s*:\s*(.*)$/i },
    { key: 'brand', pattern: /^(?:marca|brand|marchio)\s*:\s*(.*)$/i }
  ];

  function clean(value) { return String(value == null ? '' : value).trim(); }
  function norm(value) {
    return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function present(value) { return value !== '' && value !== null && value !== undefined; }
  function field(value, raw, status, reason = '') {
    return { value, raw, provenance: 'testo etichetta inserito localmente', status, reason };
  }

  function parseLabel(text) {
    if (!baseParser || typeof baseParser.parseLabelText !== 'function') {
      throw new Error('Il parser NutriTrace delle etichette non è disponibile.');
    }
    const rawText = clean(text);
    const parsed = baseParser.parseLabelText(rawText);
    const lines = rawText.split(/\r?\n/).map(clean);
    const product = { name: null, brand: null };
    for (const line of lines) {
      for (const definition of PRODUCT_LABELS) {
        const match = line.match(definition.pattern);
        if (!match) continue;
        const value = clean(match[1]);
        const proposed = value ? field(value, line, 'candidate') : field('', line, 'incomplete', 'Etichetta presente ma valore vuoto.');
        if (product[definition.key]) {
          product[definition.key] = field(product[definition.key].value, `${product[definition.key].raw}\n${line}`, 'ambiguous', 'Più righe esplicite per lo stesso campo: scegliere manualmente.');
        } else product[definition.key] = proposed;
      }
    }

    const ingredientHeading = /^(?:ingredienti|ingredients?|composition)\s*:?/i;
    const nutritionHeading = /^(?:valori nutrizionali|dichiarazione nutrizionale|nutrition facts|nutrition information|informazioni nutrizionali)\b/i;
    const hasIngredientHeading = lines.some(line => ingredientHeading.test(line));
    const ingredientText = parsed.ingredientsText;
    const trimmedIngredient = clean(ingredientText);
    const incompleteIngredients = !trimmedIngredient || /[,;:]\s*$|(?:\.\.\.|…)\s*$/.test(trimmedIngredient);
    const headingIndex = lines.findIndex(line => ingredientHeading.test(line));
    const nutritionIndex = lines.findIndex(line => nutritionHeading.test(line) || (/\|/.test(line) && /(?:100\s*g|100\s*ml|porzione|serving)/i.test(line)));
    const ingredientRaw = hasIngredientHeading
      ? lines.filter((line, index) => index === headingIndex || (index > headingIndex && (nutritionIndex < 0 || index < nutritionIndex))).join('\n')
      : '';
    const ingredients = hasIngredientHeading
      ? field(trimmedIngredient, ingredientRaw, incompleteIngredients ? 'incomplete' : 'candidate', incompleteIngredients ? 'Lista assente o terminata in modo incompleto; non considerarla completa.' : 'La completezza della lista non è verificabile dal testo.')
      : field('', '', 'missing', 'Intestazione ingredienti non individuata.');

    const nutrientRows = parsed.nutrients.map(row => ({ ...row }));
    const byKey = new Map();
    for (const row of nutrientRows) {
      if (!byKey.has(row.key)) byKey.set(row.key, []);
      byKey.get(row.key).push(row);
      if (row.status !== 'candidate') continue;
      if (row.key === 'kcal' && row.unit !== 'kcal') {
        row.status = 'review';
        row.reason = `Valore energetico espresso in ${row.unit}; non convertirlo o registrarlo come kcal senza una scelta esplicita.`;
        continue;
      }
      const limit = row.key === 'kcal' ? 1000 : 100;
      if (!Number.isFinite(row.amount) || row.amount < 0 || row.amount > limit) {
        row.status = 'invalid';
        row.reason = `Valore fuori dall'intervallo ammesso per ${row.key === 'kcal' ? 'kcal' : 'g per 100 g'}.`;
      }
    }
    const one = key => {
      const rows = byKey.get(key) || [];
      return rows.length === 1 && rows[0].status === 'candidate' ? rows[0].amount : null;
    };
    for (const [childKey, parentKey, label] of [['sugar', 'carbs', 'zuccheri superiori ai carboidrati'], ['saturatedFat', 'fat', 'grassi saturi superiori ai grassi']]) {
      const child = one(childKey), parent = one(parentKey);
      if (child !== null && parent !== null && child > parent) {
        for (const row of [...(byKey.get(childKey) || []), ...(byKey.get(parentKey) || [])]) {
          row.status = 'incoherent';
          row.reason = `Valori incoerenti: ${label}. Verificare il testo originale.`;
        }
      }
    }
    const macroValues = ['fat', 'carbs', 'protein'].map(one);
    if (macroValues.every(value => value !== null) && macroValues.reduce((sum, value) => sum + value, 0) > 100) {
      for (const key of ['fat', 'carbs', 'protein']) for (const row of byKey.get(key) || []) {
        row.status = 'incoherent';
        row.reason = 'La somma di grassi, carboidrati e proteine supera 100 g per 100 g.';
      }
    }

    return {
      rawText,
      product,
      ingredients,
      basis: parsed.basis,
      nutrients: nutrientRows,
      ambiguities: parsed.ambiguities || [],
      unrecognized: parsed.unrecognized || [],
      warnings: [...(parsed.warnings || []), ...(ingredients.status === 'incomplete' ? [ingredients.reason] : [])]
    };
  }

  function makeProposal(existingFood, parsed) {
    const food = existingFood || {};
    const proposals = [];
    for (const key of ['name', 'brand']) {
      const item = parsed?.product?.[key];
      if (item && item.status !== 'missing') proposals.push({ path: key, ...item });
    }
    if (parsed?.ingredients?.status !== 'missing') proposals.push({ path: 'ingredients', ...parsed.ingredients });
    for (const row of parsed?.nutrients || []) {
      const path = MACRO_KEYS.has(row.key) ? `label.${row.key}` : `nutrient.${row.key}`;
      proposals.push({ path, value: row.amount, raw: row.raw, provenance: 'testo etichetta inserito localmente', status: row.status, reason: row.reason || '', unit: row.unit, basis: row.basis, nutrientKey: row.key });
    }
    return proposals.map(item => {
      const current = item.path.startsWith('label.')
        ? food.label?.[item.path.slice(6)]
        : item.path.startsWith('nutrient.')
          ? (food.nutrients || []).filter(n => norm(n.name) === norm(item.nutrientKey)).map(n => n.amount)
          : food[item.path];
      const hasCurrent = Array.isArray(current) ? current.length > 0 : present(current);
      const actionable = item.status === 'candidate';
      return { ...item, sourceText: parsed.rawText, current, action: !actionable ? 'review' : hasCurrent ? 'conflict' : 'add' };
    });
  }

  // Pure application step: no mutation unless the user confirms; existing fields are
  // protected unless an explicit per-field replacement is selected in the review UI.
  function applyProposal(existingFood, proposals, { confirmed = false, selectedPaths = [], overwritePaths = [] } = {}) {
    const original = existingFood || {};
    if (!confirmed) return structuredClone(original);
    const selected = new Set(selectedPaths), overwrite = new Set(overwritePaths);
    const next = structuredClone(original);
    next.label = { ...(next.label || {}) };
    next.nutrients = [...(next.nutrients || [])];
    const provenance = { ...(next.labelImport?.fields || {}) };
    let rawText = next.labelImport?.rawText || '';
    for (const proposal of proposals || []) {
      if (!selected.has(proposal.path) || proposal.status !== 'candidate') continue;
      const conflict = proposal.action === 'conflict';
      if (conflict && !overwrite.has(proposal.path)) continue;
      if (proposal.path === 'name' || proposal.path === 'brand' || proposal.path === 'ingredients') {
        if (present(next[proposal.path]) && !overwrite.has(proposal.path)) continue;
        next[proposal.path] = proposal.value;
      } else if (proposal.path.startsWith('label.')) {
        const key = proposal.path.slice(6);
        if (present(next.label[key]) && !overwrite.has(proposal.path)) continue;
        next.label[key] = proposal.value;
      } else if (proposal.path.startsWith('nutrient.')) {
        const duplicate = next.nutrients.some(n => norm(n.name) === norm(proposal.nutrientKey));
        if (duplicate && !overwrite.has(proposal.path)) continue;
        next.nutrients = next.nutrients.filter(n => !(overwrite.has(proposal.path) && norm(n.name) === norm(proposal.nutrientKey)));
        next.nutrients.push({ id: `label-import-${proposal.nutrientKey}`, name: proposal.nutrientKey, form: 'dichiarato in etichetta', amount: proposal.value, unit: proposal.unit, source: 'Etichetta', evidence: proposal.raw });
      }
      provenance[proposal.path] = { raw: proposal.raw, provenance: proposal.provenance, status: proposal.status, unit: proposal.unit || null, basis: proposal.basis || null };
      rawText = rawText || proposal.sourceText || proposal.raw || '';
    }
    if (Object.keys(provenance).length) next.labelImport = { version: 3, rawText, fields: provenance };
    return next;
  }

  return { parseLabel, makeProposal, applyProposal };
});
