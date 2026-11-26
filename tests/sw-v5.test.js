'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ORIGIN = 'https://nutritrace-test.example';
const keyOf = value => new URL(typeof value === 'string' ? value : value.url, ORIGIN + '/').href;

function worker(options = {}) {
  const handlers = new Map();
  const stores = new Map();
  const calls = { open: [], addAll: [], put: [], deleted: [], match: [], fetch: [], skipWaiting: 0, claim: 0 };
  let network = options.network || (async request => new Response('network:' + new URL(keyOf(request)).pathname));
  function storage(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }
  const caches = {
    async open(name) {
      calls.open.push(name);
      const entries = storage(name);
      return {
        async match(request){const key=keyOf(request);calls.match.push(key);return entries.has(key)?entries.get(key).clone():undefined;},
        async addAll(requests) {
          calls.addAll.push({ name, requests: Array.from(requests) });
          if (options.coreFailure) throw new Error('Core download failed');
          for (const request of requests) entries.set(keyOf(request), new Response('core:' + request));
        },
        async put(request, response) {
          calls.put.push({ name, url: keyOf(request), status: response.status });
          entries.set(keyOf(request), response.clone());
        }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { calls.deleted.push(name); return stores.delete(name); },
    async match(request) {
      const key = keyOf(request);
      calls.match.push(key);
      for (const entries of stores.values()) if (entries.has(key)) return entries.get(key).clone();
      return undefined;
    }
  };
  const context = vm.createContext({
    console, URL, Response, Promise, caches,
    fetch: async (request, init) => { calls.fetch.push({ url: keyOf(request), init }); return network(request, init); },
    self: {
      location: { origin: ORIGIN },
      addEventListener: (name, fn) => handlers.set(name, fn),
      skipWaiting: async () => { calls.skipWaiting++; },
      clients: { claim: async () => { calls.claim++; } }
    }
  });
  vm.runInContext(SOURCE, context, { filename: 'sw.js' });
  const currentCache = vm.runInContext('CACHE', context);
  return {
    calls, stores, currentCache,
    network(fn) { network = fn; },
    seed(name, request, body) { storage(name).set(keyOf(request), new Response(body)); },
    async stored(name, request) { const value = stores.get(name)?.get(keyOf(request)); return value ? value.clone().text() : undefined; },
    async lifecycle(type) {
      const pending = [];
      handlers.get(type)({ waitUntil: promise => pending.push(promise) });
      await Promise.all(pending);
    },
    async request(url, { method = 'GET', mode = 'cors' } = {}) {
      const pending = [];
      let responsePromise;
      handlers.get('fetch')({
        request: { url: keyOf(url), method, mode },
        waitUntil: promise => pending.push(promise),
        respondWith: promise => { assert.equal(responsePromise, undefined, 'respondWith called twice'); responsePromise = promise; }
      });
      if (responsePromise === undefined) return { intercepted: false };
      const response = await responsePromise;
      await Promise.all(pending);
      return { intercepted: true, response };
    }
  };
}

test('install precaches every local script and stylesheet actually loaded by the app, including V5 modules', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.equal(sw.calls.addAll.length, 1);
  const core = new Set(sw.calls.addAll[0].requests.map(keyOf));
  const localAssets = [...INDEX.matchAll(/(?:src|href)=["'](\.\/[^"']+\.(?:js|css))["']/g)].map(m => m[1]);
  assert.ok(localAssets.length > 20, 'the real app asset list must be exercised');
  for (const asset of localAssets) assert.ok(core.has(keyOf(asset)), `${asset} is loaded by index.html but absent from offline CORE`);
  for (const asset of ['diary-v5.js', 'aurora-v5.js', 'goals-wizard-v5.js', 'nutrition-reference-v5.js', 'aurora-v5.css', 'goals-wizard-v5.css', 'aurora-v5-surfaces.css']) {
    assert.ok(core.has(keyOf('./' + asset)), `Missing V5 asset ${asset}`);
  }
  assert.equal(sw.calls.skipWaiting, 1);
});

test('a failed core download rejects installation before skipWaiting', async () => {
  const sw = worker({ coreFailure: true });
  await assert.rejects(sw.lifecycle('install'), /Core download failed/);
  assert.equal(sw.calls.skipWaiting, 0);
  assert.equal(sw.calls.fetch.length, 0, 'vendor fetches must not start after failed core caching');
});

test('activation removes obsolete app caches but preserves complete offline food data and unrelated caches', async () => {
  const sw = worker();
  sw.seed(sw.currentCache, './app.js', 'current app');
  sw.seed('nutritrace-v3-aurora-v4-20261122', './app.js', 'previous app');
  sw.seed('nutritrace-v5-20261120', './index.html', 'earlier V5');
  sw.seed('nutritrace-v7-20261126-v72', './app.js', 'earlier V72');
  sw.seed('nutrichat-v23-runtime', './data/master/chunks/00.json', 'complete offline master');
  sw.seed('personal-foods-offline', './custom-foods.json', 'personal dataset');
  sw.seed('another-application-cache', '/another-application', 'unrelated');
  await sw.lifecycle('activate');
  assert.deepEqual(sw.calls.deleted.sort(), ['nutritrace-v3-aurora-v4-20261122', 'nutritrace-v5-20261120', 'nutritrace-v7-20261126-v72']);
  assert.equal(await sw.stored('nutrichat-v23-runtime', './data/master/chunks/00.json'), 'complete offline master');
  assert.equal(await sw.stored('personal-foods-offline', './custom-foods.json'), 'personal dataset');
  assert.equal(await sw.stored('another-application-cache', '/another-application'), 'unrelated');
  assert.equal(await sw.stored(sw.currentCache, './app.js'), 'current app');
  assert.equal(sw.calls.claim, 1);
});

test('API requests and non-GET requests bypass the worker completely', async () => {
  const sw = worker();
  for (const [url, method] of [
    ['/api/barcode-lookup?barcode=8000000000001', 'GET'],
    ['/api/analyze-food-image', 'POST'],
    ['/api/coach-chat', 'POST'],
    ['/api/parse-food-entry', 'POST'],
    ['/api/nutrition-enrich', 'GET'],
    ['/custom-endpoint', 'PUT']
  ]) assert.equal((await sw.request(url, { method })).intercepted, false, method + ' ' + url);
  assert.deepEqual(sw.calls.fetch, []);
  assert.deepEqual(sw.calls.match, []);
  assert.deepEqual(sw.calls.put, []);
});

test('V5 app assets use fresh network responses and update the application cache', async () => {
  const sw = worker();
  sw.seed(sw.currentCache, './diary-v5.js', 'stale diary code');
  const result = await sw.request('./diary-v5.js');
  assert.equal(await result.response.text(), 'network:/diary-v5.js');
  assert.equal(sw.calls.fetch[0].init.cache, 'no-store');
  assert.equal(await sw.stored(sw.currentCache, './diary-v5.js'), 'network:/diary-v5.js');
});

test('offline app code falls back to its cached version', async () => {
  const sw = worker({ network: async () => { throw new Error('offline'); } });
  sw.seed(sw.currentCache, './goals-wizard-v5.js', 'cached wizard code');
  const result = await sw.request('./goals-wizard-v5.js');
  assert.equal(result.intercepted, true);
  assert.equal(await result.response.text(), 'cached wizard code');
  assert.equal(sw.calls.put.length, 0);
});

test('offline Master chunks remain readable from the preserved food cache after activation', async () => {
  const sw = worker({ network: async () => { throw new Error('offline'); } });
  sw.seed('nutrichat-v23-runtime', './data/master/chunks/17.json', '{"food":"offline"}');
  sw.seed('nutritrace-v3-aurora-v4-20261122', './index.html', 'old app');
  await sw.lifecycle('activate');
  const result = await sw.request('./data/master/chunks/17.json');
  assert.deepEqual(await result.response.json(), { food: 'offline' });
  assert.equal(sw.calls.fetch[0].init.cache, 'no-store');
});

test('offline navigation falls back to the cached app shell while missing data returns a network error', async () => {
  const sw = worker({ network: async () => { throw new Error('offline'); } });
  sw.seed(sw.currentCache, './index.html', '<main>cached app shell</main>');
  const navigation = await sw.request('/an-uncached-route', { mode: 'navigate' });
  assert.equal(await navigation.response.text(), '<main>cached app shell</main>');
  const missing = await sw.request('./data/master/chunks/99.json');
  assert.equal(missing.response.type, 'error');
  assert.equal(missing.response.status, 0);
});

test('HTTP failures do not replace a usable cached app file', async () => {
  const sw = worker({ network: async () => new Response('unavailable', { status: 503 }) });
  sw.seed(sw.currentCache, './app.js', 'known working app');
  const result = await sw.request('./app.js');
  assert.equal(result.response.status, 503);
  assert.equal(sw.calls.put.length, 0);
  assert.equal(await sw.stored(sw.currentCache, './app.js'), 'known working app');
});


test('V7.3 stale app cache cannot override current code offline, demo navigation gets shell',async()=>{const sw=worker({network:async()=>{throw Error('offline');}});sw.seed('nutritrace-v7-old','./app.js','obsolete');sw.seed(sw.currentCache,'./app.js','current');sw.seed(sw.currentCache,'./index.html','demo-capable shell');assert.equal(await(await sw.request('./app.js')).response.text(),'current');assert.equal(await(await sw.request('/?env=demo',{mode:'navigate'})).response.text(),'demo-capable shell');});
