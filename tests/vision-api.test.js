
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/analyze-food-image.js');

const originalFetch = global.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;
const originalModel = process.env.OPENROUTER_VISION_MODEL;

const IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

async function invoke(body, method = 'POST') {
  const res = responseMock();
  await handler({ method, body }, res);
  return res;
}

function aiReply(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return status === 200
        ? {
            model: 'test-vision-model',
            choices: [{
              finish_reason: 'stop',
              message: {
                content: JSON.stringify(payload)
              }
            }]
          }
        : { error: { message: 'Provider unavailable' } };
    }
  };
}

function validLabel() {
  const names = [
    'kcal', 'protein', 'carbs', 'sugar',
    'fat', 'saturatedFat', 'fiber', 'salt'
  ];

  return {
    type: 'label',
    name: 'Yogurt naturale',
    brand: 'Marca test',
    ingredients: 'Latte, fermenti lattici',
    basis: 'per_100g',
    label: Object.fromEntries(
      names.map(name => [name, null])
    ),
    evidence: Object.fromEntries(
      names.map(name => [name, 'unknown'])
    ),
    dishDescription: '',
    portions: [],
    uncertainty: [],
    warning: ''
  };
}

test.beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_VISION_MODEL = 'test-model';
  global.fetch = async () => {
    throw new Error('Unexpected external request');
  };
});

test.afterEach(() => {
  global.fetch = originalFetch;

  if (originalKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalKey;
  }

  if (originalModel === undefined) {
    delete process.env.OPENROUTER_VISION_MODEL;
  } else {
    process.env.OPENROUTER_VISION_MODEL = originalModel;
  }
});

test('rejects unsupported HTTP methods', async () => {
  const res = await invoke({}, 'GET');
  assert.equal(res.statusCode, 405);
});

test('rejects missing images', async () => {
  const res = await invoke({});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'INVALID_IMAGE');
});

test('rejects malformed JSON', async () => {
  const res = await invoke('{not-json');
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'INVALID_JSON');
});

test('accepts a valid nutritional label', async () => {
  const label = validLabel();
  label.label.protein = 8.5;
  label.evidence.protein = 'readable';

  global.fetch = async () => aiReply(label);

  const res = await invoke({ image: IMAGE });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.label.protein, 8.5);
  assert.equal(res.body.basis, 'per_100g');
  assert.equal(res.body.version, 'vision-v3-validated');
});

test('rejects numeric strings from AI', async () => {
  const label = validLabel();
  label.label.protein = '8.5';
  label.evidence.protein = 'readable';

  let calls = 0;
  global.fetch = async () => {
    calls++;
    return aiReply(label);
  };

  const res = await invoke({ image: IMAGE });

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'INVALID_AI_RESPONSE');
  assert.equal(calls, 2);
});

test('does not import values with unknown basis', async () => {
  const label = validLabel();
  label.basis = 'unknown';
  label.label.protein = 8.5;
  label.evidence.protein = 'readable';

  global.fetch = async () => aiReply(label);

  const res = await invoke({ image: IMAGE });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.label.protein, null);
});

test('retries an incomplete response', async () => {
  let calls = 0;

  global.fetch = async () => {
    calls++;
    return aiReply(
      calls === 1
        ? { type: 'dish' }
        : validLabel()
    );
  };

  const res = await invoke({ image: IMAGE });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.attempts, 2);
  assert.equal(calls, 2);
});

test('handles provider rate limits', async () => {
  global.fetch = async () => aiReply(null, 429);

  const res = await invoke({ image: IMAGE });

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, 'RATE_LIMIT');
});

test('rejects incomplete portion structures', async () => {
  const payload = validLabel();
  payload.type = 'dish';
  payload.dishDescription = 'Pasta al pomodoro';
  payload.portions = [{
    name: 'Pasta',
    estimatedGrams: '150',
    minGrams: 100,
    maxGrams: 200,
    confidence: 'medium',
    reason: 'Stima visiva',
    preparation: 'Cotta'
  }];

  global.fetch = async () => aiReply(payload);

  const res = await invoke({ image: IMAGE });

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'INVALID_AI_RESPONSE');
});
