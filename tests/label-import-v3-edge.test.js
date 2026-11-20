'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLabel } = require('../label-import-v3.js');

test('does not turn unsupported or incomplete input into certain extracted data', () => {
  const parsed = parseLabel('Brand maybe\nIngredients: water, oats,\nNutrition facts per serving\nProtein 5 g');
  assert.equal(parsed.product.brand, null);
  assert.equal(parsed.ingredients.status, 'incomplete');
  assert.equal(parsed.nutrients.find(row => row.key === 'protein').status, 'review');
  assert.equal(parsed.nutrients.find(row => row.key === 'protein').amount, 5);
});
