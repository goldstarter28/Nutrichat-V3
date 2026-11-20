// NutriTrace V3 food template compatibility. Kept in a separate module so persistence
// and UI tests exercise the same data model that the existing app uses.
const { randomUUID } = require('node:crypto');
const MACRO_KEYS = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'saturatedFat', 'fiber', 'salt'];
function createFoodTemplate(id) {
  return {
    id: id || randomUUID(), name: '', brand: '', officialName: '', servingGrams: 100,
    label: Object.fromEntries(MACRO_KEYS.map(key => [key, ''])), ingredients: '', additives: [], nutrients: [],
    nutrientStatus: {}, sources: [], notes: '', mergeMeta: null, masterId: null, masterVersion: null, aiRequested: []
  };
}
module.exports = { createFoodTemplate };
