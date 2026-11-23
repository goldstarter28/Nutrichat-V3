'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const n = require('../nutrition-reference-v5.js');
const adult = { age: 35, sex: 'male', weight: 80, kcal: 2400, physiologicalState: 'none', clinical: false };
const ref = (name, overrides) => n.referenceForGoal(name, { ...adult, ...overrides });

test('reference selection respects age and the physiological context without guessing menopause', () => {
  assert.equal(ref('Calcio', { age: 24 }).value, 1000);
  assert.equal(ref('Calcio', { age: 25 }).value, 950);
  assert.equal(ref('Ferro').value, 11);
  assert.equal(ref('Ferro', { sex: 'female', menstrualStatus: 'menstruating' }).value, 16);
  assert.equal(ref('Ferro', { sex: 'female', menstrualStatus: 'postmenopause' }).value, 11);
  assert.equal(ref('Ferro', { sex: 'female', age: 70 }).autoApplicable, false);
  assert.equal(ref('Ferro', { sex: 'female', age: 70 }).value, null);
  assert.equal(ref('Magnesio', { sex: 'female' }).value, 300);
  assert.equal(ref('Magnesio', { sex: 'unspecified' }).autoApplicable, false);
});

test('a generic adult reference is not automatically applied to minors or special circumstances', () => {
  for (const overrides of [{ age: 17 }, { age: '' }, { age: null }, { age: false }, { age: Infinity }, { clinical: true }, { physiologicalState: 'pregnant' }, { physiologicalState: 'lactating' }, { physiologicalState: 'unknown' }]) {
    const result = ref('Vitamina B12', overrides);
    assert.equal(result.autoApplicable, false, JSON.stringify(overrides));
    assert.equal(result.value, null);
    assert.equal(result.upperLimit, null);
  }
});

test('energy-dependent references retain calculation precision and require real energy input', () => {
  assert.ok(Math.abs(ref('Tiamina B1').value - 1.00416) < 1e-10);
  assert.ok(Math.abs(ref('Niacina B3').value - 16.06656) < 1e-10);
  assert.ok(Math.abs(ref('ALA').value - 2400 * 0.005 / 9) < 1e-10);
  assert.ok(Math.abs(ref('Acido linoleico (LA)').value - 2400 * 0.04 / 9) < 1e-10);
  for (const kcal of ['', null, false, -1, Infinity]) assert.equal(ref('ALA', { kcal }).autoApplicable, false);
});

test('zinc never infers phytate exposure from the diet label', () => {
  assert.equal(ref('Zinco', { dietaryPattern: 'vegan' }).value, null);
  assert.equal(ref('Zinco', { zincPhytate: 'moderate' }).value, 11.7);
  assert.equal(ref('Zinco', { sex: 'female', zincPhytate: 1200 }).value, 12.7);
});

test('combined fats and amino acid references cannot create unsupported separate goals', () => {
  assert.equal(ref('EPA + DHA').value, 250);
  assert.equal(ref('EPA').autoApplicable, false);
  assert.equal(ref('DHA').autoApplicable, false);
  assert.equal(ref('Cromo').autoApplicable, false);
  assert.equal(ref('Fluoro').autoApplicable, false);
  assert.equal(ref('Leucina').type, 'AR');
  assert.equal(ref('Leucina').value, 3.12);
  assert.equal(ref('Leucina').autoApplicable, false);
});

test('upper limits keep correct units, scope, and distinction from safe levels', () => {
  assert.equal(n.limitForGoal('Vitamina B6', adult).value, 12);
  assert.equal(n.limitForGoal('Selenio', adult).value, 255);
  assert.equal(n.limitForGoal('Zinco', adult).value, 25);
  assert.equal(n.limitForGoal('Fluoro', adult).type, 'safe-level');
  assert.equal(n.limitForGoal('Fluoro', adult).value, 3.3);
  assert.equal(n.limitForGoal('Ferro', adult).type, 'safe-level');
  assert.equal(n.limitForGoal('Rame', adult).unit, 'mg');
  assert.ok(Math.abs(n.limitForGoal('Rame', adult).value - 5.6) < 1e-10);
  for (const name of ['Vitamina A', 'Folati', 'Magnesio', 'Niacina B3', 'Vitamina E', 'Ferro', 'Manganese', 'Rame', 'Fluoro']) {
    assert.equal(n.limitForGoal(name, adult).canCompareTotal, false, name);
    assert.equal(n.catalogMetadataPatch(name).ul, null, name);
  }
  assert.equal(n.catalogMetadataPatch('Vitamina B6', 'g').ul, 0.012);
  assert.ok(Math.abs(n.catalogMetadataPatch('Selenio', 'mg').ul - 0.255) < 1e-10);
  assert.equal(n.catalogMetadataPatch('Selenio', 'mcg').ul, 255);
  assert.equal(n.catalogMetadataPatch('Vitamina B6', 'G').ul, 0.012);
  assert.match(n.catalogMetadataPatch('Vitamina D').ulNote, /calcidiolo/);
  assert.equal(n.catalogMetadataPatch('Vitamina B6', 'kcal').ul, null);
});

test('catalog metadata updates cannot overwrite saved targets, period, type, or per-kg preferences', () => {
  const saved = { name: 'Vitamina B6', target: 20, perKg: 0.25, targetMode: 'perKg', period: 'week', kind: 'target', unit: 'mg', pinned: true, ul: 100 };
  const after = { ...saved, ...n.catalogMetadataPatch(saved.name, saved.unit) };
  for (const property of ['target', 'perKg', 'targetMode', 'period', 'kind', 'unit', 'pinned']) assert.equal(after[property], saved[property]);
  assert.equal(after.ul, 12);
  assert.equal(saved.ul, 100);
});

test('source mapping covers all audited nutrients and contains no implied AI certification', () => {
  assert.equal(n.auditRows.length, 47);
  for (const row of n.auditRows) {
    assert.ok(row.sourceIds.length > 0);
    for (const id of [...row.sourceIds, ...(row.safety?.sourceIds || [])]) {
      assert.ok(n.sourceById[id], id);
      assert.match(n.sourceById[id].url, /^https:\/\//);
    }
    const result = ref(row.name);
    assert.equal(result.period, 'day');
    if (result.autoApplicable) assert.ok(Number.isFinite(result.value) && result.value > 0);
  }
  assert.equal(n.referenceForGoal('mio nutriente custom', adult), null);
  assert.deepEqual(n.catalogMetadataPatch('mio nutriente custom'), {});
});
