'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function environment() {
  const context = { console, Intl, Number, Map, Set, Object, Array, Date, Math, JSON };
  context.window = context; context.globalThis = context;
  context.React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false) }),
    useState: () => ['', () => {}], useEffect: () => {}, useRef: () => ({ current: null }), useMemo: fn => fn()
  };
  vm.createContext(context);
  for (const file of ['diary-v5.js', 'aurora-components.js', 'aurora-v5.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context;
}
function walk(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.type === 'function') return walk(node.type(node.props), out);
  out.push(node); for (const child of node.children || []) walk(child, out); return out;
}
function text(node) { return node === null || node === undefined || node === false ? '' : typeof node !== 'object' ? String(node) : (node.children || []).map(text).join(' '); }
function cls(node, value) { return walk(node).filter(n => (n.props.className || '').split(' ').includes(value)); }
const known = { sum: 500, average: 500, comparisonAvailable: true, coverage: 1, estimatedCount: 0, limitedQualityCount: 0, knownDays: 1, loggedDays: 1 };

test('legacy sodium retains its saved number but displays a containment threshold, not a missing intake', () => {
  const env = environment();
  const goal = { name: 'Sodio', unit: 'mg', target: 1500, period: 'day', kind: 'target', referenceType: 'reduction-goal' };
  const before = structuredClone(goal);
  const tree = env.NutriTraceV5.MicroCard({ goal, stats: known, weight: 70 });
  const content = text(tree);
  assert.match(content, /Soglia di contenimento/);
  assert.match(content, /Sotto la soglia di 1\.?000 mg/);
  assert.match(content, /non è una quota da raggiungere/);
  assert.doesNotMatch(content, /Mancano|Obiettivo raggiunto/);
  assert.equal(walk(tree).filter(n => n.props.role === 'progressbar').length, 1);
  const pct = cls(tree, 'v5-micro-gap')[0].children.find(n => n.type === 'b');
  assert.match(pct.props['aria-label'], /soglia di contenimento/);
  assert.deepEqual(goal, before);
});

test('special review and absent official goals retain settings but suppress completion percentages and bars', () => {
  const env = environment();
  for (const metadata of [{ referenceType: 'special-review' }, { noOfficialTarget: true }, { referenceType: 'combined-reference' }, { referenceType: 'not-established' }]) {
    const goal = { name: 'Nutriente', unit: 'mg', target: 4, period: 'day', kind: 'minimum', ...metadata };
    const before = structuredClone(goal);
    const tree = env.NutriTraceV5.MicroCard({ goal, stats: { ...known, sum: 1 }, weight: 70 });
    assert.match(text(tree), /Impostazione salvata: 4 mg/);
    assert.match(text(tree), /Riferimento da verificare/);
    assert.match(text(tree), /Fonti scientifiche/);
    assert.doesNotMatch(text(tree), /Mancano|Obiettivo raggiunto/);
    assert.equal(walk(tree).filter(n => n.props.role === 'progressbar').length, 0);
    assert.equal(cls(tree, 'v5-micro-gap')[0].children.filter(n => n.type === 'b').length, 0);
    assert.deepEqual(goal, before);
  }
});

test('a normal personal target still has progress and a changed chemical basis suppresses comparison only', () => {
  const env = environment();
  const goal = { name: 'Calcio', unit: 'mg', target: 950, period: 'day', kind: 'minimum', referenceType: 'PRI' };
  const normal = env.NutriTraceV5.MicroCard({ goal, stats: known, weight: 70 });
  assert.equal(walk(normal).filter(n => n.props.role === 'progressbar').length, 1);
  assert.match(text(normal), /Mancano al tuo obiettivo: 450 mg/);
  const mixed = env.NutriTraceV5.MicroCard({ goal: { ...goal, name: 'Vitamina A', unit: 'µg', referenceBasis: 'RE' }, stats: { ...known, comparisonAvailable: false, basisUncertain: true, basisReason: 'RE e RAE non confrontabili' }, weight: 70 });
  assert.equal(walk(mixed).filter(n => n.props.role === 'progressbar').length, 0);
  assert.match(text(mixed), /500/);
  assert.match(text(mixed), /RE e RAE non confrontabili/);
  assert.match(text(mixed), /Riferimento: 950/);
  assert.doesNotMatch(text(mixed), /Mancano/);
});

test('goal highlights use passed metadata and preserve legacy settings without offering a completion bar', () => {
  const env = environment();
  const micros = [
    { id: 'a', name: 'Sodio', unit: 'mg', value: 500, target: 1500, kind: 'target', referenceType: 'reduction-goal', coverage: 1 },
    { id: 'b', name: 'Fluoro', unit: 'mg', value: 1, target: 4, kind: 'minimum', referenceType: 'special-review', referenceNote: 'Verifica il riferimento aggiornato', coverage: 1 },
    { id: 'c', name: 'EPA', unit: 'mg', value: 100, target: 250, noOfficialTarget: true, coverage: 1 }
  ];
  const before = structuredClone(micros);
  const tree = env.NutriTraceAurora.GoalsHero({ metrics: [], micros });
  const cards = cls(tree, 'a-micro-card');
  assert.equal(cards.length, 3);
  assert.match(text(cards[0]), /33% della soglia/);
  assert.match(text(cards[0]), /Soglia personale: 1\.?500 mg/);
  assert.equal(cls(cards[0], 'a-bar').length, 1);
  for (const card of cards.slice(1)) {
    assert.equal(cls(card, 'a-bar').length, 0);
    assert.match(text(card), /Da verificare/);
    assert.match(text(card), /Impostazione salvata:/);
  }
  assert.match(text(cards[1]), /Verifica il riferimento aggiornato/);
  assert.deepEqual(micros, before);
});
