'use strict';
(function (root, factory) {
  const v3 = typeof module === 'object' && module.exports ? require('./label-import-v3.js') : root && root.NutriTraceLabelImportV3;
  const api = factory(v3);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NutriTraceLabelImportUiState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (v3) {
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function escapeHtml(value) {
    return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function readFoods(storage) {
    try {
      const raw = storage.getItem('nutritrace_foods');
      if (raw == null || raw === '') return { ok: true, foods: [], raw: raw || '[]' };
      const foods = JSON.parse(raw);
      if (!Array.isArray(foods) || foods.some(food => !food || typeof food !== 'object' || !clean(food.id))) {
        return { ok: false, foods: [], raw, reason: 'Archivio alimenti non valido: i dati originali sono stati preservati.' };
      }
      return { ok: true, foods, raw };
    } catch {
      return { ok: false, foods: [], raw: null, reason: 'Archivio alimenti non leggibile. Nessun dato è stato modificato.' };
    }
  }
  function findTargetCandidates(foods, parsed) {
    const name = normalize(parsed?.product?.name?.status === 'candidate' ? parsed.product.name.value : '');
    const brand = normalize(parsed?.product?.brand?.status === 'candidate' ? parsed.product.brand.value : '');
    if (!name) return [];
    return (Array.isArray(foods) ? foods : []).filter(food => normalize(food?.name) === name)
      .map(food => ({ food, brandMatches: Boolean(brand) && normalize(food?.brand) === brand }));
  }
  function buildSavePlan(parsed, selectedPaths, overwritePaths, existingName = '', target = '') {
    const name = clean(parsed?.product?.name?.status === 'candidate' ? parsed.product.name.value : '');
    const selected = new Set(selectedPaths || []), overwrite = new Set(overwritePaths || []);
    if (!selected.size) return { ok: false, reason: 'Nessun campo selezionato.', selected: [], overwrite: [] };
    if (target === 'new') {
      if (!name || !selected.has('name')) return { ok: false, reason: 'Per creare una scheda, seleziona un nome prodotto estratto esplicitamente dall’etichetta.', selected: [...selected], overwrite: [...overwrite] };
    } else {
      if (!target) return { ok: false, reason: 'Seleziona esplicitamente una scheda esistente o scegli di crearne una nuova.', selected: [...selected], overwrite: [...overwrite] };
      if (!clean(existingName)) return { ok: false, reason: 'La scheda di destinazione non ha un nome valido.', selected: [...selected], overwrite: [...overwrite] };
      selected.delete('name');
      overwrite.delete('name');
    }
    return { ok: true, reason: '', target, selected: [...selected], overwrite: [...overwrite] };
  }
  function createFoodTemplate(existingIds = [], idFactory) {
    const ids = new Set(existingIds.map(String));
    const createId = idFactory || (() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    let id = String(createId());
    while (!id || ids.has(id)) id = String(createId());
    return { id, name: '', brand: '', officialName: '', servingGrams: 100, label: { kcal: '', protein: '', carbs: '', sugar: '', fat: '', saturatedFat: '', fiber: '', salt: '' }, ingredients: '', additives: [], nutrients: [], nutrientStatus: {}, sources: [], notes: '', mergeMeta: null, masterId: null, masterVersion: null, aiRequested: [] };
  }
  function proposalSnapshot(archiveRaw, targetFood, proposals) {
    return { archiveRaw, targetFood: JSON.stringify(targetFood || null), proposals: JSON.stringify(proposals || []) };
  }
  function commitImport({ storage, parsed, target, proposals, selectedPaths, overwritePaths = [], snapshot, confirmed = false, idFactory }) {
    if (!confirmed) return { ok: false, reason: 'Importazione non confermata; nessun dato è stato salvato.' };
    const current = readFoods(storage);
    if (!current.ok) return { ok: false, reason: current.reason };
    if (!snapshot || snapshot.archiveRaw !== current.raw) return { ok: false, stale: true, reason: 'L’archivio è cambiato dopo l’anteprima. Rianalizza l’etichetta prima di salvare.' };
    const isNew = target === 'new';
    const base = isNew ? createFoodTemplate(current.foods.map(food => food.id), idFactory) : current.foods.find(food => food.id === target);
    if (!isNew && !base) return { ok: false, stale: true, reason: 'La scheda selezionata non esiste più. Rianalizza e scegli una destinazione.' };
    if (snapshot.targetFood !== JSON.stringify(isNew ? null : base)) return { ok: false, stale: true, reason: 'La scheda selezionata è cambiata dopo l’anteprima. Rianalizza prima di salvare.' };
    const plan = buildSavePlan(parsed, selectedPaths, overwritePaths, base?.name || '', target);
    if (!plan.ok) return { ok: false, reason: plan.reason };
    const proposalBase = isNew ? {} : base;
    const expectedProposals = v3.makeProposal(proposalBase, parsed);
    if (snapshot.proposals !== JSON.stringify(expectedProposals) || JSON.stringify(proposals) !== snapshot.proposals) {
      return { ok: false, stale: true, reason: 'Le proposte visualizzate non corrispondono più ai dati correnti. Rianalizza prima di salvare.' };
    }
    const food = v3.applyProposal(base, proposals, { confirmed: true, selectedPaths: plan.selected, overwritePaths: plan.overwrite });
    if (!clean(food.name)) return { ok: false, reason: 'Una scheda alimento deve avere un nome. Nessun dato è stato salvato.' };
    food.label = { ...(base.label || {}), ...(food.label || {}) };
    food.ingredients = food.ingredients || '';
    food.additives = [...new Set((String(food.ingredients).toUpperCase().match(/\bE\s?\d{3,4}[A-Z]?\b/g) || []).map(value => value.replace(/\s/g, '')))];
    food.sources = [...(food.sources || []), { id: String((idFactory || (() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`))()), name: 'Etichetta locale', reference: 'Importazione testo locale · nessun OCR esterno', quality: 'primaria' }]
      .filter((source, index, sources) => sources.findIndex(item => item.reference === source.reference) === index);
    let nextFoods;
    if (isNew) {
      const collision = current.foods.some(item => normalize(item.name) === normalize(food.name) && normalize(item.brand || '') === normalize(food.brand || ''));
      if (collision) return { ok: false, stale: true, reason: 'Esiste già una scheda con questo nome e marca. Rianalizza e seleziona esplicitamente quella corretta.' };
      nextFoods = [...current.foods, food];
    } else nextFoods = current.foods.map(item => item.id === base.id ? food : item);
    const expectedSerialized = JSON.stringify(nextFoods);
    try {
      storage.setItem('nutritrace_foods', expectedSerialized);
      const persistedRaw = storage.getItem('nutritrace_foods');
      const persisted = readFoods(storage);
      const savedFood = persisted.ok && persisted.foods.find(item => item.id === food.id);
      if (persistedRaw !== expectedSerialized || !savedFood || JSON.stringify(savedFood) !== JSON.stringify(food)) {
        return { ok: false, reason: 'La verifica dei dati persistiti non corrisponde alla proposta. Controlla l’archivio prima di riprovare.' };
      }
      return { ok: true, food: savedFood, foods: persisted.foods };
    } catch {
      return { ok: false, reason: 'Impossibile salvare o rileggere i dati: storage non disponibile o pieno. I dati precedenti sono stati mantenuti.' };
    }
  }
  return { escapeHtml, normalize, readFoods, findTargetCandidates, buildSavePlan, createFoodTemplate, proposalSnapshot, commitImport };
});
