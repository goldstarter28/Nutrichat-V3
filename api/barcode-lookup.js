
'use strict';

// NutriTrace V3 — Barcode Product Lookup
// Open Food Facts API v3, senza alterare il Master DB.

const API_BASE =
  'https://world.openfoodfacts.org/api/v3/product/';

const FIELDS = [
  'code',
  'product_name',
  'product_name_it',
  'brands',
  'quantity',
  'image_front_small_url',
  'ingredients_text',
  'ingredients_text_it',
  'nutrition_data_per',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity_unit',
  'nutriments'
].join(',');

function validateBarcode(value) {
  const code = String(value ?? '').trim();

  if (!/^\d{8}$|^\d{12,14}$/.test(code)) {
    return null;
  }

  // Check digit standard GTIN.
  let sum = 0;
  for (let i = code.length - 2, weight = 3;
       i >= 0;
       i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(code[i]) * weight;
  }

  return (10 - sum % 10) % 10 ===
    Number(code[code.length - 1])
      ? code
      : null;
}

function numberOrNull(value) {
  if (typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0) {
    return null;
  }
  return value;
}

// OFF <nutrient>_100g is already normalized to grams (or per 100 ml for liquids).
// The *_unit field describes entry units, not the normalized number.
const MICRO_KEYS=['calcium','iron','magnesium','phosphorus','potassium','sodium','zinc','copper','manganese','selenium','iodine','chloride','chromium','molybdenum','fluoride','vitamin-c','vitamin-d','vitamin-b1','vitamin-b2','vitamin-b6','vitamin-b12','biotin','pantothenic-acid','choline','vitamin-a','vitamin-e','vitamin-k','vitamin-pp','folates','vitamin-b9'];
function microBasis(product) {
  const per=String(product.nutrition_data_per||'').toLowerCase().replace(/\s/g,'');
  const qty=[product.product_quantity_unit,product.quantity,product.serving_quantity_unit,product.serving_size].map(v=>String(v||'').toLowerCase()).join(' ');
  const volume=/(?:^|[^a-z])(?:ml|cl|dl|l|litri?|liters?|litres?|fl\s*oz)(?:$|[^a-z])/.test(qty)||per==='100ml';
  const mass=/(?:^|[^a-z])(?:kg|g|mg|grams?|grammi?|oz)(?:$|[^a-z])/.test(qty);
  if(volume)return 'volume';
  return mass&&['100g','serving',''].includes(per)?'mass':'unknown';
}
function normalizeProduct(product, barcode) {
  const n = product.nutriments || {};

  const nutrient = key =>
    numberOrNull(n[key + '_100g']);

  const kcal =
    nutrient('energy-kcal') ??
    (nutrient('energy-kj') !== null
      ? n['energy-kj_100g'] / 4.184
      : null);

  const label = {
    kcal,
    protein: nutrient('proteins'),
    carbs: nutrient('carbohydrates'),
    sugar: nutrient('sugars'),
    fat: nutrient('fat'),
    saturatedFat: nutrient('saturated-fat'),
    fiber: nutrient('fiber'),
    salt: nutrient('salt')
  };

  return {
    barcode,
    name: String(
      product.product_name_it ||
      product.product_name ||
      ''
    ).trim(),
    brand: String(product.brands || '').trim(),
    quantity: String(product.quantity || '').trim(),
    image: product.image_front_small_url || null,
    ingredients: String(
      product.ingredients_text_it || product.ingredients_text || ''
    ).trim(),
    servingGrams: 100,
    microBasis: microBasis(product),
    microGrams: Object.fromEntries(MICRO_KEYS.map(key=>[key,nutrient(key)]).filter(([,value])=>value!==null&&value<=100)),
    label,
    source: {
      code: 'OPEN_FOOD_FACTS',
      name: 'Open Food Facts',
      scientific: false,
      verified: false,
      barcode,
      url: 'https://world.openfoodfacts.org/product/' +
        barcode
    },
    missing: Object.keys(label).filter(
      key => label[key] === null
    )
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      code: 'METHOD_NOT_ALLOWED',
      error: 'Metodo non consentito.'
    });
  }

  const barcode = validateBarcode(req.query?.barcode);

  if (!barcode) {
    return res.status(400).json({
      code: 'INVALID_BARCODE',
      error: 'Codice EAN/UPC/GTIN non valido.'
    });
  }

  try {
    const url = API_BASE + barcode +
      '?fields=' + encodeURIComponent(FIELDS);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'NutriTrace/3.0 (https://github.com/goldstarter28/Nutrichat-V3)'
      },
      signal: AbortSignal.timeout(9000)
    });

    if (response.status === 404) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        error: 'Prodotto non presente in Open Food Facts.'
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        code: 'UPSTREAM_ERROR',
        error: 'Servizio alimenti temporaneamente non disponibile.'
      });
    }

    const data = await response.json();
    const product = data.product;

    if (!product ||
        (!product.product_name &&
         !product.product_name_it)) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        error: 'Prodotto non trovato o senza nome.'
      });
    }

    return res.status(200).json({
      found: true,
      product: normalizeProduct(product, barcode)
    });

  } catch (error) {
    const timeout =
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError';

    return res.status(502).json({
      code: timeout
        ? 'UPSTREAM_TIMEOUT'
        : 'LOOKUP_FAILED',
      error: timeout
        ? 'Ricerca scaduta. Riprova.'
        : 'Impossibile recuperare il prodotto.'
    });
  }
};

module.exports.validateBarcode = validateBarcode;
module.exports.normalizeProduct = normalizeProduct;
