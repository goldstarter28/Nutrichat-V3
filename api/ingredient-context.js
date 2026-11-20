
'use strict';

// Interpreta le informazioni esplicite della lista ingredienti.
// Non inventa percentuali e non calcola nutrienti.

function clean(value, max = 6000) {
  return String(value == null ? '' : value)
    .trim()
    .slice(0, max);
}

function splitOutsideParentheses(text) {
  const result = [];
  let depth = 0;
  let token = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);

    const decimalComma =
      char === ',' &&
      /[0-9]/.test(text[i - 1] || '') &&
      /[0-9]/.test(text[i + 1] || '');

    if (
      ((char === ',' && !decimalComma) ||
        char === ';' ||
        char === '\n') &&
      depth === 0
    ) {
      if (token.trim()) result.push(token.trim());
      token = '';
    } else {
      token += char;
    }
  }

  if (token.trim()) result.push(token.trim());

  return result;
}

function buildIngredientContext(value) {
  const original = clean(value);

  const normalized = original
    .replace(
      /^\s*(?:ingredienti|ingredients?)\s*:\s*/i,
      ''
    )
    .trim();

  const warnings = [];

  if (!normalized) {
    return {
      raw: '',
      items: [],
      explicitPercentTotal: 0,
      unknownPercentCount: 0,
      warnings: []
    };
  }

  const tokens = splitOutsideParentheses(normalized);

  if (tokens.length > 50) {
    warnings.push(
      'Lista oltre 50 componenti: elaborazione parziale.'
    );
  }

  const items = tokens.slice(0, 50).map((token, index) => {
    const match = token.match(
      /(?:\(\s*)?(\d{1,3}(?:[.,]\d{1,3})?)\s*%\s*\)?\s*$/
    );

    const percent = match
      ? Number(match[1].replace(',', '.'))
      : null;

    const validPercent =
      percent !== null &&
      Number.isFinite(percent) &&
      percent >= 0 &&
      percent <= 100;

    if (percent !== null && !validPercent) {
      warnings.push(
        `Percentuale non valida nel componente ${index + 1}.`
      );
    }

    const name = clean(
      match && validPercent
        ? token.slice(0, match.index)
        : token,
      250
    )
      .replace(/[\s(]+$/g, '')
      .trim();

    return {
      raw: clean(token, 400),
      name: name || clean(token, 250),
      percent: validPercent ? percent : null,
      position: index + 1,
      percentSource: validPercent
        ? 'explicit'
        : 'unknown'
    };
  });

  const total = items.reduce(
    (sum, item) => sum + (item.percent ?? 0),
    0
  );

  if (total > 100.00001) {
    warnings.push(
      'La somma delle percentuali dichiarate supera il 100%: nessuna proporzione può essere considerata valida.'
    );

    for (const item of items) {
      item.percent = null;
      item.percentSource = 'invalid_total';
    }
  }

  return {
    raw: normalized,
    items,
    explicitPercentTotal:
      total > 100.00001
        ? null
        : Number(total.toFixed(3)),
    unknownPercentCount:
      items.filter(item => item.percent === null).length,
    warnings
  };
}

module.exports = { buildIngredientContext };
