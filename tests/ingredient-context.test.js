
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildIngredientContext
} = require('../api/ingredient-context.js');

test('ingredients without quantities remain valid', () => {
  const result = buildIngredientContext(
    'Ingredienti: acqua, avena, olio di girasole, sale'
  );

  assert.equal(result.items.length, 4);
  assert.equal(result.unknownPercentCount, 4);
  assert.equal(result.items[0].percent, null);
});

test('explicit percentages are extracted correctly', () => {
  const result = buildIngredientContext(
    'Farina integrale 58%, olio 14%, avena (8%), cacao 3,5%, sale'
  );

  assert.deepEqual(
    result.items.map(item => item.percent),
    [58, 14, 8, 3.5, null]
  );

  assert.equal(result.explicitPercentTotal, 83.5);
});

test('nested ingredient lists stay together', () => {
  const result = buildIngredientContext(
    'Cioccolato (cacao, burro di cacao, zucchero) 30%, farina'
  );

  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].percent, 30);
});

test('percentages above 100 percent are rejected', () => {
  const result = buildIngredientContext(
    'Farina 80%, acqua 40%'
  );

  assert.ok(result.warnings.length > 0);

  assert.deepEqual(
    result.items.map(item => item.percent),
    [null, null]
  );
});

test('empty input does not fabricate ingredients', () => {
  const result = buildIngredientContext('');

  assert.deepEqual(result.items, []);
});
