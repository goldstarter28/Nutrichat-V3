
'use strict';

(function (root) {
  const MAX_FAVORITES = 100;
  const MAX_GRAMS = 10000;

  function clean(value) {
    return String(value ?? '').trim();
  }

  function validGrams(value) {
    if (value === null ||
        value === undefined ||
        value === '') return null;

    const n = Number(value);

    return Number.isFinite(n) &&
      n > 0 &&
      n <= MAX_GRAMS ? n : null;
  }

  function newId() {
    return root.crypto?.randomUUID?.() ||
      'shortcut-' + Date.now() + '-' +
      Math.random().toString(36).slice(2);
  }

  function normalize(favorites) {
    if (!Array.isArray(favorites)) return [];

    const out = [];
    const seen = new Set();

    for (const item of favorites) {
      if (!item || typeof item !== 'object') continue;

      const mealId = clean(item.mealId);
      const foodId = clean(item.foodId);
      const grams = validGrams(item.grams);

      if (!mealId || !foodId || grams === null) {
        continue;
      }

      const key = JSON.stringify([
        mealId, foodId, grams
      ]);

      if (seen.has(key)) continue;

      seen.add(key);

      out.push({
        id: clean(item.id) || newId(),
        mealId,
        foodId,
        grams,
        label: clean(item.label).slice(0, 100)
      });

      if (out.length >= MAX_FAVORITES) break;
    }

    return out;
  }

  function addFavorite(favorites, entry, meals, foods) {
    const current = normalize(favorites);

    const mealId = clean(entry?.mealId);
    const foodId = clean(entry?.foodId);
    const grams = validGrams(entry?.grams);

    if (!(meals || []).some(m => m.id === mealId)) {
      throw new Error('Seleziona un pasto valido.');
    }

    if (!(foods || []).some(f => f.id === foodId)) {
      throw new Error('Alimento non presente nell’archivio.');
    }

    if (grams === null) {
      throw new Error('Indica una quantità valida in grammi.');
    }

    if (current.some(item =>
      item.mealId === mealId &&
      item.foodId === foodId &&
      item.grams === grams
    )) {
      return current;
    }

    if (current.length >= MAX_FAVORITES) {
      throw new Error('Limite massimo di 100 preferiti.');
    }

    return normalize([
      ...current,
      {
        id: newId(),
        mealId,
        foodId,
        grams,
        label: clean(entry.label)
      }
    ]);
  }

  function removeFavorite(favorites, favoriteId) {
    return normalize(favorites).filter(
      item => item.id !== favoriteId
    );
  }

  function forMeal(favorites, mealId) {
    return normalize(favorites).filter(
      item => item.mealId === mealId
    );
  }

  function createFavoriteLog(
    favorite,
    date,
    meals,
    foods
  ) {
    const mealId = clean(favorite?.mealId);
    const foodId = clean(favorite?.foodId);
    const grams = validGrams(favorite?.grams);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Data non valida.');
    }

    if (!(meals || []).some(m => m.id === mealId)) {
      throw new Error('Il pasto non è più disponibile.');
    }

    if (!(foods || []).some(f => f.id === foodId)) {
      throw new Error('Alimento non più disponibile.');
    }

    if (grams === null) {
      throw new Error('Quantità preferita non valida.');
    }

    return {
      id: newId(),
      date,
      mealId,
      foodId,
      grams,
      entryOrigin: 'meal_favorite',
      favoriteId: favorite.id || null
    };
  }

  function previousDay(date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/
      .exec(clean(date));

    if (!match) {
      throw new Error('Data non valida.');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const d = new Date(
      Date.UTC(year, month - 1, day)
    );

    if (d.getUTCFullYear() !== year ||
        d.getUTCMonth() !== month - 1 ||
        d.getUTCDate() !== day) {
      throw new Error('Data non valida.');
    }

    d.setUTCDate(d.getUTCDate() - 1);

    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      String(d.getUTCDate()).padStart(2, '0')
    ].join('-');
  }

  function copyYesterday(
    logs,
    selectedDate,
    mealId,
    meals,
    foods
  ) {
    if (!(meals || []).some(m => m.id === mealId)) {
      throw new Error('Pasto non valido.');
    }

    const yesterday = previousDay(selectedDate);

    const source = (logs || []).filter(log =>
      log.date === yesterday &&
      log.mealId === mealId
    );

    if (!source.length) {
      throw new Error(
        'Non ci sono alimenti da copiare da ieri.'
      );
    }

    const ids = new Set(
      (foods || []).map(f => f.id)
    );

    const invalid = source.filter(log =>
      !ids.has(log.foodId) ||
      validGrams(log.grams) === null
    );

    if (invalid.length) {
      throw new Error(
        'Il pasto di ieri contiene alimenti o ' +
        'quantità non più validi. Controllalo prima di copiarlo.'
      );
    }

    const alreadyPresent = (logs || []).some(log =>
      log.date === selectedDate &&
      log.mealId === mealId
    );

    if (alreadyPresent) {
      throw new Error(
        'Questo pasto contiene già alimenti. ' +
        'Spostali o rimuovili prima di copiare ieri.'
      );
    }

    return source.map(log => ({
      ...log,
      id: newId(),
      date: selectedDate,
      mealId,
      entryOrigin: 'copy_previous_day',
      copiedFromDate: yesterday,
      copiedFromLogId: log.id,
      favoriteId: null
    }));
  }

  root.NutriTraceMealShortcuts = {
    normalize,
    addFavorite,
    removeFavorite,
    forMeal,
    createFavoriteLog,
    previousDay,
    copyYesterday
  };

  if (typeof module !== 'undefined' &&
      module.exports) {
    module.exports = root.NutriTraceMealShortcuts;
  }

})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this
);
