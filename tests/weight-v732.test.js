'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const key = 'nutritrace_body_weight_v1';
function runtime(data = {}) {
  const storage = new Map([[key, JSON.stringify(data)]]);
  let slots = [], cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useMemo: fn => fn(), useEffect: () => {}, useRef: () => ({ current: null })
  };
  const context = vm.createContext({ React, console, Date, localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) }, confirm: () => true });
  for (const name of ['body-weight.js', 'weight-calorie-chart.js']) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context);
  return { context, storage, render(component, props) { cursor = 0; return component(props); }, fresh() { slots = []; cursor = 0; } };
}
function walk(node) { if (!node || typeof node !== 'object') return []; return [node, ...node.children.flatMap(walk)]; }
function text(node) { if (node === null || node === undefined || node === false) return ''; return typeof node === 'object' ? node.children.map(text).join('') : String(node); }
function dateBefore(days) { const d = new Date(); d.setDate(d.getDate() - days); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function metric(tree, label) { const row = walk(tree).find(node => node.props.className === 'metric' && text(node.children[0]) === label); return text(row.children[1]); }

test('V7.3.2 selected period changes variation, percentage and plotted entries together', () => {
  const entries = [{ id: 'old', date: dateBefore(150), kg: 60 }, { id: 'month', date: dateBefore(20), kg: 66 }, { id: 'week', date: dateBefore(6), kg: 68 }, { id: 'today', date: dateBefore(0), kg: 70 }];
  const r = runtime({ entries, target: 74 });
  let tree = r.render(r.context.NutriTraceBodyWeight);
  assert.equal(metric(tree, 'Variazione'), '+4,0 kg');
  assert.equal(metric(tree, 'Variazione %'), '+6,06%');
  const select = () => walk(tree).find(n => n.type === 'select');
  select().props.onChange({ target: { value: '7' } });
  tree = r.render(r.context.NutriTraceBodyWeight);
  assert.equal(metric(tree, 'Variazione'), '+2,0 kg');
  assert.equal(metric(tree, 'Variazione %'), '+2,94%');
  const chart = walk(tree).find(n => typeof n.type === 'function' && n.type.name === 'WeightChart');
  assert.deepEqual(Array.from(chart.props.entries, e => e.id), ['week', 'today']);
  assert.match(text(tree), new RegExp(dateBefore(6) + ' → ' + dateBefore(0)));
  select().props.onChange({ target: { value: 'all' } });
  tree = r.render(r.context.NutriTraceBodyWeight);
  assert.equal(metric(tree, 'Variazione'), '+10,0 kg');
  assert.equal(metric(tree, 'Variazione %'), '+16,67%');
});

test('V7.3.2 one or no recent measurement does not fabricate a zero variation', () => {
  const r = runtime({ entries: [{ id: 'only', date: dateBefore(12), kg: 64 }], target: null });
  let tree = r.render(r.context.NutriTraceBodyWeight);
  assert.equal(metric(tree, 'Variazione'), 'N/D');
  assert.equal(metric(tree, 'Variazione %'), 'N/D');
  walk(tree).find(n => n.type === 'select').props.onChange({ target: { value: '7' } });
  tree = r.render(r.context.NutriTraceBodyWeight);
  assert.equal(metric(tree, 'Variazione'), 'N/D');
  assert.match(text(tree), /Nessuna misurazione nel periodo/);
});

test('V7.3.2 additional weight charts render before the full measurement history', () => {
  const r = runtime({ entries: [], target: null });
  const child = r.context.React.createElement('article', { id: 'comparison-chart' }, 'Confronto peso ed alimentazione');
  const tree = r.render(r.context.NutriTraceBodyWeight, { children: child });
  const direct = tree.children.filter(n => n && typeof n === 'object');
  assert.equal(direct.at(-1).props['data-v732-weight-history'], true);
  assert.ok(direct.indexOf(child) < direct.findIndex(n => n.props['data-v732-weight-history']));
});

test('V7.3.2 weight target shown in Goals shares the same record and preserves measurements', () => {
  const original = { entries: [{ id: 'a', date: dateBefore(0), kg: 65 }], target: 70, targetHistory: [{ date: dateBefore(10), kg: 68 }] };
  const r = runtime(original);
  let tree = r.render(r.context.NutriTraceWeightTarget);
  assert.match(text(tree), /Peso da raggiungere/);
  walk(tree).find(n => n.type === 'input').props.onChange({ target: { value: '72,5' } });
  tree = r.render(r.context.NutriTraceWeightTarget);
  walk(tree).find(n => n.type === 'button').props.onClick();
  const updated = JSON.parse(r.storage.get(key));
  assert.equal(updated.target, 72.5);
  assert.deepEqual(updated.entries, original.entries);
  assert.deepEqual(updated.targetHistory, original.targetHistory);
  r.fresh();
  tree = r.render(r.context.NutriTraceBodyWeight);
  const target = walk(tree).find(n => n.type === r.context.NutriTraceWeightTarget);
  assert.equal(target.props.target, 72.5);
});

test('V7.3.2 registered weight, seven-measure trend and target legend markers match chart colors', () => {
  const r = runtime({ entries: Array.from({ length: 8 }, (_, i) => ({ id: String(i), date: dateBefore(8 - i), kg: 66 + i / 10 })), target: 70 });
  let tree = r.render(r.context.NutriTraceBodyWeight);
  const chart = walk(tree).find(n => typeof n.type === 'function' && n.type.name === 'WeightChart');
  r.fresh();
  tree = r.render(chart.type, chart.props);
  const nodes = walk(tree);
  for (const color of ['#178e7b', '#d38c2c']) {
    assert.ok(nodes.some(n => n.type === 'path' && n.props.stroke === color));
    assert.ok(nodes.some(n => n.type === 'span' && n.props.style?.color === color));
  }
  assert.ok(nodes.some(n => n.type === 'line' && n.props.stroke === '#c34a4a' && n.props.strokeDasharray));
  assert.ok(nodes.some(n => n.type === 'span' && n.props.style?.borderTop === '2px dashed #c34a4a'));
  assert.match(text(tree), /Peso da raggiungere/);
});

test('V7.3.2 comparison chart uses distinct colored legend markers for weight, calories and incomplete calories', () => {
  const r = runtime({ entries: [{ id: 'a', date: dateBefore(0), kg: 68 }], target: null });
  const tree = r.render(r.context.NutriTraceWeightCalorieChart, { logs: [{ date: dateBefore(0), foodId: 'f', grams: 100 }], foods: [{ id: 'f', servingGrams: 100, label: { kcal: 200 } }] });
  const nodes = walk(tree);
  for (const color of ['#168b78', '#b67a2a', '#e2ac6a']) assert.ok(nodes.some(n => n.type === 'span' && n.props.style?.color === color));
  assert.ok(nodes.some(n => n.type === 'path' && n.props.stroke === '#168b78'));
  assert.ok(nodes.some(n => n.type === 'rect' && n.props.fill === '#b67a2a'));
});

test('V7.3.2 invalid target leaves saved data and controlled state unchanged', () => {
  const original = { entries: [{ id: 'a', date: dateBefore(0), kg: 65 }], target: 70 };
  for (const invalid of ['10', '501', 'not-a-number', 'Infinity']) {
    const r = runtime(original), before = r.storage.get(key); let calls = 0;
    let tree = r.render(r.context.NutriTraceWeightTarget, { target: 70, onSave() { calls++; } });
    walk(tree).find(n => n.type === 'input').props.onChange({ target: { value: invalid } });
    tree = r.render(r.context.NutriTraceWeightTarget, { target: 70, onSave() { calls++; } });
    walk(tree).find(n => n.type === 'button').props.onClick();
    assert.equal(r.storage.get(key), before); assert.equal(calls, 0);
  }
});

test('V7.3.2 weight target respects the active demo storage facade', () => {
  const personal = { entries: [{ id: 'personal', date: dateBefore(0), kg: 83 }], target: 80 };
  const r = runtime(personal), before = r.storage.get(key), demo = new Map([[key, JSON.stringify({ entries: [], target: 65 })]]);
  r.context.NutriTraceEnvironment = { isDemo: true, storage: { getItem: k => demo.get(k) || null, setItem: (k, v) => demo.set(k, v) } };
  let tree = r.render(r.context.NutriTraceWeightTarget);
  assert.equal(walk(tree).find(n => n.type === 'input').props.value, '65');
  walk(tree).find(n => n.type === 'input').props.onChange({ target: { value: '68' } });
  tree = r.render(r.context.NutriTraceWeightTarget); walk(tree).find(n => n.type === 'button').props.onClick();
  assert.equal(JSON.parse(demo.get(key)).target, 68); assert.equal(r.storage.get(key), before);
});

test('V7.3.2 unreadable weight storage is not overwritten when saving a target', () => {
  const r = runtime(); r.storage.set(key, '{broken-json');
  let tree = r.render(r.context.NutriTraceWeightTarget);
  walk(tree).find(n => n.type === 'input').props.onChange({ target: { value: '72' } });
  tree = r.render(r.context.NutriTraceWeightTarget); walk(tree).find(n => n.type === 'button').props.onClick();
  assert.equal(r.storage.get(key), '{broken-json');
});
