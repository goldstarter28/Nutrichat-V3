'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLabelText, reconcile, detectBasis } = require('../label-import.js');

test('parses ingredients across lines and abbreviated saturated-fat naming', () => {
  const parsed = parseLabelText('Ingredienti: farina di frumento, acqua,\nolio di oliva, sale\nValori nutrizionali medi per 100 g\nEnergia 250 kcal\nGrassi 8,5 g\ndi cui saturi 1,2 g\nCarboidrati 35 g\ndi cui zuccheri 4 g\nProteine 9 g\nSale 0,8 g');
  assert.equal(parsed.ingredientsText, 'farina di frumento, acqua, olio di oliva, sale');
  assert.equal(parsed.basis.kind, 'per100g');
  assert.equal(parsed.nutrients.find(x => x.key === 'saturatedFat').amount, 1.2);
});

test('parses alternate saturated fat descriptions', () => {
  for (const row of ['di cui acidi grassi saturi 2 g', 'acidi grassi saturi 2 g', 'saturi 2 g']) {
    const parsed = parseLabelText(`Valori nutrizionali per 100 g\n${row}`);
    assert.equal(parsed.nutrients[0].key, 'saturatedFat');
    assert.equal(parsed.nutrients[0].amount, 2);
  }
});

test('a per-100-g and per-serving table imports only the explicitly identified per-100-g column', () => {
  const parsed = parseLabelText('Valori nutrizionali | per 100 g | per porzione 30 g\nProteine | 10 g | 3 g\nGrassi | 4 g | 1,2 g');
  assert.equal(parsed.nutrients.find(x => x.key === 'protein').amount, 10);
  assert.equal(parsed.nutrients.find(x => x.key === 'protein').status, 'candidate');
});

test('multiple values without explicit column separators remain ambiguous', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g e per porzione\nProteine 10 g 3 g');
  assert.equal(parsed.nutrients[0].status, 'ambiguous');
  assert.deepEqual(reconcile({}, parsed, ['protein']).changes, {});
});

test('per-100-ml values are retained for review and never imported as grams', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 ml\nEnergia 42 kcal\nProteine 3,4 g');
  assert.equal(parsed.basis.kind, 'per100ml');
  assert.ok(parsed.nutrients.every(x => x.status === 'review'));
  assert.deepEqual(reconcile({}, parsed, ['kcal', 'protein']).changes, {});
});

test('prefers explicit kcal where energy also lists kJ', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nEnergia 1000 kJ / 240 kcal');
  assert.equal(parsed.nutrients[0].key, 'kcal');
  assert.equal(parsed.nutrients[0].amount, 240);
  assert.equal(parsed.nutrients[0].unit, 'kcal');
  assert.equal(parsed.nutrients[0].status, 'candidate');
});

test('conflicting duplicate nutrient rows are preserved as ambiguity, not silently discarded', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nProteine 8 g\nProteine 9 g');
  assert.equal(parsed.nutrients.length, 2);
  assert.ok(parsed.nutrients.every(x => x.status === 'ambiguous'));
  assert.equal(parsed.ambiguities[0].key, 'protein');
  assert.deepEqual(reconcile({}, parsed, ['protein']).changes, {});
});

test('separates ingredient lines from nutrition table lines', () => {
  const parsed = parseLabelText('Ingredienti: latte, cacao, zucchero\nlecitina di soia\nValori nutrizionali per 100 g\nProteine 4 g\npuò contenere tracce di frutta a guscio');
  assert.match(parsed.ingredientsText, /lecitina di soia/);
  assert.doesNotMatch(parsed.ingredientsText, /Proteine|tracce/);
  assert.ok(parsed.unrecognized.includes('può contenere tracce di frutta a guscio'));
});

test('partial tables keep absent nutrients missing, never zero-filled', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nEnergia 100 kcal\nProteine 5 g');
  assert.equal(parsed.nutrients.some(x => x.key === 'fiber'), false);
  assert.equal(parsed.nutrients.some(x => x.amount === 0), false);
});

test('manual values win unless overwrite is explicitly confirmed', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nProteine 8 g');
  const protectedResult = reconcile({ protein: 10 }, parsed, ['protein']);
  assert.deepEqual(protectedResult.changes, {});
  assert.deepEqual(protectedResult.conflicts, [{ key: 'protein', current: 10, proposed: 8, unit: 'g' }]);
  assert.deepEqual(reconcile({ protein: 10 }, parsed, ['protein'], ['protein']).changes, { protein: 8 });
});

test('unknown and portion bases are not importable', () => {
  assert.equal(detectBasis('Valori nutrizionali').kind, 'unknown');
  const portion = parseLabelText('Valori nutrizionali per porzione\nProteine 5 g');
  assert.equal(portion.nutrients[0].status, 'review');
  assert.deepEqual(reconcile({}, portion, ['protein']).changes, {});
});

test('only selected fields are proposed and cancelling is a no-op', () => {
  const parsed = parseLabelText('Ingredienti: farina, acqua\nValori nutrizionali per 100 g\nProteine 8 g\nGrassi 2 g');
  assert.deepEqual(reconcile({}, parsed, ['protein']).changes, { protein: 8 });
  const existing = { name: 'Prodotto', ingredients: 'manuale', label: { protein: 12 } };
  const snapshot = structuredClone(existing);
  parseLabelText('Ingredienti: farina\nValori nutrizionali per 100 g\nProteine 4 g');
  assert.deepEqual(existing, snapshot);
});
