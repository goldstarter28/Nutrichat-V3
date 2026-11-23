/* NutriTrace V5 — riferimenti verificati il 23 novembre 2026.
 * Valori di popolazione per adulti sani: non diagnosi né prescrizioni individuali.
 * Non legge/scrive dati utente e non modifica autonomamente gli obiettivi salvati.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.NutriTraceNutritionReferences = api;
    root.NutriTraceNutritionReference = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const VERSION = '2026-11-23';
  const src = (id, title, url, year, category) => ({ id, title, url, year, category: category || 'reference', checkedAt: VERSION });
  const opinion = (id, name, year, number) => src(id, 'EFSA · ' + name, 'https://www.efsa.europa.eu/en/efsajournal/pub/' + number, year);
  const sources = [
    src('efsa-drv', 'EFSA · Significato e uso dei valori di riferimento', 'https://www.efsa.europa.eu/en/topics/topic/dietary-reference-values', 2024),
    src('efsa-summary', 'EFSA · Sintesi DRV (settembre 2017; sodio/cloruro aggiornati separatamente)', 'https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf', 2017),
    src('efsa-ul', 'EFSA · Limiti superiori e livelli di sicurezza, versione 11 (agosto 2025)', 'https://www.efsa.europa.eu/sites/default/files/2024-05/ul-summary-report.pdf', 2025, 'safety'),
    src('sinu-larn', 'SINU · LARN, V revisione (2024)', 'https://sinu.it/Larn/', 2024),
    src('sinu-tables', 'SINU · Tabelle riassuntive LARN V, edizione online', 'https://sinu.it/wp-content/uploads/2025/07/Tabelle-riassuntive_online.pdf', 2025),
    opinion('efsa-a', 'Vitamina A (RE; articolo 2015, erratum 2025)', 2015, '4028'),
    opinion('efsa-b1', 'Tiamina', 2016, '4653'),
    opinion('efsa-b2', 'Riboflavina', 2017, '4919'),
    opinion('efsa-b3', 'Niacina', 2014, '3759'),
    opinion('efsa-b5', 'Acido pantotenico', 2014, '3581'),
    opinion('efsa-b6', 'Vitamina B6', 2016, '4485'),
    opinion('efsa-b7', 'Biotina', 2014, '3580'),
    opinion('efsa-folate', 'Folati (equivalenti alimentari, DFE)', 2014, '3893'),
    opinion('efsa-b12', 'Vitamina B12', 2015, '4150'),
    opinion('efsa-c', 'Vitamina C', 2013, '3418'),
    opinion('efsa-d', 'Vitamina D', 2016, '4547'),
    opinion('efsa-e', 'Vitamina E come α-tocoferolo', 2015, '4149'),
    opinion('efsa-k', 'Vitamina K come fillochinone', 2017, '4780'),
    opinion('efsa-choline', 'Colina', 2016, '4484'),
    opinion('efsa-calcium', 'Calcio', 2015, '4101'),
    opinion('efsa-phosphorus', 'Fosforo', 2015, '4185'),
    opinion('efsa-magnesium', 'Magnesio', 2015, '4186'),
    opinion('efsa-sodium', 'Sodio: assunzione sicura e adeguata', 2019, '5778'),
    opinion('efsa-chloride', 'Cloruro: assunzione sicura e adeguata', 2019, '5779'),
    opinion('efsa-potassium', 'Potassio', 2016, '4592'),
    opinion('efsa-iron', 'Ferro', 2015, '4254'),
    opinion('efsa-zinc', 'Zinco e fitati', 2014, '3844'),
    opinion('efsa-copper', 'Rame', 2015, '4253'),
    opinion('efsa-manganese', 'Manganese', 2013, '3419'),
    opinion('efsa-iodine', 'Iodio', 2014, '3660'),
    opinion('efsa-selenium', 'Selenio', 2014, '3846'),
    opinion('efsa-molybdenum', 'Molibdeno', 2013, '3333'),
    opinion('efsa-chromium', 'Cromo: nessun AI/PRI definito', 2014, '3845'),
    opinion('efsa-fats', 'Grassi, ALA, LA ed EPA + DHA', 2010, '1461'),
    opinion('efsa-protein', 'Proteine e aminoacidi', 2012, '2557'),
    opinion('efsa-carbohydrate', 'Carboidrati e fibre', 2010, '1462'),
    opinion('efsa-energy', 'Energia e attività fisica (PAL)', 2013, '3005'),
    src('energy-mifflin', 'Mifflin et al. · Equazione del dispendio energetico a riposo', 'https://pubmed.ncbi.nlm.nih.gov/2305711/', 1990),
    src('who-sodium', 'OMS · Riduzione del sodio', 'https://www.who.int/tools/elena/interventions/sodium-cvd-adults', 2012),
    src('who-amino', 'WHO/FAO/UNU · Proteine e aminoacidi, TRS 935, tabella 49', 'https://iris.who.int/handle/10665/43411', 2007),
    src('efsa-b6-ul', 'EFSA · UL vitamina B6, valore finale 12 mg/die', 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2023.8006', 2023, 'safety'),
    src('efsa-e-ul', 'EFSA · UL vitamina E', 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2024.8953', 2024, 'safety'),
    src('efsa-selenium-ul', 'EFSA · UL selenio', 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2023.7704', 2023, 'safety'),
    src('efsa-copper-safety', 'EFSA · Rame: ADI e esposizione', 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2023.7728', 2023, 'safety'),
    src('efsa-manganese-safety', 'EFSA · Manganese: livello di sicurezza', 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2023.8413', 2023, 'safety'),
    src('efsa-fluoride-safety', 'EFSA · Rivalutazione del fluoruro', 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2025.9478', 2025, 'safety')
  ];
  const sourceById = Object.fromEntries(sources.map(s => [s.id, s]));
  const records = {};
  function def(name, unit, type, oldTarget, reference, sourceId, options) {
    records[name] = Object.assign({ name, unit, type, oldTarget, reference, sourceIds: [sourceId], kind: 'minimum' }, options || {});
  }
  def('Vitamina A', 'µg', 'PRI', 900, '750 M / 650 F µg RE/die', 'efsa-a', { male: 750, female: 650, basis: 'RE', note: 'RE e RAE non sono intercambiabili per i carotenoidi. Il limite riguarda solo il retinolo preformato.' });
  def('Tiamina B1', 'mg', 'PRI', 1.2, '0,1 mg/MJ', 'efsa-b1', { perMJ: 0.1 });
  def('Riboflavina B2', 'mg', 'PRI', 1.3, '1,6 mg/die', 'efsa-b2', { value: 1.6 });
  def('Niacina B3', 'mg', 'PRI', 16, '1,6 mg NE/MJ', 'efsa-b3', { perMJ: 1.6, basis: 'NE', note: 'Il riferimento è in equivalenti di niacina (NE). Niacina misurata e NE possono differire; limiti distinti per le forme aggiunte.' });
  def('Acido pantotenico B5', 'mg', 'AI', 5, '5 mg/die', 'efsa-b5', { value: 5 });
  def('Vitamina B6', 'mg', 'PRI', 1.3, '1,7 M / 1,6 F mg/die', 'efsa-b6', { male: 1.7, female: 1.6 });
  def('Biotina B7', 'µg', 'AI', 30, '40 µg/die', 'efsa-b7', { value: 40 });
  def('Folati', 'µg', 'PRI', 400, '330 µg DFE/die', 'efsa-folate', { value: 330, basis: 'DFE', note: 'Riferimento in DFE. Folati alimentari, DFE e acido folico aggiunto richiedono una base coerente; il limite non riguarda i folati naturali.' });
  def('Vitamina B12', 'µg', 'AI', 2.4, '4 µg/die', 'efsa-b12', { value: 4 });
  def('Vitamina C', 'mg', 'PRI', 90, '110 M / 95 F mg/die', 'efsa-c', { male: 110, female: 95 });
  def('Vitamina D', 'µg', 'AI', 15, '15 µg/die', 'efsa-d', { value: 15, note: 'Riferimento con sintesi cutanea minima; il diario non misura lo stato della vitamina D né indica una dose di integratore.' });
  def('Vitamina E', 'mg', 'AI', 15, '13 M / 11 F mg di α-tocoferolo/die', 'efsa-e', { male: 13, female: 11, basis: 'alpha-tocopherol' });
  def('Vitamina K', 'µg', 'AI', 120, '70 µg di fillochinone/die', 'efsa-k', { value: 70, basis: 'phylloquinone', note: 'Riferimento basato su K1; non è un obiettivo separato validato per K2.' });
  def('Colina', 'mg', 'AI', 550, '400 mg/die', 'efsa-choline', { value: 400 });
  def('Calcio', 'mg', 'PRI', 1000, '1.000 mg (18–24 anni); 950 mg (≥25 anni)/die', 'efsa-calcium', { ageRule: 'calcium' });
  def('Fosforo', 'mg', 'AI', 700, '550 mg/die', 'efsa-phosphorus', { value: 550 });
  def('Magnesio', 'mg', 'AI', 410, '350 M / 300 F mg/die', 'efsa-magnesium', { male: 350, female: 300 });
  def('Sodio', 'mg', 'reduction-goal', 1500, '<2.000 mg/die (riduzione OMS)', 'who-sodium', { value: 2000, kind: 'upper', sourceIds: ['who-sodium', 'efsa-sodium'], note: 'Soglia per contenere il sodio, non quota da raggiungere. Non è un UL; EFSA definisce 2 g/die come assunzione sicura e adeguata.' });
  def('Cloruro', 'mg', 'safe-adequate', 2300, '3.100 mg/die', 'efsa-chloride', { value: 3100, kind: 'target', noAuto: true, note: 'Valore collegato al sodio. Non suggerire sale per colmare una differenza; non viene applicato automaticamente.' });
  def('Potassio', 'mg', 'AI', 3400, '3.500 mg/die', 'efsa-potassium', { value: 3500 });
  def('Ferro', 'mg', 'PRI', 8, '11 mg M / postmenopausa; 16 mg F premenopausa', 'efsa-iron', { iron: true, note: 'Il valore femminile dipende dallo stato fisiologico; non si deduce la menopausa dall’età.' });
  def('Zinco', 'mg', 'PRI', 11, '9,4–16,3 M / 7,5–12,7 F mg/die secondo fitati', 'efsa-zinc', { zinc: true, note: 'Fitati della dieta richiesti per selezionare un valore. La sola etichetta vegetariano/onnivoro non stima i fitati.' });
  def('Rame', 'µg', 'AI', 900, '1.600 M / 1.300 F µg/die', 'efsa-copper', { male: 1600, female: 1300 });
  def('Manganese', 'mg', 'AI', 2.3, '3 mg/die', 'efsa-manganese', { value: 3 });
  def('Iodio', 'µg', 'AI', 150, '150 µg/die', 'efsa-iodine', { value: 150 });
  def('Selenio', 'µg', 'AI', 55, '70 µg/die', 'efsa-selenium', { value: 70 });
  def('Molibdeno', 'µg', 'AI', 45, '65 µg/die', 'efsa-molybdenum', { value: 65 });
  def('Cromo', 'µg', 'not-established', 35, 'Nessun AI/PRI EFSA', 'efsa-chromium', { noAuto: true, note: 'Il valore precedente non può essere presentato come fabbisogno EFSA.' });
  def('Nickel', 'µg', 'not-established', 0, 'Nessun obiettivo nutrizionale automatico', 'efsa-ul', { noAuto: true, note: 'Una soglia tossicologica non è un nutriente da raggiungere.' });
  def('Fluoro', 'mg', 'special-review', 4, 'Nessun obiettivo automatico; sicurezza aggiornata nel 2025', 'efsa-fluoride-safety', { noAuto: true, note: 'Il vecchio target di 4 mg/die è superiore al nuovo livello di sicurezza EFSA di 3,3 mg/die. Il diario alimentare non misura tutte le fonti di esposizione.' });
  def('Zolfo', 'mg', 'not-established', 0, 'Nessun obiettivo isolato in questo catalogo', 'efsa-protein', { noAuto: true });
  def('ALA', 'g', 'AI', 1.6, '0,5% dell’energia', 'efsa-fats', { energyPercent: 0.5 });
  def('EPA', 'mg', 'combined-reference', 250, 'Riferimento nel totale EPA + DHA', 'efsa-fats', { noAuto: true });
  def('DHA', 'mg', 'combined-reference', 250, 'Riferimento nel totale EPA + DHA per adulti', 'efsa-fats', { noAuto: true });
  def('EPA + DHA', 'mg', 'AI', 500, '250 mg/die combinati', 'efsa-fats', { value: 250, components: ['EPA', 'DHA'], note: 'Equivalente aritmetico di 1.750 mg/settimana; non è una dose unica settimanale.' });
  def('DPA', 'mg', 'not-established', 0, 'Nessun obiettivo automatico', 'efsa-fats', { noAuto: true });
  def('Acido linoleico (LA)', 'g', 'AI', 17, '4% dell’energia', 'efsa-fats', { energyPercent: 4 });
  def('Acido arachidonico (AA)', 'mg', 'not-established', 0, 'Nessun DRV definito per adulti', 'efsa-fats', { noAuto: true });
  const amino = [['Leucina', 39, 2.81], ['Isoleucina', 20, 1.44], ['Valina', 26, 1.87], ['Lisina', 30, 2.16], ['Metionina + cisteina', 15, 1.08], ['Treonina', 15, 1.08], ['Triptofano', 4, 0.29], ['Istidina', 10, 0.72], ['Fenilalanina + tirosina', 25, 1.8]];
  amino.forEach(([name, mgPerKg, old]) => def(name, 'g', 'AR', old, mgPerKg + ' mg/kg/die (fabbisogno medio)', 'who-amino', { mgPerKg, noAuto: true, note: 'Fabbisogno medio di popolazione, non PRI né obiettivo per la crescita muscolare. La quantità fissa precedente assumeva 72 kg.' }));

  const limits = {
    'Vitamina A': { value: 3000, unit: 'µg', type: 'UL', scope: 'preformed-retinol', sourceIds: ['efsa-ul'], note: 'Solo vitamina A preformata. Non confrontare con vitamina A totale/RE dei carotenoidi.' },
    'Niacina B3': { value: null, unit: 'mg', type: 'UL', scope: 'added-chemical-forms', sourceIds: ['efsa-ul'], note: '10 mg acido nicotinico / 900 mg nicotinamide, forme aggiunte: non usare un UL sul totale niacina/NE.', alternatives: [{value: 10, form: 'nicotinic-acid'}, {value: 900, form: 'nicotinamide'}] },
    'Vitamina B6': { value: 12, unit: 'mg', type: 'UL', scope: 'total-intake', sourceIds: ['efsa-b6-ul'] },
    'Folati': { value: 1000, unit: 'µg', type: 'UL', scope: 'supplemental-folate-forms', sourceIds: ['efsa-ul'], note: 'Forme aggiunte di folato secondo EFSA; esclude i folati naturali. Non confrontare direttamente con DFE totali.' },
    'Vitamina D': { value: 100, unit: 'µg', type: 'UL', scope: 'total-intake', sourceIds: ['efsa-ul'], note: 'D2/D3 equivalenti; per calcidiolo serve il fattore specifico EFSA.' },
    'Vitamina E': { value: 300, unit: 'mg', type: 'UL', scope: 'alpha-tocopherol', sourceIds: ['efsa-e-ul'], note: 'α-tocoferolo da tutte le fonti. Non applicabile a persone con anticoagulanti/antiaggreganti o condizioni indicate nel parere.' },
    'Calcio': { value: 2500, unit: 'mg', type: 'UL', scope: 'total-intake', sourceIds: ['efsa-ul'] },
    'Magnesio': { value: 250, unit: 'mg', type: 'UL', scope: 'readily-dissociable-added-magnesium', sourceIds: ['efsa-ul'], note: 'Sali dissociabili/MgO da integratori, acqua o aggiunti; esclude il magnesio naturalmente presente in alimenti e bevande.' },
    'Ferro': { value: 40, unit: 'mg', type: 'safe-level', scope: 'total-intake', sourceIds: ['efsa-ul'], note: 'Livello di sicurezza, non UL. Superarlo non dimostra automaticamente un rischio individuale.' },
    'Zinco': { value: 25, unit: 'mg', type: 'UL', scope: 'total-intake', sourceIds: ['efsa-ul'] },
    'Rame': { value: 0.07, unit: 'mg/kg', type: 'ADI', scope: 'total-intake', sourceIds: ['efsa-copper-safety'], note: 'ADI dipendente dal peso; non è un obiettivo nutrizionale.' },
    'Manganese': { value: 8, unit: 'mg', type: 'safe-level', scope: 'total-intake', sourceIds: ['efsa-manganese-safety'], note: 'Livello di sicurezza, non UL.' },
    'Iodio': { value: 600, unit: 'µg', type: 'UL', scope: 'total-intake', sourceIds: ['efsa-ul'] },
    'Selenio': { value: 255, unit: 'µg', type: 'UL', scope: 'total-intake', sourceIds: ['efsa-selenium-ul'] },
    'Molibdeno': { value: 600, unit: 'µg', type: 'UL', scope: 'total-intake', sourceIds: ['efsa-ul'] },
    'Fluoro': { value: 3.3, unit: 'mg', type: 'safe-level', scope: 'all-oral-exposure', sourceIds: ['efsa-fluoride-safety'], note: 'Include fonti orali non alimentari; non è un obiettivo da raggiungere.' }
  };
  const finite = v => (v === null || v === undefined || v === '' || typeof v === 'boolean') ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
  const key = v => String(v || '').toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const nameIndex = new Map(Object.keys(records).map(name => [key(name), name]));
  function canonicalName(name) { return nameIndex.get(key(typeof name === 'object' ? name.name || name.id : name)); }
  function normalizeProfile(profile) {
    const p = profile || {};
    let sex = String(p.sex || '').toLowerCase();
    if (['m', 'maschio', 'uomo'].includes(sex)) sex = 'male';
    if (['f', 'femmina', 'donna'].includes(sex)) sex = 'female';
    return { ...p, age: finite(p.age), weight: finite(p.weight), kcal: finite(p.kcal), sex, physiologicalState: p.physiologicalState || p.physiologicalStatus || (p.pregnancy === true ? 'pregnant' : 'none') };
  }
  function profileIssue(p) {
    if (p.age === null || p.age < 18 || p.age > 120) return 'La selezione automatica richiede un profilo adulto valido.';
    if (p.clinical === true || (p.careContext && p.careContext !== 'none')) return 'Obiettivi da concordare con il professionista che segue la tua situazione.';
    if (!['none', 'not-applicable', 'normal'].includes(p.physiologicalState)) return 'Questa situazione richiede riferimenti specifici: mantieni gli obiettivi concordati con il professionista.';
    return '';
  }
  function limitForGoal(name, profile) {
    const canonical = canonicalName(name), p = normalizeProfile(profile);
    if (!canonical || !limits[canonical] || profileIssue(p)) return null;
    const limit = { ...limits[canonical], sourceIds: [...limits[canonical].sourceIds], period: 'day', population: 'Adulti sani' };
    if (limit.unit === 'mg/kg') {
      if (!(p.weight > 0)) return { ...limit, value: null, canCompareTotal: false };
      limit.value *= p.weight;
      limit.unit = 'mg';
    }
    limit.canCompareTotal = limit.type === 'UL' && limit.scope === 'total-intake';
    return limit;
  }
  function referenceForGoal(name, profile) {
    const canonical = canonicalName(name), p = normalizeProfile(profile), row = records[canonical];
    if (!row) return null;
    const result = { name: row.name, unit: row.unit, value: null, type: row.type, kind: row.kind, period: 'day', sourceIds: [...row.sourceIds], reference: row.reference, note: row.note || '', basis: row.basis || null, autoApplicable: false, reviewedAt: VERSION, upperLimit: limitForGoal(canonical, p) };
    const issue = profileIssue(p);
    if (issue) return { ...result, reason: issue };
    let value = row.value;
    if (Object.prototype.hasOwnProperty.call(row, 'male')) {
      if (!['male', 'female'].includes(p.sex)) return { ...result, reason: 'Per questo riferimento serve il sesso utilizzato dalle tabelle.' };
      value = row[p.sex];
    }
    if (row.perMJ || row.energyPercent) {
      if (!(p.kcal > 0)) return { ...result, reason: 'Per questo riferimento serve un obiettivo energetico valido.' };
      value = row.perMJ ? row.perMJ * p.kcal * 0.004184 : p.kcal * row.energyPercent / 100 / 9;
    }
    if (row.ageRule === 'calcium') value = p.age < 25 ? 1000 : 950;
    if (row.iron) {
      if (p.sex === 'male') value = 11;
      else if (p.sex === 'female' && ['menstruating', 'premenopause', 'premenopausal'].includes(p.menstrualStatus)) value = 16;
      else if (p.sex === 'female' && ['postmenopause', 'postmenopausal'].includes(p.menstrualStatus)) value = 11;
      else return { ...result, reason: 'Il riferimento per il ferro richiede un contesto fisiologico esplicito.' };
    }
    if (row.zinc) {
      const level = { low: 0, moderate: 1, high: 2, veryHigh: 3, 300: 0, 600: 1, 900: 2, 1200: 3 }[p.zincPhytate];
      if (!['male', 'female'].includes(p.sex) || level === undefined) return { ...result, reason: 'Fitati non stimati: nessun valore singolo applicato automaticamente.' };
      value = p.sex === 'male' ? [9.4, 11.7, 14, 16.3][level] : [7.5, 9.3, 11, 12.7][level];
    }
    if (row.mgPerKg) {
      if (!(p.weight > 0)) return { ...result, reason: 'Per il riferimento medio serve il peso.' };
      value = row.mgPerKg * p.weight / 1000;
    }
    if (finite(value) === null || value <= 0) return { ...result, reason: row.note || row.reference };
    return { ...result, value, autoApplicable: !row.noAuto, reason: row.noAuto ? row.note || row.reference : '' };
  }
  // Only descriptive metadata and scientifically scoped limits; never a saved target mutation.
  function catalogMetadataPatch(name, unit) {
    const canonical = canonicalName(name), row = records[canonical];
    if (!row) return {};
    const limit = limits[canonical];
    const comparable = limit && limit.type === 'UL' && limit.scope === 'total-intake';
    const targetUnit = unit || row.unit;
    const massFactors = { g: 1, mg: 0.001, 'µg': 0.000001, 'μg': 0.000001, ug: 0.000001, mcg: 0.000001 };
    const sourceFactor = comparable && massFactors[String(limit.unit).trim().toLowerCase()];
    const targetFactor = massFactors[String(targetUnit).trim().toLowerCase()];
    const ratio = sourceFactor && targetFactor ? sourceFactor / targetFactor : null;
    return {
      referenceType: row.type, referenceText: row.reference, referenceSourceIds: [...row.sourceIds], referenceVersion: VERSION,
      referenceNote: row.note || '', referenceBasis: row.basis || null,
      ul: comparable && ratio !== null ? limit.value * ratio : null, ulUnit: targetUnit,
      ulPopulation: 'healthy-adults', ulScope: limit ? limit.scope : null,
      ulNote: comparable ? 'UL EFSA per adulti sani, apporto totale cronico; non un obiettivo.' + (limit.note ? ' ' + limit.note : '') : limit ? limit.note || 'Limite non confrontabile con il totale registrato.' : 'Nessun UL EFSA applicabile al totale in questo catalogo.'
    };
  }
  const auditRows = Object.values(records).map(row => ({
    name: row.name, unit: row.unit, previousDailyTarget: row.oldTarget, reference: row.reference,
    type: row.type, sourceIds: [...row.sourceIds], note: row.note || '',
    action: row.noAuto ? 'Nessuna nuova impostazione automatica' : row.value === row.oldTarget ? 'Valore confermato nel contesto indicato' : 'Riferimento aggiornato; applicazione esplicita',
    safety: limits[row.name] ? { ...limits[row.name] } : null
  }));
  function format(value, maximumFractionDigits) { return Number(value).toLocaleString('it-IT', { maximumFractionDigits: maximumFractionDigits === undefined ? 2 : maximumFractionDigits }); }
  function SourcesView(props) {
    const React = root.React;
    if (!React) return null;
    const h = React.createElement;
    const [query, setQuery] = React.useState('');
    const visible = auditRows.filter(row => key(row.name).includes(key(query)));
    const link = id => {
      const source = sourceById[id];
      return source ? h('a', { key: id, href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.title) : null;
    };
    return h('section', { className: 'card v5-sources', id: 'fonti-scientifiche', 'aria-labelledby': 'v5-sources-title' },
      h('span', { className: 'eyebrow' }, 'DATI E RIFERIMENTI'),
      h('h2', { id: 'v5-sources-title' }, 'Fonti scientifiche'),
      h('p', null, 'I riferimenti aiutano a leggere il diario. Descrivono gruppi di adulti sani e non stabiliscono il tuo fabbisogno esatto. Gli obiettivi che hai già impostato restano modificabili.'),
      h('p', { className: 'muted' }, 'Verifica delle fonti: 23 novembre 2026. Catalogo principale EFSA; LARN SINU V revisione come riferimento italiano distinto. Nessuna certificazione o approvazione dell’app da parte degli enti citati.'),
      h('div', { className: 'v5-source-principles' },
        h('p', null, h('strong', null, 'PRI / AI'), ' sono riferimenti di popolazione con basi scientifiche diverse. AR indica un fabbisogno medio. UL e livelli di sicurezza sono limiti, mai quote da raggiungere.'),
        h('p', null, h('strong', null, 'Dati mancanti ≠ zero. '), 'La copertura indica quanta parte del diario ha informazioni disponibili; non misura la precisione delle stime. Un valore sotto il riferimento non diagnostica una carenza.'),
        h('p', null, h('strong', null, 'Composizione e fabbisogni sono fonti diverse. '), 'Etichette, database e stime descrivono gli alimenti. I riferimenti qui sotto descrivono l’assunzione: non certificano ogni scheda alimentare né le quantità riconosciute da una foto.')
      ),
      h('p', { className: 'v5-source-links' }, link('efsa-drv'), ' · ', link('sinu-larn'), ' · ', link('efsa-ul')),
      h('details', null,
        h('summary', null, 'Verifica dei ' + auditRows.length + ' nutrienti del catalogo'),
        h('label', null, 'Trova un nutriente', h('input', { value: query, onChange: e => setQuery(e.target.value), type: 'search', placeholder: 'Es. magnesio, vitamina B12' })),
        h('div', { className: 'v5-source-audit' }, visible.map(row => h('article', { key: row.name, className: 'v5-source-row' },
          h('h3', null, row.name),
          h('p', null, h('strong', null, row.reference), ' · ', row.type),
          h('p', { className: 'muted' }, 'Preimpostazione V4: ', format(row.previousDailyTarget), ' ', row.unit, '/die. ', row.action, '.'),
          row.note ? h('p', null, row.note) : null,
          row.safety ? h('p', { className: 'muted' }, row.safety.type, row.safety.value !== null ? ' ' + format(row.safety.value) + ' ' + row.safety.unit + '/die' : '', '. ', row.safety.note || 'Riferimento di sicurezza per adulti sani; non un obiettivo.') : null,
          h('div', { className: 'v5-source-links' }, [...new Set([...row.sourceIds, ...(row.safety ? row.safety.sourceIds : [])])].map(link))
        )))
      ),
      h('details', null, h('summary', null, 'Metodo degli obiettivi automatici'),
        h('p', null, 'Il percorso guidato usa formule esplicite, con un riepilogo da applicare. L’energia è una stima del dispendio: attività e variazione desiderata sono ipotesi da rivedere nel tempo. Il calcolo automatico non sostituisce una valutazione per condizioni particolari.'),
        h('div', { className: 'v5-source-links' }, ['energy-mifflin', 'efsa-energy', 'efsa-protein', 'efsa-carbohydrate', 'efsa-fats'].map(link))
      )
    );
  }
  return Object.freeze({ VERSION, sources, sourceById, records, auditRows, referenceForGoal, limitForGoal, catalogMetadataPatch, SourcesView });
});
