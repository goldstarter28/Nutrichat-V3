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
test('parses alternate saturated fat descriptions without confusing total fat', () => {
  for (const row of ['di cui acidi grassi saturi 2 g', 'acidi grassi saturi 2 g', 'saturi 2 g', 'grassi saturi 2 g']) {
    const parsed = parseLabelText(`Valori nutrizionali per 100 g\n${row}`);
    assert.equal(parsed.nutrients[0].key, 'saturatedFat'); assert.equal(parsed.nutrients[0].amount, 2);
  }
});
test('per-100-g and per-serving table imports only the per-100-g column', () => {
  const parsed = parseLabelText('Valori nutrizionali | per 100 g | per porzione 30 g\nProteine | 10 g | 3 g\nGrassi | 4 g | 1,2 g');
  assert.equal(parsed.nutrients.find(x => x.key === 'protein').amount, 10);
  assert.equal(parsed.nutrients.find(x => x.key === 'fat').amount, 4);
});
test('multiple values without explicit column separators remain ambiguous', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g e per porzione\nProteine 10 g 3 g');
  assert.equal(parsed.nutrients[0].status, 'ambiguous'); assert.deepEqual(reconcile({}, parsed, ['protein']).changes, {});
});
test('per-100-ml values are review-only', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 ml\nEnergia 42 kcal\nProteine 3,4 g');
  assert.equal(parsed.basis.kind, 'per100ml'); assert.ok(parsed.nutrients.every(x => x.status === 'review')); assert.deepEqual(reconcile({}, parsed, ['kcal', 'protein']).changes, {});
});
test('prefers explicit kcal where energy also lists kJ', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nEnergia 1000 kJ / 240 kcal');
  assert.equal(parsed.nutrients[0].amount, 240); assert.equal(parsed.nutrients[0].unit, 'kcal');
});
test('conflicting duplicate nutrient rows remain ambiguity', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nProteine 8 g\nProteine 9 g');
  assert.equal(parsed.nutrients.length, 2); assert.ok(parsed.nutrients.every(x => x.status === 'ambiguous')); assert.deepEqual(reconcile({}, parsed, ['protein']).changes, {});
});
test('identical duplicate nutrient rows collapse', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nProtein 8 g\nProteine 8 g');
  assert.equal(parsed.nutrients.length, 1); assert.equal(parsed.nutrients[0].amount, 8);
});
test('manual values win unless overwrite is explicit', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nProteine 8 g');
  assert.deepEqual(reconcile({ protein: 10 }, parsed, ['protein']).changes, {});
  assert.deepEqual(reconcile({ protein: 10 }, parsed, ['protein'], ['protein']).changes, { protein: 8 });
});
test('unknown and portion bases are not importable', () => {
  assert.equal(detectBasis('Valori nutrizionali').kind, 'unknown');
  const portion = parseLabelText('Valori nutrizionali per porzione\nProteine 5 g'); assert.equal(portion.nutrients[0].status, 'review');
});
test('malformed rows and incompatible units are review-only', () => {
  const parsed = parseLabelText('Valori nutrizionali per 100 g\nProteine: non disponibile\nGrassi: 2 mg\nFibre: -- g'); assert.deepEqual(reconcile({}, parsed, ['protein', 'fat', 'fiber']).changes, {});
});
test('empty and malformed input shapes do not throw', () => {
  for (const input of ['', null, undefined, 42, {}]) assert.doesNotThrow(() => parseLabelText(input));
});
require('./label-import-v3.test.js');
require('./label-import-ui-state.test.js');
