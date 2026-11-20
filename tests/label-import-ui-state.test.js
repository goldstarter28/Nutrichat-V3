'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, buildSavePlan } = require('../label-import-ui-state.js');

test('save plan refuses unnamed labels instead of inventing a product name', () => {
  const plan = buildSavePlan({ product: { name: null } }, ['name', 'label.protein'], ['label.protein']);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /nome prodotto/i);
});

test('save plan accepts explicit name and selected fields', () => {
  const parsed = { product: { name: { status: 'candidate', value: 'Bevanda' } } };
  const plan = buildSavePlan(parsed, ['name', 'label.protein'], ['label.protein']);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.selected, ['name', 'label.protein']);
  assert.deepEqual(plan.overwrite, ['label.protein']);
});

test('save plan refuses empty selection', () => {
  const parsed = { product: { name: { status: 'candidate', value: 'Bevanda' } } };
  assert.equal(buildSavePlan(parsed, [], []).ok, false);
});

test('HTML escaping protects review text from markup injection', () => {
  assert.equal(escapeHtml('<b>& "x" \'y\'</b>'), '&lt;b&gt;&amp; &quot;x&quot; &#39;y&#39;&lt;/b&gt;');
});
