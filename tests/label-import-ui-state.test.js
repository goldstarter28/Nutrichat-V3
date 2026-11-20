'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, buildSavePlan, findTargetCandidates, readFoods } = require('../label-import-ui-state.js');

test('new-food save requires a valid explicitly extracted and selected name', () => {
  const parsed = { product: { name: { status: 'candidate', value: ' Bevanda ' } } };
  assert.equal(buildSavePlan(parsed, ['label.protein'], [], '', 'new').ok, false);
  assert.equal(buildSavePlan({ product: { name: null } }, ['name', 'label.protein'], [], '', 'new').ok, false);
  assert.equal(buildSavePlan(parsed, ['name', 'label.protein'], [], '', 'new').ok, true);
});

test('an existing named target may accept selected fields without changing its name', () => {
  const parsed = { product: { name: null } };
  const plan = buildSavePlan(parsed, ['label.protein'], [], 'Prodotto manuale', 'existing-1');
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.selected, ['label.protein']);
});

test('target must be selected and duplicate name matches are returned for explicit choice', () => {
  const foods = [{ id: 'a', name: 'Bevanda', brand: 'Marchio A' }, { id: 'b', name: 'Bevanda', brand: 'Marchio B' }];
  const parsed = { product: { name: { status: 'candidate', value: 'Bevanda' }, brand: null } };
  assert.equal(buildSavePlan(parsed, ['name'], [], '', '').ok, false);
  assert.deepEqual(findTargetCandidates(foods, parsed).map(candidate => candidate.food.id), ['a', 'b']);
});

test('recognizing brand does not silently select an existing target', () => {
  const foods = [{ id: 'a', name: 'Bevanda', brand: 'Marchio A' }];
  const parsed = { product: { name: { status: 'candidate', value: 'Bevanda' }, brand: { status: 'candidate', value: 'Marchio A' } } };
  assert.equal(findTargetCandidates(foods, parsed)[0].brandMatches, true);
  assert.equal(buildSavePlan(parsed, ['label.protein'], [], 'Bevanda', '').ok, false);
});

test('corrupt or unavailable storage returns an error and does not fabricate an empty archive', () => {
  assert.equal(readFoods({ getItem: () => '{bad json' }).ok, false);
  assert.equal(readFoods({ getItem: () => { throw new Error('denied'); } }).ok, false);
  assert.deepEqual(readFoods({ getItem: () => '[]' }).foods, []);
});

test('HTML escaping protects review text from markup injection', () => {
  assert.equal(escapeHtml('<b>& "x" \'y\'</b>'), '&lt;b&gt;&amp; &quot;x&quot; &#39;y&#39;&lt;/b&gt;');
});
