(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NutriTraceDiaryV5 = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[µμ]/g, 'u').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  function number(v) {
    if (v === null || v === undefined || typeof v === 'boolean' || (typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '') return null;
    var n = Number(String(v).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function positive(v) { var n = number(v); return n !== null && n > 0 && n <= 10000; }
  function validDate(v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false; var d = new Date(v + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v; }
  function format(v, digits) { var n = number(v); return n === null ? 'N/D' : n.toLocaleString('it-IT', { maximumFractionDigits: digits === undefined ? 2 : digits }); }
  function unit(v) { var s = String(v || '').trim().toLowerCase().replace(/[µμ]/g, 'u'); return s === 'mcg' ? 'ug' : s; }
  function convert(v, from, to) {
    var n = number(v), f = { g: 1, mg: .001, ug: .000001 }, a = unit(from), b = unit(to);
    if (n === null || !a || !b) return null;
    var result = a === b ? n : f[a] && f[b] ? n * f[a] / f[b] : null;
    return result !== null && Number.isFinite(result) ? result : null;
  }
  function recentFoods(logs, foods, limit, untilDate, mealId = null) {
    var byId = new Map((foods || []).map(function (f) { return [f.id, f]; })), seen = new Set();
    function timestamp(log) { var v = log.createdAt || log.timestamp; var n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Date.parse(v) : NaN; return Number.isFinite(n) ? n : null; }
    return (logs || []).map(function (log, index) { return { log: log, index: index }; })
      .filter(function (x) { return x.log && (mealId === null || x.log.mealId === mealId) && validDate(x.log.date) && (!untilDate || x.log.date <= untilDate) && positive(x.log.grams) && byId.has(x.log.foodId); })
      .sort(function (a, b) { var day = String(b.log.date).localeCompare(String(a.log.date)); if (day) return day; var at = timestamp(a.log), bt = timestamp(b.log); return at !== null && bt !== null && at !== bt ? bt - at : b.index - a.index; })
      .filter(function (x) { if (seen.has(x.log.foodId)) return false; seen.add(x.log.foodId); return true; })
      .slice(0, limit === undefined ? 3 : Math.max(0, Math.floor(number(limit) || 0)))
      .map(function (x) { return Object.assign({}, byId.get(x.log.foodId), { resultType: 'personal', recentLog: Object.assign({}, x.log, { grams: number(x.log.grams) }) }); });
  }
  function recentMetadata(log) {
    var out = { entryOrigin: 'recent-v5' };
    ['quantity', 'unit', 'gramsPerUnit', 'portionAssumption', 'portionOrigin', 'portionConfidence', 'portionEstimatedMinGrams', 'portionEstimatedMaxGrams', 'portionEstimatedByAI'].forEach(function (k) {
      if (!log || log[k] === undefined) return;
      if (['quantity', 'gramsPerUnit', 'portionEstimatedMinGrams', 'portionEstimatedMaxGrams'].includes(k)) { var n = number(log[k]); if (n !== null && n > 0) out[k] = n; }
      else if (k === 'portionEstimatedByAI') out[k] = log[k] === true;
      else out[k] = log[k];
    });
    return out;
  }
  function estimated(n) {
    return Boolean(n && (n.aiEstimate === true || n.estimated === true || /\bai[_ -]?estimate\b|\bai\b.{0,12}\bstima\b|\bstim[aoe]\b|\bstimata\b|\bestimat(?:e|ed)\b/i.test(String(n.source || '') + ' ' + String(n.evidence || '') + ' ' + String(n.reliability || ''))));
  }
  function limitedQuality(n) {
    if (!n) return false;
    var grade = String(n.grade || (n.source === 'NutriTrace Master DB' ? 'C' : '')).toUpperCase();
    return ['C', 'D'].includes(grade) || Boolean(String(n.auditWarning || '').trim()) || /\blow\b|single[_ -]source|outlier|conflict|uncertain/i.test(String(n.reliability || '')) || /\bgrade\s*[CD]\b/i.test(String(n.evidence || ''));
  }
  function basisKey(v) { return String(v || '').toLowerCase().replace(/α/g, 'alpha').replace(/[^a-z0-9]/g, ''); }
  function normalizedBasis(v) {
    var k = basisKey(v);
    if (['re', 'retinolequivalent', 'retinolequivalents', 'retinoloequivalente', 'retinoloequivalenti'].includes(k)) return 'RE';
    if (['rae', 'retinolactivityequivalent', 'retinolactivityequivalents'].includes(k)) return 'RAE';
    if (['ne', 'niacinequivalent', 'niacinequivalents', 'equivalentiniacina'].includes(k)) return 'NE';
    if (['dfe', 'dietaryfolateequivalent', 'dietaryfolateequivalents'].includes(k)) return 'DFE';
    if (['alphatocopherol', 'alfatocoferolo', 'alphatocoferolo'].includes(k)) return 'alpha-tocopherol';
    if (['phylloquinone', 'fillochinone', 'vitamink1', 'vitaminak1', 'k1'].includes(k)) return 'phylloquinone';
    return k;
  }
  var canonicalBases = {
    vitamin_a_retinol_equivalent: 'RE', vitamin_a_re: 'RE', vitamin_a_rae: 'RAE',
    niacin_equivalent: 'NE', niacin_equivalents: 'NE', niacin_ne: 'NE', niacin_b3: 'niacin',
    folate_dfe: 'DFE', folate_dietary_folate_equivalent: 'DFE', folate_total_b9: 'folate-total', folate_total: 'folate-total', folic_acid: 'folic-acid',
    alpha_tocopherol: 'alpha-tocopherol', vitamin_e_alpha_te: 'alpha-TE',
    vitamin_k1: 'phylloquinone', vitamin_k: 'vitamin-K-total'
  };
  function basisMatches(n, expected) {
    if (!expected) return true;
    var explicit = normalizedBasis(n.referenceBasis || n.nutrientBasis || n.basis), canonical = canonicalBases[String(n.canonicalId || '').toLowerCase()];
    // A conflicting canonical chemical basis must not be silently converted by a generic unit label.
    if (canonical && canonical !== expected) return false;
    if (explicit && explicit !== expected) return false;
    return explicit === expected || canonical === expected;
  }
  function stats(logs, foods, goal) {
    goal = goal || {};
    var byId = new Map((foods || []).map(function (f) { return [f.id, f]; }));
    var components = Array.isArray(goal.components) && goal.components.length ? goal.components : null;
    var names = (components || [goal.name]).map(norm), expectedBasis = normalizedBasis(goal.referenceBasis);
    var days = new Set(), knownDays = new Set(), daily = {}, totalMass = 0, knownMass = 0, referenceMass = 0, sum = 0;
    var estimatedCount = 0, nutrientEstimateCount = 0, portionEstimateCount = 0, limitedQualityCount = 0, basisUncertainCount = 0, knownCount = 0, partialCount = 0;
    var sources = new Set(), macro = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'salt', 'sugar', 'saturatedFat'].includes(goal.id);
    (logs || []).forEach(function (log) {
      if (!log || !validDate(log.date) || !positive(log.grams)) return;
      days.add(log.date);
      if (!daily[log.date]) daily[log.date] = { date: log.date, value: null, knownMass: 0, totalMass: 0, estimated: false, limitedQuality: false, basisUncertain: false, portionEstimated: false };
      var day = daily[log.date], grams = number(log.grams), food = byId.get(log.foodId);
      totalMass += grams; day.totalMass += grams; if (!food) return;
      // Missing legacy serving metadata historically means per 100 g; an explicit invalid base is unknown.
      var baseMissing = food.servingGrams === null || food.servingGrams === undefined || food.servingGrams === '';
      var base = baseMissing ? 100 : number(food.servingGrams); if (!(base > 0)) return;
      var values = [], complete = macro, used = [];
      var portionEstimate = log.portionEstimatedByAI === true || /visual_estimate|ai_estimate|estimated|stima/i.test(String(log.portionOrigin || ''));
      var hasEstimate = false, hasLimited = false, hasBasisMismatch = false;
      function nutrientValue(name) {
        var candidates = (food.nutrients || []).filter(function (n) { return n && norm(n.name) === name && (goal.form === '*' || !goal.form || norm(n.form) === norm(goal.form)) && number(n.amount) !== null && number(n.amount) >= 0; });
        var result = null, found = [];
        candidates.forEach(function (n) {
          var converted = convert(n.amount, n.unit, goal.unit);
          var scaled = converted === null ? null : converted * grams / base;
          if (scaled === null || !Number.isFinite(scaled) || scaled < 0) return;
          result = (result === null ? 0 : result) + scaled; found.push(n);
        });
        return { value: result !== null && Number.isFinite(result) ? result : null, nutrients: found };
      }
      if (macro) {
        var v = number(food.label && food.label[goal.id]);
        var scaledMacro = v === null ? null : v * grams / base;
        if (scaledMacro !== null && scaledMacro >= 0 && Number.isFinite(scaledMacro)) values.push(scaledMacro);
        var evidence = food.labelEvidence && food.labelEvidence[goal.id];
        var evidenceMeta = evidence && typeof evidence === 'object' ? evidence : { evidence: evidence || '' };
        hasEstimate = estimated(evidenceMeta); hasLimited = limitedQuality(evidenceMeta);
      } else {
        var direct = components ? nutrientValue(norm(goal.name)) : null;
        if (direct && direct.value !== null) {
          // A declared aggregate and its constituent parts describe the same intake: count the aggregate once.
          values.push(direct.value); used = direct.nutrients; complete = true;
        } else {
          names.forEach(function (name) {
            var result = nutrientValue(name), value = result.value;
            if (value === null && name === 'sodio' && (!goal.form || goal.form === '*')) {
              var salt = number(food.label && food.label.salt);
              if (salt !== null && salt >= 0) value = convert(salt / 2.5 * grams / base, 'g', goal.unit);
            }
            if (value !== null) { values.push(value); used = used.concat(result.nutrients); }
          });
          complete = values.length === names.length;
        }
        used.forEach(function (n) { hasEstimate = hasEstimate || estimated(n); hasLimited = hasLimited || limitedQuality(n); hasBasisMismatch = hasBasisMismatch || !basisMatches(n, expectedBasis); if (n.source) sources.add(n.source); });
      }
      if (!values.length) return;
      var amount = values.reduce(function (a, b) { return a + b; }, 0);
      if (!Number.isFinite(amount) || !Number.isFinite(sum + amount)) return;
      knownCount++; knownDays.add(log.date); sum += amount; day.value = (day.value === null ? 0 : day.value) + amount;
      if (complete) {
        knownMass += grams; day.knownMass += grams;
        if (!hasEstimate && !portionEstimate && !hasLimited && !hasBasisMismatch) referenceMass += grams;
      } else partialCount++;
      if (hasEstimate || portionEstimate) { estimatedCount++; day.estimated = true; }
      if (hasEstimate) nutrientEstimateCount++;
      if (portionEstimate) { portionEstimateCount++; day.portionEstimated = true; }
      if (hasLimited) { limitedQualityCount++; day.limitedQuality = true; }
      if (hasBasisMismatch) { basisUncertainCount++; day.basisUncertain = true; }
    });
    var basisReason = basisUncertainCount ? 'Base di misura non verificata o diversa dal riferimento ' + String(goal.referenceBasis) + ': quantità registrata non direttamente confrontabile.' : '';
    return {
      sum: knownCount ? sum : null, average: knownDays.size ? sum / knownDays.size : null,
      knownDays: knownDays.size, loggedDays: days.size, knownCount: knownCount,
      coverage: totalMass ? knownMass / totalMass : 0, referenceCoverage: totalMass ? referenceMass / totalMass : 0,
      estimatedCount: estimatedCount, nutrientEstimateCount: nutrientEstimateCount, portionEstimateCount: portionEstimateCount,
      limitedQualityCount: limitedQualityCount, partialCount: partialCount,
      comparisonAvailable: knownCount > 0 && basisUncertainCount === 0, basisUncertain: basisUncertainCount > 0, basisReason: basisReason,
      sources: Array.from(sources),
      daily: Object.values(daily).sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (day) { return Object.assign(day, { comparisonAvailable: day.value !== null && !day.basisUncertain }); })
    };
  }
  function dailyTarget(goal, weight) {
    if (!goal) return null;
    var amount = number(goal.targetMode === 'perKg' ? goal.perKg : goal.target), kg = number(weight);
    if (amount === null || (goal.targetMode === 'perKg' && !(kg > 0))) return null;
    var n = goal.targetMode === 'perKg' ? amount * kg : amount;
    return Number.isFinite(n) && n > 0 ? n / (goal.period === 'week' ? 7 : 1) : null;
  }
  function normalizeRecipes(value) {
    if (!Array.isArray(value)) return [];
    var seen = new Set();
    return value.filter(function (r) {
      if (!r || typeof r.id !== 'string' || !r.id.trim() || seen.has(r.id) || !String(r.name || '').trim() || !positive(r.yieldGrams) || !Array.isArray(r.ingredients) || !r.ingredients.length || r.ingredients.length > 100 || !r.ingredients.every(function (i) { return i && typeof i.foodId === 'string' && i.foodId.trim() && positive(i.grams); })) return false;
      seen.add(r.id); return true;
    }).slice(0, 250).map(function (r) {
      return { id: r.id, name: String(r.name).slice(0, 120), yieldGrams: number(r.yieldGrams), servings: number(r.servings) > 0 ? number(r.servings) : null, createdAt: String(r.createdAt || ''), ingredients: r.ingredients.map(function (i) { return { foodId: i.foodId, grams: number(i.grams), name: String(i.name || ''), metadata: recentMetadata(i.metadata || {}) }; }) };
    });
  }
  function scaleRecipe(recipe, consumedGrams, foods) {
    if (!positive(consumedGrams) || !positive(recipe && recipe.yieldGrams)) throw new Error('Inserisci una porzione e un peso finale validi, fino a 10.000 g.');
    var known = new Set((foods || []).map(function (f) { return f.id; }));
    if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length) throw new Error('La ricetta non contiene ingredienti.');
    var factor = number(consumedGrams) / number(recipe.yieldGrams);
    return recipe.ingredients.map(function (i) {
      if (!known.has(i.foodId)) throw new Error('Un ingrediente non è più in archivio: modifica la ricetta prima di usarla.');
      var grams = number(i.grams) * factor;
      if (!positive(i.grams) || !positive(grams)) throw new Error('Quantità dell’ingrediente non valida.');
      var metadata = recentMetadata(i.metadata || {});
      ['quantity', 'portionEstimatedMinGrams', 'portionEstimatedMaxGrams'].forEach(function (key) { if (number(metadata[key]) > 0) metadata[key] *= factor; });
      return Object.assign(metadata, { foodId: i.foodId, grams: grams, recipeName: recipe.name, recipeIngredient: i.name, recipeYieldGrams: number(recipe.yieldGrams), recipeConsumedGrams: number(consumedGrams), entryOrigin: 'saved-recipe-v5' });
    });
  }
  function productFood(product, foods, id) {
    if (!product || !String(product.name || '').trim()) throw new Error('Indica il nome dell’alimento.');
    var existing = (foods || []).find(function (f) { return product.barcode ? String(f.barcode || '').trim() === String(product.barcode).trim() : norm(f.name) === norm(product.name) && norm(f.brand) === norm(product.brand); });
    if (existing) return { food: existing, existing: true };
    var label = {}; ['kcal', 'protein', 'carbs', 'fat', 'sugar', 'saturatedFat', 'fiber', 'salt'].forEach(function (k) { var n = number(product.label && product.label[k]); label[k] = n !== null && n >= 0 ? n : ''; });
    return { existing: false, food: { id: id, name: String(product.name).trim(), brand: String(product.brand || ''), barcode: product.barcode || undefined, servingGrams: 100, label: label, nutrients: [], nutrientStatus: {}, aliases: [String(product.name).trim()], ingredients: String(product.ingredients || ''), additives: [], sources: [{ id: id + '-source', name: product.barcode ? 'Open Food Facts' : 'Etichetta fotografata', reference: product.source && product.source.url || 'Trascrizione Vision da verificare con l’etichetta', quality: 'secondaria' }], notes: 'Valori per 100 g confermati durante l’inserimento rapido. I micronutrienti assenti sono N/D.' } };
  }
  return Object.freeze({ number: number, positive: positive, format: format, convert: convert, recentFoods: recentFoods, recentMetadata: recentMetadata, stats: stats, dailyTarget: dailyTarget, normalizeRecipes: normalizeRecipes, scaleRecipe: scaleRecipe, productFood: productFood });
});
