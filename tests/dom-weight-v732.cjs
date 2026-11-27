'use strict';
// Real React state/events and localStorage; jsdom does not verify painted layout.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require(process.env.NUTRITRACE_JSDOM || '../../qa-runtime/node_modules/jsdom');
const APP = path.resolve(__dirname, '..'), VENDOR = process.env.NUTRITRACE_REACT_VENDOR || path.resolve(__dirname, '../../qa-vendor');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const dateBefore = n => { const d = new Date(); d.setDate(d.getDate() - n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
async function main() {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e))); vc.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://nutritrace.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, d = w.document, storageKey = 'nutritrace_body_weight_v1';
  w.confirm = () => true; w.HTMLElement.prototype.scrollIntoView = function () {};
  const original = { target: 74, entries: [{ id: 'old', date: dateBefore(150), time: '', kg: 60, note: 'inizio' }, { id: 'month', date: dateBefore(20), time: '', kg: 66, note: '' }, { id: 'week', date: dateBefore(6), time: '', kg: 68, note: '' }, { id: 'today', date: dateBefore(0), time: '', kg: 70, note: '' }] };
  w.localStorage.setItem(storageKey, JSON.stringify(original));
  for (const file of ['react.js', 'react-dom.js']) w.eval(fs.readFileSync(path.join(VENDOR, file), 'utf8'));
  for (const file of ['body-weight.js', 'weight-calorie-chart.js']) w.eval(fs.readFileSync(path.join(APP, file), 'utf8'));
  const h = w.React.createElement, app = w.ReactDOM.createRoot(d.getElementById('root'));
  const set = async (el, value) => { assert.ok(el); const proto = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value)); el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(40); };
  const metric = label => [...d.querySelectorAll('.metric')].find(el => el.querySelector('span')?.textContent === label)?.querySelector('strong')?.textContent;

  app.render(h(w.NutriTraceWeightTarget)); await wait(60);
  assert.match(d.querySelector('h2').textContent, /^Peso da raggiungere$/);
  await set(d.querySelector('input'), 72.5); d.querySelector('button').click(); await wait(40);
  assert.equal(JSON.parse(w.localStorage.getItem(storageKey)).target, 72.5);
  assert.deepEqual(JSON.parse(w.localStorage.getItem(storageKey)).entries, original.entries);

  app.render(h(w.NutriTraceBodyWeight, null, h(w.NutriTraceWeightCalorieChart, { logs: [], foods: [] }))); await wait(60);
  assert.equal(d.querySelector('[data-v732-weight-target] input').value, '72.5');
  assert.equal(metric('Variazione'), '+4,0 kg');
  await set(d.querySelector('select[aria-label="Periodo delle variazioni di peso"]'), '7');
  assert.equal(metric('Variazione'), '+2,0 kg'); assert.equal(metric('Variazione %'), '+2,94%');
  assert.equal(d.querySelector('svg[aria-label="Andamento del peso corporeo"]').querySelectorAll('circle').length, 2);
  assert.equal(d.querySelector('[data-v732-period-dates]').textContent, dateBefore(6) + ' → ' + dateBefore(0));
  const history = d.querySelector('[data-v732-weight-history]'), comparison = d.querySelector('svg[aria-label="Confronto peso e calorie"]').closest('article');
  assert.ok(comparison.compareDocumentPosition(history) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(history.parentElement.lastElementChild, history);

  history.querySelector('button').click(); await wait(40);
  await set(d.querySelector('input[data-v731-weight]'), 71);
  d.querySelector('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(50);
  assert.equal(metric('Variazione'), '+3,0 kg');
  assert.equal(JSON.parse(w.localStorage.getItem(storageKey)).entries.find(e => e.id === 'today').kg, 71);
  assert.equal(JSON.parse(w.localStorage.getItem(storageKey)).target, 72.5);
  assert.deepEqual(errors, []);
  app.unmount(); dom.window.close();
  console.log('PASS real React: shared target, selected-period variation and chart, history placement, measurement edit; no console errors.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
