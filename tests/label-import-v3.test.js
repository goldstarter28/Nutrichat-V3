'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLabel, makeProposal, applyProposal } = require('../label-import-v3.js');

test('reads explicitly labelled product name and brand separately, retaining source lines', () => {
  const parsed = parseLabel('Nome prodotto: Bevanda di avena\nMarca: Verde & Co\nIngredienti: acqua, avena\nValori nutrizionali per 100 g\nProteine 2 g');
  assert.equal(parsed.product.name.value, 'Bevanda di avena');
  assert.equal(parsed.product.brand.value, 'Verde & Co');
  assert.equal(parsed.product.name.raw, 'Nome prodotto: Bevanda di avena');
  assert.equal(parsed.product.brand.provenance, 'testo etichetta inserito localmente');
});

test('does not infer brand or name from an unlabeled line', () => {
  const parsed = parseLabel('Verde & Co Bevanda di avena\nIngredienti: acqua, avena');
  assert.equal(parsed.product.name, null);
  assert.equal(parsed.product.brand, null);
  assert.ok(parsed.unrecognized.includes('Verde & Co Bevanda di avena'));
});

test('incomplete ingredients stay marked for review and preserve the source text', () => {
  const parsed = parseLabel('Ingredienti: acqua, avena,');
  assert.equal(parsed.ingredients.status, 'incomplete');
  assert.equal(parsed.ingredients.raw, 'Ingredienti: acqua, avena,');
  assert.match(parsed.ingredients.reason, /incompleto/);
});

test('missing ingredient heading remains missing, not an empty ingredient list', () => {
  const parsed = parseLabel('Nome prodotto: Alimento');
  assert.equal(parsed.ingredients.status, 'missing');
  assert.equal(parsed.ingredients.value, '');
});

test('discordant nutrient duplicates remain ambiguous and cannot enter a proposal as candidates', () => {
  const parsed = parseLabel('Valori nutrizionali per 100 g\nProteine 8 g\nProteine 9 g');
  const proposal = makeProposal({}, parsed);
  assert.ok(proposal.filter(x => x.path === 'label.protein').every(x => x.status === 'ambiguous'));
  const next = applyProposal({}, proposal, { confirmed: true, selectedPaths: ['label.protein'] });
  assert.equal(next.label.protein, undefined);
});

test('concordant duplicates remain a single candidate from the base parser', () => {
  const parsed = parseLabel('Valori nutrizionali per 100 g\nProteine 8 g\nProtein 8 g');
  assert.equal(parsed.nutrients.filter(x => x.key === 'protein').length, 1);
  assert.equal(parsed.nutrients[0].status, 'candidate');
});

test('rejects invalid ranges and incoherent sugar and saturated-fat relationships', () => {
  const parsed = parseLabel('Valori nutrizionali per 100 g\nGrassi 5 g\ndi cui saturi 6 g\nCarboidrati 4 g\ndi cui zuccheri 5 g\nProteine 150 g');
  assert.equal(parsed.nutrients.find(x => x.key === 'protein').status, 'invalid');
  assert.equal(parsed.nutrients.find(x => x.key === 'sugar').status, 'incoherent');
  assert.equal(parsed.nutrients.find(x => x.key === 'fat').status, 'incoherent');
  assert.equal(parsed.nutrients.find(x => x.key === 'saturatedFat').status, 'incoherent');
});

test('proposal exposes existing values as conflicts without changing the existing object', () => {
  const existing = { name: 'Manuale', brand: '', ingredients: '', label: { protein: 12 }, nutrients: [] };
  const parsed = parseLabel('Nome prodotto: Importato\nMarca: Marca X\nIngredienti: acqua, avena\nValori nutrizionali per 100 g\nProteine 8 g\nGrassi 2 g');
  const proposals = makeProposal(existing, parsed);
  assert.equal(proposals.find(x => x.path === 'name').action, 'conflict');
  assert.equal(proposals.find(x => x.path === 'label.protein').action, 'conflict');
  assert.equal(proposals.find(x => x.path === 'label.fat').action, 'add');
  assert.equal(existing.name, 'Manuale');
  assert.equal(existing.label.protein, 12);
});

test('cancel or missing explicit confirmation leaves existing food deeply unchanged', () => {
  const existing = { name: 'Manuale', label: { protein: 12 }, nutrients: [{ name: 'Ferro', amount: 2 }] };
  const snapshot = structuredClone(existing);
  const proposals = makeProposal(existing, parseLabel('Nome prodotto: Importato\nValori nutrizionali per 100 g\nGrassi 2 g'));
  assert.deepEqual(applyProposal(existing, proposals, { selectedPaths: ['name', 'label.fat'] }), snapshot);
  assert.deepEqual(existing, snapshot);
});

test('confirmed application adds selected values and provenance without overwriting existing fields', () => {
  const existing = { name: '', brand: 'Manuale', ingredients: '', label: { protein: 12 }, nutrients: [] };
  const parsed = parseLabel('Nome prodotto: Importato\nMarca: Marca X\nIngredienti: acqua, avena\nValori nutrizionali per 100 g\nProteine 8 g\nGrassi 2 g');
  const proposals = makeProposal(existing, parsed);
  const next = applyProposal(existing, proposals, { confirmed: true, selectedPaths: ['name', 'brand', 'ingredients', 'label.protein', 'label.fat'], overwritePaths: ['label.protein'] });
  assert.equal(next.name, 'Importato');
  assert.equal(next.brand, 'Manuale');
  assert.equal(next.ingredients, 'acqua, avena');
  assert.equal(next.label.protein, 8);
  assert.equal(next.label.fat, 2);
  assert.equal(existing.label.protein, 12);
  assert.equal(next.labelImport.fields['label.protein'].raw, 'Proteine 8 g');
  assert.equal(next.labelImport.rawText, parsed.rawText);
});

test('unselected fields and ambiguous fields are never applied', () => {
  const parsed = parseLabel('Nome prodotto: Importato\nValori nutrizionali per 100 g\nProteine 8 g\nProteine 9 g');
  const proposal = makeProposal({}, parsed);
  const next = applyProposal({}, proposal, { confirmed: true, selectedPaths: ['label.protein'] });
  assert.equal(next.name, undefined);
  assert.equal(next.label.protein, undefined);
});

test('legacy food records retain their existing fields and accept V3 provenance metadata', () => {
  const legacy = { id: 'legacy-1', name: 'Vecchio alimento', servingGrams: 100, label: { kcal: 0, protein: '' }, ingredients: '', nutrients: [], sources: [] };
  const parsed = parseLabel('Nome prodotto: Nuovo nome\nValori nutrizionali per 100 g\nProteine 3 g');
  const proposals = makeProposal(legacy, parsed);
  const next = applyProposal(legacy, proposals, { confirmed: true, selectedPaths: ['name', 'label.protein'] });
  assert.equal(next.id, 'legacy-1');
  assert.equal(next.label.kcal, 0);
  assert.equal(next.label.protein, 3);
  assert.equal(next.labelImport.version, 3);
});

test('energy in kJ is review-only and is never mislabelled as kcal', () => {
  const parsed = parseLabel('Valori nutrizionali per 100 g\nEnergia 1000 kJ');
  const energy = parsed.nutrients.find(row => row.key === 'kcal');
  assert.equal(energy.status, 'review');
  assert.equal(energy.unit, 'kj');
  assert.equal(makeProposal({}, parsed).find(row => row.path === 'label.kcal').status, 'review');
});

test('full original label text is retained as provenance when an accepted field is applied', () => {
  const text = 'Nome prodotto: Bevanda\nMarca: X\nIngredienti: acqua, avena\nValori nutrizionali per 100 g\nProteine 3 g';
  const parsed = parseLabel(text);
  const next = applyProposal({}, makeProposal({}, parsed), { confirmed: true, selectedPaths: ['label.protein'] });
  assert.equal(next.labelImport.rawText, text);
  assert.equal(next.labelImport.fields['label.protein'].raw, 'Proteine 3 g');
});
