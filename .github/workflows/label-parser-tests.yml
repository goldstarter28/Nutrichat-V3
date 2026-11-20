'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const v3 = require('../label-import-v3.js');
const state = require('../label-import-ui-state.js');

function storage(initial = '[]') {
  let raw = initial;
  return {
    getItem(key) { return key === 'nutritrace_foods' ? raw : null; },
    setItem(key, value) { if (key === 'nutritrace_foods') raw = value; },
    current() { return raw; }
  };
}
const input = 'Nome prodotto: Bevanda avena\nMarca: Prova\nIngredienti: acqua, avena\nValori nutrizionali per 100 g\nProteine 3 g';
function prepare(s, target = 'new') {
  const parsed = v3.parseLabel(input);
  const archive = state.readFoods(s);
  const food = target === 'new' ? null : archive.foods.find(f => f.id === target);
  const proposals = v3.makeProposal(food || {}, parsed);
  return { storage: s, parsed, target, proposals,
    snapshot: state.proposalSnapshot(archive.raw, food, proposals) };
}

test('new food is saved with unique ID and required app fields', () => {
  const s = storage();
  const p = prepare(s);
  const result = state.commitImport({ ...p, selectedPaths: ['name', 'brand', 'label.protein'], confirmed: true,
    idFactory: (() => { let i = 0; return () => `test-${++i}`; })() });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.food.id, 'test-1');
  assert.equal(result.food.name, 'Bevanda avena');
  assert.equal(result.food.label.protein, 3);
  assert.equal(state.readFoods(s).foods[0].id, result.food.id);
});

test('no confirmation means no persistent write', () => {
  const s = storage();
  const before = s.current();
  const result = state.commitImport({ ...prepare(s), selectedPaths: ['name'], confirmed: false });
  assert.equal(result.ok, false);
  assert.equal(s.current(), before);
});

test('changed archive after review is rejected without overwriting', () => {
  const s = storage();
  const p = prepare(s);
  s.setItem('nutritrace_foods', JSON.stringify([{ id: 'other', name: 'Other' }]));
  const before = s.current();
  const result = state.commitImport({ ...p, selectedPaths: ['name'], confirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.stale, true);
  assert.equal(s.current(), before);
});

test('manual protein is retained without explicit overwrite', () => {
  const original = { id: 'existing', name: 'Bevanda avena', brand: 'Prova',
    label: { protein: 12 }, nutrients: [], sources: [] };
  const s = storage(JSON.stringify([original]));
  const p = prepare(s, 'existing');
  assert.equal(p.proposals.find(x => x.path === 'label.protein').action, 'conflict');
  const result = state.commitImport({ ...p, selectedPaths: ['label.protein'], overwritePaths: [], confirmed: true });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.food.label.protein, 12);
});

test('corrupt storage is never replaced by an empty archive', () => {
  const s = storage('{broken');
  assert.equal(state.readFoods(s).ok, false);
  assert.equal(s.current(), '{broken');
});
