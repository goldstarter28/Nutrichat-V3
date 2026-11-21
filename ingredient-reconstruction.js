
'use strict';
// NutriTrace V3: deterministic, evidence-preserving recipe reconstruction.
// Data are per 100g of input ingredients unless an explicit measured yield is supplied.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NutriTraceIngredientReconstruction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MACROS = {
    kcal: ['energy_kcal'], protein: ['protein'],
    carbs: ['carbohydrate_available', 'carbohydrate_total'],
    sugar: ['sugars_total'], fat: ['fat_total'],
    saturatedFat: ['fat_saturated'], fiber: ['fiber'], salt: ['salt']
  };
  const BLOCKED_GRADES = new Set(['D']);
  const finite = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
  const round = (x, digits = 3) => Number(x.toFixed(digits));

  function convert(value, from, to) {
    const scale = { g: 1, mg: 1e-3, 'µg': 1e-6, ug: 1e-6, kcal: 1 };
    if (!(from in scale) || !(to in scale)) return null;
    if ((from === 'kcal') !== (to === 'kcal')) return null;
    return value * scale[from] / scale[to];
  }

  function pick(detail, ids, catalog, targetUnit) {
    for (const id of ids) {
      const rec = detail?.n?.[id];
      if (!Array.isArray(rec) || !finite(rec[0]) || Number(rec[0]) < 0) continue;
      const grade = String(rec[6] || 'C').toUpperCase();
      if (BLOCKED_GRADES.has(grade) || String(rec[5] || '').trim()) continue;
      const sourceUnit = catalog[id]?.unit;
      const source = sourceUnit && String(sourceUnit).match(/^(µg|ug|mg|g|kcal)\b/i);
      if (!source) continue;
      const amount = convert(Number(rec[0]), source[1], targetUnit);
      if (amount === null) continue;
      let range = null;
      const rawRange = rec[4];
      if (Array.isArray(rawRange) && rawRange.length === 2 && finite(rawRange[0]) && finite(rawRange[1])) {
        const min = convert(Number(rawRange[0]), source[1], targetUnit);
        const max = convert(Number(rawRange[1]), source[1], targetUnit);
        if (min !== null && max !== null && min >= 0 && max >= min && amount >= min && amount <= max) range = [min,max];
      }
      return {id,amount,unit:targetUnit,grade,range,sources:rec[3] || []};
    }
    return null;
  }

  function nutrientDefinitions(microSpecs={}) {
    const out = {};
    for (const [key,ids] of Object.entries(MACROS)) out[key] = {ids,unit:key==='kcal'?'kcal':'g'};
    for (const [name,spec] of Object.entries(microSpecs)) {
      if (!spec || !Array.isArray(spec.ids) || !spec.ids.length || !spec.unit) continue;
      out[`micro:${name}`] = {ids:spec.ids,unit:spec.unit};
    }
    return out;
  }

  function reconstruct({items=[], matches={}, catalog={}, microSpecs={}, yieldFactor=null}={}) {
    const warnings = [];
    if (!Array.isArray(items) || !items.length || items.length > 50) return {status:'invalid',warnings:['Lista ingredienti assente o troppo lunga.'],values:{},contributions:{}};
    const knownPct = items.reduce((n,x)=>n+(finite(x.percent)?Number(x.percent):0),0);
    const invalid = items.some(x=>finite(x.percent) && (Number(x.percent)<0 || Number(x.percent)>100));
    if (invalid || knownPct > 100.000001) return {status:'invalid',warnings:['Percentuali dichiarate non valide o superiori al 100%.'],values:{},contributions:{}};
    const hasUnknown = items.some(x=>!finite(x.percent));
    const completeWeights = !hasUnknown && Math.abs(knownPct-100)<1e-6;
    if (!completeWeights) warnings.push('Ricetta incompleta: percentuali mancanti; i contributi noti non sono il totale del prodotto.');
    const validYield = finite(yieldFactor) && Number(yieldFactor)>0 && Number(yieldFactor)<=10;
    if (!validYield) warnings.push('Resa di lavorazione non misurata: non è possibile stimare valori per 100 g di prodotto finito.');
    const definitions = nutrientDefinitions(microSpecs);
    const values = {}, contributions = {}, evidence = {};
    const canComplete = completeWeights && validYield;
    let matchedWeight = 0;
    const mapping = items.map((ingredient,index)=>{
      const match = matches[String(index)] || null;
      const mapped = match && match.detail && match.id != null && match.confirmed === true;
      if (finite(ingredient.percent) && Number(ingredient.percent)>0 && mapped) matchedWeight+=Number(ingredient.percent);
      return {position:index+1,ingredient:ingredient.name,percent:finite(ingredient.percent)?Number(ingredient.percent):null,masterId:mapped?match.id:null,masterName:mapped?match.name:null,confirmed:Boolean(mapped)};
    });

    for (const [key,spec] of Object.entries(definitions)) {
      let sum = 0, low = 0, high = 0, includedPct = 0, allRanges = true;
      const components=[];
      for (let index=0;index<items.length;index++) {
        const ingredient=items[index], pct=ingredient.percent;
        if (!finite(pct) || Number(pct)<0) continue;
        const weight=Number(pct);
        if (weight===0)continue;
        const match=matches[String(index)];
        if (!match || match.confirmed!==true || !match.detail || match.id == null)continue;
        let datum=pick(match.detail,spec.ids,catalog,spec.unit);
        if (!datum && key==='salt') {
          const sodium=pick(match.detail,['sodium'],catalog,'mg');
          if (sodium) datum={...sodium,id:'sodium',amount:sodium.amount*2.5/1000,unit:'g',range:sodium.range?sodium.range.map(n=>n*2.5/1000):null};
        }
        if (!datum)continue;
        includedPct+=weight;
        sum+=weight*datum.amount/100;
        if (datum.range) {low+=weight*datum.range[0]/100;high+=weight*datum.range[1]/100;}
        else allRanges=false;
        components.push({ingredient:ingredient.name,percent:weight,masterId:String(match.id),nutrientId:datum.id,grade:datum.grade,sources:datum.sources});
      }
      if (!components.length) continue;
      contributions[key]={amount:round(sum),unit:spec.unit,coveragePercent:round(includedPct),components};
      const exactCoverage = canComplete && Math.abs(includedPct-100)<1e-6;
      if (!exactCoverage)continue;
      const divisor=Number(yieldFactor);
      values[key]={amount:round(sum/divisor),unit:spec.unit,status:'calculated',basis:'per_100g_finished_food',
        range:allRanges?[round(low/divisor),round(high/divisor)]:null,
        evidence:components,method:'mass_weighted_master_v1',yieldFactor:divisor};
      evidence[key]=components;
    }

    if (!Object.keys(values).length) warnings.push('Nessun nutriente completo e tracciabile: conservare N/D oppure richiedere verifica manuale.');
    const v=key=>values[key]?.amount;
    let energyCheck=null;
    if (['protein','carbs','fat','fiber','kcal'].every(k=>finite(v(k)))) {
      const calculated = 4*v('protein') + 4*v('carbs') + 9*v('fat') + 2*v('fiber');
      const declared = v('kcal');
      const difference = Math.abs(calculated-declared);
      const tolerance = Math.max(20,calculated*0.05);
      energyCheck={calculatedKcal:round(calculated,1),energyKcal:declared,differenceKcal:round(difference,1),warning:difference>tolerance};
      if (energyCheck.warning)warnings.push('Bilancio energetico non coerente: controllare fattori energetici, definizione dei carboidrati e composizione delle fonti.');
    }
    if (finite(v('fat')) && finite(v('saturatedFat')) && v('saturatedFat')>v('fat')+1e-8) warnings.push('Saturi superiori ai grassi totali: dati da quarantinare.');
    if (finite(v('carbs')) && finite(v('sugar')) && v('sugar')>v('carbs')+1e-8) warnings.push('Zuccheri superiori ai carboidrati: dati da quarantinare.');
    return {status:Object.keys(values).length?'reconstructed':'partial',basis:'per_100g_input_ingredients',
      exactPercentageTotal:round(knownPct),missingPercentages:hasUnknown,measuredYield:validYield?Number(yieldFactor):null,
      matchedPercentage:round(matchedWeight),mapping,warnings,values,contributions,energyCheck};
  }
  return {reconstruct,convert,pick,nutrientDefinitions};
});
