'use strict';
// Real React controls. Camera/scanner hardware are mocked; painted layout is not measured by jsdom.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require(process.env.NUTRITRACE_JSDOM || '../../qa-runtime/node_modules/jsdom');
const APP = path.resolve(__dirname, '..'), VENDOR = process.env.NUTRITRACE_REACT_VENDOR || path.resolve(__dirname, '../../qa-vendor');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e))); vc.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://nutritrace.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, d = w.document;
  for (const file of ['react.js', 'react-dom.js']) w.eval(fs.readFileSync(path.join(VENDOR, file), 'utf8'));
  for (const file of ['diary-v5.js', 'aurora-components.js', 'nutrition-intelligence-v61.js', 'food-quality-v73.js', 'strategy-v64.js', 'aurora-v5.js']) w.eval(fs.readFileSync(path.join(APP, file), 'utf8'));
  const h = w.React.createElement, app = w.ReactDOM.createRoot(d.getElementById('root')), calls = [];
  const product = { name: 'Ingrediente acquisito', microBasis: 'mass', label: { kcal: 120 } };
  w.NutriTraceBarcodeScanner = ({ onProduct }) => h('button', { 'data-mock-scan': true, onClick: () => onProduct(product) }, 'Simula lettura barcode');
  w.NutriTraceFoodCamera = ({ onLabel }) => h('button', { 'data-mock-photo': true, onClick: () => onLabel(product) }, 'Simula foto etichetta');
  const review = { mode: 'multi', ingredients: [{ name: 'Farina', grams: 100, selectedKey: 'p:flour', candidates: [{ name: 'Farina', candidateKey: 'p:flour', resultType: 'personal' }] }] };
  app.render(h(w.NutriTraceV5.RecipeReview, { review, onChange() {}, onFind: i => calls.push(['find', i]), onAI: i => calls.push(['ai', i]), onCapture: (i, value) => calls.push(['capture', i, value.name]), onCommit() {} })); await wait(70);
  const group = d.querySelector('.v732-ingredient-actions'); assert.ok(group);
  const byText = text => [...group.querySelectorAll('button')].find(button => button.textContent.trim() === text);
  const find = byText('Corrispondenze'), ai = byText('Aiuto AI'), barcode = group.querySelector('[aria-label="Codice a barre ingrediente"]'), photo = group.querySelector('[aria-label="Foto etichetta ingrediente"]');
  assert.ok(find && ai && barcode && photo); assert.equal(group.querySelectorAll('button').length, 4);
  for (const button of [find, ai, barcode, photo]) assert.equal(button.closest('.v732-ingredient-actions'), group);
  assert.ok(group.querySelector('.v732-capture-inline'));
  find.click(); ai.click(); barcode.click(); await wait(40);
  assert.ok(group.querySelector('[data-mock-scan]')); group.querySelector('[data-mock-scan]').click(); await wait(40);
  byText('Usa questo ingrediente').click(); await wait(40);
  photo.click(); await wait(40); assert.ok(group.querySelector('[data-mock-photo]'));
  group.querySelector('[data-mock-photo]').click(); await wait(40); byText('Usa questo ingrediente').click(); await wait(40);
  assert.deepEqual(calls, [['find', 0], ['ai', 0], ['capture', 0, 'Ingrediente acquisito'], ['capture', 0, 'Ingrediente acquisito']]);

  const foods = [{ id: 'known', name: 'Food A', servingGrams: 100, label: { kcal: 100 }, qualityV61: { nutriScore: 'A', nutriScoreVersion: '2023', source: 'Test source' } }, { id: 'unknown', name: 'Unclassified', servingGrams: 100, label: { kcal: 100 } }];
  const logs = [{ id: 'one', foodId: 'known', grams: 50, date: '2026-11-27' }, { id: 'two', foodId: 'known', grams: 150, date: '2026-11-27' }, { id: 'three', foodId: 'unknown', grams: 800, date: '2026-11-27' }];
  app.render(h(w.NutriTraceFoodQualityV73.QualityHistoryPanel, { logs, foods, today: '2026-11-27' })); await wait(50);
  const summary = d.querySelector('.q732-counted-foods'); assert.equal(summary.querySelector('small').textContent, 'Cibi conteggiati'); assert.equal(summary.querySelector('strong').textContent, '2 / 3'); assert.equal(summary.querySelector('span').textContent, 'registrazioni · 20% delle kcal note');
  const month = [...d.querySelectorAll('.q73-period-tabs button')].find(button => button.textContent === 'Mese'); month.click(); await wait(40);
  assert.equal(d.querySelector('.q732-counted-foods strong').textContent, '2 / 3'); assert.equal(d.querySelector('.q732-counted-foods span').textContent, 'registrazioni · 20% delle kcal note');
  d.querySelector('button[aria-label="Periodo precedente"]').click(); await wait(40);
  assert.equal(d.querySelector('.q732-counted-foods strong').textContent, '0 / 0'); assert.equal(d.querySelector('.q732-counted-foods span').textContent, 'registrazioni · N/D delle kcal note');
  assert.deepEqual(errors, []); app.unmount(); dom.window.close();
  console.log('PASS real React: compact recipe action group and callbacks, inline mock camera/barcode confirmation, registration count vs kcal coverage, repeated food and unknown grade, period updates; no console errors.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
