'use strict';

(function (root) {
  const FIELDS = [
    'kcal', 'protein', 'carbs', 'fat',
    'sugar', 'saturatedFat', 'fiber', 'salt'
  ];

  function numeric(value) {
    if (value === null || value === undefined ||
        value === '') return null;

    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function isDate(value) {
    if (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));

    return date.getUTCFullYear() === y &&
      date.getUTCMonth() + 1 === m &&
      date.getUTCDate() === d;
  }

  function datesBetween(from, to) {
    if (!isDate(from) || !isDate(to) || from > to) {
      throw new Error('Intervallo di date non valido.');
    }

    const result = [];
    const cursor = new Date(from + 'T12:00:00Z');
    const last = new Date(to + 'T12:00:00Z');

    while (cursor <= last) {
      result.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return result;
  }

  function emptyTotals() {
    return Object.fromEntries(
      FIELDS.map(key => [key, 0])
    );
  }

  function summarize(logs, foods) {
    const byId = new Map(
      (foods || []).map(food => [food.id, food])
    );

    const totals = emptyTotals();
    const known = Object.fromEntries(
      FIELDS.map(key => [key, 0])
    );

    let totalWeight = 0;
    let foodCount = 0;
    let validCount = 0;

    for (const log of logs || []) {
      const grams = numeric(log?.grams);
      if (grams === null || grams <= 0) continue;

      foodCount++;
      totalWeight += grams;

      const food = byId.get(log.foodId);
      if (!food) continue;

      const base = numeric(food.servingGrams);
      if (base === null || base <= 0) continue;

      validCount++;
      const ratio = grams / base;

      for (const key of FIELDS) {
        const value = numeric(food.label?.[key]);

        if (value === null) continue;

        totals[key] += value * ratio;
        known[key] += grams;
      }
    }

    const coverage = {};

    for (const key of FIELDS) {
      coverage[key] = totalWeight > 0
        ? known[key] / totalWeight
        : null;
    }

    return {
      totals,
      coverage,
      totalWeight,
      foodCount,
      validCount,
      complete: foodCount > 0 &&
        FIELDS.every(key => coverage[key] === 1)
    };
  }

  function analyze({
    logs = [],
    foods = [],
    meals = [],
    from,
    to
  }) {
    const days = datesBetween(from, to);
    const activeMeals = [
      ...meals,
      { id: '__unassigned__', name: 'Senza pasto' }
    ];

    const validIds = new Set(
      meals.map(meal => meal.id)
    );

    const periodLogs = logs.filter(log =>
      log && log.date >= from && log.date <= to
    );

    const resolvedMealId = log =>
      validIds.has(log.mealId)
        ? log.mealId
        : '__unassigned__';

    const results = activeMeals.map(meal => {
      const mealLogs = periodLogs.filter(log =>
        resolvedMealId(log) === meal.id
      );

      const byDay = days.map(date => {
        const dailyLogs = mealLogs.filter(log =>
          log.date === date
        );

        return {
          date,
          recorded: dailyLogs.length > 0,
          ...summarize(dailyLogs, foods)
        };
      });

      const recordedDays = byDay.filter(
        day => day.recorded
      );

      const overall = summarize(mealLogs, foods);
      const averages = {};

      for (const key of FIELDS) {
        averages[key] = recordedDays.length > 0
          ? overall.totals[key] / recordedDays.length
          : null;
      }

      return {
        mealId: meal.id,
        name: meal.name,
        daysInPeriod: days.length,
        recordedDays: recordedDays.length,
        totals: overall.totals,
        averages,
        coverage: overall.coverage,
        totalWeight: overall.totalWeight,
        foodCount: overall.foodCount,
        byDay
      };
    });

    const overall = summarize(periodLogs, foods);

    return {
      from,
      to,
      daysInPeriod: days.length,
      meals: results,
      overall,
      fields: [...FIELDS]
    };
  }

  function comparePeriods(current, previous, field) {
    if (!FIELDS.includes(field)) {
      throw new Error('Nutriente non riconosciuto.');
    }

    const ids = new Set([
      ...current.meals.map(meal => meal.mealId),
      ...previous.meals.map(meal => meal.mealId)
    ]);

    return [...ids].map(id => {
      const base = number(food.servingGrams);
const value = foodValue(food, metric);

if (base !== null && base > 0 && value !== null) {
  row.value += value * grams / base;
  row.knownWeight += grams;
}

      const now = currentMeal?.averages?.[field] ?? null;
      const before = previousMeal?.averages?.[field] ?? null;

      const delta = now !== null && before !== null
        ? now - before
        : null;

      const percentChange =
        delta !== null && before > 0
          ? delta / before * 100
          : null;

      return {
        mealId: id,
        name: currentMeal?.name ||
          previousMeal?.name || id,
        current: now,
        previous: before,
        delta,
        percentChange
      };
    });
  }

  const api = {
    fields: [...FIELDS],
    datesBetween,
    summarize,
    analyze,
    comparePeriods
  };

  root.NutriTraceMealAnalytics = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this
);
