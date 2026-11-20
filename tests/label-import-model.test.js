'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFoodTemplate } = require('./fixtures/food-template.js');

test('existing app food template exposes all fields expected by the V2.3 edit and save flow', () => {
  const food = createFoodTemplate('test-id');
  assert.equal(food.id, 'test-id');
  for (const key of ['name', 'brand', 'officialName', 'servingGrams', 'label', 'ingredients', 'additives', 'nutrients', 'nutrientStatus', 'sources', 'notes', 'mergeMeta', 'masterId', 'masterVersion', 'aiRequested']) assert.ok(key in food);
  assert.deepEqual(Object.keys(food.label), ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'saturatedFat', 'fiber', 'salt']);
});
