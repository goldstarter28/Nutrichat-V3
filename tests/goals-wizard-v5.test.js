'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wizard = require('../goals-wizard-v5.js');

const adult = {
  goal: 'maintain', age: 35, sex: 'male', height: 178, weight: 75,
  careContext: 'none', activity: 'light', trainingDays: '3-4', trainingType: 'mixed',
  dietaryPattern: 'omnivore', mealsPerDay: '4', schedule: 'regular', cookingTime: 'quick',
  foodPriorities: ['simple'], hydrationHabits: 'regular', sleep: 'regular', focus: 'logging', confidence: 'small'
};
const profile = { weight: 72, customProperty: 'keep', macroPlan: { calorieMode: 'derived', kcal: 2350, autoMacro: 'protein', perKg: { protein: 140 / 72, carbs: 300 / 72, fat: 0.8, sugar: 60 / 72, fiber: 35 / 72 } } };
const goals = [
  { id: 'kcal', name: 'Energia', group: 'Energia e macro', target: 2350, targetMode: 'absolute', unit: 'kcal', period: 'day' },
  ...['protein', 'carbs', 'fat', 'fiber'].map(id => ({ id, name: id, group: 'Energia e macro', target: 100, perKg: 1, targetMode: 'perKg', unit: 'g', period: 'day' })),
  { id: 'sugar', name: 'Zuccheri semplici', group: 'Energia e macro', target: 60, targetMode: 'perKg', perKg: 60 / 72, unit: 'g', period: 'day', kind: 'upper' },
  { id: 'Calcio', name: 'Calcio', group: 'Minerali e oligoelementi', target: 7000, targetMode: 'absolute', unit: 'mg', period: 'week', pinned: true, customNote: 'keep' },
  { id: 'custom-id', name: 'Mio riferimento', group: 'Personalizzati', target: 3, targetMode: 'perKg', perKg: 0.05, unit: 'g', period: 'day' }
];
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('conditional paths never exceed 20 questions and remove irrelevant questions', () => {
  assert.equal(wizard.QUESTIONS.length, 20);
  const female = { ...adult, sex: 'female', physiologicalState: 'none', menstrualStatus: 'menstruating' };
  assert.equal(wizard.getQuestions(female).length, 20);
  assert.equal(wizard.getQuestions(adult).length, 18);
  assert.equal(wizard.getQuestions({ ...adult, trainingDays: '0' }).length, 17);
  assert.ok(!wizard.getQuestions({ ...female, physiologicalState: 'pregnant' }).some(x => x.id === 'menstrualStatus'));
});

test('known Mifflin case uses PAL once and keeps exact energy arithmetic', () => {
  const plan = wizard.calculatePlan(adult);
  assert.equal(plan.eligible, true);
  assert.equal(plan.bmr, 1692.5);
  assert.equal(plan.pal, 1.6);
  assert.equal(plan.maintenance, 2708);
  assert.equal(plan.kcal, 2708);
  const macroEnergy = plan.grams.protein * 4 + plan.grams.carbs * 4 + plan.grams.fat * 9;
  assert.ok(Math.abs(macroEnergy - plan.kcal) < 1e-8);
  assert.equal(plan.grams.fiber, 25);
  assert.equal(wizard.calculatePlan({ ...adult, trainingDays: '5+', trainingType: 'strength' }).kcal, plan.kcal);
  assert.equal(wizard.calculatePlan({ ...adult, goal: 'lose' }).kcal, 2437);
  assert.equal(wizard.calculatePlan({ ...adult, goal: 'gain' }).kcal, 2843);
});

test('female formula is explicit and a missing physiological answer blocks calculation', () => {
  assert.equal(wizard.calculatePlan({ ...adult, sex: 'female' }).eligible, false);
  const plan = wizard.calculatePlan({ ...adult, sex: 'female', physiologicalState: 'none' });
  assert.equal(plan.eligible, true);
  assert.equal(plan.bmr, 1526.5);
});

test('protected contexts keep all existing goals and weight-based targets unchanged', () => {
  const contexts = [
    { age: 17 }, { age: 79 }, { sex: 'manual' }, { careContext: 'professional' },
    { careContext: 'unknown' }, { sex: 'female', physiologicalState: 'pregnant' },
    { sex: 'female', physiologicalState: 'lactating' }, { weight: 45 },
    { goal: 'lose', age: 70 }, { goal: 'lose', weight: 61 }
  ];
  for (const patch of contexts) {
    const result = wizard.applyPlan(profile, goals, { ...adult, ...patch }, { updateMicros: true });
    assert.equal(result.summary.eligible, false, JSON.stringify(patch));
    assert.deepEqual(result.goals, goals, JSON.stringify(patch));
    assert.equal(result.profile.weight, profile.weight);
    assert.deepEqual(result.profile.macroPlan, profile.macroPlan);
    assert.equal(result.profile.wizardV5.version, 1);
  }
});

test('applying goals preserves source objects, custom settings, sugar amount and micro targets', () => {
  const oldProfile = structuredClone(profile), oldGoals = structuredClone(goals);
  const result = wizard.applyPlan(profile, goals, adult, { now: '2026-11-23T12:00:00Z' });
  assert.deepEqual(profile, oldProfile);
  assert.deepEqual(goals, oldGoals);
  assert.equal(result.profile.weight, 75);
  assert.equal(result.profile.customProperty, 'keep');
  assert.equal(result.profile.macroPlan.calorieMode, 'fixed');
  assert.equal(result.profile.macroPlan.autoMacro, 'carbs');
  assert.equal(result.profile.wizardV5.completedAt, '2026-11-23T12:00:00Z');
  assert.equal(result.goals.find(x => x.id === 'kcal').target, 2708);
  assert.ok(Math.abs(result.goals.find(x => x.id === 'sugar').perKg * 75 - 60) < 1e-9);
  assert.deepEqual(result.goals.find(x => x.id === 'Calcio'), goals.find(x => x.id === 'Calcio'));
  assert.deepEqual(result.goals.find(x => x.id === 'custom-id'), goals.find(x => x.id === 'custom-id'));
  assert.deepEqual(result.updatedMicronutrients, []);
});

test('micro reference replacement requires explicit opt-in and converts unit and weekly period', () => {
  const references = {
    version: 'test',
    referenceForGoal: name => name === 'Calcio' ? { value: 0.95, unit: 'g', type: 'PRI', kind: 'minimum', autoApplicable: true, sourceIds: ['efsa-calcium'], upperLimit: { value: 2500, unit: 'mg', scope: 'total' } } : null
  };
  const unchanged = wizard.applyPlan(profile, goals, adult, { references });
  assert.equal(unchanged.goals.find(x => x.id === 'Calcio').target, 7000);
  const result = wizard.applyPlan(profile, goals, adult, { references, updateMicros: true });
  const calcium = result.goals.find(x => x.id === 'Calcio');
  assert.ok(Math.abs(calcium.target - 6650) < 1e-8);
  assert.equal(calcium.targetMode, 'absolute');
  assert.equal(calcium.unit, 'mg');
  assert.equal(calcium.period, 'week');
  assert.equal(calcium.pinned, true);
  assert.equal(calcium.referencePending, false);
  assert.equal(calcium.noOfficialTarget, false);
  assert.equal(calcium.customNote, 'keep');
  assert.equal(calcium.ul, undefined, 'A scoped upper limit must never be copied into a scalar daily goal');
  assert.deepEqual(result.updatedMicronutrients, ['Calcio']);
});

test('references that cannot be applied are not replaced even after opt-in', () => {
  for (const ref of [null, { autoApplicable: false, value: 400, unit: 'mg' }, { autoApplicable: true, value: null, unit: 'mg' }, { autoApplicable: true, value: 1, unit: 'IU' }]) {
    const result = wizard.applyPlan(profile, goals, adult, { updateMicros: true, references: { referenceForGoal: () => ref } });
    assert.deepEqual(result.goals.find(x => x.id === 'Calcio'), goals.find(x => x.id === 'Calcio'));
  }
  const customInStandardGroup = { id: 'user-defined', name: 'Calcio', group: 'Minerali e oligoelementi', target: 14, unit: 'mg', period: 'day' };
  const result = wizard.applyPlan(profile, [...goals, customInStandardGroup], adult, { updateMicros: true, references: { referenceForGoal: () => ({ autoApplicable: true, value: 950, unit: 'mg' }) } });
  assert.deepEqual(result.goals.find(x => x.id === 'user-defined'), customInStandardGroup);
});

test('Coach context allowlist excludes physiological, medical and identifying numeric data', () => {
  const context = wizard.contextForCoach({ ...adult, sex: 'female', physiologicalState: 'none', menstrualStatus: 'menstruating', careContext: 'professional', arbitrarySecret: 'never' });
  assert.deepEqual(Object.keys(context).sort(), ['activity', 'cookingTime', 'focus', 'goal', 'mealPattern', 'preferences', 'training']);
  const json = JSON.stringify(context);
  for (const forbidden of ['physiologicalState', 'menstrualStatus', 'careContext', 'weight', 'height', 'age', 'sleep', 'arbitrarySecret', 'never']) assert.ok(!json.includes('"' + forbidden + '"'));
});

test('draft round trip sanitizes unknown fields, survives malformed storage and uses a known step', () => {
  const storage = memoryStorage();
  assert.equal(wizard.saveDraft({ ...adult, secret: 'drop' }, 'activity', storage), true);
  const draft = wizard.readDraft(storage);
  assert.equal(draft.questionId, 'activity');
  assert.equal(draft.answers.secret, undefined);
  assert.equal(draft.answers.age, 35);
  assert.equal(wizard.clearDraft(storage), true);
  assert.equal(wizard.readDraft(storage), null);
  storage.setItem(wizard.DRAFT_KEY, '{');
  assert.equal(wizard.readDraft(storage), null);
  storage.setItem(wizard.DRAFT_KEY, JSON.stringify({ version: 999, answers: adult }));
  assert.equal(wizard.readDraft(storage), null);
  const broken = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('disabled'); } };
  assert.equal(wizard.readDraft(broken), null);
  assert.equal(wizard.saveDraft(adult, 'goal', broken), false);
  assert.equal(wizard.clearDraft(broken), false);
});

test('validation rejects malformed, out-of-range, nonfinite and unknown answers', () => {
  const age = wizard.QUESTIONS.find(x => x.id === 'age');
  for (const value of ['', null, undefined, NaN, Infinity, 'abc', -1, 101, 35.5]) assert.equal(wizard.validateAnswer(age, value), false);
  assert.equal(wizard.validateAnswer(age, '35'), true);
  assert.deepEqual(wizard.sanitizeAnswers({ age: 35, sex: 'anything', foodPriorities: ['simple', 'secret'], weight: 75, random: 'text' }), { age: 35, weight: 75 });
  assert.equal(wizard.displayNumber(1.23456789), '1,23');
  assert.equal(wizard.displayNumber(140.00000000003), '140');
});

test('live scientific references can be consumed without changing unknown or custom targets', () => {
  let references;
  try { references = require('../nutrition-reference-v5.js'); } catch (_) { return; }
  const result = wizard.applyPlan(profile, goals, adult, { updateMicros: true, references });
  assert.equal(result.profile.wizardV5.version, 1);
  assert.deepEqual(result.goals.find(x => x.id === 'custom-id'), goals.find(x => x.id === 'custom-id'));
  assert.ok(result.goals.find(x => x.id === 'Calcio').target > 0);
});
