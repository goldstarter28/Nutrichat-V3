'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Q = require('../nutrition-intelligence-v61'), F = require('../food-quality-v73');
const entry = (id, foodId, grams = 100) => ({ id, foodId, grams, date: '2026-11-27', mealId: 'breakfast' });
const known = { id: 'known', name: 'Food A', servingGrams: 100, label: { kcal: 100 }, qualityV61: { nutriScore: 'A', nutriScoreVersion: '2023', source: 'Test record' } };
const unknown = { id: 'unknown', name: 'Unclassified food', servingGrams: 100, label: { kcal: 100 } };
const logs = [entry('first', 'known', 50), entry('second', 'known', 150), entry('other', 'unknown', 800)];
function context() {
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }), useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useMemo: f => f(), useRef: () => ({ current: null }), useEffect: () => {}, useId: () => 'test' };
  const c = vm.createContext({ React, NutriTraceIntelligence: Q, NutriTraceDiaryV5: require('../diary-v5'), NutriTraceAurora: { Icon: () => null } }); c.window = c;
  for (const file of ['strategy-v64.js', 'aurora-v5.js', 'food-quality-v73.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c);
  return c;
}
function all(n) { return n && typeof n === 'object' ? [n, ...n.children.flatMap(all)] : []; }
function text(n) { return n === null || n === undefined || n === false ? '' : typeof n === 'object' ? n.children.map(text).join('') : String(n); }

test('V7.3.2 counted foods means registrations, while calorie coverage stays energy-weighted', () => {
  const s = F.summarize(logs, [known, unknown]);
  assert.equal(s.gradedEntries, 2); assert.equal(s.entries, 3); assert.equal(s.coverage, .2);
  assert.equal(s.foods.length, 2); // Repeating the same food is two registrations, one food identity.
  const c = context(), tree = c.NutriTraceFoodQualityV73.QualityHistoryPanel({ logs, foods: [known, unknown], today: '2026-11-27' });
  const summary = all(tree).find(n => n.props.className === 'q732-counted-foods');
  assert.equal(text(summary), 'Cibi conteggiati2 / 3registrazioni · 20% delle kcal note');
  assert.match(text(tree), /lo stesso cibo in due pasti conta due volte/);
});

test('V7.3.2 missing and removed foods remain in total registrations without becoming classified', () => {
  const s = F.summarize([...logs, entry('deleted', 'removed')], [known, unknown]);
  assert.equal(s.gradedEntries, 2); assert.equal(s.entries, 4); assert.equal(s.coverage, .2); assert.equal(s.missingFoodEntries, 1);
});

test('V7.3.2 ingredient capture is inside the matching and AI action group and keeps row identity', () => {
  const c = context(), calls = [], review = { mode: 'multi', ingredients: [{ name: 'Farina', grams: 100, selectedKey: 'p:flour', candidates: [] }, { name: 'Latte', grams: 200, selectedKey: 'p:milk', candidates: [] }] };
  const tree = c.NutriTraceV5.RecipeReview({ review, onChange() {}, onFind: i => calls.push(['find', i]), onAI: i => calls.push(['ai', i]), onCapture: (i, product) => calls.push(['capture', i, product]), onCommit() {} });
  const groups = all(tree).filter(n => n.props.className === 'v5-action-row v732-ingredient-actions'); assert.equal(groups.length, 2);
  groups.forEach((group, index) => {
    const buttons = group.children.filter(n => n.type === 'button'); assert.deepEqual(buttons.map(text), ['Corrispondenze', 'Aiuto AI']);
    const capture = group.children.find(n => n.type === c.NutriTraceStrategy.IngredientCapture); assert.ok(capture); assert.equal(capture.props.inline, true);
    buttons[0].props.onClick(); buttons[1].props.onClick(); capture.props.onConfirm({ name: 'Test ' + index });
  });
  assert.deepEqual(calls, [['find', 0], ['ai', 0], ['capture', 0, { name: 'Test 0' }], ['find', 1], ['ai', 1], ['capture', 1, { name: 'Test 1' }]]);
});
