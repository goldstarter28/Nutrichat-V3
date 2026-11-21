'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../label-import.js');
const v3 = require('../label-import-v3.js');
globalThis.NutriTraceLabelImportV3 = v3;
require('./label-import-ui-state.test.js');
require('./label-import-ui-integration.test.js');
require('./label-import-v3-edge.test.js');
require('./label-import-model.test.js');

test('concordant duplicate values collapse and conflicting duplicate rows remain non-importable', () => {
  const same = v3.parseLabel('Nome prodotto: Test\nValori nutrizionali per 100 g\nProteine 8 g\nProtein 8 g');
  assert.equal(same.nutrients.filter(row => row.key === 'protein').length, 1);
  const conflicting = v3.parseLabel('Nome prodotto: Test\nValori nutrizionali per 100 g\nProteine 8 g\nProteine 9 g');
  assert.ok(conflicting.nutrients.filter(row => row.key === 'protein').every(row => row.status === 'ambiguous'));
});

test('cancelled overwrite does not alter the original manual value', () => {
  const original = { id: 'manual', name: 'Prodotto', label: { protein: 12 }, nutrients: [], sources: [] };
  const parsed = v3.parseLabel('Nome prodotto: Prodotto\nValori nutrizionali per 100 g\nProteine 8 g');
  const proposal = v3.makeProposal(original, parsed);
  const result = v3.applyProposal(original, proposal, { confirmed: true, selectedPaths: ['label.protein'], overwritePaths: [] });
  assert.equal(result.label.protein, 12);
  assert.equal(original.label.protein, 12);
});
