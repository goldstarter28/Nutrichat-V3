'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../diary-v5.js');
const day = '2026-11-23';
const log = (foodId, grams = 100, date = day, extra = {}) => ({ foodId, grams, date, ...extra });
const food = (id, nutrients = [], extra = {}) => ({ id, name: id, servingGrams: 100, nutrients, ...extra });
const nutrient = (name, amount, unit = 'mg', extra = {}) => ({ name, amount, unit, ...extra });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('numeric parsing accepts decimal comma and explicit zero but rejects unknown, booleans and nonfinite values', () => {
  assert.equal(d.number('12,5'), 12.5);
  assert.equal(d.number(' 0 '), 0);
  for (const v of [null, undefined, '', ' ', false, true, [], {}, '1,2,3', NaN, Infinity]) assert.equal(d.number(v), null);
  for (const v of [0, -1, 10000.1, false, null]) assert.equal(d.positive(v), false);
  assert.equal(d.positive('10000'), true);
  assert.equal(d.convert('1,5', 'g', 'mg'), 1500);
  assert.equal(d.convert(1000, 'µg', 'MG'), 1);
  close(d.convert(255, 'mcg', 'mg'), 0.255);
  assert.equal(d.convert('', 'mg', 'mg'), null);
  assert.equal(d.convert(1, 'IU', 'mg'), null);
  assert.equal(d.convert(1e308, 'g', 'µg'), null);
});

test('recent foods come only from real prior logs, use the last portion, and do not write a weight into the archive', () => {
  const foods = ['a', 'b', 'c', 'd', 'unused'].map(id => food(id));
  const before = structuredClone(foods);
  const logs = [log('a', 40, '2026-11-20'), log('b', 70, '2026-11-21'), log('c', 90, '2026-11-22'), log('a', '125,5'), log('d', 200, '2026-11-24'), log('unused', 0), log('missing', 10), log('unused', 30, '2026-02-30')];
  const result = d.recentFoods(logs, foods, 3, day);
  assert.deepEqual(result.map(x => x.id), ['a', 'c', 'b']);
  assert.equal(result[0].recentLog.grams, 125.5);
  assert.equal(result[0].grams, undefined);
  assert.equal(result[0].resultType, 'personal');
  assert.deepEqual(foods, before);
  assert.equal(logs[3].grams, '125,5');
  assert.equal(d.recentFoods(logs, foods, 0, day).length, 0);
});

test('recent ordering respects timestamps when both exist and insertion order for legacy records without timestamps', () => {
  const foods = [food('a')];
  const old = log('a', 100, day, { createdAt: day + 'T10:00:00Z' });
  assert.equal(d.recentFoods([old, log('a', 200)], foods)[0].recentLog.grams, 200);
  assert.equal(d.recentFoods([old, log('a', 200, day, { createdAt: 'not-a-date' })], foods)[0].recentLog.grams, 200);
  assert.equal(d.recentFoods([log('a', 200, day, { createdAt: day + 'T11:00:00Z' }), old], foods)[0].recentLog.grams, 200);
  assert.equal(d.recentFoods([log('a', 200, day, { timestamp: Date.parse(day + 'T11:00:00Z') }), old], foods)[0].recentLog.grams, 200);
});

test('means exclude days with no values, include measured zero, and report missing food mass in coverage', () => {
  const foods = [food('known', [], { label: { kcal: 100 } }), food('zero', [], { label: { kcal: 0 } }), food('unknown', [], { label: { kcal: '' } })];
  const logs = [log('known', 100, '2026-11-20'), log('removed', 100, '2026-11-20'), log('unknown', 100, '2026-11-21'), log('zero', 100, '2026-11-22')];
  const s = d.stats(logs, foods, { id: 'kcal' });
  assert.equal(s.sum, 100);
  assert.equal(s.average, 50);
  assert.equal(s.knownDays, 2);
  assert.equal(s.loggedDays, 3);
  assert.equal(s.coverage, 0.5);
  assert.equal(s.daily[1].value, null);
  assert.equal(s.daily[2].value, 0);
  assert.equal(s.comparisonAvailable, true);
  const unknown = d.stats([log('unknown')], foods, { id: 'kcal' });
  assert.equal(unknown.sum, null);
  assert.equal(unknown.average, null);
  assert.equal(unknown.knownDays, 0);
  assert.equal(unknown.loggedDays, 1);
  assert.equal(unknown.comparisonAvailable, false);
});

test('stats handle decimal comma, converted nutrient units and serving size without losing zeros', () => {
  const foods = [food('a', [nutrient('Vitamina B6', '2,5')], { servingGrams: '50' }), food('b', [nutrient('Vitamina B6', 0)])];
  const s = d.stats([log('a', '12,5'), log('b', 100)], foods, { name: 'Vitamina B6', unit: 'g' });
  close(s.sum, 0.000625);
  assert.equal(s.knownCount, 2);
  assert.equal(s.coverage, 1);
  const invalid = d.stats([log('a')], [food('a', [nutrient('Vitamina B6', -2), nutrient('Vitamina B6', 2, 'IU')])], { name: 'Vitamina B6', unit: 'mg' });
  assert.equal(invalid.sum, null);
});

test('invalid explicit serving bases are unknown, while absent legacy bases retain the per-100-g convention', () => {
  for (const base of [0, -10, '0', false, 'invalid']) {
    const s = d.stats([log('a')], [food('a', [], { servingGrams: base, label: { kcal: 200 } })], { id: 'kcal' });
    assert.equal(s.sum, null, String(base));
    assert.equal(s.coverage, 0);
    assert.equal(s.loggedDays, 1);
  }
  const s = d.stats([log('a')], [{ id: 'a', label: { kcal: 200 } }], { id: 'kcal' });
  assert.equal(s.sum, 200);
  assert.equal(d.stats([log('a', true), log('a', 10, '2026-02-30')], [], { id: 'kcal' }).loggedDays, 0);
});

test('estimates, low-quality numeric data and portion uncertainty remain separate flags', () => {
  const foods = [
    food('low', [nutrient('Calcio', 200, 'mg', { source: 'NutriTrace Master DB', grade: 'D', auditWarning: 'dispersion' })]),
    food('ai', [nutrient('Calcio', 100, 'mg', { aiEstimate: true })]),
    food('portion', [nutrient('Calcio', 150, 'mg', { grade: 'A' })])
  ];
  const s = d.stats([log('low'), log('ai'), log('portion', 100, day, { portionEstimatedByAI: true })], foods, { name: 'Calcio', unit: 'mg' });
  assert.equal(s.sum, 450);
  assert.equal(s.coverage, 1);
  assert.equal(s.referenceCoverage, 0);
  assert.equal(s.estimatedCount, 2);
  assert.equal(s.nutrientEstimateCount, 1);
  assert.equal(s.portionEstimateCount, 1);
  assert.equal(s.limitedQualityCount, 1);
  assert.equal(s.daily[0].limitedQuality, true);
  assert.equal(s.daily[0].portionEstimated, true);
  const lowOnly = d.stats([log('low')], foods, { name: 'Calcio', unit: 'mg' });
  assert.equal(lowOnly.estimatedCount, 0);
  assert.equal(lowOnly.limitedQualityCount, 1);
  const macro = d.stats([log('m')], [food('m', [], { label: { kcal: 200 }, labelEvidence: { kcal: 'stima AI' } })], { id: 'kcal' });
  assert.equal(macro.estimatedCount, 1);
});

test('RE/RAE, NE/niacin, DFE/total folate and vitamin forms are not silently treated as equivalent', () => {
  const pairs = [
    ['Vitamina A', 'µg', 'RE', 'vitamin_a_rae', 'vitamin_a_retinol_equivalent'],
    ['Niacina B3', 'mg', 'NE', 'niacin_b3', 'niacin_equivalent'],
    ['Folati', 'µg', 'DFE', 'folate_total_b9', 'folate_dfe'],
    ['Vitamina E', 'mg', 'alpha-tocopherol', 'vitamin_e_alpha_te', 'alpha_tocopherol'],
    ['Vitamina K', 'µg', 'phylloquinone', 'vitamin_k', 'vitamin_k1']
  ];
  for (const [name, unit, basis, bad, good] of pairs) {
    const goal = { name, unit, referenceBasis: basis };
    const incompatible = d.stats([log('a')], [food('a', [nutrient(name, 40, unit, { canonicalId: bad })])], goal);
    assert.equal(incompatible.sum, 40, name);
    assert.equal(incompatible.comparisonAvailable, false, name);
    assert.equal(incompatible.basisUncertain, true);
    assert.ok(incompatible.basisReason.includes(basis));
    assert.equal(incompatible.referenceCoverage, 0);
    assert.equal(incompatible.daily[0].comparisonAvailable, false);
    const compatible = d.stats([log('a')], [food('a', [nutrient(name, 40, unit, { canonicalId: good })])], goal);
    assert.equal(compatible.comparisonAvailable, true, name);
    const unlabelled = d.stats([log('a')], [food('a', [nutrient(name, 40, unit)])], goal);
    assert.equal(unlabelled.comparisonAvailable, false, name);
    const explicit = d.stats([log('a')], [food('a', [nutrient(name, 40, unit, { basis })])], goal);
    assert.equal(explicit.comparisonAvailable, true, name);
  }
});

test('a mixture with an unknown chemical basis blocks only the comparison, preserving its reported quantities', () => {
  const foods = [food('a', [nutrient('Vitamina A', 300, 'µg', { basis: 'RE' })]), food('b', [nutrient('Vitamina A', 100, 'µg', { canonicalId: 'vitamin_a_rae', basis: 'RE' })])];
  const s = d.stats([log('a'), log('b')], foods, { name: 'Vitamina A', unit: 'µg', referenceBasis: 'RE' });
  assert.equal(s.sum, 400);
  assert.equal(s.comparisonAvailable, false);
  assert.equal(s.coverage, 1);
  assert.equal(s.referenceCoverage, 0.5);
  const custom = d.stats([log('b')], foods, { name: 'Vitamina A', unit: 'µg', group: 'Personalizzati' });
  assert.equal(custom.comparisonAvailable, true);
});

test('combined totals prefer the explicit aggregate once and treat missing components as a partial amount', () => {
  const goal = { name: 'EPA + DHA', unit: 'mg', components: ['EPA', 'DHA'] };
  const both = food('a', [nutrient('EPA + DHA', 250), nutrient('EPA', 100), nutrient('DHA', 150)]);
  const direct = d.stats([log('a')], [both], goal);
  assert.equal(direct.sum, 250);
  assert.equal(direct.coverage, 1);
  assert.equal(direct.partialCount, 0);
  const components = d.stats([log('a')], [food('a', [nutrient('EPA', 100), nutrient('DHA', 150)])], goal);
  assert.equal(components.sum, 250);
  assert.equal(components.coverage, 1);
  const partial = d.stats([log('a')], [food('a', [nutrient('EPA', 100)])], goal);
  assert.equal(partial.sum, 100);
  assert.equal(partial.coverage, 0);
  assert.equal(partial.partialCount, 1);
  const zero = d.stats([log('a')], [food('a', [nutrient('EPA + DHA', 0), nutrient('EPA', 100)])], goal);
  assert.equal(zero.sum, 0);
  assert.equal(zero.coverage, 1);
});

test('daily target conversion keeps periods and user mass units without fabricating missing weights', () => {
  assert.equal(d.dailyTarget({ target: '7', period: 'week' }), 1);
  assert.equal(d.dailyTarget({ perKg: '0,5', targetMode: 'perKg', period: 'week' }, 70), 5);
  for (const weight of [null, undefined, 0, false, -1]) assert.equal(d.dailyTarget({ perKg: 0.5, targetMode: 'perKg' }, weight), null);
  assert.equal(d.dailyTarget({ target: 0 }), null);
  assert.equal(d.dailyTarget({ target: false }), null);
});

test('recipe normalization handles comma quantities and rejects invalid or duplicate recipes without mutation', () => {
  const valid = { id: 'r', name: 'Risotto', yieldGrams: '250,5', servings: '2', ingredients: [{ foodId: 'rice', name: 'Riso', grams: '100,5', metadata: { quantity: '100,5', unit: 'g', portionEstimatedByAI: true } }] };
  const before = structuredClone(valid);
  const result = d.normalizeRecipes([valid, { ...valid, name: 'Duplicate' }, { ...valid, id: 'bad', yieldGrams: false }, { ...valid, id: 'bad2', ingredients: [{ foodId: 'rice', grams: -1 }] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].yieldGrams, 250.5);
  assert.equal(result[0].ingredients[0].grams, 100.5);
  assert.equal(result[0].ingredients[0].metadata.quantity, 100.5);
  assert.deepEqual(valid, before);
});

test('recipe portions scale raw ingredient amounts, quantity and estimate ranges by the cooked yield', () => {
  const recipe = { id: 'r', name: 'Piatto', yieldGrams: 250, ingredients: [
    { foodId: 'milk', name: 'Latte', grams: 200, metadata: { quantity: 200, unit: 'ml', gramsPerUnit: 1, portionEstimatedMinGrams: 180, portionEstimatedMaxGrams: 220, portionEstimatedByAI: true } },
    { foodId: 'rice', name: 'Riso', grams: 100 }
  ] };
  const before = structuredClone(recipe);
  const result = d.scaleRecipe(recipe, '125,0', [food('milk'), food('rice')]);
  assert.deepEqual(result.map(x => x.grams), [100, 50]);
  assert.equal(result[0].quantity, 100);
  assert.equal(result[0].unit, 'ml');
  assert.equal(result[0].gramsPerUnit, 1);
  assert.equal(result[0].portionEstimatedMinGrams, 90);
  assert.equal(result[0].portionEstimatedMaxGrams, 110);
  assert.equal(result[0].portionEstimatedByAI, true);
  assert.equal(result[0].entryOrigin, 'saved-recipe-v5');
  assert.equal(result[0].recipeConsumedGrams, 125);
  assert.deepEqual(recipe, before);
  assert.throws(() => d.scaleRecipe(recipe, 100, [food('rice')]), /archivio/);
  for (const amount of [0, -1, false, Infinity]) assert.throws(() => d.scaleRecipe(recipe, amount, [food('milk'), food('rice')]), /porzione/);
});

test('quick products reuse the archive and keep absent nutrients unknown, without storing a recent portion', () => {
  const existing = food('old', [nutrient('Calcio', 100)], { name: 'Latte', brand: 'Marca', barcode: '123', label: { kcal: 60 } });
  const before = structuredClone(existing);
  const reused = d.productFood({ name: 'Nuovo nome', barcode: '123', label: { kcal: 999 } }, [existing], 'new');
  assert.equal(reused.existing, true);
  assert.equal(reused.food, existing);
  assert.deepEqual(existing, before);
  assert.equal(d.productFood({ name: 'latte', brand: 'marca' }, [existing], 'new').food, existing);
  const created = d.productFood({ name: 'Photo', label: { kcal: '125,5', fat: 0, protein: '', fiber: null, sugar: false } }, [], 'new').food;
  assert.equal(created.label.kcal, 125.5);
  assert.equal(created.label.fat, 0);
  assert.equal(created.label.protein, '');
  assert.equal(created.label.fiber, '');
  assert.equal(created.label.sugar, '');
  assert.deepEqual(created.nutrients, []);
  assert.equal(created.grams, undefined);
  assert.equal(created.recentLog, undefined);
});
