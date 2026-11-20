
'use strict';

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) root.NutriTraceIngredientAutoAudit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {

  function norm(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function parseIngredients(raw) {
    const text = String(raw || '')
      .replace(/^\s*(ingredienti|ingredients?)\s*:\s*/i, '')
      .trim();

    if (!text) return [];

    const tokens = [];
    let token = '';
    let depth = 0;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      const decimalComma =
        c === ',' &&
        /\d/.test(text[i - 1] || '') &&
        /\d/.test(text[i + 1] || '');

      if (
        depth === 0 &&
        ((c === ',' && !decimalComma) ||
         c === ';' || c === '\n')
      ) {
        if (token.trim()) tokens.push(token.trim());
        token = '';
        continue;
      }

      if (c === '(') depth++;
      if (c === ')') depth = Math.max(0, depth - 1);
      token += c;
    }

    if (token.trim()) tokens.push(token.trim());

    return tokens.slice(0, 50).map((value, i) => {
      const match = value.match(
        /(?:\(\s*)?(\d{1,3}(?:[.,]\d{1,3})?)\s*%\s*\)?\s*$/
      );

      const percent = match
        ? Number(match[1].replace(',', '.'))
        : null;

      return {
        position: i + 1,
        name: (match
          ? value.slice(0, match.index)
          : value
        ).replace(/[\s(]+$/g, '').trim(),

        percent: Number.isFinite(percent) &&
                 percent >= 0 && percent <= 100
          ? percent : null
      };
    });
  }

  function validateMacros(label, basis = 100) {
    const warnings = [];
    const value = key => {
      const raw = label?.[key];
      if (raw === null || raw === undefined ||
          raw === '') return null;
      const number = Number(raw);
      return Number.isFinite(number) && number >= 0
        ? number : null;
    };

    const fat = value('fat');
    const saturatedFat = value('saturatedFat');
    const carbs = value('carbs');
    const sugar = value('sugar');
    const protein = value('protein');
    const fiber = value('fiber');
    const kcal = value('kcal');

    if (fat !== null && saturatedFat !== null &&
        saturatedFat > fat + 0.01) {
      warnings.push({
        code: 'SATURATED_GT_FAT',
        message: 'Grassi saturi superiori ai grassi totali.'
      });
    }

    if (carbs !== null && sugar !== null &&
        sugar > carbs + 0.01) {
      warnings.push({
        code: 'SUGAR_GT_CARBS',
        message: 'Zuccheri superiori ai carboidrati.'
      });
    }

    let energy = null;

    if ([protein, carbs, fat, fiber, kcal]
        .every(x => x !== null)) {

      const calculated =
        4 * protein +
        4 * carbs +
        9 * fat +
        2 * fiber;

      const difference = Math.abs(calculated - kcal);
      const tolerance = Math.max(
        20 * basis / 100,
        calculated * 0.12
      );

      energy = {
        estimatedFromMacros: Number(calculated.toFixed(1)),
        reportedKcal: kcal,
        differenceKcal: Number(difference.toFixed(1)),
        toleranceKcal: Number(tolerance.toFixed(1)),
        consistent: difference <= tolerance
      };

      if (!energy.consistent) {
        warnings.push({
          code: 'ENERGY_MISMATCH',
          message: 'Energia e macronutrienti poco coerenti.'
        });
      }
    }

    return {energy, warnings};
  }

  function exactCandidates(name, rows) {
    const target = norm(name);

    return (rows || []).filter(row => {
      const names = [
        row.name,
        row.name_en,
        ...(row.aliases || [])
      ];

      return names.some(candidate =>
        norm(candidate) === target
      );
    });
  }

  async function audit({
    food,
    index,
    search,
    loadDetail,
    catalog,
    microSpecs,
    reconstruction
  }) {
    const items = parseIngredients(food?.ingredients);
    const basis = Number(food?.servingGrams) > 0
      ? Number(food.servingGrams)
      : 100;

    const checks = validateMacros(food?.label, basis);
    const matches = {};
    const mapping = [];
    const warnings = [...checks.warnings];

    if (!items.length) {
      return {
        version: 'auto-audit-1',
        status: 'no_ingredients',
        mapping: [],
        energy: checks.energy,
        warnings
      };
    }

    const total = items.reduce(
      (sum, item) => sum + (item.percent ?? 0),
      0
    );

    if (total > 100.00001) {
      warnings.push({
        code: 'PERCENT_OVERFLOW',
        message: 'Percentuali dichiarate superiori al 100%.'
      });
    }

    let matchedCount = 0;
    let matchedPercentage = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const candidates = search(item.name, index, 12);
      const exact = exactCandidates(item.name, candidates);

      if (exact.length !== 1) {
        mapping.push({
          ingredient: item.name,
          percent: item.percent,
          status: exact.length > 1
            ? 'ambiguous'
            : 'unmatched'
        });
        continue;
      }

      const row = exact[0];

      try {
        const detail = await loadDetail(row);

        if (!detail) throw new Error('Master detail missing');

        matches[String(i)] = {
          id: row.id,
          name: row.name,
          detail,
          confirmed: true
        };

        matchedCount++;

        if (item.percent !== null) {
          matchedPercentage += item.percent;
        }

        mapping.push({
          ingredient: item.name,
          percent: item.percent,
          masterId: row.id,
          masterName: row.name,
          status: 'exact_match'
        });

      } catch {
        mapping.push({
          ingredient: item.name,
          percent: item.percent,
          status: 'master_unavailable'
        });
      }
    }

    let reconstructionResult = null;

    if (reconstruction && Object.keys(matches).length) {
      // No assumed cooking yield. Contributions are diagnostic only.
      reconstructionResult = reconstruction.reconstruct({
        items,
        matches,
        catalog,
        microSpecs,
        yieldFactor: null
      });
    }

    return {
      version: 'auto-audit-1',
      status: 'completed',
      ingredientCount: items.length,
      matchedCount,
      matchedPercentage:
        Number(matchedPercentage.toFixed(2)),
      declaredPercentageTotal:
        Number(total.toFixed(2)),
      mapping,
      energy: checks.energy,
      warnings,
      reconstruction: reconstructionResult
        ? {
            status: reconstructionResult.status,
            contributions:
              reconstructionResult.contributions,
            warnings:
              reconstructionResult.warnings
          }
        : null
    };
  }

  return {
    parseIngredients,
    validateMacros,
    exactCandidates,
    audit
  };
});
