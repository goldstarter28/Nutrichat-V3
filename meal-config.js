'use strict';

(function (root) {
  const DEFAULT_MEALS = [
    { id: 'breakfast', name: 'Colazione' },
    { id: 'morning-snack', name: 'Spuntino mattina' },
    { id: 'lunch', name: 'Pranzo' },
    { id: 'afternoon-snack', name: 'Spuntino pomeriggio' },
    { id: 'dinner', name: 'Cena' }
  ];

  const MAX_MEALS = 20;
  const MAX_NAME_LENGTH = 60;

  function clean(value) {
    return String(value ?? '').trim();
  }

  function newId() {
    if (root.crypto?.randomUUID) {
      return root.crypto.randomUUID();
    }

    return 'meal-' + Date.now() + '-' +
      Math.random().toString(36).slice(2);
  }

  function defaults() {
    return DEFAULT_MEALS.map(meal => ({ ...meal }));
  }

  function normalize(meals) {
    if (!Array.isArray(meals)) return defaults();

    const result = [];
    const ids = new Set();

    for (const meal of meals) {
      if (!meal || typeof meal !== 'object') continue;

      const id = clean(meal.id);
      const name = clean(meal.name)
        .slice(0, MAX_NAME_LENGTH);

      if (!id || !name || ids.has(id)) continue;

      ids.add(id);
      result.push({ id, name });

      if (result.length >= MAX_MEALS) break;
    }

    return result;
  }

  function add(meals, name) {
    const current = normalize(meals);
    const label = clean(name).slice(0, MAX_NAME_LENGTH);

    if (!label) {
      throw new Error('Inserisci il nome del pasto.');
    }

    if (current.length >= MAX_MEALS) {
      throw new Error('Limite massimo di 20 pasti.');
    }

    return [
      ...current,
      { id: newId(), name: label }
    ];
  }

  function rename(meals, id, name) {
    const label = clean(name).slice(0, MAX_NAME_LENGTH);

    if (!label) {
      throw new Error('Il nome del pasto non può essere vuoto.');
    }

    return normalize(meals).map(meal =>
      meal.id === id
        ? { ...meal, name: label }
        : meal
    );
  }

  function move(meals, id, direction) {
    const current = normalize(meals);

    const index = current.findIndex(meal =>
      meal.id === id
    );

    if (index < 0) return current;

    const target = index + direction;

    if (target < 0 || target >= current.length) {
      return current;
    }

    [current[index], current[target]] =
      [current[target], current[index]];

    return current;
  }

  function remove(meals, id) {
    return normalize(meals).filter(meal =>
      meal.id !== id
    );
  }

  function validMealId(meals, id) {
    return normalize(meals).some(meal =>
      meal.id === id
    );
  }

  function assignLog(log, mealId, meals) {
    if (!log || typeof log !== 'object') {
      throw new Error('Registrazione non valida.');
    }

    if (mealId !== null &&
        !validMealId(meals, mealId)) {
      throw new Error('Pasto non valido.');
    }

    return {
      ...log,
      mealId
    };
  }

  function reconcileLogs(logs, meals) {
    const ids = new Set(
      normalize(meals).map(meal => meal.id)
    );

    return (Array.isArray(logs) ? logs : [])
      .map(log => {
        if (!log || typeof log !== 'object') {
          return log;
        }

        if (!log.mealId || !ids.has(log.mealId)) {
          return { ...log, mealId: null };
        }

        return { ...log };
      });
  }

  const api = {
    defaults,
    normalize,
    add,
    rename,
    move,
    remove,
    validMealId,
    assignLog,
    reconcileLogs
  };

  root.NutriTraceMealConfig = api;

  if (typeof module !== 'undefined' &&
      module.exports) {
    module.exports = api;
  }

})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this
);
