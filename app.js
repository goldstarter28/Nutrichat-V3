const { useEffect, useMemo, useState } = React;
const SOURCE_META = {
    MASTER: { name: 'NutriTrace Master Food DB', version: 'v1', mode: 'bundled', official: true, scientific: true },
    CIQUAL: { name: 'ANSES-CIQUAL', version: '2025', mode: 'local', official: true, scientific: true },
    FRIDA: { name: 'FRIDA / DTU Food Institute', version: '5.5 (2025)', mode: 'local', official: true, scientific: true },
    COFID: { name: 'UK CoFID', version: '2021', mode: 'local', official: true, scientific: true }
};
const clean = s => String(s ?? '').trim();
const norm = s => clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[µμ]/g, 'u').replace(/[^a-z0-9]+/g, ' ').trim();
function num(v) {
    if (v === null || v === undefined || v === '')
        return null;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : null;
    let s = String(v).trim().replace(',', '.');
    if (!s || /^(tr|trace|n|nd|na|-)$/i.test(s))
        return null;
    s = s.replace(/^</, '').replace(/[^0-9.+-]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
// Espansioni volutamente semplici: aiutano la ricerca in italiano nei dataset EN/FR/DK.
// Dopo il primo utilizzo l'alias italiano viene salvato nell'archivio personale, quindi non serve più tradurre.
const IT_SYNONYMS = {
    pasta:['pasta','spaghetti','macaroni','noodle','noodles','pates'], petto:['breast'], coscia:['thigh'],
    integrale:['whole wheat','wholewheat','whole grain','wholegrain','wholemeal','complet','complete','complets','completes'],
    riso:['rice','riz','ris'], pollo:['chicken','poulet','kylling'], tacchino:['turkey','dinde','kalkun'],
    salmone:['salmon','saumon','laks'], tonno:['tuna','thon','tun'], merluzzo:['cod','cabillaud','torsk'],
    mela:['apple','pomme','aeble'], mele:['apples'], pera:['pear','poire','paere'], pere:['pears'], banana:['banana','banane','bananas'],
    arancia:['orange'], arance:['oranges'], mandarino:['mandarin','tangerine','clementine'], mandarini:['mandarins','tangerines','clementines'],
    pesca:['peach'], pesche:['peaches'], nettarina:['nectarine'], nettarine:['nectarines'], albicocca:['apricot'], albicocche:['apricots'],
    prugna:['plum'], prugne:['plums'], kiwi:['kiwi','kiwifruit'], mango:['mango'], limone:['lemon'], limoni:['lemons'], lime:['lime'],
    pompelmo:['grapefruit'], pompelmi:['grapefruits'], melone:['melon','cantaloupe'], meloni:['melons','cantaloupes'],
    fragola:['strawberry','fraise','jordbaer'], fragole:['strawberries'], mirtillo:['blueberry'], mirtilli:['blueberry','blueberries','myrtille'],
    uovo:['egg','oeuf','aeg'], uova:['eggs','oeufs','aeg'], latte:['milk','lait','maelk'], yogurt:['yogurt','yoghurt','yaourt'],
    formaggio:['cheese','fromage','ost'], pane:['bread','pain','brod'], avena:['oat','oats','avoine','havre'], farro:['farro','spelt','épeautre'],
    lenticchie:['lentil','lentils','lentille','linser'], ceci:['chickpea','chickpeas','pois chiche','kikært'], fagioli:['bean','beans','haricot','bonner'],
    patata:['potato','pomme de terre','kartoffel'], patate:['potatoes','pommes de terre','kartofler'],
    pomodoro:['tomato','tomate'], pomodori:['tomatoes','tomates'], cetriolo:['cucumber','concombre'], cetrioli:['cucumbers','concombres'],
    carota:['carrot','carotte','gulerod'], carote:['carrots'], zucchina:['zucchini','courgette','squash'], zucchine:['zucchini','courgettes'],
    broccolo:['broccoli'], broccoli:['broccoli'], spinacio:['spinach'], spinaci:['spinach','epinard','spinat'],
    lattuga:['lettuce'], sedano:['celery'], peperone:['pepper','bell pepper'], peperoni:['peppers','bell peppers'],
    cipolla:['onion'], cipolle:['onions'], aglio:['garlic'], fungo:['mushroom'], funghi:['mushrooms'],
    ravanello:['radish'], ravanelli:['radishes'], barbabietola:['beet','beetroot'], barbabietole:['beets','beetroots'],
    carciofo:['artichoke'], carciofi:['artichokes'], asparago:['asparagus'], asparagi:['asparagus'], avocado:['avocado','avocados'],
    mandorle:['almond','almonds','amande','mandler'], noci:['walnut','walnuts','noix','valnod'], arachidi:['peanut','peanuts','cacahuete','jordnod'],
    oliva:['olive'], olive:['olives'], olio:['oil','huile','olie'],
    manzo:['beef','boeuf','okse'], maiale:['pork','porc','svin'], crudo:['raw','cru'], cotto:['cooked','boiled','cuit'],
    bollito:['boiled','cooked','bouilli'], grigliato:['grilled','grille'], secco:['dry','dried','sec']
};
function queryTokens(q){
    const stop=new Set(['di','del','della','dei','degli','delle','a','al','alla','con','senza','e','ed','o','un','uno','una','il','lo','la','i','gli','le','da','circa','medio','media','medie','medi','piccolo','piccola','piccoli','piccole','grande','grandi','pezzo','pezzi']);
    return norm(q).split(' ').filter(x=>x&&!stop.has(x)&&!/^\d+(?:[.,]\d+)?$/.test(x)&&!['g','gr','grammi','grammo','kg','chilogrammi','chilogrammo'].includes(x));
}
function tokenAlternatives(token){
    const t=norm(token),out=new Set(t?[t]:[]);
    for(const [key,values] of Object.entries(IT_SYNONYMS)){
        const group=[key,...(values||[])].map(norm).filter(Boolean);
        if(group.includes(t))for(const x of group)out.add(x);
    }
    return [...out];
}
// Phrase/token matching is boundary-aware: e.g. Italian “pollo” must not match English “pollock”.
function hasTerm(text, term) { const t=norm(text), q=norm(term); return Boolean(q) && (t===q || t.startsWith(`${q} `) || t.endsWith(` ${q}`) || t.includes(` ${q} `)); }
function candidateLexicalEvidence(query,candidate){
    const tokens=queryTokens(query);
    if(!tokens.length)return false;
    const text=norm(`${candidate?.name||''} ${candidate?.officialName||''} ${candidate?.name_en||''} ${(candidate?.aliases||[]).join(' ')}`);
    return tokens.some(token=>tokenAlternatives(token).some(alt=>hasTerm(text,alt)));
}
function candidateExactSemanticMatch(query,candidate){
    const q=norm(query); if(!q)return false;
    const names=[candidate?.name,candidate?.officialName,candidate?.name_en,...(candidate?.aliases||[])].map(norm).filter(Boolean);
    if(names.includes(q))return true;
    const qt=queryTokens(query);
    if(qt.length!==1)return false;
    return tokenAlternatives(qt[0]).some(alt=>names.some(name=>name===alt));
}
function semanticLookupQueries(ingredient){
    const ing=typeof ingredient==='string'?{name:ingredient}:ingredient||{};
    return [ing.lookup_name_en,...(ing.search_terms_en||[]),ing.name,...(ing.broader_terms_en||[])]
      .map(clean).filter(Boolean).filter((x,i,a)=>a.findIndex(y=>norm(y)===norm(x))===i).slice(0,20);
}
function candidateSemanticGate(ingredient,candidate,matchedQuery=''){
    const ing=typeof ingredient==='string'?{name:ingredient}:ingredient||{};
    const text=norm(`${candidate?.name||''} ${candidate?.officialName||''} ${candidate?.name_en||''} ${(candidate?.aliases||[]).join(' ')}`);
    if(!text)return false;
    const must=(ing.must_terms_en||[]).map(norm).filter(Boolean), exclude=(ing.exclude_terms_en||[]).map(norm).filter(Boolean);
    if(exclude.some(t=>hasTerm(text,t)))return false;
    // A must-list is interpreted as semantic evidence, not as a requirement that every adjective be present.
    if(must.length&&!must.some(t=>hasTerm(text,t)))return false;
    const queries=semanticLookupQueries(ing);
    return queries.some(q=>candidateLexicalEvidence(q,candidate)||candidateExactSemanticMatch(q,candidate)) ||
      Boolean(matchedQuery&&candidateLexicalEvidence(matchedQuery,candidate));
}
function phraseAlternatives(q) {
    const n = norm(q);
    const out = [n];
    if (n === 'pasta integrale')
        out.push('whole wheat pasta', 'wholemeal pasta', 'pates completes', 'whole grain pasta');
    if (n === 'riso integrale')
        out.push('brown rice', 'whole grain rice', 'riz complet');
    if (n === 'pane integrale')
        out.push('whole wheat bread', 'wholemeal bread', 'pain complet');
    return out;
}
const FIELD_ALIASES = {
    kcal: ['energy kcal', 'energie kcal', 'energia kcal', 'energy kcal 100g', 'energy kcal per 100g', 'kcal'],
    protein: ['protein', 'proteins', 'proteines', 'proteine', 'protein g', 'protein g 100g'],
    carbs: ['carbohydrate', 'carbohydrates', 'available carbohydrates', 'available_carbohydrates', 'glucides', 'carboidrati', 'carboidrati disponibili', 'carbohydrate g'],
    sugar: ['sugars', 'sum sugars', 'soluble sugars', 'soluble_sugars', 'sucres', 'zuccheri', 'zuccheri solubili', 'total sugars'],
    fat: ['fat', 'lipid', 'lipids', 'lipides', 'grassi', 'total fat'],
    saturatedFat: ['saturates', 'saturated fatty acids', 'saturated fat', 'acides gras satures', 'grassi saturi'],
    fiber: ['fibre', 'fiber', 'total fiber', 'total_fiber', 'fibra totale', 'dietary fibre', 'fibres alimentaires', 'fibre alimentaire'],
    salt: ['salt', 'sel chlorure de sodium', 'sale'], sodium: ['sodium', 'sodio'],
};
const NUTRIENT_ALIASES = {
    'Calcio': ['calcium', 'calcio'], 'Ferro': ['iron', 'fer', 'ferro'], 'Magnesio': ['magnesium', 'magnesio'],
    'Potassio': ['potassium', 'potassio'], 'Zinco': ['zinc', 'zinco'], 'Rame': ['copper', 'cuivre', 'rame'],
    'Manganese': ['manganese'], 'Selenio': ['selenium', 'selenio'], 'Iodio': ['iodine', 'iode', 'iodio'],
    'Fosforo': ['phosphorus', 'phosphore', 'fosforo'], 'Vitamina C': ['vitamin c', 'vitamine c', 'vitamina c'],
    'Vitamina D': ['vitamin d', 'vitamine d', 'vitamina d'], 'Vitamina E': ['vitamin e', 'vitamine e', 'vitamina e'],
    'Tiamina B1': ['thiamin', 'thiamine', 'vitamine b1', 'tiamina'], 'Riboflavina B2': ['riboflavin', 'riboflavine', 'vitamine b2'],
    'Niacina B3': ['niacin', 'niacine', 'vitamine b3'], 'Vitamina B6': ['vitamin b6', 'vitamine b6'],
    'Folati': ['folate', 'folates', 'folates totaux', 'vitamin b9', 'vitamine b9'], 'Acido folico': ['folic acid', 'acide folique'],
    'Vitamina B12': ['vitamin b12', 'vitamine b12'], 'Vitamina K': ['vitamin k', 'vitamine k'],
    'ALA': ['alpha linolenic', 'alpha linolenique', '18 3 n 3', 'c18 3 n 3'], 'EPA': ['eicosapentaenoic', '20 5 n 3', 'c20 5 n 3'],
    'DHA': ['docosahexaenoic', '22 6 n 3', 'c22 6 n 3'], 'Acido linoleico (LA)': ['linoleic acid', '18 2 n 6', 'c18 2 n 6'],
    'Colesterolo': ['cholesterol'],
    'Leucina': ['leucine'], 'Isoleucina': ['isoleucine'], 'Valina': ['valine'], 'Lisina': ['lysine'], 'Metionina': ['methionine'],
    'Treonina': ['threonine'], 'Triptofano': ['tryptophan'], 'Istidina': ['histidine'], 'Fenilalanina': ['phenylalanine'],
    'Fruttosio': ['fructose'], 'Glucosio': ['glucose'], 'Galattosio': ['galactose'], 'Lattosio': ['lactose'], 'Saccarosio': ['sucrose'],
    'Sodio': ['sodium', 'sodio'], 'Cloruro': ['chloride', 'chlorine', 'cloro', 'cloruro'], 'Cromo': ['chromium', 'cromo'],
    'Molibdeno': ['molybdenum', 'molibdeno'], 'Nickel': ['nickel'], 'Fluoro': ['fluoride', 'fluorine', 'fluoro'], 'Zolfo': ['sulfur', 'sulphur', 'zolfo'],
    'Vitamina A': ['vitamin a', 'vitamina a', 'retinol equivalent', 'retinolo equivalente'],
    'Acido pantotenico B5': ['pantothenic acid', 'acido pantotenico'], 'Biotina B7': ['biotin', 'biotina'],
    'Colina': ['choline', 'colina'], 'Acido arachidonico (AA)': ['arachidonic acid', 'acido arachidonico', '20 4 n 6'],
};
function matchesHeader(header, aliases) { const h = norm(header); return aliases.some(a => h === norm(a) || h.includes(norm(a))); }
function unitFromHeader(h, fallback = 'mg') { const n = norm(h); if (/\b(kcal)\b/.test(n))
    return 'kcal'; if (/\b(ug|mcg)\b/.test(n))
    return 'µg'; if (/\bmg\b/.test(n))
    return 'mg'; if (/\bg\b/.test(n))
    return 'g'; return fallback; }
function findNameKey(keys) { const candidates = ['alim nom fr', 'food name', 'foodname', 'food name english', 'name', 'description', 'food', 'foedevare navn', 'fødevare navn']; return keys.find(k => candidates.some(c => norm(k) === norm(c))) || keys.find(k => /(food|aliment|alim|fødevare).*(name|nom|navn)|description/.test(norm(k))); }
function findIdKey(keys) { return keys.find(k => /(food id|foodid|alim code|code alim|id food|food code|fdc id|fdc_id)/.test(norm(k))) || null; }
function findBrandKey(keys) { return keys.find(k => /(brand|marque|marca)/.test(norm(k))) || null; }
function sourceRef(source, id) { return `${SOURCE_META[source]?.name || source}${id ? ` · ${id}` : ''}`; }
function newId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function emptyLabel() { return { kcal: '', protein: '', carbs: '', sugar: '', fat: '', saturatedFat: '', fiber: '', salt: '' }; }
function normalizeWideRows(source, rows) {
    if (!rows?.length)
        return [];
    const keys = Object.keys(rows.find(r => r && Object.keys(r).length) || {});
    const nameKey = findNameKey(keys);
    const idKey = findIdKey(keys);
    const brandKey = findBrandKey(keys);
    if (!nameKey)
        return [];
    const out = [];
    for (const r of rows) {
        const name = clean(r[nameKey]);
        if (!name)
            continue;
        const label = emptyLabel();
        const nutrients = [];
        for (const [key, val] of Object.entries(r)) {
            const v = num(val);
            if (v === null)
                continue;
            for (const [field, aliases] of Object.entries(FIELD_ALIASES))
                if (matchesHeader(key, aliases)) {
                    if (field === 'sodium') {
                        if (label.salt === '')
                            label.salt = v * 2.5 / (unitFromHeader(key) === 'mg' ? 1000 : 1);
                    }
                    else if (label[field] === '')
                        label[field] = v;
                }
            for (const [display, aliases] of Object.entries(NUTRIENT_ALIASES))
                if (matchesHeader(key, aliases)) {
                    nutrients.push({ id: newId(), name: display, form: 'naturalmente presente / non specificata', amount: v, unit: unitFromHeader(key, ['Folati', 'Vitamina B12', 'Vitamina D', 'Iodio'].includes(display) ? 'µg' : 'mg'), source: SOURCE_META[source].name, evidence: 'dataset ufficiale', bio: { mode: 'none' } });
                    break;
                }
        }
        out.push({ localId: `${source}:${clean(r[idKey]) || out.length + 1}`, source, sourceId: clean(r[idKey]) || String(out.length + 1), name, officialName: name, brand: brandKey ? clean(r[brandKey]) : '', servingGrams: 100, label, nutrients, ingredients: '', aliases: [], sourceInfo: { id: newId(), name: SOURCE_META[source].name, reference: sourceRef(source, clean(r[idKey])), quality: 'primaria', version: SOURCE_META[source].version } });
    }
    return out;
}
function normalizeLongRows(source, rows) {
    if (!rows?.length)
        return [];
    const keys = Object.keys(rows.find(r => r && Object.keys(r).length) || {});
    const idKey = findIdKey(keys);
    const nameKey = findNameKey(keys);
    const paramKey = keys.find(k => /(parameter name|parameter|component|nutrient)/.test(norm(k)));
    const valueKey = keys.find(k => /^(value|amount|content)$/.test(norm(k))) || keys.find(k => /(value|amount|content)/.test(norm(k)));
    const unitKey = keys.find(k => /^unit$/.test(norm(k)) || /unit/.test(norm(k)));
    if (!nameKey || !paramKey || !valueKey)
        return [];
    const grouped = new Map();
    for (const r of rows) {
        const id = clean(idKey ? r[idKey] : r[nameKey]);
        const name = clean(r[nameKey]);
        if (!name)
            continue;
        if (!grouped.has(id))
            grouped.set(id, { id, name, rows: [] });
        grouped.get(id).rows.push(r);
    }
    const out = [];
    for (const g of grouped.values()) {
        const label = emptyLabel();
        const nutrients = [];
        for (const r of g.rows) {
            const p = clean(r[paramKey]);
            const v = num(r[valueKey]);
            if (v === null)
                continue;
            const rawUnit=clean(unitKey ? r[unitKey] : ''); const unit = rawUnit ? (rawUnit.replace(/μ/g,'µ').replace(/^ug$/i,'µg').replace(/^mcg$/i,'µg')) : unitFromHeader(p);
            for (const [field, aliases] of Object.entries(FIELD_ALIASES))
                if (matchesHeader(p, aliases)) {
                    if (field === 'sodium') {
                        if (label.salt === '')
                            label.salt = v * 2.5 / (unit.toLowerCase() === 'mg' ? 1000 : 1);
                    }
                    else if (label[field] === '')
                        label[field] = v;
                }
            for (const [display, aliases] of Object.entries(NUTRIENT_ALIASES))
                if (matchesHeader(p, aliases)) {
                    nutrients.push({ id: newId(), name: display, form: 'naturalmente presente / non specificata', amount: v, unit: unit.replace(/ug/i, 'µg'), source: SOURCE_META[source].name, evidence: 'dataset ufficiale', bio: { mode: 'none' } });
                    break;
                }
        }
        out.push({ localId: `${source}:${g.id}`, source, sourceId: g.id, name: g.name, officialName: g.name, brand: '', servingGrams: 100, label, nutrients, ingredients: '', aliases: [], sourceInfo: { id: newId(), name: SOURCE_META[source].name, reference: sourceRef(source, g.id), quality: 'primaria', version: SOURCE_META[source].version } });
    }
    return out;
}
function normalizeRows(source, rows) { const keys = Object.keys(rows?.[0] || {}); const longish = keys.some(k => /(parameter|component|nutrient)/.test(norm(k))) && keys.some(k => /(value|amount|content)/.test(norm(k))); return longish ? normalizeLongRows(source, rows) : normalizeWideRows(source, rows); }
function scoreFood(q, f) {
    const name = norm(`${f.name || ''} ${f.officialName || ''}`), brand = norm(f.brand), aliases = (f.aliases || []).map(norm);
    if (!norm(q))
        return 0;
    let s = 0;
    for (const p of phraseAlternatives(q)) {
        if (name === p)
            s = Math.max(s, 120);
        else if (name.startsWith(`${p} `))
            s = Math.max(s, 65);
        else if (hasTerm(name,p))
            s = Math.max(s, 48);
        if (aliases.some(a=>a===p))
            s = Math.max(s, 150);
    }
    for (const token of queryTokens(q)) {
        const alts = tokenAlternatives(token);
        if (alts.some(a => hasTerm(name,a)))
            s += 14;
        else
            s -= 4;
        if (alts.some(a => aliases.some(x => hasTerm(x,a))))
            s += 25;
    }
    if (brand && norm(q) === brand)
        s += 8;
    return Math.max(0, s);
}
function searchLocalDataset(q, datasets, limit = 12) { const all = []; for (const [source, foods] of Object.entries(datasets || {}))
    for (const f of foods || []) {
        const score = scoreFood(q, f);
        if (score > 0)
            all.push({ ...f, score, source });
    } return all.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name))).slice(0, limit); }
function searchPersonalFoods(q, foods, limit = 8) { return (foods || []).map(f => ({ ...f, score: scoreFood(q, f), resultType: 'personal' })).filter(f => f.score > 0).sort((a, b) => b.score - a.score).slice(0, limit); }
const BASE_GOALS = [
    { id: 'kcal', name: 'Energia', unit: 'kcal', target: 2400, period: 'day', kind: 'target' },
    { id: 'protein', name: 'Proteine', unit: 'g', target: 160, period: 'day', kind: 'target' },
    { id: 'carbs', name: 'Carboidrati', unit: 'g', target: 260, period: 'day', kind: 'target' },
    { id: 'fat', name: 'Grassi', unit: 'g', target: 75, period: 'day', kind: 'target' },
    { id: 'fiber', name: 'Fibre', unit: 'g', target: 35, period: 'day', kind: 'minimum' },
    { id: 'Magnesio', name: 'Magnesio', form: '*', unit: 'mg', target: 400, period: 'day', kind: 'minimum' },
    { id: 'Ferro', name: 'Ferro', form: '*', unit: 'mg', target: 10, period: 'day', kind: 'minimum' },
    { id: 'Calcio', name: 'Calcio', form: '*', unit: 'mg', target: 1000, period: 'day', kind: 'minimum' },
    { id: 'Potassio', name: 'Potassio', form: '*', unit: 'mg', target: 3500, period: 'day', kind: 'minimum' },
    { id: 'Zinco', name: 'Zinco', form: '*', unit: 'mg', target: 11, period: 'day', kind: 'minimum' },
    { id: 'EPA', name: 'EPA', form: '*', unit: 'mg', target: 1750, period: 'week', kind: 'minimum' },
    { id: 'DHA', name: 'DHA', form: '*', unit: 'mg', target: 1750, period: 'week', kind: 'minimum' }
];
const MACROS = { kcal: 'Calorie (kcal)', protein: 'Proteine (g)', carbs: 'Carboidrati (g)', sugar: 'Zuccheri (g)', fat: 'Grassi (g)', saturatedFat: 'Saturi (g)', fiber: 'Fibre (g)', salt: 'Sale (g)' };
const EAA = ['Leucina', 'Isoleucina', 'Valina', 'Lisina', 'Metionina', 'Treonina', 'Triptofano', 'Istidina', 'Fenilalanina'];
const emptyFood = () => ({ id: crypto.randomUUID(), name: '', brand: '', servingGrams: 100, label: Object.fromEntries(Object.keys(MACROS).map(k => [k, ''])), ingredients: '', additives: [], nutrients: [], nutrientStatus: {}, sources: [], notes: '', mergeMeta: null, masterId: null, masterVersion: null, aiRequested: [] });
const emptyNutrient = () => ({ id: crypto.randomUUID(), name: '', form: '', amount: '', unit: 'mg', source: 'Etichetta', evidence: 'dichiarato', elementalAmount: '', bio: { mode: 'none', min: '', max: '', source: '' } });
const fmt = (n, d = 1) => Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: d });
const fmtMaybe = (n, d = 1) => isMissing(n) ? 'N/D' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: d });
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfWeek = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; };
const parseAdditives = t => [...new Set((String(t).toUpperCase().match(/\bE\s?\d{3,4}[A-Z]?\b/g) || []).map(x => x.replace(/\s/g, '')))];
const unitFactor = u => u === 'g' ? 1000 : u === 'µg' ? 0.001 : u === 'mg' ? 1 : 1;
const convert = (v, from, to) => Number(v || 0) * unitFactor(from) / unitFactor(to);
function aggregate(logs, foods) {
    const o = { kcal: 0, protein: 0, carbs: 0, sugar: 0, fat: 0, saturatedFat: 0, fiber: 0, salt: 0, nutrients: {} };
    for (const l of logs) {
        const f = foods.find(x => x.id === l.foodId);
        if (!f)
            continue;
        const q = Number(l.grams) / (Number(f.servingGrams) || 100);
        for (const k of Object.keys(MACROS))
            o[k] += (Number(f.label?.[k]) || 0) * q;
        for (const n of f.nutrients || []) {
            const key = `${n.name}|${n.form || 'non specificata'}|${n.unit}`;
            if (!o.nutrients[key])
                o.nutrients[key] = { amount: 0, absorbedMin: 0, absorbedMax: 0, hasBio: false, sources: new Set() };
            const z = o.nutrients[key];
            z.amount += (Number(n.amount) || 0) * q;
            z.sources.add(n.source || 'non specificata');
            const elemental = n.elementalAmount !== '' && n.elementalAmount != null ? Number(n.elementalAmount) : Number(n.amount) || 0;
            const b = n.bio || {};
            if (b.mode === 'fixed' || b.mode === 'range') {
                const min = Number(b.min) || 0, max = Number(b.max || b.min) || 0;
                z.absorbedMin += elemental * q * min / 100;
                z.absorbedMax += elemental * q * max / 100;
                z.hasBio = true;
            }
        }
    }
    return o;
}
function nutrientTotal(ag, name, toUnit = 'mg', form = '*') { let sum = 0; for (const [k, v] of Object.entries(ag.nutrients)) {
    const [n, f, u] = k.split('|');
    if (n.toLowerCase() === name.toLowerCase() && (form === '*' || !form || f.toLowerCase() === form.toLowerCase()))
        sum += convert(v.amount, u, toUnit);
} return sum; }
function absorbedTotal(ag, name, toUnit = 'mg') { let min = 0, max = 0, has = false; for (const [k, v] of Object.entries(ag.nutrients)) {
    const [n, , u] = k.split('|');
    if (n.toLowerCase() !== name.toLowerCase() || !v.hasBio)
        continue;
    min += convert(v.absorbedMin, u, toUnit);
    max += convert(v.absorbedMax, u, toUnit);
    has = true;
} return { min, max, has }; }
function Progress({ value, goal, unit, kind = 'target' }) { const pct = goal ? Math.min(100, value / goal * 100) : 0; const warn = kind === 'upper' && value > goal; return React.createElement("div", { className: "progressBlock" },
    React.createElement("div", { className: "progressTop" },
        React.createElement("strong", null, fmt(value, 2)),
        React.createElement("span", null,
            "/ ",
            fmt(goal, 2),
            " ",
            unit)),
    React.createElement("div", { className: `bar ${warn ? 'over' : ''}` },
        React.createElement("span", { style: { width: `${pct}%` } })),
    React.createElement("small", { className: "goalKind" }, kind === 'minimum' ? 'minimo' : kind === 'upper' ? 'limite massimo' : 'obiettivo')); }
function openDb() { return new Promise((res, rej) => { const r = indexedDB.open('nutritrace-db', 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('datasets'))
    r.result.createObjectStore('datasets'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function dbSet(k, v) { const db = await openDb(); return new Promise((res, rej) => { const tx = db.transaction('datasets', 'readwrite'); tx.objectStore('datasets').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function dbGet(k) { const db = await openDb(); return new Promise((res, rej) => { const r = db.transaction('datasets').objectStore('datasets').get(k); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
async function dbDel(k) { const db = await openDb(); return new Promise((res, rej) => { const tx = db.transaction('datasets', 'readwrite'); tx.objectStore('datasets').delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
function parseSheetRows(data, type = 'array') { const wb = XLSX.read(data, { type }); let rows = []; for (const sn of wb.SheetNames) {
    const a = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
    if (a.length)
        rows.push(...a);
} return rows; }

const h = React.createElement;
const V5 = window.NutriTraceV5, DiaryV5 = window.NutriTraceDiaryV5;
const NutriTraceFastFoodInput = React.memo(
  function NutriTraceFastFoodInput({
    value,
    onQueryChange
  }) {
    const [draft, setDraft] = React.useState(value);

    const timer = React.useRef(null);
    const callback = React.useRef(onQueryChange);

    React.useEffect(() => {
      callback.current = onQueryChange;
    }, [onQueryChange]);

    React.useEffect(() => {
      if (value === '' && draft !== '') {
        clearTimeout(timer.current);
        setDraft('');
      }
    }, [value]);

    React.useEffect(() => {
      return () => clearTimeout(timer.current);
    }, []);

    function handleChange(event) {
      const text = event.target.value;

      setDraft(text);
      clearTimeout(timer.current);

      timer.current = setTimeout(() => {
        callback.current(text);
      }, 350);
    }

    return h('input', {
      value: draft,
      onChange: handleChange,
      placeholder:
        'Es. latte, banana, pollo, 2 uova...',
      autoComplete: 'off',
      'aria-label': 'Cerca un alimento'
    });
  }
);
const MICRO_CATALOG = [
  { group:'Vitamine', id:'Vitamina A', name:'Vitamina A', unit:'µg', dailyTarget:900, minIndicative:700, ul:3000, kind:'minimum' },
  { group:'Vitamine', id:'Tiamina B1', name:'Tiamina B1', unit:'mg', dailyTarget:1.2, minIndicative:1.1, kind:'minimum' },
  { group:'Vitamine', id:'Riboflavina B2', name:'Riboflavina B2', unit:'mg', dailyTarget:1.3, minIndicative:1.1, kind:'minimum' },
  { group:'Vitamine', id:'Niacina B3', name:'Niacina B3', unit:'mg', dailyTarget:16, minIndicative:14, ul:35, ulNote:'UL principalmente da integratori/forme fortificate', kind:'minimum' },
  { group:'Vitamine', id:'Acido pantotenico B5', name:'Acido pantotenico B5', unit:'mg', dailyTarget:5, minIndicative:5, kind:'minimum' },
  { group:'Vitamine', id:'Vitamina B6', name:'Vitamina B6', unit:'mg', dailyTarget:1.3, minIndicative:1.3, ul:100, ulNote:'UL indicativo; interpretare con cautela per integratori', kind:'minimum' },
  { group:'Vitamine', id:'Biotina B7', name:'Biotina B7', unit:'µg', dailyTarget:30, minIndicative:30, kind:'minimum' },
  { group:'Vitamine', id:'Folati', name:'Folati', unit:'µg', dailyTarget:400, minIndicative:400, ul:1000, ulNote:'UL riferito soprattutto ad acido folico da integratori/fortificati', kind:'minimum' },
  { group:'Vitamine', id:'Vitamina B12', name:'Vitamina B12', unit:'µg', dailyTarget:2.4, minIndicative:2.4, kind:'minimum' },
  { group:'Vitamine', id:'Vitamina C', name:'Vitamina C', unit:'mg', dailyTarget:90, minIndicative:90, ul:2000, kind:'minimum' },
  { group:'Vitamine', id:'Vitamina D', name:'Vitamina D', unit:'µg', dailyTarget:15, minIndicative:15, ul:100, kind:'minimum' },
  { group:'Vitamine', id:'Vitamina E', name:'Vitamina E', unit:'mg', dailyTarget:15, minIndicative:15, ul:1000, ulNote:'UL principalmente da integratori/forme fortificate', kind:'minimum' },
  { group:'Vitamine', id:'Vitamina K', name:'Vitamina K', unit:'µg', dailyTarget:120, minIndicative:120, kind:'minimum' },
  { group:'Vitamine', id:'Colina', name:'Colina', unit:'mg', dailyTarget:550, minIndicative:550, ul:3500, kind:'minimum' },

  { group:'Minerali e oligoelementi', id:'Calcio', name:'Calcio', unit:'mg', dailyTarget:1000, minIndicative:1000, ul:2500, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Fosforo', name:'Fosforo', unit:'mg', dailyTarget:700, minIndicative:700, ul:4000, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Magnesio', name:'Magnesio', unit:'mg', dailyTarget:410, minIndicative:400, ul:350, ulNote:'UL 350 mg riguarda integratori/farmaci, non il magnesio naturalmente presente negli alimenti', kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Sodio', name:'Sodio', unit:'mg', dailyTarget:1500, minIndicative:1500, ul:2000, ulNote:'Riferimento prudenziale; il fabbisogno può aumentare con sudorazione importante', kind:'target' },
  { group:'Minerali e oligoelementi', id:'Cloruro', name:'Cloruro', unit:'mg', dailyTarget:2300, minIndicative:2300, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Potassio', name:'Potassio', unit:'mg', dailyTarget:3400, minIndicative:3400, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Ferro', name:'Ferro', unit:'mg', dailyTarget:8, minIndicative:8, ul:45, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Zinco', name:'Zinco', unit:'mg', dailyTarget:11, minIndicative:11, ul:40, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Rame', name:'Rame', unit:'µg', dailyTarget:900, minIndicative:900, ul:10000, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Manganese', name:'Manganese', unit:'mg', dailyTarget:2.3, minIndicative:2.3, ul:11, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Iodio', name:'Iodio', unit:'µg', dailyTarget:150, minIndicative:150, ul:1100, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Selenio', name:'Selenio', unit:'µg', dailyTarget:55, minIndicative:55, ul:400, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Molibdeno', name:'Molibdeno', unit:'µg', dailyTarget:45, minIndicative:45, ul:2000, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Cromo', name:'Cromo', unit:'µg', dailyTarget:35, minIndicative:35, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Nickel', name:'Nickel', unit:'µg', dailyTarget:0, kind:'target', noOfficialTarget:true },
  { group:'Minerali e oligoelementi', id:'Fluoro', name:'Fluoro', unit:'mg', dailyTarget:4, minIndicative:4, ul:10, kind:'minimum' },
  { group:'Minerali e oligoelementi', id:'Zolfo', name:'Zolfo', unit:'mg', dailyTarget:0, kind:'target', noOfficialTarget:true },

  { group:'Acidi grassi essenziali', id:'ALA', name:'ALA', unit:'g', dailyTarget:1.6, minIndicative:1.6, kind:'minimum' },
  { group:'Acidi grassi essenziali', id:'EPA', name:'EPA', unit:'mg', dailyTarget:250, minIndicative:250, kind:'minimum' },
  { group:'Acidi grassi essenziali', id:'DHA', name:'DHA', unit:'mg', dailyTarget:250, minIndicative:250, kind:'minimum' },
  { group:'Acidi grassi essenziali', id:'EPA + DHA', name:'EPA + DHA', unit:'mg', dailyTarget:500, minIndicative:250, ul:3000, components:['EPA','DHA'], kind:'minimum' },
  { group:'Acidi grassi essenziali', id:'DPA', name:'DPA', unit:'mg', dailyTarget:0, kind:'target', noOfficialTarget:true },
  { group:'Acidi grassi essenziali', id:'Acido linoleico (LA)', name:'Acido linoleico (LA)', unit:'g', dailyTarget:17, minIndicative:12, kind:'minimum' },
  { group:'Acidi grassi essenziali', id:'Acido arachidonico (AA)', name:'Acido arachidonico (AA)', unit:'mg', dailyTarget:0, kind:'target', noOfficialTarget:true },

  { group:'Aminoacidi essenziali', id:'Leucina', name:'Leucina', unit:'g', dailyTarget:2.81, minIndicative:2.81, perKgReference:39, kind:'minimum' },
  { group:'Aminoacidi essenziali', id:'Isoleucina', name:'Isoleucina', unit:'g', dailyTarget:1.44, minIndicative:1.44, perKgReference:20, kind:'minimum' },
  { group:'Aminoacidi essenziali', id:'Valina', name:'Valina', unit:'g', dailyTarget:1.87, minIndicative:1.87, perKgReference:26, kind:'minimum' },
  { group:'Aminoacidi essenziali', id:'Lisina', name:'Lisina', unit:'g', dailyTarget:2.16, minIndicative:2.16, perKgReference:30, kind:'minimum' },
  { group:'Aminoacidi essenziali', id:'Metionina + cisteina', name:'Metionina + cisteina', unit:'g', dailyTarget:1.08, minIndicative:1.08, perKgReference:15, components:['Metionina','Cisteina'], kind:'minimum' },
  { group:'Aminoacidi essenziali', id:'Treonina', name:'Treonina', unit:'g', dailyTarget:1.08, minIndicative:1.08, perKgReference:15, kind:'minimum' },
  { group:'Aminoacidi essenziali', id:'Triptofano', name:'Triptofano', unit:'g', dailyTarget:0.29, minIndicative:0.29, perKgReference:4, kind:'minimum' },
  { group:'Aminoacidi essenziali', id:'Istidina', name:'Istidina', unit:'g', dailyTarget:0.72, minIndicative:0.72, perKgReference:10, kind:'minimum' },
  { group:'Aminoacidi essenziali', id:'Fenilalanina + tirosina', name:'Fenilalanina + tirosina', unit:'g', dailyTarget:1.8, minIndicative:1.8, perKgReference:25, components:['Fenilalanina','Tirosina'], kind:'minimum' }
];

const MACRO_GOALS = [
  { id:'kcal', name:'Energia', unit:'kcal', target:2350, period:'day', kind:'target', group:'Energia e macro' },
  { id:'protein', name:'Proteine', unit:'g', target:140, period:'day', kind:'target', group:'Energia e macro' },
  { id:'carbs', name:'Carboidrati', unit:'g', target:317.9, period:'day', kind:'target', group:'Energia e macro' },
  { id:'fat', name:'Grassi', unit:'g', target:57.6, period:'day', kind:'target', group:'Energia e macro' },
  { id:'sugar', name:'Zuccheri semplici', unit:'g', target:60, period:'day', kind:'upper', group:'Energia e macro', preferredMax:40 },
  { id:'fiber', name:'Fibre', unit:'g', target:35, period:'day', kind:'minimum', group:'Energia e macro' }
];

// V5 replaces only reference metadata here. Stored user targets remain intact.
for (let i=0;i<MICRO_CATALOG.length;i++) {
  const g=MICRO_CATALOG[i], refs=window.NutriTraceNutritionReferences;
  const ref=refs.referenceForGoal(g.name, {});
  MICRO_CATALOG[i]={...g,...refs.catalogMetadataPatch(g.name),dailyTarget:ref?.autoApplicable?ref.value:0,
    noOfficialTarget:['not-established','combined-reference','special-review'].includes(ref?.type), referencePending:!ref?.autoApplicable,
    referenceSourceIds:ref?.sourceIds||[], referenceType:ref?.type||null};
}
function buildDefaultGoals(){
  return [
    ...MACRO_GOALS.map(x=>({...x,targetMode:'absolute',perKg:0,pinned:false})),
    ...MICRO_CATALOG.map(x=>({...x,target:Number(x.dailyTarget||0)*7,period:'week',form:'*',targetMode:'absolute',perKg:0,pinned:false}))
  ];
}
function mergeGoalCatalog(saved){
  const base=buildDefaultGoals();
  // V2.3 deliberately uses a new storage key. This merge remains useful for import/backups.
  if(!Array.isArray(saved)||!saved.length)return base;
  const map=new Map(saved.map(g=>[String(g.id),g]));
  const out=base.map(b=>({...b,...(map.get(String(b.id))||{}),...((map.get(String(b.id))||b).group==='Personalizzati'?{}:window.NutriTraceNutritionReferences.catalogMetadataPatch(b.name,(map.get(String(b.id))||{}).unit||b.unit)),group:(map.get(String(b.id))||{}).group||b.group,targetMode:(map.get(String(b.id))||{}).targetMode||'absolute',perKg:Number((map.get(String(b.id))||{}).perKg||0),pinned:Boolean((map.get(String(b.id))||{}).pinned)}));
  const ids=new Set(out.map(g=>String(g.id)));
  for(const g of saved)if(!ids.has(String(g.id)))out.push({...g,group:g.group||'Personalizzati',targetMode:g.targetMode||'absolute',perKg:Number(g.perKg||0),pinned:Boolean(g.pinned)});
  return out;
}

const DEFAULT_PROFILE = { weight:72, macroPlan:{ calorieMode:'fixed', kcal:2350, autoMacro:'carbs', perKg:{ protein:140/72, carbs:317.9/72, fat:.8, sugar:60/72, fiber:35/72 } } };
function normalizeProfile(p){
  if(!p)return structuredClone(DEFAULT_PROFILE);
  if(p.macroPlan)return {...structuredClone(DEFAULT_PROFILE),...p,macroPlan:{...structuredClone(DEFAULT_PROFILE).macroPlan,...p.macroPlan,perKg:{...DEFAULT_PROFILE.macroPlan.perKg,...(p.macroPlan.perKg||{})}}};
  return {...structuredClone(DEFAULT_PROFILE),weight:Number(p.weight||72),macroPlan:{...structuredClone(DEFAULT_PROFILE).macroPlan,kcal:Number(p.kcal||2350),perKg:{...DEFAULT_PROFILE.macroPlan.perKg,protein:Number(p.proteinPerKg||140/72),fat:Number(p.fatPerKg||.8)}}};
}
function computeMacroPlan(profile){
  const weight=Math.max(.1,Number(profile.weight)||0), plan=profile.macroPlan||DEFAULT_PROFILE.macroPlan;
  const per={...DEFAULT_PROFILE.macroPlan.perKg,...(plan.perKg||{})};
  const grams={protein:weight*Number(per.protein||0),carbs:weight*Number(per.carbs||0),fat:weight*Number(per.fat||0),sugar:weight*Number(per.sugar||0),fiber:weight*Number(per.fiber||0)};
  const factors={protein:4,carbs:4,fat:9};
  if(plan.calorieMode==='fixed'&&['protein','carbs','fat'].includes(plan.autoMacro)){
    const auto=plan.autoMacro;let used=0;
    for(const k of ['protein','carbs','fat'])if(k!==auto)used+=grams[k]*factors[k];
    grams[auto]=Math.max(0,(Number(plan.kcal||0)-used)/factors[auto]);per[auto]=grams[auto]/weight;
  }
  const derivedKcal=grams.protein*4+grams.carbs*4+grams.fat*9;
  return {weight,perKg:per,grams,kcal:plan.calorieMode==='derived'?derivedKcal:Number(plan.kcal||0),derivedKcal,delta:Number(plan.kcal||0)-derivedKcal};
}

function parseDateKey(k){ const [y,m,d]=String(k).split('-').map(Number); return new Date(y,m-1,d,12,0,0,0); }
function shiftDateKey(k,days){ const d=parseDateKey(k); d.setDate(d.getDate()+days); return dateKey(d); }
function startOfWeekFor(k){ const d=parseDateKey(k); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d; }
function weekBounds(k){ const a=startOfWeekFor(k), b=new Date(a); b.setDate(a.getDate()+6); return [dateKey(a),dateKey(b)]; }
function dayLabel(k,today){ if(k===today) return 'Oggi'; return parseDateKey(k).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }
function shortDate(k){ return parseDateKey(k).toLocaleDateString('it-IT',{day:'2-digit',month:'short'}); }
function monthBounds(k){const d=parseDateKey(k),a=new Date(d.getFullYear(),d.getMonth(),1,12),b=new Date(d.getFullYear(),d.getMonth()+1,0,12);return[dateKey(a),dateKey(b)];}
function yearBounds(k){const d=parseDateKey(k);return[`${d.getFullYear()}-01-01`,`${d.getFullYear()}-12-31`];}
function daysInclusive(a,b){return Math.max(1,Math.round((parseDateKey(b)-parseDateKey(a))/86400000)+1);}
function previousRange(a,b){const n=daysInclusive(a,b);return[shiftDateKey(a,-n),shiftDateKey(a,-1)];}
function effectiveTarget(g,weight){ return g.targetMode==='perKg' ? Number(g.perKg||0)*Number(weight||0) : Number(g.target||0); }
function goalUnitLabel(g){ return g.targetMode==='perKg' ? `${g.unit}/kg` : g.unit; }
function isMissing(v){ return v===null || v===undefined || v==='' || Number.isNaN(v); }

const CREA_NAME_MAP = {
  magnesium:'Magnesio', iron:'Ferro', calcium:'Calcio', potassium:'Potassio', zinc:'Zinco', copper:'Rame', manganese:'Manganese', selenium:'Selenio', iodine:'Iodio', phosphorus:'Fosforo', sodium:'Sodio', chlorine:'Cloruro', chromium:'Cromo', nickel:'Nickel', molybdenum:'Molibdeno', fluorine:'Fluoro', fluoride:'Fluoro', sulfur:'Zolfo',
  vitamin_a_retinol_equivalent:'Vitamina A', thiamine:'Tiamina B1', riboflavin:'Riboflavina B2', niacin:'Niacina B3', pantothenic_acid:'Acido pantotenico B5', vitamin_b6:'Vitamina B6', biotin:'Biotina B7', folate:'Folati', folates:'Folati', vitamin_b12:'Vitamina B12', vitamin_c:'Vitamina C', vitamin_d:'Vitamina D', vitamin_e:'Vitamina E', vitamin_k:'Vitamina K',
  sucrose:'Saccarosio', glucose:'Glucosio', fructose:'Fruttosio', lactose:'Lattosio', galactose:'Galattosio', maltose:'Maltosio',
  leucine:'Leucina', isoleucine:'Isoleucina', valine:'Valina', lysine:'Lisina', methionine:'Metionina', threonine:'Treonina', tryptophan:'Triptofano', histidine:'Istidina', phenylalanine:'Fenilalanina'
};
const CREA_UNIT_MAP = {
  fluorine:'µg', fluoride:'µg', sodium:'mg', magnesium:'mg', phosphorus:'mg', chlorine:'mg', potassium:'mg', calcium:'mg', chromium:'µg', manganese:'mg', iron:'mg', nickel:'µg', molybdenum:'µg', copper:'mg', zinc:'mg', selenium:'µg', iodine:'µg',
  sucrose:'g', glucose:'g', fructose:'g', lactose:'g', galactose:'g', maltose:'g',
  vitamin_a_retinol_equivalent:'µg', thiamine:'mg', riboflavin:'mg', niacin:'mg', pantothenic_acid:'mg', vitamin_b6:'mg', biotin:'µg', folate:'µg', folates:'µg', vitamin_b12:'µg', vitamin_c:'mg', vitamin_d:'µg', vitamin_e:'mg', vitamin_k:'µg'
};
const CREA_AMINO_KEYS = new Set(['leucine','isoleucine','valine','lysine','methionine','threonine','tryptophan','histidine','phenylalanine']);
function creaUnit(raw, display){
  const n=norm(raw);
  const byKey=Object.entries(CREA_UNIT_MAP).find(([k])=>n===norm(k));
  if(byKey) return byKey[1];
  const fromHeader=unitFromHeader(raw,'');
  if(fromHeader) return fromHeader;
  if(['Saccarosio','Glucosio','Fruttosio','Lattosio','Galattosio','Maltosio'].includes(display)) return 'g';
  if(['Vitamina A','Folati','Vitamina B12','Vitamina D','Vitamina K','Selenio','Iodio'].includes(display)) return 'µg';
  return 'mg';
}
function flattenCreaItems(record){
  const items=[];
  for(const [group,val] of Object.entries(record||{})) if(Array.isArray(val)) for(const x of val) if(x && typeof x==='object' && ('description' in x || 'Descrizione Nutriente' in x)) items.push({group,...x});
  return items;
}
function normalizeCreaNested(source, records){
  const meta=SOURCE_META[source]||{name:source,version:'importato'};
  const out=[];
  for(const r of records||[]){
    const name=clean(r.name||r.Nome||r.food_name||r['Nome Alimento']); if(!name) continue;
    const code=clean(r.food_code||r['Codice Alimento']||r.code||out.length+1);
    const items=flattenCreaItems(r); const by={};
    for(const item of items){ const desc=norm(item.description||item['Descrizione Nutriente']); by[desc]={...item,value:num(item.value??item['Valore per 100 g'])}; }
    const get=(...keys)=>{ for(const k of keys){ const x=by[norm(k)]; if(x && x.value!==null) return x.value; } return null; };
    const getMicro=(...keys)=>{ const v=get(...keys); return v===0?null:v; }; // CREA exports can encode unavailable detail as 0: conservatively expose N/D.
    const label=emptyLabel();
    label.kcal=get('energy_kcal','Energia (kcal)')??'';
    label.protein=get('proteins','Proteine (g)')??'';
    label.fat=get('lipids','Lipidi (g)')??'';
    label.carbs=get('available_carbohydrates','Carboidrati disponibili (g)')??'';
    label.sugar=get('soluble_sugars','Zuccheri solubili (g)')??'';
    label.fiber=get('total_fiber','Fibra totale (g)')??'';
    const nutrients=[];
    const add=(name,amount,unit,raw)=>{ if(amount===null || amount===undefined || !Number.isFinite(Number(amount))) return; nutrients.push({id:newId(),name,form:'naturalmente presente / non specificata',amount:Number(amount),unit,source:meta.name,evidence:'dataset CREA/importato · zero dettaglio ambiguo trattato come N/D',rawName:raw||name,bio:{mode:'none',min:'',max:'',source:''}}); };
    for(const item of items){
      const raw=clean(item.description||item['Descrizione Nutriente']); const n=norm(raw); const v=num(item.value??item['Valore per 100 g']); if(v===null||v===0) continue;
      const groupNorm=norm(item.group||'');
      if(groupNorm.includes('amino') || groupNorm.includes('fatty acid') || groupNorm.includes('acidi grassi')) continue;
      let key=Object.keys(CREA_NAME_MAP).find(k=>n===norm(k)||n.startsWith(norm(k)+' '));
      if(CREA_AMINO_KEYS.has(key)) continue;
      if(!key){
        const aliases=Object.entries(NUTRIENT_ALIASES).find(([,a])=>matchesHeader(raw,a));
        if(aliases) key=aliases[0];
      }
      if(key){ const display=CREA_NAME_MAP[key]||key; const unit=creaUnit(key===display?raw:key,display); add(display,v,unit,raw); }
    }
    const fat=Number(label.fat)||0, protein=Number(label.protein)||0;
    const pct=(...keys)=>getMicro(...keys);
    const sat=pct('saturated_fatty_acids','Acidi grassi Saturi (%)'); if(sat!==null && fat) label.saturatedFat=fat*sat/100;
    const fatty=[['ALA',['C18:3_linolenic_acid','c18_3_linolenic_acid','C18:3 acido linolenico (%)']],['Acido linoleico (LA)',['C18:2_linoleic_acid','c18_2_linoleic_acid','C18:2 acido linoleico (%)']],['Acido arachidonico (AA)',['C20:4_arachidonic_acid','c20_4_arachidonic_acid','C20:4 acido arachidonico (%)']],['EPA',['C20:5_eicosapentaenoic_acid_EPA','c20_5_eicosapentaenoic_acid_epa','C20:5 acido eicosapentenoico EPA (%)']],['DHA',['C22:6_docosahexaenoic_acid_DHA','c22_6_docosahexaenoic_acid_dha','C22:6 acido docosaesenoico DHA (%)']]];
    for(const [display,keys] of fatty){ const v=pct(...keys); if(v!==null && fat) add(display,fat*v/100,'g',keys[0]); }
    for(const aa of EAA){ const english=Object.entries(CREA_NAME_MAP).find(([k,v])=>CREA_AMINO_KEYS.has(k)&&v===aa)?.[0]; const v=getMicro(aa,aa.toLowerCase(),english); if(v!==null && protein) add(aa,protein*v/100,'g',aa); }
    const sodium=nutrients.find(n=>n.name==='Sodio'); if(sodium && isMissing(label.salt)) label.salt=convert(sodium.amount,sodium.unit,'g')*2.5;
    out.push({localId:`${source}:${code}`,source,sourceId:code,name,officialName:name,brand:'',servingGrams:100,label,nutrients,ingredients:'',aliases:[],sourceInfo:{id:newId(),name:meta.name,reference:`CREA ${code}`,quality:'primaria',version:meta.version||'2019'}});
  }
  return out;
}
function normalizeCreaFlat(source, rows){
  const meta=SOURCE_META[source]||{name:source,version:'importato'};
  const get=(r,...aliases)=>{ for(const [k,v] of Object.entries(r||{})) if(aliases.some(a=>norm(k)===norm(a))) return num(v); return null; };
  const getMicro=(r,...aliases)=>{ const v=get(r,...aliases); return v===0?null:v; }; // zero in CREA detail fields is ambiguous: N/D is safer than a false absence.
  const out=[];
  for(const r of rows||[]){
    const name=clean(r.name||r.Nome||r['Nome Alimento']); if(!name) continue;
    const code=clean(r.food_code||r['Codice Alimento']||r.code||out.length+1);
    const label=emptyLabel();
    label.kcal=get(r,'energy_kcal','Energia (kcal)')??'';
    label.protein=get(r,'proteins','Proteine (g)')??'';
    label.fat=get(r,'lipids','Lipidi (g)')??'';
    label.carbs=get(r,'available_carbohydrates','Carboidrati disponibili (g)')??'';
    label.sugar=get(r,'soluble_sugars','Zuccheri solubili (g)')??'';
    label.fiber=get(r,'total_fiber','Fibra totale (g)')??'';
    const nutrients=[];
    const add=(display,amount,unit,raw)=>{ if(amount===null||!Number.isFinite(Number(amount))) return; nutrients.push({id:newId(),name:display,form:'naturalmente presente / non specificata',amount:Number(amount),unit,source:meta.name,evidence:'dataset CREA/importato · zero dettaglio ambiguo trattato come N/D',rawName:raw||display,bio:{mode:'none',min:'',max:'',source:''}}); };
    for(const [key,display] of Object.entries(CREA_NAME_MAP)){
      if(CREA_AMINO_KEYS.has(key)) continue;
      const v=getMicro(r,key); if(v!==null) add(display,v,creaUnit(key,display),key);
    }
    const fat=Number(label.fat)||0, protein=Number(label.protein)||0;
    const sat=getMicro(r,'saturated_fatty_acids','Acidi grassi Saturi (%)'); if(sat!==null&&fat) label.saturatedFat=fat*sat/100;
    const fatty=[
      ['ALA',['C18:3_linolenic_acid','c18_3_linolenic_acid','C18:3 acido linolenico (%)']],
      ['Acido linoleico (LA)',['C18:2_linoleic_acid','c18_2_linoleic_acid','C18:2 acido linoleico (%)']],
      ['Acido arachidonico (AA)',['C20:4_arachidonic_acid','c20_4_arachidonic_acid','C20:4 acido arachidonico (%)']],
      ['EPA',['C20:5_eicosapentaenoic_acid_EPA','c20_5_eicosapentaenoic_acid_epa','C20:5 acido eicosapentenoico EPA (%)']],
      ['DHA',['C22:6_docosahexaenoic_acid_DHA','c22_6_docosahexaenoic_acid_dha','C22:6 acido docosaesenoico DHA (%)']]
    ];
    for(const [display,keys] of fatty){ const v=getMicro(r,...keys); if(v!==null&&fat) add(display,fat*v/100,'g',keys[0]); }
    for(const aa of EAA){ const english=Object.entries(CREA_NAME_MAP).find(([k,v])=>CREA_AMINO_KEYS.has(k)&&v===aa)?.[0]; const v=getMicro(r,aa,aa.toLowerCase(),english); if(v!==null&&protein) add(aa,protein*v/100,'g',aa); }
    const sodium=nutrients.find(n=>n.name==='Sodio'); if(sodium) label.salt=convert(sodium.amount,sodium.unit,'g')*2.5;
    out.push({localId:`${source}:${code}`,source,sourceId:code,name,officialName:name,brand:'',servingGrams:100,label,nutrients,ingredients:'',aliases:[],sourceInfo:{id:newId(),name:meta.name,reference:`CREA ${code}`,quality:'primaria',version:meta.version||'2019'}});
  }
  return out;
}
function looksLikeCreaFlat(rows){
  if(!rows?.length) return false;
  const keys=Object.keys(rows[0]||{}).map(norm);
  return keys.includes(norm('energy_kcal')) && keys.includes(norm('available_carbohydrates')) && (keys.includes(norm('food_code')) || keys.includes(norm('Codice Alimento')));
}

function parseJsonDataset(source,text){
  let raw;
  try{ raw=JSON.parse(text); }catch{ raw=String(text).split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)); }
  const arr=Array.isArray(raw)?raw:(Array.isArray(raw?.foods)?raw.foods:(Array.isArray(raw?.data)?raw.data:[]));
  if(!arr.length) return [];
  if(arr.some(x=>Array.isArray(x?.macro_nutrients)||Array.isArray(x?.['MACRO NUTRIENTI']))) return normalizeCreaNested(source,arr);
  if(looksLikeCreaFlat(arr)) return normalizeCreaFlat(source,arr);
  return normalizeRows(source,arr);
}

const MASTER_BASE='./data/master';
function masterRevision(manifest){ return [manifest?.runtime_version||manifest?.schema||'v1',manifest?.built_at||'',manifest?.numeric_values||''].join('|'); }
const DEFAULT_APP_CONFIG={
  ui:{
    search:{
      title:'Ricerca alimenti',
      dbButton:'Cerca nel database',
      aiButton:'Ricerca con AI',
      aiWorking:'Ricerca con AI…',
      manualButton:'Inserisci manualmente',
      gramsLabel:'Grammi',
      gramsPlaceholder:'facoltativi se esiste una porzione standard',
      notFound:'Nessuna corrispondenza sufficientemente affidabile nel Master DB.'
    },
    recipe:{
      title:'Voce libera / lista / ricetta',
      subtitle:'L’AI interpreta il testo; peso e corrispondenza database vengono poi validati dal codice.',
      interpretButton:'Interpreta e verifica',
      aiEstimateButton:'Ricerca con AI',
      dbSearchButton:'Ricerche DB'
    }
  },
  searchPolicy:{
    portionPolicy:{
      catalogFirst:true,
      aiEstimateWhenCatalogMissing:true,
      validateExplicitMassFromRawText:true,
      ignoreAiGramsWithoutExplicitMass:true,
      defaultNaturalUnitCount:1,
      defaultNaturalUnitSize:'medium',
      autoApplyCatalog:true,
      autoApplyAiConfidence:['high','medium'],
      maxAiRelativeRange:.55,
      neverAutoApplyKinds:['dish','plate','bowl','serving','pizza','slice_variable','piece_variable','unknown'],
      showAssumption:true
    },
    databaseMatchPolicy:{
      requireLexicalEvidence:true,
      minCandidateScore:42,
      minAutoSelectScore:92,
      minAutoSelectGap:14,
      neverAutoSelectOnMaterialAmbiguity:true
    },
    ambiguityPolicy:{askOnlyIfMaterial:true}
  },
  standardPortions:{items:[]}
};
function cfgGet(obj,path,fallback){let cur=obj;for(const k of String(path||'').split('.')){if(cur==null||typeof cur!=='object'||!(k in cur))return fallback;cur=cur[k];}return cur===undefined?fallback:cur;}
async function loadJsonConfig(url,fallback){
  try{
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error(`config ${r.status}`);
    return await r.json();
  }catch{return fallback;}
}
async function loadAppConfig(){
  const [ui,searchPolicy,standardPortions]=await Promise.all([
    loadJsonConfig('./config/ui.it.json',DEFAULT_APP_CONFIG.ui),
    loadJsonConfig('./config/search-policy.json',DEFAULT_APP_CONFIG.searchPolicy),
    loadJsonConfig('./config/standard-portions.json',DEFAULT_APP_CONFIG.standardPortions)
  ]);
  return {ui,searchPolicy,standardPortions};
}
function explicitMassFromText(text){
  const s=String(text??'').toLowerCase().replace(/(\d),(\d)/g,'$1.$2');
  const m=s.match(/(?:^|\s|\b)(\d+(?:\.\d+)?)\s*(kg|chilogrammi?|kilogrammi?|g|gr|grammi?|grammo)\b/i);
  if(!m)return null;
  const value=Number(m[1]);if(!(value>0))return null;
  return /^(kg|chilogram|kilogram)/i.test(m[2])?value*1000:value;
}
function countFromText(text){
  let s=String(text??'').toLowerCase().replace(/(\d),(\d)/g,'$1.$2');
  s=s.replace(/\d+(?:\.\d+)?\s*(?:kg|chilogrammi?|kilogrammi?|g|gr|grammi?|grammo)\b/gi,' ');
  const n=norm(s);
  const m=n.match(/(?:^| )(\d+(?:\.\d+)?)(?: |$)/);
  if(m){const v=Number(m[1]);if(Number.isFinite(v)&&v>0&&v<=100)return v;}
  const words={un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10};
  for(const [w,v] of Object.entries(words))if(hasTerm(n,w))return v;
  return null;
}
function naturalCount(text,def=1){return countFromText(text)??def;}
function textSize(text){const n=norm(text);if(['piccolo','piccola','small'].some(x=>hasTerm(n,x)))return 'small';if(['grande','large'].some(x=>hasTerm(n,x)))return 'large';if(['medio','media','medium'].some(x=>hasTerm(n,x)))return 'medium';return 'medium';}
function findPortionCatalog(textOrTexts,config,sizeOverride='',countOverride=null){
  const items=config?.standardPortions?.items||[];
  const texts=(Array.isArray(textOrTexts)?textOrTexts:[textOrTexts]).map(clean).filter(Boolean);
  if(!texts.length)return null;
  const joined=texts.join(' '), size=sizeOverride&&sizeOverride!=='unspecified'?sizeOverride:textSize(joined);
  const count=Number(countOverride)>0?Number(countOverride):naturalCount(joined,cfgGet(config,'searchPolicy.portionPolicy.defaultNaturalUnitCount',1));
  let best=null,bestScore=-1;
  for(const item of items){
    if(item.kind!=='natural_unit')continue;
    for(const aliasRaw of [...(item.aliases||[]),item.canonicalName].filter(Boolean)){
      const alias=norm(aliasRaw);if(!alias)continue;
      for(const text of texts){
        const nt=norm(text);let score=0;
        if(nt===alias)score=10000+alias.length;
        else if(hasTerm(nt,alias))score=1000+alias.length;
        else continue;
        if(score>bestScore){best={item,matchedAlias:aliasRaw};bestScore=score;}
      }
    }
  }
  if(!best)return null;
  const item=best.item;
  const chosen=item.sizes?.[size]||item.sizes?.[item.defaultSize||'medium']||item.sizes?.medium;
  if(!chosen||!(Number(chosen.grams)>0)||chosen.autoApply===false||cfgGet(config,'searchPolicy.portionPolicy.autoApplyCatalog',true)===false)return null;
  const perLo=Number(chosen.range_g?.[0]??chosen.p10??chosen.grams),perHi=Number(chosen.range_g?.[1]??chosen.p90??chosen.grams);
  const sizeLabel=size==='small'?'piccola':size==='large'?'grande':'media';
  return {
    grams:Number(chosen.grams)*count,count,size,confidence:chosen.confidence||'medium',
    source:item.source?.name||item.sourceNote||'catalogo porzioni',
    range:[perLo*count,perHi*count],kind:item.kind,catalogId:item.id,
    assumption:`${count} × unità ${sizeLabel} ≈ ${fmt(Number(chosen.grams)*count,1)} g edibili`
  };
}
function quickNaturalPortion(query,row,config){
  if(!String(query||'').trim()||!row)return null;
  const simplify=value=>norm(value).split(' ').filter(x=>!['un','uno','una','due','tre','quattro','cinque','sei','sette','otto','nove','dieci','piccolo','piccola','piccoli','piccole','medio','media','medi','medie','grande','grandi','pezzo','pezzi','pz','small','medium','large'].includes(x)&&!/^\d+$/.test(x)).join(' ');
  const q=simplify(query);if(!q)return null;
  if(/\d[.,]\d/.test(query)||/\b\d/.test(query)&&!countFromText(query))return null;
  const names=[row.officialName||row.name_en||row.name].filter(Boolean).map(norm);
  // Prefer the curated base entries and exact catalogue matches. No banana weight on banana cake, juice or dried fruit.
  const qualifiers=new Set(['raw','crudo','cruda','crude','crudi','fresh','fresco','fresca','freschi','fresche','ripe','mature','matura','maturo','edible','portion','parte','edibile','whole','intero','intera','and','slightly','overripe','sbucciata','sbucciato','polpa','peeled','flesh','senza','buccia']);
  const items=(config?.standardPortions?.items||[]).filter(i=>i.kind==='natural_unit'&&[...(i.aliases||[]),i.canonicalName].some(a=>norm(a)===q));
  for(const item of items){
    const aliases=[...(item.aliases||[]),item.canonicalName].map(norm).filter(Boolean);
    const compatible=names.some(n=>aliases.some(a=>n===a||(n.startsWith(a+' ')&&n.slice(a.length+1).split(' ').every(x=>qualifiers.has(x)))));
    if(!compatible)continue;
    const p=findPortionCatalog(query,{...config,standardPortions:{items:[item]}},'',countFromText(query)||1);
    if(p&&DiaryV5.positive(p.grams))return p;
  }
  return null;
}
function aiPortionUsable(ing,config,countOverride=null){
  if(!ing||ing.unit_kind!=='natural_unit'||!Number(ing.estimated_piece_grams))return null;
  const policy=cfgGet(config,'searchPolicy.portionPolicy',{});
  if((policy.neverAutoApplyKinds||[]).includes(ing.unit_kind))return null;
  const confidence=ing.portion_confidence||'none';
  if(!(policy.autoApplyAiConfidence||['high','medium']).includes(confidence))return null;
  const mid=Number(ing.estimated_piece_grams),lo=Number(ing.estimated_piece_min_g||mid),hi=Number(ing.estimated_piece_max_g||mid);
  if((hi-lo)/Math.max(1,mid)>Number(policy.maxAiRelativeRange??.55))return null;
  const count=Number(countOverride)>0?Number(countOverride):(Number(ing.count)||1);
  const sizeLabel=ing.size==='small'?'piccola':ing.size==='large'?'grande':'media';
  return {grams:mid*count,count,size:ing.size||'medium',confidence,source:'AI · stima porzione',range:[lo*count,hi*count],kind:ing.unit_kind,assumption:`${count} × unità ${sizeLabel} ≈ ${fmt(mid*count,1)} g (stima AI ${confidence})`};
}
function applyPortionPolicy(ing,config){
  const fragment=`${ing?.raw||''} ${ing?.quantity_text||''}`.trim();
  const explicit=explicitMassFromText(fragment);
  const textCount=countFromText(fragment);
  const parserCount=Number(ing?.count);
  const count=textCount||(!explicit&&parserCount>0&&parserCount<=100?parserCount:1);
  const normalized={...ing,count,grams:null};
  if(ing?.gramsUserEdited&&Number(ing.grams)>0){const manual=Number(ing.grams);return {...normalized,grams:manual,gramsUserEdited:true,requires_weight_confirmation:false,portion_assumption:`Peso inserito manualmente: ${fmt(manual,1)} g`,portionResolution:{type:'manual',grams:manual,count}};}
  if(explicit){
    return {...normalized,grams:explicit,requires_weight_confirmation:false,portion_assumption:`Peso indicato dall’utente: ${fmt(explicit,1)} g`,portionResolution:{type:'explicit',grams:explicit,count}};
  }
  const cat=findPortionCatalog([ing?.raw,ing?.name,ing?.lookup_name_en],config,ing?.size,count);
  if(cat)return {...normalized,grams:cat.grams,requires_weight_confirmation:false,portion_assumption:cat.assumption,portionResolution:{type:'catalog',...cat}};
  if(cfgGet(config,'searchPolicy.portionPolicy.aiEstimateWhenCatalogMissing',true)!==false){
    const ai=aiPortionUsable(normalized,config,count);
    if(ai)return {...normalized,grams:ai.grams,requires_weight_confirmation:false,portion_assumption:ai.assumption,portionResolution:{type:'ai_portion',...ai}};
  }
  return {...normalized,requires_weight_confirmation:true};
}
const masterChunkCache=new Map();
const MASTER_MICRO_SPECS={
  'Vitamina A':{ids:['vitamin_a_rae'],unit:'µg'},
  'Tiamina B1':{ids:['thiamin_b1'],unit:'mg'}, 'Riboflavina B2':{ids:['riboflavin_b2'],unit:'mg'},
  'Niacina B3':{ids:['niacin_b3'],unit:'mg'}, 'Acido pantotenico B5':{ids:['pantothenic_acid_b5'],unit:'mg'},
  'Vitamina B6':{ids:['vitamin_b6'],unit:'mg'}, 'Biotina B7':{ids:['biotin_b7'],unit:'µg'},
  'Folati':{ids:['folate_total_b9'],unit:'µg'}, 'Vitamina B12':{ids:['vitamin_b12'],unit:'µg'},
  'Vitamina C':{ids:['vitamin_c'],unit:'mg'}, 'Vitamina D':{ids:['vitamin_d'],unit:'µg'},
  'Vitamina E':{ids:['alpha_tocopherol','vitamin_e_alpha_te'],unit:'mg'}, 'Vitamina K':{ids:['vitamin_k','vitamin_k1'],unit:'µg'},
  'Colina':{ids:['choline'],unit:'mg'}, 'Calcio':{ids:['calcium'],unit:'mg'}, 'Fosforo':{ids:['phosphorus'],unit:'mg'},
  'Magnesio':{ids:['magnesium'],unit:'mg'}, 'Sodio':{ids:['sodium'],unit:'mg'}, 'Cloruro':{ids:['chloride'],unit:'mg'},
  'Potassio':{ids:['potassium'],unit:'mg'}, 'Ferro':{ids:['iron'],unit:'mg'}, 'Zinco':{ids:['zinc'],unit:'mg'},
  'Rame':{ids:['copper'],unit:'mg'}, 'Manganese':{ids:['manganese'],unit:'mg'}, 'Iodio':{ids:['iodine'],unit:'µg'},
  'Selenio':{ids:['selenium'],unit:'µg'}, 'Molibdeno':{ids:['molybdenum'],unit:'µg'}, 'Cromo':{ids:['chromium'],unit:'µg'},
  'Nickel':{ids:['nickel'],unit:'µg'}, 'Fluoro':{ids:['fluoride'],unit:'µg'}, 'Zolfo':{ids:['sulfur'],unit:'mg'},
  'ALA':{ids:['alpha_linolenic_acid'],unit:'mg'}, 'EPA':{ids:['epa'],unit:'mg'}, 'DHA':{ids:['dha'],unit:'mg'},
  'DPA':{ids:['dpa'],unit:'mg'}, 'Acido linoleico (LA)':{ids:['linoleic_acid'],unit:'g'},
  'Acido arachidonico (AA)':{ids:['arachidonic_acid'],unit:'mg'}, 'Omega-3 totali':{ids:['omega3_total'],unit:'g'},
  'Omega-6 totali':{ids:['omega6_total'],unit:'g'},
  'Leucina':{ids:['leucine'],unit:'g'}, 'Isoleucina':{ids:['isoleucine'],unit:'g'}, 'Valina':{ids:['valine'],unit:'g'},
  'Lisina':{ids:['lysine'],unit:'g'}, 'Metionina':{ids:['methionine'],unit:'g'}, 'Treonina':{ids:['threonine'],unit:'g'},
  'Triptofano':{ids:['tryptophan'],unit:'g'}, 'Istidina':{ids:['histidine'],unit:'g'}, 'Fenilalanina':{ids:['phenylalanine'],unit:'g'}, 'Cisteina':{ids:['cysteine','cystine'],unit:'g'}, 'Tirosina':{ids:['tyrosine'],unit:'g'}
};
const AI_NUTRIENT_SPECS={
  'Vitamina A':{id:'vitamin_a_rae',unit:'µg',advanced:true}, 'Tiamina B1':{id:'thiamin_b1',unit:'mg'},
  'Riboflavina B2':{id:'riboflavin_b2',unit:'mg'}, 'Niacina B3':{id:'niacin_b3',unit:'mg'},
  'Acido pantotenico B5':{id:'pantothenic_acid_b5',unit:'mg'}, 'Vitamina B6':{id:'vitamin_b6',unit:'mg'},
  'Biotina B7':{id:'biotin_b7',unit:'µg',advanced:true}, 'Folati':{id:'folate_total_b9',unit:'µg'},
  'Vitamina B12':{id:'vitamin_b12',unit:'µg'}, 'Vitamina C':{id:'vitamin_c',unit:'mg'},
  'Vitamina D':{id:'vitamin_d',unit:'µg'}, 'Vitamina E':{id:'alpha_tocopherol',unit:'mg'},
  'Vitamina K':{id:'vitamin_k',unit:'µg'}, 'Colina':{id:'choline',unit:'mg'}, 'Calcio':{id:'calcium',unit:'mg'},
  'Fosforo':{id:'phosphorus',unit:'mg'}, 'Magnesio':{id:'magnesium',unit:'mg'}, 'Sodio':{id:'sodium',unit:'mg'},
  'Cloruro':{id:'chloride',unit:'mg',advanced:true}, 'Potassio':{id:'potassium',unit:'mg'}, 'Ferro':{id:'iron',unit:'mg'},
  'Zinco':{id:'zinc',unit:'mg'}, 'Rame':{id:'copper',unit:'mg'}, 'Manganese':{id:'manganese',unit:'mg'},
  'Iodio':{id:'iodine',unit:'µg',advanced:true}, 'Selenio':{id:'selenium',unit:'µg'},
  'Molibdeno':{id:'molybdenum',unit:'µg',advanced:true}, 'Cromo':{id:'chromium',unit:'µg',advanced:true},
  'Nickel':{id:'nickel',unit:'µg',advanced:true}, 'Fluoro':{id:'fluoride',unit:'µg',advanced:true}, 'Zolfo':{id:'sulfur',unit:'mg',advanced:true},
  'ALA':{id:'alpha_linolenic_acid',unit:'mg',advanced:true}, 'EPA':{id:'epa',unit:'mg',advanced:true}, 'DHA':{id:'dha',unit:'mg',advanced:true},
  'DPA':{id:'dpa',unit:'mg',advanced:true}, 'Acido linoleico (LA)':{id:'linoleic_acid',unit:'g',advanced:true},
  'Acido arachidonico (AA)':{id:'arachidonic_acid',unit:'mg',advanced:true}, 'Omega-3 totali':{id:'omega3_total',unit:'g',advanced:true},
  'Omega-6 totali':{id:'omega6_total',unit:'g',advanced:true},
  'Leucina':{id:'leucine',unit:'g',advanced:true}, 'Isoleucina':{id:'isoleucine',unit:'g',advanced:true},
  'Valina':{id:'valine',unit:'g',advanced:true}, 'Lisina':{id:'lysine',unit:'g',advanced:true},
  'Metionina':{id:'methionine',unit:'g',advanced:true}, 'Treonina':{id:'threonine',unit:'g',advanced:true},
  'Triptofano':{id:'tryptophan',unit:'g',advanced:true}, 'Istidina':{id:'histidine',unit:'g',advanced:true},
  'Fenilalanina':{id:'phenylalanine',unit:'g',advanced:true}, 'Cisteina':{id:'cysteine',unit:'g',advanced:true}, 'Tirosina':{id:'tyrosine',unit:'g',advanced:true}
};
const AI_ID_TO_DISPLAY=Object.fromEntries(Object.entries(AI_NUTRIENT_SPECS).map(([name,x])=>[x.id,name]));
const SAFE_AI_DEFAULT=['Tiamina B1','Riboflavina B2','Niacina B3','Acido pantotenico B5','Vitamina B6','Folati','Vitamina B12','Vitamina C','Vitamina D','Vitamina E','Vitamina K','Colina','Calcio','Fosforo','Magnesio','Sodio','Potassio','Ferro','Zinco','Rame','Manganese','Selenio'];
function massUnit(u){ const x=String(u||''); if(x.startsWith('µg')||x.startsWith('ug'))return 'µg'; if(x.startsWith('mg'))return 'mg'; if(x.startsWith('g'))return 'g'; return x; }
function masterNutrientCatalog(manifest){ return Object.fromEntries((manifest?.nutrients||[]).map(n=>[n.id,n])); }
async function loadMasterBundle(){
  const [m,i]=await Promise.all([fetch(`${MASTER_BASE}/manifest.json`,{cache:'no-cache'}),fetch(`${MASTER_BASE}/index.json`,{cache:'no-cache'})]);
  if(!m.ok||!i.ok) throw new Error('Master Food DB non disponibile');
  const manifest=await m.json(), rawIndex=await i.json();
  // V2.3: prepare normalized search fields exactly once. This removes thousands of
  // Unicode/string normalizations from every diary keystroke.
  const index=(rawIndex||[]).map(r=>({
    ...r,
    __nn:norm(r.name),
    __ne:norm(r.name_en),
    __aliases:(r.aliases||[]).map(norm).filter(Boolean),
    __search:norm(`${r.name||''} ${r.name_en||''} ${(r.aliases||[]).join(' ')}`)
  }));
  return {manifest,index};
}
function scoreMasterRow(q,row){
  const nq=norm(q);
  if(!nq)return 0;

  const nn=row.__nn??norm(row.name);
  const ne=row.__ne??norm(row.name_en);
  const aliases=row.__aliases??(row.aliases||[]).map(norm);
  const names=[nn,ne].filter(Boolean);

  let relevance=0;

  for(const p of phraseAlternatives(q)){
    if(names.some(n=>n===p)){
      relevance=Math.max(relevance,400);
    }else if(names.some(n=>n.startsWith(p+' '))){
      relevance=Math.max(relevance,280);
    }else if(names.some(n=>hasTerm(n,p))){
      relevance=Math.max(relevance,200);
    }

    if(aliases.some(x=>x===p)){
      relevance=Math.max(relevance,160);
    }else if(aliases.some(x=>hasTerm(x,p))){
      relevance=Math.max(relevance,90);
    }
  }

  const tokens=queryTokens(q);
  let matched=0;

  for(const token of tokens){
    const alternatives=tokenAlternatives(token);

    const inName=alternatives.some(t=>
      names.some(n=>hasTerm(n,t))
    );

    const inAlias=alternatives.some(t=>
      aliases.some(x=>hasTerm(x,t))
    );

    if(inName||inAlias){
      matched++;
      relevance+=inName?18:7;
    }
  }

  // Nessun bonus di qualità senza corrispondenza lessicale.
  if(relevance===0)return 0;

  // Evita risultati deboli nelle ricerche con più parole.
  if(tokens.length>1 && matched<tokens.length && relevance<90){
    return 0;
  }

  if(tokens.length>1 && matched<tokens.length){
    relevance-=35*(tokens.length-matched);
  }

  // La qualità distingue risultati pertinenti,
  // ma non può superare una corrispondenza più precisa.
  const quality=
    Math.min(18,Math.max(0,Number(row.sc||1)-1)*6)+
    ((row.sources||[]).includes('it')?6:0)+
    (row.core?6:Math.min(3,Number(row.mc||0)));

  return Math.max(0,relevance+quality);
}
function searchMasterIndex(q,index,limit=12){
  const raw=clean(q); if(!raw)return [];
  const nq=norm(raw); if(nq.length<2)return [];
  const tokens=queryTokens(raw), tokenAlts=tokens.flatMap(tokenAlternatives).map(norm).filter(Boolean);
  const out=[];
  for(const r of index||[]){
    // Very cheap pre-filter. If the literal query is absent, require at least one semantic token/alias.
    const hay=r.__search??norm(`${r.name||''} ${r.name_en||''} ${(r.aliases||[]).join(' ')}`);
    if(!hay.includes(nq) && tokenAlts.length && !tokenAlts.some(t=>hasTerm(hay,t)))continue;
    const score=scoreMasterRow(raw,r); if(score>0)out.push({...r,score,resultType:'master'});
  }
  return out.sort((a,b)=>b.score-a.score||Number(b.core)-Number(a.core)||Number(b.mc||0)-Number(a.mc||0)||Number(b.sc||0)-Number(a.sc||0)||String(a.name).localeCompare(String(b.name),'it')).slice(0,limit);
}
async function loadMasterDetail(row){
  const c=Number(row.chunk); if(!masterChunkCache.has(c)) masterChunkCache.set(c,fetch(`${MASTER_BASE}/chunks/${String(c).padStart(2,'0')}.json`).then(r=>{if(!r.ok)throw new Error('Chunk Master DB non disponibile');return r.json();}));
  const data=await masterChunkCache.get(c); return data[String(row.id)]||null;
}
function masterGrade(arr){ return String(arr?.[6]||'C').toUpperCase(); }
function masterWarning(arr){ return clean(arr?.[5]||''); }
function masterPick(detail,ids){ for(const id of ids||[]){ const a=detail?.n?.[id]; if(!a||!Number.isFinite(Number(a[0]))) continue; return {id,arr:a,grade:masterGrade(a),warning:masterWarning(a)}; } return null; }
function masterNd(detail,ids){ for(const id of ids||[]){ const a=detail?.nd?.[id]; if(a)return {id,arr:a}; } return null; }
function nutrientEligibleForDeficiency(n){
  if(!n||!Number.isFinite(Number(n.amount)))return false;
  if(n.aiEstimate||String(n.source||'').toLowerCase().includes('ai · stima'))return false;
  if(n.source==='NutriTrace Master DB')return ['A','B','C'].includes(String(n.grade||'C').toUpperCase());
  return true;
}
function masterToFood(row,detail,manifest,alias=''){
  const f={...emptyFood(),masterId:row.id,masterVersion:masterRevision(manifest),name:clean(alias)||row.name,officialName:row.name_en||row.name,aliases:[...new Set([row.name,row.name_en,...(row.aliases||[]),clean(alias)].filter(Boolean))],servingGrams:100,nutrientStatus:{}};
  const cat=masterNutrientCatalog(manifest); const label=emptyLabel();
  const macro={kcal:['energy_kcal'],protein:['protein'],carbs:['carbohydrate_available','carbohydrate_total'],sugar:['sugars_total'],fat:['fat_total'],saturatedFat:['fat_saturated'],fiber:['fiber'],salt:['salt']};
  for(const [field,ids] of Object.entries(macro)){ const p=masterPick(detail,ids); if(p) label[field]=Number(p.arr[0]); }
  if(isMissing(label.salt)){ const na=masterPick(detail,['sodium']); if(na)label.salt=Number(na.arr[0])*2.5/1000; }
  f.label=label;
  for(const [display,spec] of Object.entries(MASTER_MICRO_SPECS)){
    const p=masterPick(detail,spec.ids);
    if(p){
      const sourceUnit=massUnit(cat[p.id]?.unit||spec.unit), amount=convert(Number(p.arr[0]),sourceUnit,spec.unit);
      const warning=p.warning?` · warning: ${p.warning}`:'';
      f.nutrients.push({id:newId(),name:display,form:`Master DB · ${cat[p.id]?.name||p.id}`,amount,unit:spec.unit,source:'NutriTrace Master DB',evidence:`Grade ${p.grade} · ${p.arr[1]} · ${p.arr[3]?.join(', ')||'fonte nazionale'}${p.arr[4]?` · range ${p.arr[4][0]}–${p.arr[4][1]} ${cat[p.id]?.unit||''}`:''}${warning}`,canonicalId:p.id,reliability:p.arr[1],grade:p.grade,auditWarning:p.warning,bio:{mode:'none',min:'',max:'',source:''}});
      f.nutrientStatus[display]={status:'numeric',reliability:p.arr[1],grade:p.grade,warning:p.warning,canonicalId:p.id,sources:p.arr[3]||[]};
    }else{
      const nd=masterNd(detail,spec.ids); f.nutrientStatus[display]={status:nd?.arr?.[0]||'nd',reason:nd?.arr?.[1]||'Dato non disponibile nelle fonti compatibili',canonicalId:nd?.id||spec.ids[0],sources:nd?.arr?.[2]||[]};
    }
  }
  const srcMap=Object.fromEntries((manifest?.sources||[]).map(s=>[s.code,s]));
  f.sources=(row.sources||[]).map(code=>({id:newId(),name:srcMap[code]?.name||code,reference:`Master ${manifest?.runtime_version||'v1'} · ${code}`,quality:'primaria',version:srcMap[code]?.version||''}));
  f.notes=`NutriTrace Master DB ${manifest?.runtime_version||''}. ${Number(row.sc||0)} record sorgente compatibili. Grade A/B: alta-media evidenza; C: single-source/low confidence; D: informativo e escluso dalle carenze. I campi assenti sono N/D, non zero.`;
  f.mergeMeta={importedFrom:'MASTER',sourceCount:Number(row.sc||0),masterSources:row.sources||[]};
  return f;
}
function macroCoverage(logs,foods,key){
  let total=0,known=0;
  for(const l of logs||[]){const g=Math.max(0,Number(l.grams)||0),f=(foods||[]).find(x=>x.id===l.foodId);if(!f||!g)continue;total+=g;if(!isMissing(f.label?.[key]))known+=g;}
  return total?known/total:0;
}
function nutrientCoverage(logs,foods,name,mode='display'){
  let total=0,known=0;
  for(const l of logs||[]){
    const g=Math.max(0,Number(l.grams)||0), f=(foods||[]).find(x=>x.id===l.foodId); if(!f||!g)continue;
    total+=g;
    const candidates=(f.nutrients||[]).filter(n=>norm(n.name)===norm(name)&&Number.isFinite(Number(n.amount)));
    if(candidates.some(n=>mode!=='deficiency'||nutrientEligibleForDeficiency(n)))known+=g;
  }
  return total?known/total:0;
}
function nutrientTotalFromLogs(logs,foods,name,toUnit='mg',form='*',mode='display'){
  let sum=0;
  for(const l of logs||[]){
    const g=Math.max(0,Number(l.grams)||0), f=(foods||[]).find(x=>x.id===l.foodId); if(!f||!g)continue;
    const q=g/(Number(f.servingGrams)||100);
    for(const n of f.nutrients||[]){
      if(norm(n.name)!==norm(name)||!Number.isFinite(Number(n.amount)))continue;
      if(form!=='*'&&form&&norm(n.form)!==norm(form))continue;
      if(mode==='deficiency'&&!nutrientEligibleForDeficiency(n))continue;
      sum+=convert(Number(n.amount)*q,n.unit,toUnit);
    }
  }
  return sum;
}
function goalComponents(g){return Array.isArray(g?.components)&&g.components.length?g.components:[g?.name].filter(Boolean);}
function goalNutrientTotalFromLogs(logs,foods,g,mode='display'){
  return goalComponents(g).reduce((sum,name)=>sum+nutrientTotalFromLogs(logs,foods,name,g.unit,g.form||'*',mode),0);
}
function goalCoverageFromLogs(logs,foods,g,mode='display'){
  const names=goalComponents(g);if(!names.length)return 0;
  return Math.min(...names.map(name=>nutrientCoverage(logs,foods,name,mode)));
}
function goalValueFromAggregate(g,ag){
  if(Object.keys(MACROS).includes(g.id))return ag[g.id]||0;
  return goalComponents(g).reduce((sum,name)=>sum+nutrientTotal(ag,name,g.unit,g.form||'*'),0);
}
function goalDailyReference(g,weight){const t=effectiveTarget(g,weight);return g.period==='week'?t/7:t;}
function goalTargetForDays(g,weight,days){return goalDailyReference(g,weight)*Math.max(0,Number(days)||0);}
async function parseFoodEntry(text,context='diary'){
  const r=await fetch('/api/parse-food-entry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,context})}); let d={};try{d=await r.json();}catch{}
  if(!r.ok)throw new Error(d.error||`AI ${r.status}`); return d;
}

async function aiEnrich(food, requestedNames=[]){
  const requested=[...new Set(requestedNames)]
    .map(name=>AI_NUTRIENT_SPECS[name]?{
      name,
      id:AI_NUTRIENT_SPECS[name].id,
      unit:AI_NUTRIENT_SPECS[name].unit,
      advanced:Boolean(AI_NUTRIENT_SPECS[name].advanced)
    }:null)
    .filter(Boolean)
    .slice(0,12);

  const r=await fetch('/api/nutrition-enrich',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      food:{
        name:food.name,
        brand:food.brand||'',
        servingGrams:Number(food.servingGrams)||100,
        label:food.label||{},
        ingredients:food.ingredients||'',
        nutrients:food.nutrients||[]
      },
      requested,
      allowAdvanced:requested.some(x=>x.advanced)
    })
  });

  let d={};
  try{
    d=await r.json();
  }catch{}

  if(!r.ok) throw new Error(d.error||`AI ${r.status}`);
  return d;
}

function mergeAiFood(food, ai){
  const next=structuredClone(food); next.label={...next.label}; next.nutrientStatus={...(next.nutrientStatus||{})};
  for(const k of Object.keys(MACROS))if(isMissing(next.label[k])&&ai.label&&!isMissing(ai.label[k]))next.label[k]=ai.label[k];
  next.nutrients=[...(next.nutrients||[])];
  for(const n of ai.nutrients||[]){
    const display=AI_ID_TO_DISPLAY[n.id],spec=display&&AI_NUTRIENT_SPECS[display];if(!display||!spec)continue;
      const hasValue=next.nutrients.some(row=>
  norm(row.name)===norm(display) &&
  !isMissing(row.amount) &&
  Number.isFinite(Number(row.amount)) &&
  Number(row.amount)>=0
);
if(hasValue)continue;
    if(n.status==='blocked_high_risk'){
      next.nutrientStatus[display]={status:'blocked_high_risk',reason:n.note||`Errore ${display}: nutriente ad alto rischio; stima AI disabilitata.`,canonicalId:n.id};continue;
    }
    if(n.status==='error'){
      next.nutrientStatus[display]={status:'ai_error',reason:n.note||`Errore AI durante il completamento di ${display}.`,canonicalId:n.id};continue;
    }
    if(n.status!=='estimated'||!Number.isFinite(Number(n.value))){
      next.nutrientStatus[display]={status:'nd_ai',reason:n.note||'AI: dato non sufficientemente affidabile',canonicalId:n.id};continue;
    }
    next.nutrients=next.nutrients.filter(
  row=>norm(row.name)!==norm(display)
);
    next.nutrients.push({id:newId(),name:display,form:'stima AI controllata',amount:Number(n.value),unit:spec.unit,source:'AI · stima',evidence:`stima AI · confidenza ${n.confidence||'media'}${n.note?` · ${n.note}`:''}`,canonicalId:n.id,reliability:'ai_estimate',aiEstimate:true,grade:'AI',bio:{mode:'none',min:'',max:'',source:''}});
    next.nutrientStatus[display]={status:'ai_estimate',reliability:n.confidence||'media',canonicalId:n.id};
  }
  if((ai.nutrients||[]).length||Object.values(ai.label||{}).some(v=>v!==null&&v!==undefined)){
    const ref=ai.note||'Valori stimati; non equivalenti a dati analitici o di etichetta.';
    if(!(next.sources||[]).some(x=>x?.name==='AI · stima integrativa'&&x?.reference===ref))next.sources=[...(next.sources||[]),{id:newId(),name:'AI · stima integrativa',reference:ref,quality:'stimata'}];
  }
  return next;
}

function GoalRow({g,index,goals,setGoals,weight,current}){
  const patch=(x)=>{
    const a=[...goals], refs=window.NutriTraceNutritionReferences;
    const metadata=x.unit && g.group!=='Personalizzati' && refs?.catalogMetadataPatch
      ? refs.catalogMetadataPatch(g.name,x.unit) : {};
    a[index]={...a[index],...x,...metadata,customized:true};
    setGoals(a);
  };
  const amount=g.targetMode==='perKg'?g.perKg:g.target, custom=g.group==='Personalizzati';
  return h('div',{className:`goalRow ${custom?'customGoal':''}`},
    h('div',{className:'goalIdentity'},custom?h('input',{value:g.name,onChange:e=>patch({name:e.target.value}),placeholder:'Nome nutriente'}):h('b',null,g.name),h('small',null,`${fmt(current,2)} ${g.unit} registrati`)),
    h('input',{type:'number',step:'any',value:typeof amount==='number'&&Math.abs(amount)>=.01?Number(amount.toFixed(2)):amount,onChange:e=>patch(g.targetMode==='perKg'?{perKg:Number(e.target.value)}:{target:Number(e.target.value)})}),
    h('select',{value:g.unit||'mg',onChange:e=>patch({unit:e.target.value})},h('option',{value:'g'},'g'),h('option',{value:'mg'},'mg'),h('option',{value:'µg'},'µg')),
    h('select',{value:g.targetMode||'absolute',onChange:e=>patch({targetMode:e.target.value})},h('option',{value:'absolute'},'Assoluto'),h('option',{value:'perKg'},'Per kg BW')),
    h('select',{value:g.kind||'minimum',onChange:e=>patch({kind:e.target.value})},h('option',{value:'minimum'},'Minimo'),h('option',{value:'target'},'Target'),h('option',{value:'upper'},'Massimo')),
    h('select',{value:g.period||'day',onChange:e=>patch({period:e.target.value})},h('option',{value:'day'},'Giorno'),h('option',{value:'week'},'Settimana')),
    h('span',{className:'goalComputed'},`→ ${fmt(effectiveTarget(g,weight),2)} ${g.unit}${g.period==='week'?` / settimana · ${fmt(goalDailyReference(g,weight),2)}/die`:''}${g.ul?` · UL adulti sani ${fmt(g.ul,2)} ${g.unit}/die`:''}${g.targetMode==='perKg'?` (${fmt(Number(g.perKg||0),2)} ${g.unit}/kg)`:''}`),
    g.group!=='Energia e macro'?h('button',{className:`pinBtn ${g.pinned?'pinned':''}`,title:g.pinned?'Rimuovi dai pinnati':'Pinna nel diario',onClick:()=>patch({pinned:!g.pinned})},g.pinned?'★':'☆'):null,
    custom?h('button',{className:'ghost danger',onClick:()=>setGoals(goals.filter(x=>x.id!==g.id))},'×'):null
  );
}

function CandidatePreviewModal({food,onClose}){
  const ndRows=Object.entries(food?.nutrientStatus||{}).filter(([,st])=>!['numeric','ai_estimate'].includes(st?.status));
  return h('div',{className:'modalBackdrop'},
    h('div',{className:'modal candidatePreviewModal'},
      h('div',{className:'modalHead'},
        h('div',null,
          h('span',{className:'eyebrow'},'DETTAGLIO DATABASE'),
          h('h2',null,food?.name||food?.officialName||'Alimento'),
          food?.officialName&&food.officialName!==food.name?h('p',{className:'muted'},food.officialName):null
        ),
        h('button',{className:'close',onClick:onClose},'×')
      ),
      h('div',{className:'previewMacroGrid'},
        ...Object.entries(MACROS).map(([k,label])=>h('div',{key:k},h('small',null,label),h('strong',null,fmtMaybe(food?.label?.[k],2))))
      ),
      h('h3',null,'Micronutrienti e componenti'),
      !(food?.nutrients||[]).length
        ?h('p',{className:'muted'},'Nessun micronutriente numerico disponibile nella scheda.')
        :h('div',{className:'previewNutrients'},
          ...(food.nutrients||[]).map(n=>h('div',{className:'previewNutrient',key:n.id||`${n.name}-${n.form}`},
            h('div',null,h('b',null,n.name),h('small',null,n.form||'')),
            h('strong',null,`${fmt(Number(n.amount),4)} ${n.unit}`),
            h('small',null,`${n.source||''}${n.grade?` · Grade ${n.grade}`:''}${n.evidence?` · ${n.evidence}`:''}`)
          ))
        ),
      ndRows.length?h('details',{className:'previewNd'},
        h('summary',null,'Campi N/D / non disponibili'),
        h('div',null,...ndRows.map(([name,st])=>h('div',{className:'previewNdRow',key:name},h('b',null,name),h('span',null,st?.reason||st?.status||'N/D'))))
      ):null,
      (food?.sources||[]).length?h('details',{className:'previewSources'},
        h('summary',null,'Fonti e provenienza'),
        h('div',null,...(food.sources||[]).map((src,i)=>h('div',{className:'previewSourceRow',key:src?.id||i},h('b',null,src?.name||String(src)),h('small',null,src?.reference||''))))
      ):null,
      h('div',{className:'modalActions'},h('button',{className:'cta',onClick:onClose},'Chiudi'))
    )
  );
}

function Home(){
  const [entryOpen,setEntryOpen]=useState(false),[entryMode,setEntryMode]=useState('food');
  const [mealPicker,setMealPicker]=useState(null),mealPickerRef=React.useRef(null);
  const [quickSelected,setQuickSelected]=useState(null),[directCapture,setDirectCapture]=useState(null);
  const [recipeDestination,setRecipeDestination]=useState(null),[wizardOpen,setWizardOpen]=useState(false);
  const [v5Notice,setV5Notice]=useState(null),[wizardUndo,setWizardUndo]=useState(()=>{try{return Boolean(localStorage.getItem('nutritrace_goals_before_wizard_v5'));}catch{return false;}});
  const [savedRecipes,setSavedRecipes]=useState(()=>{try{return DiaryV5.normalizeRecipes(JSON.parse(localStorage.getItem('nutritrace_recipes_v5')||'[]'));}catch{return [];}});
  const mutationLock=React.useRef(false),captureGeneration=React.useRef(0),speechRef=React.useRef(null),recipeRequest=React.useRef(0);
  const [listening,setListening]=useState(false);
  useEffect(()=>()=>{speechRef.current?.abort?.();},[]);
  useEffect(()=>{if(!v5Notice)return;const timer=setTimeout(()=>setV5Notice(null),12000);return()=>clearTimeout(timer);},[v5Notice]);

  const [foods,setFoods]=useState([]), [logs,setLogs]=useState([]), [goals,setGoals]=useState(buildDefaultGoals()), [profile,setProfile]=useState(structuredClone(DEFAULT_PROFILE));
  const [meals,setMeals] = useState(() => {
  const config = window.NutriTraceMealConfig;
  const migrationKey = 'nutritrace_extras_migrated_v3';

  let current;

  try {
    const saved = localStorage.getItem('nutritrace_meals_v3');

    current = saved === null
      ? config.defaults()
      : config.normalize(JSON.parse(saved));
  } catch (error) {
    console.warn('Configurazione pasti non leggibile', error);
    current = config.defaults();
  }

  if (localStorage.getItem(migrationKey) !== '1') {
    const hasExtras = current.some(meal =>
      meal.id === 'extras' ||
      ['extra', 'extras'].includes(
        String(meal.name || '').trim().toLowerCase()
      )
    );

    if (!hasExtras && current.length < 20) {
      current = [
        ...current,
        { id: 'extras', name: 'Extra' }
      ];
    }

    if (hasExtras || current.length <= 20 &&
        current.some(meal => meal.id === 'extras')) {
      localStorage.setItem(migrationKey, '1');
    }
  }

  return current;
});
    const [selectedMealId,setSelectedMealId] = useState(null);
const [mealFavorites, setMealFavorites] = useState(() => {
  try {
    const saved = localStorage.getItem(
      'nutritrace_meal_favorites_v3'
    );

    return window.NutriTraceMealShortcuts.normalize(
      saved ? JSON.parse(saved) : []
    );
  } catch (error) {
    console.warn(
      'Impossibile leggere i preferiti dei pasti',
      error
    );
    return [];
  }
});

const activeMealId = meals.some(
  meal => meal.id === selectedMealId
) ? selectedMealId : null;
  const [darkMode,setDarkMode]=useState(()=>{
  try {
    return localStorage.getItem('nutritrace_theme_v3')==='dark';
  } catch {
    return false;
  }
});

useEffect(()=>{
  document.documentElement.dataset.theme=
    darkMode?'dark':'light';

  try {
    localStorage.setItem(
      'nutritrace_theme_v3',
      darkMode?'dark':'light'
    );
  } catch(error) {
    console.warn('Preferenza tema non salvata',error);
  }
},[darkMode]);
    const [tab,setTab]=useState('oggi'), [foodDraft,setFoodDraft]=useState(null), [grams,setGrams]=useState(''), [loaded,setLoaded]=useState(false);
  useEffect(() => {
  if (!loaded) return;

  try {
    localStorage.setItem(
      'nutritrace_meal_favorites_v3',
      JSON.stringify(mealFavorites)
    );
  } catch (error) {
    console.error(
      'Impossibile salvare i preferiti dei pasti',
      error
    );
  }
}, [mealFavorites, loaded]);
  const [query,setQuery]=useState(''), [results,setResults]=useState([]), [searchError,setSearchError]=useState(''), [searching,setSearching]=useState(false);    
  const [importName,setImportName]=useState('');
  const [importBrand,setImportBrand]=useState('');
  const [importIngredients,setImportIngredients]=useState('');
  const [quickQuery,setQuickQuery]=useState(''), [datasetMsg,setDatasetMsg]=useState(''), [datasets,setDatasets]=useState({}), [datasetMeta,setDatasetMeta]=useState([]), [newDatasetName,setNewDatasetName]=useState('CREA Italia'), [newDatasetFile,setNewDatasetFile]=useState(null);
  const [aiBusy,setAiBusy]=useState(''), [aiMsg,setAiMsg]=useState('');
  const [deviceToday,setDeviceToday]=useState(dateKey()), [selectedDate,setSelectedDate]=useState(dateKey());
  const [masterManifest,setMasterManifest]=useState(null), [masterIndex,setMasterIndex]=useState([]), [masterStatus,setMasterStatus]=useState('Caricamento Master DB…'), [masterOfflineMsg,setMasterOfflineMsg]=useState('');
  const [recipeText,setRecipeText]=useState(''), [recipeReview,setRecipeReview]=useState(null), [recipeBusy,setRecipeBusy]=useState(''), [recipeMsg,setRecipeMsg]=useState('');
  const [photoReviewOpen,setPhotoReviewOpen] = useState(false);
  const [showAllDeficits,setShowAllDeficits]=useState(false), [masterMigrationDone,setMasterMigrationDone]=useState(false);
  const [appConfig,setAppConfig]=useState(DEFAULT_APP_CONFIG);
  const [quickSearchQuery,setQuickSearchQuery]=useState('');
  const [quickAiResult,setQuickAiResult]=useState(null);
  const [foodLexicon,setFoodLexicon]=useState(null);
  const [candidateBrowserIndex,setCandidateBrowserIndex]=useState(null), [candidatePreview,setCandidatePreview]=useState(null), [candidatePreviewBusy,setCandidatePreviewBusy]=useState(false);
  const [reportMode,setReportMode]=useState('week'), [reportAnchor,setReportAnchor]=useState(dateKey()), [reportFrom,setReportFrom]=useState(dateKey()), [reportTo,setReportTo]=useState(dateKey());

  const liveData=React.useRef(null),liveReview=React.useRef(null),liveQuick=React.useRef('');
  liveData.current={foods,logs,recipes:savedRecipes};liveReview.current=recipeReview;liveQuick.current=quickQuery;

  useEffect(()=>{ try{
    setFoods(JSON.parse(localStorage.getItem('nutritrace_foods')||'[]'));
    setLogs(JSON.parse(localStorage.getItem('nutritrace_logs')||'[]'));
    setGoals(mergeGoalCatalog(JSON.parse(localStorage.getItem('nutritrace_goals_v23')||'null')));
    setProfile(normalizeProfile(JSON.parse(localStorage.getItem('nutritrace_profile_v23')||'null')));
    let meta=JSON.parse(localStorage.getItem('nutritrace_dataset_meta_v4')||'[]');
    (async()=>{
      if(localStorage.getItem('nutritrace_dataset_migration_v4')!=='1'){
        for(const legacy of [{id:'CIQUAL',name:'ANSES-CIQUAL'},{id:'FRIDA',name:'FRIDA / DTU Food Institute'},{id:'COFID',name:'UK CoFID'}]){
          const rows=await dbGet(legacy.id);
          if(rows.length && !meta.some(m=>m.id===legacy.id)) meta.push({id:legacy.id,name:legacy.name,fileName:'migrato dalla v1.1',count:rows.length,version:SOURCE_META[legacy.id]?.version||'legacy'});
        }
        await Promise.allSettled(['USDA_FOUNDATION','USDA_SR','USDA_BRANDED'].map(dbDel));
        localStorage.removeItem('nutritrace_usda_key'); localStorage.removeItem('nutritrace_commercial_online');
        localStorage.setItem('nutritrace_dataset_migration_v4','1');
      }
      setDatasetMeta(meta);
      const obj={}; for(const m of meta){ SOURCE_META[m.id]={name:m.name,version:m.version||'importato',mode:'local',official:false,scientific:true}; obj[m.id]=await dbGet(m.id); } setDatasets(obj);
    })();
  } finally { setLoaded(true); }
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  },[]);
  useEffect(()=>{let alive=true;loadAppConfig().then(c=>{if(alive)setAppConfig(c||DEFAULT_APP_CONFIG)});return()=>{alive=false};},[]);
  useEffect(()=>{const t=setTimeout(()=>setQuickSearchQuery(quickQuery),220);return()=>clearTimeout(t);},[quickQuery]);
  useEffect(()=>{
    let active=true;
    const provider=window.NutriTraceFoodLexicon;
    if(provider?.load){
      provider.load('./data/food-lexicon-it-en.json')
        .then(lex=>{if(active)setFoodLexicon(lex);})
        .catch(()=>{if(active)setFoodLexicon(null);});
    }
    return()=>{active=false;};
  },[]);
  useEffect(() => {
  if (!loaded) return;

  try {
    localStorage.setItem(
      'nutritrace_meals_v3',
      JSON.stringify(meals)
    );
  } catch (error) {
    console.error(
      'Impossibile salvare la configurazione dei pasti',
      error
    );
  }
}, [meals, loaded]);
  useEffect(()=>{ let alive=true; loadMasterBundle().then(({manifest,index})=>{ if(!alive)return; setMasterManifest(manifest); setMasterIndex(index); setMasterStatus(`${Number(manifest.food_count||index.length).toLocaleString('it-IT')} alimenti · Runtime ${manifest.runtime_version||'v1'} auditato pronto`); }).catch(e=>alive&&setMasterStatus(`Master DB non disponibile: ${e.message}`)); return()=>{alive=false}; },[]);
  useEffect(()=>{ if(!loaded||!masterManifest||!masterIndex.length||masterMigrationDone)return; let alive=true; (async()=>{
    const byId=new Map(masterIndex.map(r=>[String(r.id),r])); const currentRevision=masterRevision(masterManifest); const stale=foods.filter(f=>f.mergeMeta?.importedFrom==='MASTER'&&f.masterId&&String(f.masterVersion||'')!==currentRevision);
    if(!stale.length){if(alive)setMasterMigrationDone(true);return;}
    const refreshed=new Map();
    for(const old of stale){const row=byId.get(String(old.masterId));if(!row)continue;try{const detail=await loadMasterDetail(row);if(detail){const nf=masterToFood(row,detail,masterManifest,old.name);nf.id=old.id;refreshed.set(old.id,nf);}}catch{}}
    if(alive&&refreshed.size)setFoods(cur=>cur.map(f=>refreshed.get(f.id)||f));
    if(alive)setMasterMigrationDone(true);
  })(); return()=>{alive=false}; },[loaded,masterManifest,masterIndex,masterMigrationDone]);
  useEffect(()=>{ if(loaded) localStorage.setItem('nutritrace_foods',JSON.stringify(foods)); },[foods,loaded]);
  useEffect(()=>{ if(loaded) localStorage.setItem('nutritrace_logs',JSON.stringify(logs)); },[logs,loaded]);
  useEffect(()=>{ if(loaded) localStorage.setItem('nutritrace_goals_v23',JSON.stringify(goals)); },[goals,loaded]);
  useEffect(()=>{ if(loaded) localStorage.setItem('nutritrace_profile_v23',JSON.stringify(profile)); },[profile,loaded]);
  useEffect(()=>{ if(loaded) localStorage.setItem('nutritrace_dataset_meta_v4',JSON.stringify(datasetMeta)); },[datasetMeta,loaded]);
  useEffect(()=>{ const sync=()=>{ const now=dateKey(); if(now!==deviceToday){ setSelectedDate(d=>d===deviceToday?now:d); setDeviceToday(now); } }; const t=setInterval(sync,30000); document.addEventListener('visibilitychange',sync); return()=>{clearInterval(t);document.removeEventListener('visibilitychange',sync)}; },[deviceToday]);

  const dayLogs=useMemo(()=>logs.filter(l=>l.date===selectedDate),[logs,selectedDate]);
  const [weekStart,weekEnd]=useMemo(()=>weekBounds(selectedDate),[selectedDate]);
  const weekLogs=useMemo(()=>logs.filter(l=>l.date>=weekStart&&l.date<=weekEnd),[logs,weekStart,weekEnd]);
  const totals=useMemo(()=>aggregate(dayLogs,foods),[dayLogs,foods]), weekTotals=useMemo(()=>aggregate(weekLogs,foods),[weekLogs,foods]);
  const recentFoods=useMemo(()=>DiaryV5.recentFoods(logs,foods,3,deviceToday),[logs,foods,deviceToday]);
  const quickSuggestions=useMemo(()=>{
  const q=quickSearchQuery.trim();

  if(!q) return quickQuery.trim()?[]:recentFoods;
  if(norm(q)!==norm(quickQuery))return [];

  if(norm(q).length<2)return [];

  const searchText=q.replace(/^(?:\d+(?:[.,]\d+)?\s*(?:kg|chilogrammi?|kilogrammi?|grammi?|grammo|gr|g)\b\s*(?:di\s+)?|\d+\s+(?:pz\s+)?|(?:un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s+)/i,'').trim()||q;
  const originalSearch=term=>[
    ...searchPersonalFoods(term,foods,4),
    ...searchMasterIndex(term,masterIndex,8),
    ...searchLocalDataset(term,datasets,4)
      .map(f=>({...f,resultType:'local'}))
  ];
  const bridge=window.NutriTraceFoodSearchBridge;
  const regular=bridge?.search
    ? bridge.search(searchText,originalSearch,foodLexicon,10)
    : originalSearch(searchText).slice(0,10);

  if(
    !quickAiResult ||
    norm(quickAiResult.query)!==norm(q)
  ) return regular.slice(0,10);

  const seen=new Set();

  return [...quickAiResult.rows,...regular]
    .filter(row=>{
      const key=row.resultType==='master'
        ? 'm:'+row.id
        : row.resultType==='personal'
          ? 'p:'+row.id
          : 'l:'+(row.localId||row.sourceId||row.id);

      if(seen.has(key))return false;
      seen.add(key);
      return true;
    })
    .slice(0,12);

},[
  quickSearchQuery,quickQuery,foods,datasets,
  recentFoods,masterIndex,quickAiResult,foodLexicon
]);
  const macroPreview=useMemo(()=>computeMacroPlan(profile),[profile]);
  const pinnedGoals=goals.filter(g=>g.group!=='Energia e macro'&&g.pinned);
  const trackedWeekDays=useMemo(()=>new Set(weekLogs.map(l=>l.date)).size,[weekLogs]);
  const weeklyDeficits=useMemo(()=>{
    const list=[];
    // Unlogged days are unknown, not zero: daily goals are compared only with days that contain diary entries.
    // Weekly goals are prorated by the same tracked-day fraction until a complete 7-day week is available.
    const tracked=Math.max(0,trackedWeekDays);
    for(const g of goals){
      if(g.group==='Energia e macro'||g.kind==='upper')continue;
      const one=effectiveTarget(g,profile.weight); if(!(one>0)||tracked===0)continue;
      const target=goalTargetForDays(g,profile.weight,tracked), current=goalNutrientTotalFromLogs(weekLogs,foods,g,'deficiency'), coverage=goalCoverageFromLogs(weekLogs,foods,g,'deficiency');
      const dataSufficient=coverage>=.65, deficit=dataSufficient?Math.max(0,1-current/target):null;
      list.push({g,target,current,coverage,dataSufficient,deficit,trackedDays:tracked});
    }
    return list.sort((a,b)=>Number(b.dataSufficient)-Number(a.dataSufficient)||(b.deficit??-1)-(a.deficit??-1)||a.g.name.localeCompare(b.g.name,'it'));
  },[goals,weekTotals,weekLogs,foods,profile.weight,trackedWeekDays]);
  const topDeficits=weeklyDeficits.filter(x=>x.dataSufficient&&x.deficit>0).slice(0,6);
  const reportRange=useMemo(()=>{
    if(reportMode==='day')return[reportAnchor,reportAnchor];
    if(reportMode==='week')return weekBounds(reportAnchor);
    if(reportMode==='month')return monthBounds(reportAnchor);
    if(reportMode==='year')return yearBounds(reportAnchor);
    const a=reportFrom<=reportTo?reportFrom:reportTo,b=reportFrom<=reportTo?reportTo:reportFrom;return[a,b];
  },[reportMode,reportAnchor,reportFrom,reportTo]);
  const reportLogs=useMemo(()=>logs.filter(l=>l.date>=reportRange[0]&&l.date<=reportRange[1]),[logs,reportRange[0],reportRange[1]]);
  const reportTrackedDays=useMemo(()=>new Set(reportLogs.map(l=>l.date)).size,[reportLogs]);
  const reportTotals=useMemo(()=>aggregate(reportLogs,foods),[reportLogs,foods]);
  const reportAvg=useMemo(()=>Object.fromEntries(Object.keys(MACROS).map(k=>[k,DiaryV5.stats(reportLogs,foods,{id:k}).average])),[reportLogs,foods]);
  const previousReportRange=useMemo(()=>previousRange(reportRange[0],reportRange[1]),[reportRange[0],reportRange[1]]);
  const previousReportLogs=useMemo(()=>logs.filter(l=>l.date>=previousReportRange[0]&&l.date<=previousReportRange[1]),[logs,previousReportRange[0],previousReportRange[1]]);
  const previousTrackedDays=useMemo(()=>new Set(previousReportLogs.map(l=>l.date)).size,[previousReportLogs]);
  const previousTotals=useMemo(()=>aggregate(previousReportLogs,foods),[previousReportLogs,foods]);
  const previousAvg=useMemo(()=>Object.fromEntries(Object.keys(MACROS).map(k=>[k,DiaryV5.stats(previousReportLogs,foods,{id:k}).average])),[previousReportLogs,foods]);
  const reportGoalStats=useMemo(()=>goals.filter(g=>g.group!=='Energia e macro'&&effectiveTarget(g,profile.weight)>0).map(g=>{
    const coverage=goalCoverageFromLogs(reportLogs,foods,g,'deficiency'),current=goalNutrientTotalFromLogs(reportLogs,foods,g,'deficiency'),target=goalTargetForDays(g,profile.weight,reportTrackedDays);
    const pct=target>0?current/target:null,ulTotal=g.ul?Number(g.ul)*Math.max(1,reportTrackedDays):null;
    const status=coverage<.65?'insufficient':ulTotal&&current>ulTotal?'high':pct!==null&&pct<.8?'low':'adequate';
    return{g,coverage,current,target,pct,ulTotal,status};
  }).sort((a,b)=>({low:0,high:1,adequate:2,insufficient:3}[a.status]-({low:0,high:1,adequate:2,insufficient:3}[b.status]))||a.g.name.localeCompare(b.g.name,'it')),[goals,profile.weight,reportLogs,foods,reportTrackedDays]);
  const reportHistory=useMemo(()=>{
    const weekMap=new Map(),monthMap=new Map(),yearMap=new Map();
    for(const l of logs){
      const [ws,we]=weekBounds(l.date),mk=l.date.slice(0,7),yk=l.date.slice(0,4);
      if(!weekMap.has(ws))weekMap.set(ws,{from:ws,to:we,dates:new Set(),count:0});const w=weekMap.get(ws);w.dates.add(l.date);w.count++;
      if(!yearMap.has(yk))yearMap.set(yk,{from:`${yk}-01-01`,to:`${yk}-12-31`,dates:new Set(),count:0});const y=yearMap.get(yk);y.dates.add(l.date);y.count++;
    }
    const finish=map=>[...map.values()].map(x=>({...x,trackedDays:x.dates.size})).sort((a,b)=>b.from.localeCompare(a.from));
    return{weeks:finish(weekMap).slice(0,26),months:finish(monthMap).slice(0,24),years:finish(yearMap)};
  },[logs]);
  const masterSources=masterManifest?.sources||[];
  const includedMasterSources=masterSources.filter(x=>x.inclusion_status==='included'||!x.inclusion_status);
  const validationOnlySources=masterSources.filter(x=>x.inclusion_status==='validation_only');
  const missingMasterSources=masterSources.filter(x=>x.inclusion_status==='missing_input');
  
const draftCatalogRows=foodDraft
  ? MICRO_CATALOG.map(spec=>{
      const nutrient=(foodDraft.nutrients||[]).find(n=>
        norm(n.name)===norm(spec.name) &&
        !isMissing(n.amount) &&
        Number.isFinite(Number(n.amount)) &&
        Number(n.amount)>=0
      );
      const status=foodDraft.nutrientStatus?.[spec.name]||{
        status:'nd',
        reason:'N/D: nessun valore disponibile'
      };
      return {...spec,nutrient,missing:!nutrient,status};
    })
  :[];

const draftNdRows=draftCatalogRows.filter(
  row=>row.missing&&AI_NUTRIENT_SPECS[row.name]
);

  const ui=(path,fallback)=>cfgGet(appConfig?.ui,path,fallback);


  function persistDiaryChange(nextFoods,nextLogs,recipes){
    const updates=[['nutritrace_foods',JSON.stringify(nextFoods)],['nutritrace_logs',JSON.stringify(nextLogs)]];
    if(recipes)updates.push(['nutritrace_recipes_v5',JSON.stringify(recipes)]);
    const before=updates.map(([key])=>[key,localStorage.getItem(key)]);
    try{for(const [key,value]of updates)localStorage.setItem(key,value);}
    catch(error){for(const [key,value]of before){try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value);}catch{}}throw new Error('Spazio sul dispositivo insufficiente: il salvataggio non è stato completato. Esporta un backup da Dati.');}
    liveData.current={foods:nextFoods,logs:nextLogs,recipes:recipes||liveData.current.recipes};
    setFoods(nextFoods);setLogs(nextLogs);if(recipes)setSavedRecipes(recipes);
  }
  function persistDiaryBatch(created,added,recipes){
    const latest=liveData.current, nextFoods=[...latest.foods],remap=new Map();
    for(const food of created){
      const found=nextFoods.find(f=>f.id===food.id||(food.masterId!=null&&f.masterId!=null&&String(food.masterId)===String(f.masterId))||(food.barcode&&f.barcode===food.barcode));
      if(found)remap.set(food.id,found.id);else nextFoods.push(food);
    }
    const known=new Set(nextFoods.map(f=>f.id));
    const nextLogs=added.map(log=>({...log,foodId:remap.get(log.foodId)||log.foodId}));
    if(nextLogs.some(log=>!known.has(log.foodId)))throw new Error('Un alimento è stato rimosso durante la preparazione. Ripeti la selezione.');
    if(recipes)recipes=recipes.map(recipe=>({...recipe,ingredients:recipe.ingredients.map(i=>({...i,foodId:remap.get(i.foodId)||i.foodId}))}));
    persistDiaryChange(nextFoods,[...latest.logs,...nextLogs],recipes);
    return nextLogs;
  }
  // A missing destination is never silently treated as an unassigned entry.
  function chooseMeal(mealId){
    if(meals.some(m=>m.id===mealId))return Promise.resolve(mealId);
    if(mealPickerRef.current)return Promise.resolve(null);
    return new Promise(resolve=>{mealPickerRef.current=resolve;setMealPicker(true);});
  }
  function finishMealChoice(id){
    const resolve=mealPickerRef.current;mealPickerRef.current=null;setMealPicker(null);
    const valid=meals.some(m=>m.id===id)?id:null;
    if(valid)setSelectedMealId(valid);
    resolve?.(valid);
  }
  function clearMealChoice(){
    setSelectedMealId(null);
    setRecipeDestination(prev=>prev?{...prev,mealId:null}:prev);
  }
  // The Home composer and meal dialog share state. A completed or abandoned
  // entry must not leak a review (or a late speech/AI callback) into the other surface.
  function stopEntryDictation(){
    const recognition=speechRef.current;speechRef.current=null;
    if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{if(recognition.abort)recognition.abort();else recognition.stop?.();}catch{}}
    setListening(false);
  }
  function clearRecipeReview(){
    recipeRequest.current++;liveReview.current=null;
    setRecipeReview(null);setRecipeDestination(null);setRecipeMsg('');setRecipeBusy('');
    setCandidateBrowserIndex(null);setCandidatePreview(null);setCandidatePreviewBusy(false);setPhotoReviewOpen(false);
  }
  function resetTextEntry(){
    stopEntryDictation();clearRecipeReview();setRecipeText('');
  }
  function closeEntry(){
    if(mutationLock.current)return;
    resetTextEntry();setEntryOpen(false);
  }
  function openEntry(mealId){
    if(mutationLock.current)return;
    resetTextEntry();
    setSelectedMealId(meals.some(m=>m.id===mealId)?mealId:null);setQuickQuery('');setQuickSearchQuery('');setGrams('');setQuickSelected(null);setAiMsg('');setEntryMode('food');setEntryOpen(true);
  }
  function openDirectCapture(mode){
    if(mutationLock.current)return;
    captureGeneration.current++;resetTextEntry();setEntryOpen(false);
    const context={date:selectedDate,mealId:activeMealId};setRecipeDestination(context);
    setDirectCapture({mode,context,generation:captureGeneration.current,product:null,review:false});
  }
  function closeDirectCapture(){if(mutationLock.current)return;captureGeneration.current++;resetTextEntry();setDirectCapture(null);}
  async function captureDish(photo){
    const generation=captureGeneration.current;
    await importPhotoDish(photo,true);
    if(generation!==captureGeneration.current)return;
    setDirectCapture(prev=>prev?{...prev,review:true}:prev);
  }
  function captureLabel(photo){
    if(photo.basis!=='per_100g')throw new Error('Per registrare i valori, conferma prima una tabella riferita a 100 g.');
    setDirectCapture(prev=>prev?{...prev,product:photo}:prev);
  }
  async function commitCapturedProduct(product,amount){
    if(mutationLock.current)return;
    if(!directCapture||!DiaryV5.positive(amount))throw new Error('Controlla la quantità.');
    mutationLock.current=true;
    try{
      const mealId=await chooseMeal(directCapture.context.mealId);if(!mealId)return false;
      const result=DiaryV5.productFood(product,foods,newId()),food=result.food;
      const log={id:newId(),createdAt:new Date().toISOString(),...directCapture.context,mealId,foodId:food.id,grams:amount,entryOrigin:product.barcode?'barcode-direct-v5':'photo-label-direct-v5'};
      persistDiaryBatch(result.existing?[]:[food],[log]);
      setV5Notice({text:food.name+' aggiunto al pasto',ids:[log.id]});resetTextEntry();setDirectCapture(null);
    }finally{mutationLock.current=false;}
  }
  function startDictation(){
    if(mutationLock.current)return;
    const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Speech){setRecipeMsg('La dettatura non è disponibile in questo browser. Puoi usare il microfono della tastiera del telefono.');return;}
    if(listening){speechRef.current?.stop();return;}
    const recognition=new Speech();recognition.lang='it-IT';recognition.interimResults=false;
    recognition.onresult=e=>{if(speechRef.current!==recognition||mutationLock.current)return;const text=Array.from(e.results).map(r=>r[0].transcript).join(' ');if(!text.trim())return;clearRecipeReview();setRecipeText(old=>(old?old+' ':'')+text);};
    recognition.onerror=()=>{if(speechRef.current!==recognition)return;setRecipeMsg('Dettatura interrotta. Controlla il permesso del microfono o usa la tastiera.');setListening(false);};
    recognition.onend=()=>{if(speechRef.current===recognition){speechRef.current=null;setListening(false);}};speechRef.current=recognition;
    try{recognition.start();setListening(true);}catch{setRecipeMsg('Impossibile avviare la dettatura.');}
  }
  async function addSavedRecipe(recipe,amount){
    if(mutationLock.current)return;
    mutationLock.current=true;
    try{const portions=DiaryV5.scaleRecipe(recipe,amount,foods),groupId=newId(),now=new Date().toISOString();
      const mealId=await chooseMeal(activeMealId);if(!mealId)return false;
      const added=portions.map(x=>({...x,id:newId(),createdAt:now,recipeGroupId:groupId,date:selectedDate,mealId}));
      persistDiaryBatch([],added);setV5Notice({text:recipe.name+' · '+fmt(amount,2)+' g aggiunti',ids:added.map(l=>l.id)});resetTextEntry();setEntryOpen(false);
    }finally{mutationLock.current=false;}
  }
  function editSavedRecipe(recipe){
    if(mutationLock.current)return;
    resetTextEntry();
    setRecipeReview({mode:'recipe',recipe_name:recipe.name,recipeId:recipe.id,saveRecipe:true,yieldOverride:recipe.yieldGrams,servings:recipe.servings||'',consumed_grams:'',ingredients:recipe.ingredients.map(i=>{const f=foods.find(x=>x.id===i.foodId);return{savedMetadata:{...(i.metadata||{})},name:f?.name||i.name,grams:i.grams,selectedKey:f?'p:'+f.id:'',candidates:f?[{...f,candidateKey:'p:'+f.id,resultType:'personal'}]:[],ambiguity:'none'};})});
    setRecipeDestination({date:selectedDate,mealId:activeMealId});setEntryMode('text');setRecipeMsg('');
  }
  function removeSavedRecipe(id){
    if(!window.confirm('Rimuovere questa ricetta salvata? Le registrazioni già nel diario restano.'))return;
    const next=savedRecipes.filter(r=>r.id!==id);try{localStorage.setItem('nutritrace_recipes_v5',JSON.stringify(next));setSavedRecipes(next);}catch{setRecipeMsg('Ricette non salvate: spazio insufficiente.');}
  }
  function applyWizardResult(result){
    const before={profile,goals},rawProfile=localStorage.getItem('nutritrace_profile_v23'),rawGoals=localStorage.getItem('nutritrace_goals_v23');
    localStorage.setItem('nutritrace_goals_before_wizard_v5',JSON.stringify(before));
    try{localStorage.setItem('nutritrace_profile_v23',JSON.stringify(result.profile));localStorage.setItem('nutritrace_goals_v23',JSON.stringify(result.goals));}
    catch(error){try{rawProfile===null?localStorage.removeItem('nutritrace_profile_v23'):localStorage.setItem('nutritrace_profile_v23',rawProfile);rawGoals===null?localStorage.removeItem('nutritrace_goals_v23'):localStorage.setItem('nutritrace_goals_v23',rawGoals);}catch{}throw new Error('Impossibile salvare gli obiettivi sul dispositivo.');}
    setProfile(result.profile);setGoals(result.goals);setWizardOpen(false);setWizardUndo(true);setV5Notice({text:result.summary?.eligible===false?'Preferenze salvate. Obiettivi invariati: '+result.summary.reason:'Obiettivi aggiornati. Puoi modificarli in qualsiasi momento.'});
  }
  function undoWizard(){
    try{const previous=JSON.parse(localStorage.getItem('nutritrace_goals_before_wizard_v5')||'null');if(!previous?.profile||!Array.isArray(previous.goals))throw new Error('Nessun ripristino disponibile.');
      applyWizardResult(previous);setV5Notice({text:'Ripristinati gli obiettivi precedenti.'});
    }catch(e){setV5Notice({text:e.message});}
  }

  function valueForGoal(g,ag){ const v=goalValueFromAggregate(g,ag); if(v===0&&g.name==='Sodio'&&ag.salt>0)return convert(ag.salt/2.5,'g',g.unit); return v; }
  function openBarcodeProduct(product) {
  if (
    !product ||
    !/^\d{8}$|^\d{12,14}$/.test(String(product.barcode || '')) ||
    !String(product.name || '').trim()
  ) {
    window.alert('Scheda barcode non valida.');
    return;
  }

  const barcode = String(product.barcode);
  const name = String(product.name).trim();
  const brand = String(product.brand || '').trim();

  const found =
    foods.find(f => String(f.barcode || '') === barcode) ||
    foods.find(f =>
      norm(f.name) === norm(name) &&
      norm(f.brand || '') === norm(brand)
    );

  if (found) {
    window.alert(
      'Alimento già presente: apriamo la scheda esistente. ' +
      'I nutrienti salvati non verranno sovrascritti automaticamente.'
    );
  }

  const label = emptyLabel();

  if (!found) {
    for (const key of Object.keys(label)) {
      const value = product.label?.[key];

      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0
      ) {
        label[key] = value;
      }
    }
  }

  const draft = found
    ? {
        ...structuredClone(found),
        barcode
      }
    : {
        ...emptyFood(),
        barcode,
        name,
        brand,
        ingredients: String(product.ingredients || ''),
        label,
        aliases: [name],
        servingGrams: 100,
        notes:
          'Dati Open Food Facts: verifica con l’etichetta originale.',
        sources: [{
          id: newId(),
          name: 'Open Food Facts',
          reference: product.source?.url ||
            ('https://world.openfoodfacts.org/product/' + barcode),
          quality: 'secondaria'
        }]
      };

  draft.barcodeDiary = {
    add: false,
    grams: '100',
    mealId: ''
  };

  setFoodDraft(draft);
}

async function saveFood() {
  if (!foodDraft?.name?.trim()||mutationLock.current) return;

  const { barcodeDiary, ...data } = foodDraft;
  const gramsValue = Number(barcodeDiary?.grams);

  if (
    barcodeDiary?.add &&
    (
      !Number.isFinite(gramsValue) ||
      gramsValue <= 0 ||
      gramsValue > 10000
    )
  ) {
    window.alert('Inserisci una quantità valida fino a 10000 g.');
    return;
  }

  let mealId = barcodeDiary?.mealId || null;
  if(barcodeDiary?.add&&barcodeDiary.quickHome&&!mealId){
    mutationLock.current=true;try{mealId=await chooseMeal(null);if(!mealId)return;}finally{mutationLock.current=false;}
  }

  if (
    barcodeDiary?.add &&
    mealId &&
    !meals.some(m => m.id === mealId)
  ) {
    window.alert('Seleziona un pasto valido.');
    return;
  }

  const food = {
    ...data,
    additives: parseAdditives(data.ingredients)
  };

  setFoods(prev => [
    ...prev.filter(f => f.id !== food.id),
    food
  ]);

  if (barcodeDiary?.add) {
    setLogs(prev => [
      ...prev,
      {
        id: newId(),
        date: barcodeDiary.date || selectedDate,
        createdAt:new Date().toISOString(),
        foodId: food.id,
        grams: gramsValue,
        mealId
      }
    ]);
  }

  setFoodDraft(null);
}
  function removeFood(id){ const f=foods.find(x=>x.id===id); if(!f) return; const n=logs.filter(l=>l.foodId===id).length; if(!confirm(`Rimuovere “${f.name}” dall'archivio?${n?` Verranno eliminate anche ${n} registrazioni del diario.`:''}`)) return; setFoods(p=>p.filter(x=>x.id!==id)); setLogs(p=>p.filter(l=>l.foodId!==id)); }
  function addFoodLog(foodId, g = grams, extra = {}) {
  const amount = Number(g);

  if (!foodId || !Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    return;
  }

  setLogs(previous => [
    ...previous,
    {
      id: newId(),
      date: selectedDate,
      createdAt:new Date().toISOString(),
      foodId,
      grams: amount,
      ...extra,
      mealId: activeMealId
    }
  ]);
}
  async function masterFoodFromResult(r,alias=''){
    const existing=foods.find(f=>String(f.masterId||'')===String(r.id));
    const currentRevision=masterRevision(masterManifest);
    if(existing && String(existing.masterVersion||'')===currentRevision)return existing;
    const detail=await loadMasterDetail(r); if(!detail)throw new Error('Dettaglio alimento Master DB non trovato.');
    const fresh=masterToFood(r,detail,masterManifest,alias||existing?.name||'');
    if(existing)fresh.id=existing.id;
    return fresh;
  }
  async function quickAdd(r) {
    if(mutationLock.current)return;
    const isRecent=Boolean(r.recentLog&&!quickQuery.trim());
    // Explicit grams > recent portion > explicit mass in query > documented natural unit.
    // Never reuse the last portion for a regular archive/search result.
    const blank=String(grams).trim()==='';
    const explicit=blank&&!isRecent?explicitMassFromText(quickQuery):null;
    const portion=blank&&!isRecent&&!explicit?quickNaturalPortion(quickQuery,r,appConfig):null;
    const amount=blank?(isRecent?DiaryV5.number(r.recentLog.grams):explicit??portion?.grams??null):DiaryV5.number(grams);
    if(!DiaryV5.positive(amount)){
      setQuickSelected(r);setAiMsg(blank&&!explicit&&!portion?'Attenzione: non hai inserito il peso. Indica la quantità in grammi.':'Inserisci una quantità positiva, fino a 10.000 g.');
      requestAnimationFrame(()=>document.querySelector('[data-v5-grams]')?.focus());return;
    }
    const destination={date:selectedDate,mealId:activeMealId};
    mutationLock.current=true;setRecipeBusy('quick');setAiMsg('');
    try {
      const mealId=await chooseMeal(destination.mealId);if(!mealId)return;
      destination.mealId=mealId;
      let food=r.resultType==='personal'?foods.find(f=>f.id===r.id):r.resultType==='master'?foods.find(f=>String(f.masterId||'')===String(r.id)):foods.find(f=>f.sourceId&&f.sourceId===r.sourceId&&f.source===r.source);
      const created=!food;
      if(!food)food=r.resultType==='master'?await masterFoodFromResult(r,r.name):materializeImported(r,r.name);
      if(!food)throw new Error('Alimento non più disponibile.');
      const log={...(isRecent?DiaryV5.recentMetadata(r.recentLog):{}),id:newId(),createdAt:new Date().toISOString(),...destination,foodId:food.id,grams:amount};
      if(portion)Object.assign(log,{portionOrigin:'catalog-standard',portionEstimatedByAI:false,portionAssumption:portion.assumption,portionConfidence:portion.confidence,portionEstimatedMinGrams:portion.range?.[0]??null,portionEstimatedMaxGrams:portion.range?.[1]??null,quantity:portion.count,unit:'pz',gramsPerUnit:portion.grams/portion.count});
      if(isRecent&&String(grams).trim()!==''&&amount!==DiaryV5.number(r.recentLog.grams)){
        for(const key of ['quantity','unit','gramsPerUnit','portionEstimatedMinGrams','portionEstimatedMaxGrams','portionConfidence','portionAssumption','portionNote'])delete log[key];
        log.portionEstimatedByAI=false;log.portionOrigin='manual';
      }
      persistDiaryBatch(created?[food]:[],[log]);
      setV5Notice({text:food.name+' · '+fmt(amount,2)+' g aggiunti'+(portion?' (porzione standard stimata)':''),ids:[log.id]});
      resetTextEntry();setQuickQuery('');setQuickSearchQuery('');setGrams('');setQuickSelected(null);setEntryOpen(false);
    }catch(error){setAiMsg(error.message||'Inserimento non riuscito.');}
    finally{mutationLock.current=false;setRecipeBusy('');}
  }
  function materializeImported(f,alias=''){ const source=f.sourceInfo||f.source; const useAlias=alias.trim(); return {...emptyFood(),source:f.source||'',sourceId:f.sourceId||'',name:useAlias?alias.trim():f.name,officialName:f.officialName||f.name,aliases:[...new Set([...(f.aliases||[]),...(useAlias?[alias.trim()]:[])])],brand:f.brand||'',servingGrams:f.servingGrams||100,label:f.label||emptyFood().label,ingredients:f.ingredients||'',nutrients:f.nutrients||[],sources:[source],mergeMeta:{importedFrom:f.source||source?.name}}; }
  function openImported(f,alias=query){ const same=foods.find(z=>(z.sourceId&&z.sourceId===f.sourceId)||(norm(z.name)===norm(f.name)&&norm(z.brand||'')===norm(f.brand||''))); if(same) setFoodDraft({...structuredClone(same),mergeMeta:{mode:'review',candidate:f}}); else setFoodDraft(materializeImported(f,alias)); setTab('alimenti'); }
  async function openResult(r,alias=query){
    if(r.resultType!=='master'){openImported(r,alias);return;}
    setSearching(true);setSearchError('');try{const existing=foods.find(f=>String(f.masterId||'')===String(r.id));setFoodDraft(existing?structuredClone(existing):await masterFoodFromResult(r,alias));setTab('alimenti');}catch(e){setSearchError(e.message)}finally{setSearching(false)}
  }
  async function searchFoods(){
    if(!query.trim())return;
    setSearching(true);setSearchError('');
    try{
      const originalSearch=term=>[
        ...searchMasterIndex(term,masterIndex,30),
        ...searchLocalDataset(term,datasets,12).map(f=>({...f,resultType:'local'}))
      ];
      const bridge=window.NutriTraceFoodSearchBridge;
      const found=bridge?.search
        ? bridge.search(query,originalSearch,foodLexicon,40)
        : originalSearch(query).slice(0,40);
      setResults(found);
      if(!found.length)setSearchError(ui('search.notFound','Nessun risultato nel Master DB o nei database personali.'));
    }finally{setSearching(false);}
  }
  async function createWithAI(name){ setAiBusy('search'); setAiMsg(''); try{ let f={...emptyFood(),name:name.trim(),aliases:[name.trim()]}; const ai=await aiEnrich(f,SAFE_AI_DEFAULT); f=mergeAiFood(f,ai); for(const x of MICRO_CATALOG) if(!f.nutrientStatus[x.name])f.nutrientStatus[x.name]={status:'nd',reason:'N/D: non stimato in assenza di una fonte strutturata'}; setFoodDraft(f); setTab('alimenti'); }catch(e){ setAiMsg(e.message); }finally{ setAiBusy(''); } }
  
async function enrichDraft(initialFood=foodDraft){
  if(!initialFood?.name?.trim())return;

  setAiBusy('draft');
  setAiMsg('');

  const selected=MICRO_CATALOG
    .filter(spec=>AI_NUTRIENT_SPECS[spec.name])
    .filter(spec=>!(initialFood.nutrients||[]).some(n=>
      norm(n.name)===norm(spec.name) &&
      !isMissing(n.amount) &&
      Number.isFinite(Number(n.amount)) &&
      Number(n.amount)>=0
    ))
    .map(spec=>spec.name);

  const batches=[];
  for(let i=0;i<selected.length;i+=10){
    batches.push(selected.slice(i,i+10));
  }

  if(!batches.length)batches.push([]);

  let next=structuredClone(initialFood);
  let failures=[];
  setFoodDraft(next);

  try{
    for(let bi=0;bi<batches.length;bi++){
      const batch=batches[bi];

      setAiMsg(
        `Completamento AI: blocco ${bi+1}/${batches.length}…`
      );

      try{
        next=mergeAiFood(
          next,
          await aiEnrich(next,batch)
        );
        setFoodDraft(structuredClone(next));
      }catch(e){
        failures.push(...batch);
        next.nutrientStatus={
          ...(next.nutrientStatus||{})
        };

        for(const name of batch){
          const spec=AI_NUTRIENT_SPECS[name];
          next.nutrientStatus[name]={
            status:'ai_error',
            reason:`Errore ${name}: ${e.message}`,
            canonicalId:spec?.id||''
          };
        }

        if(!batch.length)throw e;
      }
    }

    
next.aiRequested=failures;

try {
  if (
    window.NutriTraceIngredientAutoAudit &&
    masterIndex.length
  ) {
    next.aiAudit =
      await window.NutriTraceIngredientAutoAudit.audit({
        food: next,
        index: masterIndex,
        search: searchMasterIndex,
        loadDetail: loadMasterDetail,
        catalog: masterNutrientCatalog(masterManifest),
        microSpecs: MASTER_MICRO_SPECS,
        reconstruction:
          window.NutriTraceIngredientReconstruction
      });
  } else {
    next.aiAudit = {
      status: 'master_unavailable',
      warnings: []
    };
  }
} catch (error) {
  next.aiAudit = {
    status: 'audit_error',
    warnings: [{
      code: 'AUDIT_ERROR',
      message: String(error?.message || error)
    }]
  };
}

setFoodDraft(next);


    setAiMsg(failures.length
      ?`Completamento parziale: ${failures.length} nutrienti non elaborati per errore.`
      :'Completamento terminato. Le stime AI restano escluse dai calcoli delle carenze.'
    );
  }catch(e){
    setFoodDraft(next);
    setAiMsg(e.message);
  }finally{
    setAiBusy('');
  }
}

async function importPhotoLabel(photo) {
  if (!photo?.name?.trim()) {
    throw new Error('Nome prodotto mancante.');
  }

  const existing = foods.find(food =>
    norm(food.name) === norm(photo.name) &&
    norm(food.brand || '') === norm(photo.brand || '')
  );

  if (existing) {
    throw new Error(
      'Questo prodotto esiste già nell’archivio. ' +
      'Aprilo per modificarlo senza creare duplicati.'
    );
  }

  const label = emptyLabel();

  if (photo.basis === 'per_100g') {
    for (const key of Object.keys(MACROS)) {
      const value = photo.label?.[key];

      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
      ) {
        label[key] = Number(value);
      }
    }
  }

  const draft = {
    ...emptyFood(),
    name:photo.name.trim(),
    brand:photo.brand || '',
    ingredients:photo.ingredients || '',
    label,
    aliases:[photo.name.trim()],
    notes:
      'Importazione da fotografia. ' +
      'Valori della tabella verificati in anteprima ' +
      'dall’utente prima del salvataggio.',
    sources:[{
      id:newId(),
      name:'Etichetta fotografata',
      reference:'Trascrizione AI Vision verificata in anteprima',
      quality:'primaria'
    }]
  };

  setTab('ricerca');
  setFoodDraft(draft);

  // Existing AI enrichment preserves populated macro fields.
  // Run it only when ingredient context is available.
  if (draft.ingredients.trim()) {
    await enrichDraft(draft);
  }
}



async function importPhotoDish(photo,direct=false) {
  const captureToken=captureGeneration.current,requestToken=++recipeRequest.current;
  if(!direct)setRecipeDestination({date:selectedDate,mealId:activeMealId});
  const description = typeof photo === 'string'
    ? photo.trim()
    : String(photo?.description || '').trim();

  const portions = Array.isArray(photo?.portions)
    ? photo.portions.filter(p =>
        String(p?.name || '').trim()
      )
    : [];

  if (!description && !portions.length) {
    throw new Error(
      'Nessun alimento riconoscibile nella fotografia.'
    );
  }

  setRecipeBusy('parse');
  setRecipeMsg('');

  try {
    let review;
    let text;

    if (portions.length) {
      // La fotografia è già stata interpretata.
      // Non richiediamo una seconda analisi AI.
      // Manteniamo un elemento per ogni porzione confermata.

      const ingredients = portions.map((p, index) => {
        const name = String(p.name).trim();

        const rawGrams = p.estimatedGrams;

        const grams =
          rawGrams !== null &&
          rawGrams !== undefined &&
          rawGrams !== '' &&
          Number.isFinite(Number(rawGrams)) &&
          Number(rawGrams) > 0 &&
          Number(rawGrams) <= 10000
            ? Number(rawGrams)
            : null;

        const source =
          p.source === 'user_confirmed_visual_estimate'
            ? 'user_confirmed_visual_estimate'
            : p.source === 'manual'
              ? 'manual'
              : 'ai_visual_estimate';

        const confidence = [
          'high', 'medium', 'low', 'none'
        ].includes(p.confidence)
          ? p.confidence
          : 'none';

        const confidenceLabel = {
          high: 'alta',
          medium: 'media',
          low: 'bassa',
          none: 'non stimabile'
        }[confidence];

        const minGrams =
          Number.isFinite(Number(p.minGrams)) &&
          p.minGrams !== null &&
          Number(p.minGrams) > 0
            ? Number(p.minGrams)
            : null;

        const maxGrams =
          Number.isFinite(Number(p.maxGrams)) &&
          p.maxGrams !== null &&
          Number(p.maxGrams) > 0
            ? Number(p.maxGrams)
            : null;

        const validRange =
          grams !== null &&
          minGrams !== null &&
          maxGrams !== null &&
          minGrams <= grams &&
          grams <= maxGrams;

        const assumption =
          source === 'manual'
            ? 'Alimento aggiunto manualmente.'
            : source === 'user_confirmed_visual_estimate'
              ? 'Peso fotografico corretto dall’utente.'
              : 'Peso stimato dall’AI tramite fotografia.';

        // Ricerca deterministica nel database.
        // Non alteriamo nome e peso confermati.
        const candidates = ingredientCandidates(
          { name },
          'none'
        );

        return {
          name,
          raw: name,
          grams: grams === null ? '' : grams,
          gramsUserEdited:
            source !== 'ai_visual_estimate',

          ambiguity: 'none',
          ambiguity_reason: '',
          requires_weight_confirmation:
            grams === null,

          portion_assumption:
            assumption +
            ` Confidenza: ${confidenceLabel}.` +
            (
              validRange
                ? ` Intervallo stimato: ` +
                  `${minGrams}–${maxGrams} g.`
                : ''
            ),

          visualPortionSource: source,
          visualPortionConfidence: confidence,
          visualPortionMinGrams:
            validRange ? minGrams : null,
          visualPortionMaxGrams:
            validRange ? maxGrams : null,

          photoPortionIndex: index,

          ...candidates
        };
      });

      review = {
        mode:
          ingredients.length > 1
            ? 'multi'
            : 'single',

        recipe_name:
          description || 'Pasto fotografato',

        ingredients,
        errors: [],
        source: 'photo_vision_review'
      };

      text = ingredients
        .map(ing =>
          ing.grams !== ''
            ? `${ing.grams} g di ${ing.name}`
            : ing.name
        )
        .join(', ');

    } else {
      // Nessuna porzione identificata:
      // conserviamo il vecchio flusso testuale,
      // che può richiedere OpenRouter.

      text = description;
      review = await interpretText(text, 'diary');
    }

    // Nessun salvataggio nel diario in questa fase.
    // L'utente deve ancora selezionare e confermare
    // la corrispondenza database di ogni alimento.

    if(requestToken!==recipeRequest.current||(direct&&captureToken!==captureGeneration.current))return;
    setRecipeText(text);
    setRecipeReview(review);
    setPhotoReviewOpen(!direct);

    if (review.errors?.length) {
      setRecipeMsg(review.errors.join(' · '));
    }

  } catch (error) {
    throw new Error(
      'Impossibile preparare il diario: ' +
      (error?.message || 'errore sconosciuto')
    );

  } finally {
    if(requestToken===recipeRequest.current)setRecipeBusy('');
  }
}


async function createFromIngredientList(){
  const name=importName.trim();
  const ingredients=importIngredients.trim();

  if(!name||!ingredients){
    setSearchError(
      'Inserisci nome alimento e lista ingredienti.'
    );
    return;
  }

  const duplicate=foods.find(food=>
    norm(food.name)===norm(name) &&
    norm(food.brand||'')===norm(importBrand)
  );

  if(duplicate){
    setSearchError(
      'Esiste già un alimento con questo nome e marca. ' +
      'Aprilo dall’Archivio e completa i nutrienti dalla sua scheda.'
    );
    return;
  }

  setSearchError('');

  const draft={
    ...emptyFood(),
    name,
    brand:importBrand.trim(),
    ingredients,
    aliases:[name]
  };

  setFoodDraft(draft);
  await enrichDraft(draft);
}

function editCatalogNutrient(name, unit, value) {
  if (!foodDraft) return;

  const next = structuredClone(foodDraft);
  next.nutrients = [...(next.nutrients || [])];
  next.nutrientStatus = { ...(next.nutrientStatus || {}) };

  const index = next.nutrients.findIndex(
    n => norm(n.name) === norm(name)
  );

  if (value.trim() === '') {
    next.nutrients = next.nutrients.filter(
      n => norm(n.name) !== norm(name)
    );

    next.nutrientStatus[name] = {
      status: 'nd',
      reason: 'N/D: quantità non disponibile'
    };
  } else {
    const previous = index >= 0
      ? next.nutrients[index]
      : emptyNutrient();

    const nutrient = {
      ...previous,
      name,
      unit,
      amount: value,
      source: 'Manuale',
      evidence: 'Inserimento manuale',
      aiEstimate: false,
      reliability: 'manuale'
    };

    if (index >= 0) {
      next.nutrients[index] = nutrient;
    } else {
      next.nutrients.push(nutrient);
    }

    next.nutrientStatus[name] = {
      status: Number.isFinite(Number(value)) && Number(value) >= 0
        ? 'numeric'
        : 'nd',
      reason: 'Valore inserito manualmente'
    };
  }

  setFoodDraft(next);
}

  function toggleAiRequest(name){const a=[...(foodDraft.aiRequested||[])],i=a.indexOf(name);if(i>=0)a.splice(i,1);else a.push(name);setFoodDraft({...foodDraft,aiRequested:a});}
  function ingredientCandidates(ingredient,ambiguity='none'){
    const ing=typeof ingredient==='string'?{name:ingredient}:ingredient||{};
    const queries=semanticLookupQueries(ing);
    const policy=cfgGet(appConfig,'searchPolicy.databaseMatchPolicy',{});
    const byKey=new Map();
    for(const q of queries){
      for(const x of searchPersonalFoods(q,foods,5)){
        const candidate={...x,candidateKey:`p:${x.id}`,matchedQuery:q};const prev=byKey.get(candidate.candidateKey);if(!prev||candidate.score>prev.score)byKey.set(candidate.candidateKey,candidate);
      }
      for(const x of searchMasterIndex(q,masterIndex,8)){
        const candidate={...x,candidateKey:`m:${x.id}`,matchedQuery:q};const prev=byKey.get(candidate.candidateKey);if(!prev||candidate.score>prev.score)byKey.set(candidate.candidateKey,candidate);
      }
    }
    let candidates=[...byKey.values()];
    if(policy.requireLexicalEvidence!==false)candidates=candidates.filter(c=>candidateSemanticGate(ing,c,c.matchedQuery));
    const minScore=Number(policy.minCandidateScore??42);
    candidates=candidates.filter(c=>Number(c.score)>=minScore).sort((a,b)=>b.score-a.score).slice(0,8);
    let selectedKey='';
    const materialAmbiguity=(ambiguity||ing.ambiguity)==='needs_detail';
    if(!materialAmbiguity&&candidates.length){
      const top=candidates[0],second=candidates[1],exact=queries.some(q=>candidateExactSemanticMatch(q,top));
      const minAuto=Number(policy.minAutoSelectScore??92),gap=Number(policy.minAutoSelectGap??14);
      if(exact || (top.score>=minAuto&&(!second||top.score-second.score>=gap)))selectedKey=top.candidateKey;
    }
    return {candidates,selectedKey};
  }
  async function interpretText(text,context='diary'){
    const parsed=await parseFoodEntry(text,context);
    const ingredients=(parsed.ingredients||[]).map(x=>{
      const weighted=applyPortionPolicy(x,appConfig);
      return {...weighted,...ingredientCandidates(weighted,weighted.ambiguity)};
    });
    const unresolvedErrors=(parsed.errors||[]).filter(err=>!ingredients.some(ing=>Number(ing.grams)>0&&String(err).toLowerCase().includes(String(ing.name||'').toLowerCase())));
    const mode=parsed.mode==='recipe'?'recipe':ingredients.length>1?'multi':'single';
    return {...parsed,mode,ingredients,errors:unresolvedErrors,yieldOverride:parsed.final_recipe_weight_g||''};
  }
  async function interpretRecipe(){
    if(!recipeText.trim()||mutationLock.current)return;
    stopEntryDictation();
    const token=++recipeRequest.current;
    setRecipeDestination({date:selectedDate,mealId:activeMealId});setRecipeBusy('parse');setRecipeMsg('');setRecipeReview(null);
    try{const review=await interpretText(recipeText,'recipe');if(token!==recipeRequest.current)return;setRecipeReview(review);if(review.errors?.length)setRecipeMsg(review.errors.join(' · '));}
    catch(e){if(token===recipeRequest.current)setRecipeMsg(e.message);}finally{if(token===recipeRequest.current)setRecipeBusy('');}
  }
  async function quickSearchWithAI(){
  const text=quickQuery.trim();
  if(!text||mutationLock.current)return;
  const token=++recipeRequest.current;

  setRecipeBusy('quick-ai');
  setAiMsg('');
  setQuickAiResult(null);

  try{
    const review=await interpretText(text,'search');
    if(token!==recipeRequest.current||liveQuick.current.trim()!==text)return;
    const ingredients=review.ingredients||[];

    if(ingredients.length!==1){
      setAiMsg(
        'La ricerca rapida accetta un alimento alla volta. '+
        'Per liste e ricette usa Voce libera.'
      );
      return;
    }

    const ing=ingredients[0];

    if(ing.ambiguity==='needs_detail'){
      setAiMsg(
        'Descrizione troppo generica: specifica il tipo '+
        'di alimento per ottenere risultati affidabili.'
      );
      return;
    }

    const queries=semanticLookupQueries(ing);
    const byKey=new Map();

    for(const term of queries){
      for(const row of searchMasterIndex(
        term,masterIndex,25
      )){
        const key='m:'+row.id;
        const prev=byKey.get(key);

        if(!prev||row.score>prev.score)
          byKey.set(key,{...row,matchedQuery:term});
      }

      for(const row of searchLocalDataset(
        term,datasets,12
      )){
        const key='l:'+
          (row.localId||row.sourceId||row.id);
        const prev=byKey.get(key);

        if(!prev||row.score>prev.score)
          byKey.set(key,{
            ...row,resultType:'local',
            matchedQuery:term
          });
      }

      for(const row of searchPersonalFoods(
        term,foods,12
      )){
        const key='p:'+row.id;
        const prev=byKey.get(key);

        if(!prev||row.score>prev.score)
          byKey.set(key,{
            ...row,resultType:'personal',
            matchedQuery:term
          });
      }
    }

    const policy=cfgGet(
      appConfig,'searchPolicy.databaseMatchPolicy',{}
    );

    let matches=[...byKey.values()];

    if(policy.requireLexicalEvidence!==false){
      matches=matches.filter(row=>
        candidateSemanticGate(
          ing,row,row.matchedQuery
        )
      );
    }

    matches=matches
      .filter(row=>
        Number(row.score)>=
        Number(policy.minCandidateScore??42)
      )
      .sort((a,b)=>b.score-a.score)
      .slice(0,12);

    setQuickAiResult({
      query:text,
      rows:matches
    });

    setAiMsg(
      matches.length
        ? 'Ricerca AI completata: '+
          matches.length+
          ' corrispondenze. Seleziona il prodotto corretto.'
        : 'Alimento interpretato, ma nessuna '+
          'corrispondenza sufficientemente affidabile.'
    );

  }catch(error){
    if(token===recipeRequest.current&&liveQuick.current.trim()===text)setAiMsg(
      error.message||'Ricerca AI non riuscita.'
    );
  }finally{
    if(token===recipeRequest.current)setRecipeBusy('');
  }
}
  async function searchFoodsWithAI(){
    if(!query.trim())return;setAiBusy('search-ai');setAiMsg('');setSearchError('');
    try{
      const review=await interpretText(query,'search');const ing=review.ingredients?.[0];if(!ing)throw new Error('L’AI non ha individuato un alimento.');
      const queries=semanticLookupQueries(ing);
      const byKey=new Map();
      for(const q of queries){
        for(const r0 of searchMasterIndex(q,masterIndex,30)){const r={...r0,matchedQuery:q},k=`m:${r.id}`,prev=byKey.get(k);if(!prev||r.score>prev.score)byKey.set(k,r);}
        for(const r0 of searchLocalDataset(q,datasets,12)){const r={...r0,resultType:'local',matchedQuery:q},k=`l:${r.localId||r.sourceId||r.id}`,prev=byKey.get(k);if(!prev||r.score>prev.score)byKey.set(k,r);}
      }
      const policy=cfgGet(appConfig,'searchPolicy.databaseMatchPolicy',{});
      let found=[...byKey.values()];
      if(policy.requireLexicalEvidence!==false)found=found.filter(r=>candidateSemanticGate(ing,r,r.matchedQuery));
      found=found.filter(r=>Number(r.score)>=Number(policy.minCandidateScore??42)).sort((a,b)=>b.score-a.score).slice(0,40);
      setResults(found);
      const assumption=ing.portion_assumption;setAiMsg(`Interpretato come “${ing.name}”${assumption?` · ${assumption}`:''}.`);
      if(!found.length)setSearchError('Alimento interpretato, ma nessuna corrispondenza database sufficientemente affidabile.');
    }catch(e){setSearchError(e.message)}finally{setAiBusy('')}
  }
  function updateRecipeIngredient(i,patch){if(!liveReview.current?.ingredients?.[i])return;const rr=structuredClone(liveReview.current);rr.ingredients[i]={...rr.ingredients[i],...patch};setRecipeReview(rr);}
  function rerunRecipeCandidates(i){const ing=recipeReview.ingredients[i],r=ingredientCandidates(ing,'none');updateRecipeIngredient(i,r);setCandidateBrowserIndex(i);}
  async function previewCandidate(c,alias=''){
    if(!c)return;const token=recipeRequest.current;setCandidatePreviewBusy(true);setRecipeMsg('');
    try{
      if(c.resultType==='master'){
        const detail=await loadMasterDetail(c);if(token!==recipeRequest.current)return;if(!detail)throw new Error('Dettaglio Master DB non disponibile.');
        setCandidatePreview(masterToFood(c,detail,masterManifest,alias||c.name));
      }else setCandidatePreview(structuredClone(c));
    }catch(e){if(token===recipeRequest.current)setRecipeMsg(e.message)}finally{if(token===recipeRequest.current)setCandidatePreviewBusy(false)}
  }
  async function estimateRecipeIngredient(i){
    const original=liveReview.current,ing=original?.ingredients?.[i];if(!ing)return;
    const token=++recipeRequest.current;setRecipeBusy('ai-'+i);setRecipeMsg('');
    try{
      const parsed=await parseFoodEntry(ing.name,'search');if(token!==recipeRequest.current||liveReview.current!==original)return;
      const raw=parsed.ingredients?.[0];if(!raw)throw new Error('L’AI non ha reinterpretato l’alimento.');
      const weighted=applyPortionPolicy({...ing,...raw,grams:ing.grams||raw.grams},appConfig),match=ingredientCandidates(weighted,weighted.ambiguity);
      setRecipeReview({...original,ingredients:original.ingredients.map((item,j)=>i===j?{...item,...weighted,...match}:item)});
      if(!match.candidates.length)setRecipeMsg('Nessuna corrispondenza affidabile: prova a precisare il nome.');
    }catch(e){if(token===recipeRequest.current)setRecipeMsg(e.message);}finally{if(token===recipeRequest.current)setRecipeBusy('');}
  }
  
async function commitRecipe(options={}) {
  const saveOnly=options?.saveOnly===true;
  if (!recipeReview||mutationLock.current) return;
  mutationLock.current=true;
  const destination={...(recipeDestination||{date:selectedDate,mealId:activeMealId})};
  setRecipeBusy('commit');
  setRecipeMsg('');

  try {
    const ingredients = recipeReview.ingredients || [];

    if (!ingredients.length) {
      throw new Error('Nessun alimento da registrare.');
    }

    const bad = ingredients.filter(ing =>
      !Number.isFinite(Number(ing.grams)) ||
      Number(ing.grams) <= 0 || Number(ing.grams)>10000 ||
      !ing.selectedKey ||
      ing.ambiguity === 'needs_detail'
    );

    if (bad.length) {
      throw new Error(
        'Completa il peso e seleziona una ' +
        'corrispondenza database affidabile ' +
        'per ogni alimento.'
      );
    }

    const isRecipe = recipeReview.mode === 'recipe';

    const ingredientSum = ingredients.reduce(
      (sum, ing) => sum + Number(ing.grams),
      0
    );

    let factor = 1;
    let consumed = ingredientSum;
    let groupId = null;

    if (isRecipe) {
      const yieldG =
        (String(recipeReview.yieldOverride??'').trim()===''?ingredientSum:DiaryV5.number(recipeReview.yieldOverride));

      consumed = saveOnly?yieldG:Number(recipeReview.consumed_grams);
      if(!DiaryV5.positive(consumed)||!DiaryV5.positive(yieldG))throw new Error('Indica quanti grammi di ricetta hai mangiato (massimo 10.000 g).');

      if (!(yieldG > 0) || !(consumed > 0)) {
        throw new Error(
          'Peso totale o porzione non valido.'
        );
      }

      factor = consumed / yieldG;
      groupId = newId();
    }

    if(!saveOnly){const mealId=await chooseMeal(destination.mealId);if(!mealId)return;destination.mealId=mealId;}
    const created = [];
    const newLogs = [];
    const savedIngredients=[];

    for (const ing of ingredients) {
      let food = null;

      if (ing.selectedKey.startsWith('p:')) {
        const id = ing.selectedKey.slice(2);

        food =
          foods.find(f => f.id === id) ||
          created.find(f => f.id === id);

      } else if (ing.selectedKey.startsWith('m:')) {
        const id = ing.selectedKey.slice(2);

        const row =
          (ing.candidates || []).find(
            candidate => String(candidate.id) === id
          ) ||
          masterIndex.find(
            candidate => String(candidate.id) === id
          );

        food =
          foods.find(
            f => f.masterId != null &&
              String(f.masterId) === id
          ) ||
          created.find(
            f => f.masterId != null &&
              String(f.masterId) === id
          );

        if (!food) {
          if (!row) {
            throw new Error(
              `Corrispondenza Master non trovata: ${ing.name}`
            );
          }

          const detail = await loadMasterDetail(row);

          if (!detail) {
            throw new Error(
              `Dettaglio Master non disponibile: ${ing.name}`
            );
          }

          food = masterToFood(
            row,
            detail,
            masterManifest,
            ing.name
          );

          created.push(food);
        }

      } else {
        throw new Error(
          `Tipo di corrispondenza non valido: ${ing.name}`
        );
      }

      if (!food) {
        throw new Error(
          `Alimento non risolto: ${ing.name}`
        );
      }

      const portionMeta={...(ing.savedMetadata||{})};
      if(ing.portion_assumption)portionMeta.portionAssumption=ing.portion_assumption;
      if(ing.visualPortionSource){Object.assign(portionMeta,{portionOrigin:ing.visualPortionSource,portionEstimatedByAI:ing.visualPortionSource==='ai_visual_estimate',portionConfidence:ing.visualPortionConfidence||'none',portionEstimatedMinGrams:ing.visualPortionMinGrams??null,portionEstimatedMaxGrams:ing.visualPortionMaxGrams??null});}
      else if(ing.portionResolution?.type==='ai_portion'){Object.assign(portionMeta,{portionOrigin:'ai-text-estimate',portionEstimatedByAI:true});}
      else if(ing.portionResolution?.type==='catalog'){Object.assign(portionMeta,{portionOrigin:'catalog-standard',portionEstimatedByAI:false,portionAssumption:ing.portion_assumption||'Porzione standard, non pesata'});}
      if(ing.gramsUserEdited&&!ing.visualPortionSource){delete portionMeta.quantity;delete portionMeta.unit;delete portionMeta.gramsPerUnit;delete portionMeta.portionEstimatedMinGrams;delete portionMeta.portionEstimatedMaxGrams;}
      savedIngredients.push({foodId:food.id,name:ing.name,grams:Number(ing.grams),metadata:portionMeta});
      const grams = Number(ing.grams) * factor;

      if (!DiaryV5.positive(grams)) {
        throw new Error(
          `Peso non valido: ${ing.name}`
        );
      }

      const log = {...portionMeta,id:newId(),createdAt:new Date().toISOString(),...destination,foodId:food.id,grams};
      if(factor!==1){if(Number(log.quantity)>0)log.quantity*=factor;for(const field of ['portionEstimatedMinGrams','portionEstimatedMaxGrams'])if(Number(log[field])>0)log[field]*=factor;}

      if (isRecipe) {
        log.recipeGroupId = groupId;
        log.recipeName =
          recipeReview.recipe_name || 'Ricetta';
        log.recipeIngredient = ing.name;
      }

      if (ing.portion_assumption) {
        log.portionAssumption =
          ing.portion_assumption;
      }


      newLogs.push(log);
    }

    let recipes=null;
    if(isRecipe&&(recipeReview.saveRecipe||saveOnly)){
      const saved={id:recipeReview.recipeId||newId(),name:recipeReview.recipe_name||'Ricetta',yieldGrams:String(recipeReview.yieldOverride??'').trim()===''?ingredientSum:DiaryV5.number(recipeReview.yieldOverride),servings:recipeReview.servings||null,createdAt:new Date().toISOString(),ingredients:savedIngredients};
      recipes=DiaryV5.normalizeRecipes([...liveData.current.recipes.filter(r=>r.id!==saved.id),saved]);
      if(!recipes.some(r=>r.id===saved.id))throw new Error('La ricetta non può essere salvata: controlla ingredienti e peso finale.');
    }
    persistDiaryBatch(created,saveOnly?[]:newLogs,recipes);
    setV5Notice({text:saveOnly?'Ricetta salvata':isRecipe?'Ricetta aggiunta al pasto':newLogs.length+' alimenti aggiunti al pasto',ids:saveOnly?undefined:newLogs.map(l=>l.id)});
    // Only reset after a successful persistent write. Validation failures and
    // cancelled meal choice keep the review available for correction.
    resetTextEntry();setDirectCapture(null);if(!saveOnly)setEntryOpen(false);if(saveOnly)setEntryMode('recipes');

  } catch (error) {
    setRecipeMsg(
      error?.message || 'Salvataggio non riuscito.'
    );

  } finally {
    mutationLock.current=false;
    setRecipeBusy('');
  }
}

  async function downloadMasterOffline(){
    if(!masterManifest||!('caches' in window)){setMasterOfflineMsg('Cache offline non disponibile in questo browser.');return;}
    const count=Number(masterManifest.chunk_count||0),cache=await caches.open('nutrichat-v23-runtime');
    try{
      if(navigator.storage?.persist) navigator.storage.persist().catch(()=>{});
      for(let i=0;i<count;i++){
        setMasterOfflineMsg(`Download Master offline ${i+1}/${count}…`);
        const url=`${MASTER_BASE}/chunks/${String(i).padStart(2,'0')}.json`,r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error(`chunk ${i}`);await cache.put(url,r.clone());
      }
      setMasterOfflineMsg(`Master DB completo disponibile offline · ${count} chunk.`);
    }catch(e){setMasterOfflineMsg(`Download offline incompleto: ${e.message}. Puoi riprovare; i chunk già salvati restano in cache.`);}
  }
  function applyMacroPlan(){ const p=macroPreview; setProfile(x=>({...x,macroPlan:{...x.macroPlan,perKg:{...x.macroPlan.perKg,...p.perKg}}})); setGoals(gs=>gs.map(g=>g.id==='kcal'?{...g,target:p.kcal,targetMode:'absolute'}:['protein','carbs','fat','sugar','fiber'].includes(g.id)?{...g,perKg:p.perKg[g.id],target:p.grams[g.id],targetMode:'perKg'}:g)); }
  function exportData() {
  try {
    const raw = localStorage.getItem('nutritrace_body_weight_v1');
    const bodyWeight = raw === null
      ? { entries: [], target: null }
      : JSON.parse(raw);

    if (!bodyWeight || !Array.isArray(bodyWeight.entries)) {
      throw new Error('Archivio del peso non valido.');
    }

    const backup = {
  version: 7,
  savedRecipes,
  foods,
  logs,
  goals,
  profile,
  bodyWeight,
  meals: window.NutriTraceMealConfig.normalize(meals),
  mealFavorites: window.NutriTraceMealShortcuts.normalize(mealFavorites)
};

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'nutritrace-' + dateKey() + '.json';
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {
    alert('Esportazione non riuscita: ' + error.message);
  }
}

function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      const own = key =>
        Object.prototype.hasOwnProperty.call(data, key);

      if (!data || typeof data !== 'object' ||
          Array.isArray(data)) {
        throw new Error('Formato del backup non valido.');
      }

      if (Number(data.version || 4) > 7) {
        throw new Error(
          'Backup creato con una versione più recente di NutriTrace.'
        );
      }

      const updates = new Map();
      const sections = [];

      for (const [field, storageKey, label] of [
        ['foods', 'nutritrace_foods', 'Alimenti'],
        ['logs', 'nutritrace_logs', 'Registrazioni'],
        ['goals', 'nutritrace_goals_v23', 'Obiettivi']
      ]) {
        if (!own(field)) continue;

        if (!Array.isArray(data[field]) ||
            !data[field].every(x =>
              x && typeof x === 'object' && !Array.isArray(x)
            )) {
          throw new Error(label + ': dati non validi.');
        }

        const normalized = field === 'goals'
          ? mergeGoalCatalog(data[field])
          : data[field];

        updates.set(storageKey, JSON.stringify(normalized));
        sections.push(label + ': ' + data[field].length);
      }

      if (own('profile')) {
        if (!data.profile || typeof data.profile !== 'object' ||
            Array.isArray(data.profile)) {
          throw new Error('Profilo non valido.');
        }

        updates.set(
          'nutritrace_profile_v23',
          JSON.stringify(normalizeProfile(data.profile))
        );
        sections.push('Profilo: presente');
      }

      if(own('savedRecipes')){
        const recipes=DiaryV5.normalizeRecipes(data.savedRecipes);
        if(!Array.isArray(data.savedRecipes)||recipes.length!==data.savedRecipes.length)throw new Error('Ricette non valide nel backup.');
        const foodIds=new Set((own('foods')?data.foods:foods).map(f=>f.id));
        if(recipes.some(r=>r.ingredients.some(i=>!foodIds.has(i.foodId))))throw new Error('Una ricetta usa alimenti assenti dal backup.');
        updates.set('nutritrace_recipes_v5',JSON.stringify(recipes));sections.push('Ricette: '+recipes.length);
      }
      let restoredMeals = null;

      if (own('meals')) {
        if (!Array.isArray(data.meals) ||
            data.meals.length > 20) {
          throw new Error('Configurazione pasti non valida.');
        }

        restoredMeals = window.NutriTraceMealConfig.normalize(
          data.meals
        );

        if (restoredMeals.length !== data.meals.length) {
          throw new Error(
            'Pasti duplicati o non validi nel backup.'
          );
        }

        updates.set(
          'nutritrace_meals_v3',
          JSON.stringify(restoredMeals)
        );

        sections.push('Pasti: ' + restoredMeals.length);
      }

      if (own('mealFavorites')) {
        if (!Array.isArray(data.mealFavorites) ||
            data.mealFavorites.length > 100) {
          throw new Error('Preferiti non validi.');
        }

        const favorites =
          window.NutriTraceMealShortcuts.normalize(
            data.mealFavorites
          );

        if (favorites.length !== data.mealFavorites.length) {
          throw new Error('Preferiti duplicati o non validi.');
        }

        const referenceMeals = restoredMeals || meals;
        const referenceFoods = own('foods') ? data.foods : foods;

        const mealIds = new Set(
          referenceMeals.map(x => x.id)
        );
        const foodIds = new Set(
          referenceFoods.map(x => x.id)
        );

        if (favorites.some(x =>
          !mealIds.has(x.mealId) ||
          !foodIds.has(x.foodId)
        )) {
          throw new Error(
            'Alcuni preferiti fanno riferimento a pasti ' +
            'o alimenti non presenti.'
          );
        }

        updates.set(
          'nutritrace_meal_favorites_v3',
          JSON.stringify(favorites)
        );

        sections.push('Preferiti: ' + favorites.length);
      }

      if (own('bodyWeight')) {
        const weight = data.bodyWeight;

        if (!weight || !Array.isArray(weight.entries)) {
          throw new Error('Diario del peso non valido.');
        }

        if (weight.target !== null &&
            !(typeof weight.target === 'number' &&
              Number.isFinite(weight.target) &&
              weight.target >= 20 &&
              weight.target <= 500)) {
          throw new Error('Obiettivo peso non valido.');
        }

        const ids = new Set();

        for (const entry of weight.entries) {
          const date = entry?.date;

          const validDate =
            typeof date === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            Number.isFinite(Date.parse(date)) &&
            new Date(date + 'T12:00:00Z')
              .toISOString().slice(0, 10) === date;

          if (!validDate ||
              typeof entry.id !== 'string' ||
              !entry.id ||
              ids.has(entry.id) ||
              typeof entry.kg !== 'number' ||
              !Number.isFinite(entry.kg) ||
              entry.kg < 20 || entry.kg > 500 ||
              (entry.time &&
                (typeof entry.time !== 'string' ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))) ||
              (entry.note != null &&
                typeof entry.note !== 'string')) {
            throw new Error(
              'Misurazione del peso non valida.'
            );
          }

          ids.add(entry.id);
        }

        updates.set(
          'nutritrace_body_weight_v1',
          JSON.stringify(weight)
        );

        sections.push(
          'Misurazioni peso: ' + weight.entries.length
        );
      }

      if (!updates.size) {
        throw new Error(
          'Nessuna sezione riconosciuta nel backup.'
        );
      }

      const summary = [
        'RIPRISTINO BACKUP NUTRITRACE',
        '',
        'File: ' + file.name,
        'Versione: ' + (data.version ?? 'precedente'),
        '',
        ...sections,
        '',
        'Le sezioni elencate sostituiranno',
        'quelle presenti sul dispositivo.',
        'Le sezioni assenti saranno conservate.',
        '',
        'Hai conservato una copia dei dati attuali?',
        '',
        'Confermi il ripristino?'
      ].join('\n');

      if (!window.confirm(summary)) return;

      const previous = new Map();

      for (const key of updates.keys()) {
        previous.set(key, localStorage.getItem(key));
      }

      try {
        for (const [key, content] of updates) {
          localStorage.setItem(key, content);
        }
      } catch (error) {
        let rollbackFailed = false;

        for (const [key, content] of previous) {
          try {
            if (content === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, content);
            }
          } catch {
            rollbackFailed = true;
          }
        }

        if (rollbackFailed) {
          throw new Error(
            'Salvataggio fallito e ripristino precedente ' +
            'non completamente riuscito. Conserva il file di backup.'
          );
        }

        throw new Error(
          'Salvataggio fallito. I dati precedenti sono stati ripristinati.'
        );
      }

      window.location.reload();

    } catch (error) {
      alert(
        'Importazione non riuscita: ' + error.message
      );
    }
  };

  reader.onerror = () => {
    alert('Impossibile leggere il file di backup.');
  };

  reader.readAsText(file);
}
  async function importCustomDataset(){ if(!newDatasetName.trim()||!newDatasetFile){ setDatasetMsg('Inserisci un nome e seleziona un file.'); return; } const id=`CUSTOM_${Date.now()}`; SOURCE_META[id]={name:newDatasetName.trim(),version:'importato',mode:'local',official:false,scientific:true}; setDatasetMsg(`Importazione ${newDatasetName.trim()}…`); try{ const buf=await newDatasetFile.arrayBuffer(), lower=newDatasetFile.name.toLowerCase(); let normalized=[]; if(lower.endsWith('.json')||lower.endsWith('.jsonl')) normalized=parseJsonDataset(id,new TextDecoder().decode(buf)); else { const rows=parseSheetRows(buf,'array'); normalized=looksLikeCreaFlat(rows)?normalizeCreaFlat(id,rows):normalizeRows(id,rows); } if(!normalized.length) throw new Error('Formato non riconosciuto o nessun alimento trovato. Sono supportati CSV/XLSX/ODS e JSON/JSONL, incluso il formato CREA esportato.'); await dbSet(id,normalized); setDatasets(d=>({...d,[id]:normalized})); setDatasetMeta(m=>[...m,{id,name:newDatasetName.trim(),fileName:newDatasetFile.name,count:normalized.length,version:'importato'}]); setDatasetMsg(`${newDatasetName.trim()}: ${normalized.length} alimenti disponibili offline.`); setNewDatasetFile(null); }catch(e){ setDatasetMsg(`Errore: ${e.message}`); } }
  async function removeDataset(id){ const m=datasetMeta.find(x=>x.id===id); if(!confirm(`Rimuovere il database “${m?.name||id}” dal dispositivo?`)) return; await dbDel(id); setDatasets(d=>{const x={...d};delete x[id];return x}); setDatasetMeta(x=>x.filter(m=>m.id!==id)); setDatasetMsg('Database rimosso.'); }
  const addNutrient=()=>setFoodDraft({...foodDraft,nutrients:[...(foodDraft.nutrients||[]),emptyNutrient()]});
  function editNutrient(i,patch){ const a=[...foodDraft.nutrients]; a[i]={...a[i],...patch}; setFoodDraft({...foodDraft,nutrients:a}); }

  const dateNavigator=h('div',{className:'dateNavigator'},
    h('button',{className:'ghost navDay',onClick:()=>setSelectedDate(shiftDateKey(selectedDate,-1))},'‹'),
    h('div',{className:'dateCenter'},h('strong',null,dayLabel(selectedDate,deviceToday)),h('small',null,`${shortDate(weekStart)} – ${shortDate(weekEnd)}`)),
    h('input',{type:'date',value:selectedDate,onChange:e=>e.target.value&&setSelectedDate(e.target.value),'aria-label':'Seleziona giorno'}),
    h('button',{className:'ghost navDay',onClick:()=>setSelectedDate(shiftDateKey(selectedDate,1))},'›'),
    selectedDate!==deviceToday?h('button',{className:'ghost todayBtn',onClick:()=>setSelectedDate(deviceToday)},'Oggi'):null
  );


  const mealLabel=meals.find(m=>m.id===activeMealId)?.name||'Alimenti del giorno';
  const recipeReviewView=recipeReview?h(V5.RecipeReview,{allowRecipe:!directCapture&&tab==='oggi',review:recipeReview,onChange:setRecipeReview,busy:recipeBusy,message:recipeMsg,onFind:i=>{const ing=recipeReview.ingredients[i];updateRecipeIngredient(i,ingredientCandidates(ing,'none'));},onAI:estimateRecipeIngredient,onCommit:commitRecipe,onSave:()=>commitRecipe({saveOnly:true})}):null;
  const composer=h('article',{className:'card quickDiary v5-quick-diary'},
    h('div',{className:'v5-composer-heading'},h('div',null,h('div',{className:'v5-meal-destination'},h('strong',null,activeMealId?'Aggiungi a '+mealLabel:'Pasto da scegliere'),activeMealId&&h('button',{type:'button',className:'v5-clear-meal',onClick:clearMealChoice,'aria-label':'Togli selezione del pasto'},'×')),h('h2',null,selectedDate===deviceToday?'Cosa hai mangiato oggi?':'Aggiungi al '+shortDate(selectedDate))),
      h('div',{className:'v5-capture-buttons'},h('button',{className:'v5-icon-button',onClick:()=>openDirectCapture('photo'),'aria-label':'Fotografa il cibo',title:'Foto cibo'},h(window.NutriTraceAurora.Icon,{name:'camera',size:22})),h('button',{className:'v5-icon-button',onClick:()=>openDirectCapture('barcode'),'aria-label':'Scansiona codice a barre',title:'Codice a barre'},h(window.NutriTraceAurora.Icon,{name:'barcode',size:22})))),
    h('div',{className:'v5-segmented v5-entry-tabs',role:'group','aria-label':'Metodo di inserimento'},[['food','Alimento'],['text','Voce / ricetta'],['recipes','Salvate']].map(([id,label])=>h('button',{key:id,'aria-pressed':entryMode===id,onClick:()=>{if(mutationLock.current)return;setEntryMode(id);setAiMsg('');}},label))),
    entryMode==='food'&&h(React.Fragment,null,
      h('div',{className:'quickInputs'},h('label',null,'Cerca un alimento',h(NutriTraceFastFoodInput,{value:quickQuery,onQueryChange:text=>{setQuickQuery(text);setQuickAiResult(null);setQuickSelected(null);setAiMsg('');}})),h('label',null,'Quantità · g',h('input',{'data-v5-grams':true,type:'number',inputMode:'decimal',min:'.1',max:'10000',step:'any',value:grams,placeholder:'Peso',onChange:e=>{setGrams(e.target.value);setAiMsg('');}}))),
      aiMsg&&h('p',{className:'errorText',role:'alert'},aiMsg),
      quickSelected&&h('div',{className:'v5-selected-food'},h('b',null,quickSelected.name),h('button',{className:'cta',disabled:recipeBusy==='quick',onClick:()=>quickAdd(quickSelected)},recipeBusy==='quick'?'Aggiunta…':'Aggiungi al pasto')),
      !quickQuery.trim()&&recentFoods.length>0&&h('span',{className:'v5-recent-label'},'Gli ultimi 3 · con la quantità dell’ultima volta'),
      quickSuggestions.length?h('div',{className:'quickSuggestions '+(quickQuery.trim()?'v5-search-list':'v5-recent-list')},quickSuggestions.map(r=>h('button',{className:'quickChoice',key:r.resultType==='master'?'m:'+r.id:r.id||r.localId,onClick:()=>quickAdd(r),disabled:recipeBusy==='quick'},h('span',null,h('b',null,r.name),quickQuery.trim()&&r.officialName&&r.officialName!==r.name?h('small',null,r.officialName):null,quickQuery.trim()&&r.brand?h('small',null,r.brand):null,h('small',null,r.recentLog?fmt(r.recentLog.grams,2)+' g · ultima porzione':r.resultType==='personal'?'Il tuo archivio · scegli la quantità':'Database · scegli la quantità')),h('strong',{'aria-hidden':'true'},'+')))):quickQuery.trim()?h('p',{className:'v5-note'},'Nessuna corrispondenza. Prova Aiuto AI o inserisci un alimento manuale.'):h('p',{className:'v5-note'},'Cerca un alimento oppure usa foto, barcode e voce.'),
      quickQuery.trim()&&h('div',{className:'v5-action-row'},h('button',{className:'ghost',disabled:Boolean(recipeBusy),onClick:quickSearchWithAI},recipeBusy==='quick-ai'?'Ricerca…':'Aiuto AI'),h('button',{className:'ghost',onClick:()=>{setFoodDraft({...emptyFood(),name:quickQuery.trim(),aliases:[quickQuery.trim()],barcodeDiary:{add:true,grams:'',mealId:activeMealId||'',date:selectedDate,quickHome:true}});setEntryOpen(false);}},'Inserisci manualmente')),
      null),
    entryMode==='text'&&h('div',{className:'v5-text-entry'},h('label',null,'Descrivi il pasto o gli ingredienti',h('textarea',{rows:3,value:recipeText,disabled:mutationLock.current,onChange:e=>{if(mutationLock.current)return;clearRecipeReview();setRecipeText(e.target.value);},placeholder:'Es. 150 g di yogurt e una banana. Oppure: una ricetta con 200 g di farina…'})),
      h('div',{className:'v5-action-row'},h('button',{className:'ghost','aria-pressed':listening,onClick:startDictation},listening?'Ferma dettatura':'Detta a voce'),h('button',{className:'cta',onClick:interpretRecipe,disabled:Boolean(recipeBusy)||!recipeText.trim()},recipeBusy==='parse'?'Interpretazione…':'Interpreta e verifica')),
      h('small',{className:'v5-note'},'Con “Interpreta” il testo viene inviato al servizio AI. La dettatura usa il servizio vocale del browser, se disponibile.'),
      recipeDestination&&recipeReview&&h('p',{className:'v5-note'},'Destinazione: '+shortDate(recipeDestination.date)+' · '+(meals.find(m=>m.id===recipeDestination.mealId)?.name||'Alimenti del giorno')),
      !recipeReview&&recipeMsg&&h('p',{className:'errorText',role:'alert'},recipeMsg),recipeReviewView),
    entryMode==='recipes'&&h(V5.Recipes,{recipes:savedRecipes,foods,onAdd:addSavedRecipe,onNew:()=>{if(mutationLock.current)return;resetTextEntry();setEntryMode('text');},onEdit:editSavedRecipe,onRemove:removeSavedRecipe})
  );

  return h('main',{className:'aurora-app'},
    h(window.NutriTraceAurora.Header,{
      darkMode,
      onToggleTheme:()=>setDarkMode(value=>!value)
    }),
    h(window.NutriTraceAurora.Navigation,{tab,onChange:next=>{setTab(next);window.scrollTo({top:0,behavior:'instant'});}}),
    v5Notice&&h('div',{className:'v5-toast',role:'status'},h('span',null,v5Notice.text),v5Notice.ids&&h('button',{className:'ghost',onClick:()=>{try{persistDiaryChange(foods,logs.filter(l=>!v5Notice.ids.includes(l.id)));setV5Notice(null);}catch(e){setV5Notice({text:e.message});}}},'Annulla'),h('button',{className:'v5-icon-button','aria-label':'Chiudi messaggio',onClick:()=>setV5Notice(null)},'×')),
    tab==='coach'&&h('section',{className:'aurora-coach'},h(window.NutriTraceAurora.PageIntro,{kicker:'INTELLIGENZA ALIMENTARE',title:'Coach AI',description:'Una conversazione intelligente per analizzare e comprendere la tua alimentazione.',icon:'sparkles'}),h(window.NutriTraceAICoach.View,{logs,foods,goals,profile})),
    tab==='oggi'&&h('section',{className:'aurora-today'},
      dateNavigator,
      h(window.NutriTraceAurora.DailyOverview,{
        metrics:[
    ['kcal','Calorie','kcal'],
    ['protein','Proteine','g'],
    ['carbs','Carboidrati','g'],
    ['fat','Grassi','g'],
    ['fiber','Fibre','g']
  ].map(([id,label,unit])=>{
    const g=goals.find(x=>x.id===id);
    return {
      id,label,unit,
      value:totals[id],
      target:effectiveTarget(g||{},profile.weight),
      coverage:dayLogs.length?macroCoverage(dayLogs,foods,id):1,
      kind:g?.kind||'target'
    };
  }),
        hydration:h('div',{className:'v5-hydration-compact'},h(window.NutriTraceHydrationWidget,{key:selectedDate,date:selectedDate})),
        onAdd:()=>openEntry(activeMealId),
        onSearch:()=>setTab('ricerca'),
        onCoach:()=>setTab('coach')
      }),
    h(window.NutriTraceAurora.MealDiaryPanel,{
  meals,
  logs:dayLogs,
  foods,
  favorites:mealFavorites,

  showDayFoods:false,
  onAdd:openEntry,

  onAssign:(logId,mealId)=>{
    const id=meals.some(m=>m.id===mealId)
      ?mealId:null;

    setLogs(previous=>previous.map(log=>
      log.id===logId
        ?{...log,mealId:id}
        :log
    ));
  },

  onRemove:logId=>{
    setLogs(previous=>previous.filter(
      log=>log.id!==logId
    ));
  },

  onAddFavorite:(mealId,logId)=>{
  try {
    const log=dayLogs.find(l=>l.id===logId);

    if(!log){
      throw new Error('Alimento non trovato nel diario.');
    }

    const food=foods.find(f=>f.id===log.foodId);

    if(!food){
      throw new Error('Alimento non presente nell’archivio.');
    }

    const unitInput=window.prompt(
      'Unità del preferito: g, ml oppure pz',
      'g'
    );

    if(unitInput===null)return;

    const unit=unitInput.trim().toLowerCase();

    if(!['g','ml','pz'].includes(unit)){
      throw new Error('Unità non valida. Usa g, ml o pz.');
    }

    const quantityInput=window.prompt(
      'Quantità in '+unit,
      unit==='g'?String(log.grams):''
    );

    if(quantityInput===null)return;

    const quantity=Number(
      quantityInput.trim().replace(',','.')
    );

    if(!Number.isFinite(quantity)||quantity<=0){
      throw new Error('Inserisci una quantità positiva.');
    }

    let gramsPerUnit=1;

    if(unit!=='g'){
      const message=unit==='ml'
        ? 'Quanti grammi pesa 1 ml di questo alimento?'
        : 'Quanti grammi pesa 1 pezzo di questo alimento?';

      const factorInput=window.prompt(message,'');

      if(factorInput===null)return;

      gramsPerUnit=Number(
        factorInput.trim().replace(',','.')
      );

      if(!Number.isFinite(gramsPerUnit)||gramsPerUnit<=0){
        throw new Error(
          'Inserisci un fattore di conversione valido.'
        );
      }
    }

    const grams=Math.round(
      quantity*gramsPerUnit*1000
    )/1000;

    if(grams<=0||grams>10000){
      throw new Error(
        'Il peso convertito deve essere compreso tra 0 e 10000 g.'
      );
    }

    const updated=window.NutriTraceMealShortcuts.addFavorite(
      mealFavorites,
      {
        mealId,
        foodId:log.foodId,
        grams,
        quantity,
        unit,
        gramsPerUnit
      },
      meals,
      foods
    );

    setMealFavorites(updated);

  }catch(error){
    window.alert(error.message);
  }
},

  onRemoveFavorite:favoriteId=>{
    setMealFavorites(previous=>
      window.NutriTraceMealShortcuts.removeFavorite(
        previous,
        favoriteId
      )
    );
  },

  onQuickFavorite:favorite=>{
    try{
      const log=window.NutriTraceMealShortcuts.createFavoriteLog(
        favorite,
        selectedDate,
        meals,
        foods
      );

      setLogs(previous=>[...previous,{...log,createdAt:new Date().toISOString(),quantity:favorite.quantity,unit:favorite.unit,gramsPerUnit:favorite.gramsPerUnit}]);
    }catch(error){
      window.alert(error.message);
    }
  },

  onCopyYesterday:mealId=>{
    try{
      const copied=window.NutriTraceMealShortcuts.copyYesterday(
        logs,
        selectedDate,
        mealId,
        meals,
        foods
      );

      if(!window.confirm(
        `Copia ${copied.length} alimenti dal pasto di ieri?`
      )){
        return;
      }

      setLogs(previous=>[...previous,...copied.map(log=>({...log,createdAt:new Date().toISOString()}))]);
    }catch(error){
      window.alert(error.message);
    }
  },

  onConfigure:()=>{
    const panel=document.getElementById(
      'nutritrace-meal-settings'
    );

    if(panel){
      panel.open=true;
      panel.scrollIntoView({
        behavior:'smooth',
        block:'start'
      });
    }
  }
}),
      !entryOpen&&!directCapture&&composer,
      h(window.NutriTraceMealDiary.DayFoods,{logs:dayLogs,foods,meals,onRemove:logId=>setLogs(previous=>previous.filter(l=>l.id!==logId))}),
      h(V5.WeeklyOverview,{logs:weekLogs,foods,label:shortDate(weekStart)+' – '+shortDate(weekEnd)}),
      h('article',{className:'card v5-micro-home'},h('div',{className:'cardTitle'},h('div',null,h('h2',null,'I tuoi micronutrienti'),h('p',null,'Quantità registrate e scarto dai tuoi obiettivi.')),h('button',{className:'ghost',onClick:()=>setTab('micro')},'Apri Micro')),
        pinnedGoals.length?h('div',{className:'v5-micro-grid'},pinnedGoals.slice(0,3).map(g=>h(V5.MicroCard,{key:g.id,goal:g,weight:profile.weight,stats:DiaryV5.stats(dayLogs,foods,g)}))):h('p',{className:'v5-note'},'Trovi il dettaglio del giorno, le medie e l’andamento in Altro → Micro. Aggiungi una stella ai nutrienti che vuoi vedere qui.')),
                h('details',{
  id:'nutritrace-meal-settings',
  className:'card',
  style:{marginBottom:'16px'}
},
  h('summary',null,'⚙️ Configura i pasti'),

  h('p',{className:'muted tiny'},
    'Aggiungi, rinomina, elimina o riordina i pasti. ' +
    'La configurazione viene salvata automaticamente.'
  ),

  ...meals.map((meal,index)=>
    h('div',{
      key:meal.id,
      style:{
        display:'flex',
        alignItems:'center',
        gap:'8px',
        flexWrap:'wrap',
        marginBottom:'10px'
      }
    },
      h('strong',{
        style:{flex:'1',minWidth:'110px'}
      },meal.name),

      h('button',{
        className:'ghost',
        disabled:index===0,
        onClick:()=>setMeals(current=>
          window.NutriTraceMealConfig.move(
            current,meal.id,-1
          )
        )
      },'↑'),

      h('button',{
        className:'ghost',
        disabled:index===meals.length-1,
        onClick:()=>setMeals(current=>
          window.NutriTraceMealConfig.move(
            current,meal.id,1
          )
        )
      },'↓'),

      h('button',{
        className:'ghost',
        onClick:()=>{
          const name=window.prompt(
            'Nuovo nome del pasto:',
            meal.name
          );
          if(name===null)return;
          if(!name.trim()){
            window.alert('Il nome non può essere vuoto.');
            return;
          }
          setMeals(current=>
            window.NutriTraceMealConfig.rename(
              current,meal.id,name
            )
          );
        }
      },'Rinomina'),

      h('button',{
        className:'ghost danger',
        onClick:()=>{
          if(!window.confirm(
            `Eliminare il pasto "${meal.name}"?`
          ))return;
          setMeals(current=>
            window.NutriTraceMealConfig.remove(
              current,meal.id
            )
          );
        }
      },'Elimina')
    )
  ),

  h('button',{
    className:'cta',
    onClick:()=>{
      const name=window.prompt(
        'Nome del nuovo pasto:'
      );
      if(name===null)return;
      if(!name.trim()){
        window.alert('Inserisci un nome valido.');
        return;
      }
      if(meals.length>=20){
        window.alert('Massimo 20 pasti.');
        return;
      }
      setMeals(current=>
        window.NutriTraceMealConfig.add(
          current,name
        )
      );
    }
  },'+ Aggiungi pasto')
)

    ),

    tab==='micro'&&h(V5.MicroPage,{logs,foods,goals,profile,date:selectedDate,weekStart,weekEnd,dateNavigator,onGoals:()=>setTab('obiettivi'),onSources:()=>{setTab('dati');requestAnimationFrame(()=>document.getElementById('v5-scientific-sources')?.scrollIntoView({behavior:'smooth'}));},onPin:id=>setGoals(gs=>gs.map(g=>g.id===id?{...g,pinned:!g.pinned}:g))}),

    tab==='ricerca'&&h('section',{className:'aurora-search'},
      h(window.NutriTraceAurora.SearchHero,{
        query,
        onQuery:setQuery,
        onSearch:searchFoods,
        onAISearch:searchFoodsWithAI,
        searching,
        aiBusy:aiBusy==='search-ai',
        camera:h(window.NutriTraceFoodCamera,{
          onLabel:importPhotoLabel,
          onDish:importPhotoDish
        }),
        scanner:h(window.NutriTraceBarcodeScanner,{
          onProduct:openBarcodeProduct
        })
      }),
      photoReviewOpen && h('article',{
  className:'card',
  style:{
    marginBottom:'16px',
    border:'2px solid #318bc4'
  }
},

  h('div',{
    style:{
      display:'flex',
      justifyContent:'space-between',
      alignItems:'center',
      gap:'10px'
    }
  },
    h('div',null,
      h('h2',null,'📷 Revisione del piatto'),
      h('p',{className:'muted tiny'},
        'Controlla alimenti, quantità e corrispondenze '+
        'prima di salvare nel diario.'
      )
    ),
    h('button',{
      className:'ghost',
      onClick:()=>{
        setPhotoReviewOpen(false);
        setRecipeReview(null);
        setRecipeMsg('');
      }
    },'Chiudi')
  ),

  recipeReview
    ? h(React.Fragment,null,

        h('h3',null,
          recipeReview.recipe_name || 'Pasto fotografato'
        ),

        ...(recipeReview.ingredients || []).map((ing,i)=>
          h('div',{
            key:i,
            style:{
              padding:'12px',
              marginBottom:'10px',
              border:'1px solid #dce7e8',
              borderRadius:'12px'
            }
          },

            h('label',null,'Alimento',
  h('input',{
    value:ing.name || '',
    onChange:e=>updateRecipeIngredient(i,{
      name:e.target.value,
      selectedKey:'',
      candidates:[],
      ambiguity:'none'
    }),
    onBlur:e=>{
      const name=e.target.value.trim();
      if(!name)return;
      updateRecipeIngredient(i,{
        ...ingredientCandidates({name},'none'),
        name
      });
    }
  })
),

            h('label',null,'Quantità (g)',
              h('input',{
                type:'number',
                min:1,
                step:'any',
                value:ing.grams ?? '',
                onChange:e=>updateRecipeIngredient(i,{
  grams:e.target.value,
  gramsUserEdited:true,
  visualPortionSource:
    'user_confirmed_visual_estimate',
  visualPortionConfidence:'none',
  visualPortionMinGrams:null,
  visualPortionMaxGrams:null,
  portion_assumption:
    'Peso fotografico modificato manualmente ' +
    'durante la revisione. ' +
    'Non costituisce una pesatura verificata.'
})
              })
            ),

            ing.portion_assumption &&
              h('p',{className:'muted tiny'},
                ing.portion_assumption
              ),

            h('label',null,'Alimento nel database',
              h('select',{
                value:ing.selectedKey || '',
                onChange:e=>updateRecipeIngredient(i,{
                  selectedKey:e.target.value,
                  ambiguity:e.target.value
                    ? 'none'
                    : ing.ambiguity
                })
              },
                h('option',{value:''},
                  'Seleziona una corrispondenza'
                ),
                ...(ing.candidates || []).map((c,j)=>
                  h('option',{
                    key:c.candidateKey || j,
                    value:c.candidateKey || ''
                  },
                    `${c.name || 'Alimento'}${
                      Number.isFinite(Number(c.score))
                        ? ` · score ${Math.round(Number(c.score))}`
                        : ''
                    }`
                  )
                )
              )
            ),

            h('button',{
              className:'ghost',
              disabled:recipeBusy === `ai-${i}`,
              onClick:()=>estimateRecipeIngredient(i),
              style:{fontSize:'12px',marginTop:'6px'}
            },
              recipeBusy === `ai-${i}`
                ? 'Ricerca in corso…'
                : 'Cerca altre corrispondenze'
            )
          )
        ),

        recipeReview.mode === 'recipe' &&
          h('div',null,
            h('label',null,'Peso totale della preparazione (g)',
              h('input',{
                type:'number',
                min:1,
                step:'any',
                value:recipeReview.yieldOverride ?? '',
                onChange:e=>setRecipeReview(prev=>({
                  ...prev,
                  yieldOverride:e.target.value
                }))
              })
            ),
            h('label',null,'Quantità consumata (g)',
              h('input',{
                type:'number',
                min:1,
                step:'any',
                value:recipeReview.consumed_grams ?? '',
                onChange:e=>setRecipeReview(prev=>({
                  ...prev,
                  consumed_grams:e.target.value
                }))
              })
            )
          ),

        (recipeReview.errors || []).length > 0 &&
          h('p',{className:'muted tiny'},
            recipeReview.errors.join(' · ')
          ),

        recipeMsg &&
          h('p',{className:'errorText'},recipeMsg),

        h('button',{
          className:'cta',
          disabled:recipeBusy === 'commit',
          onClick:commitRecipe,
          style:{width:'100%',marginTop:'12px'}
        },
          recipeBusy === 'commit'
            ? 'Salvataggio…'
            : 'Conferma e salva nel diario'
        )
      )

    : h('div',null,
        h('p',{className:'statusMsg'},
          recipeMsg || 'Revisione conclusa.'
        ),
        h('button',{
          className:'ghost',
          onClick:()=>{
            setPhotoReviewOpen(false);
            setTab('oggi');
          }
        },'Vai al diario')
      )
),

 h('article',{className:'card aurora-search-panel'},
        h('div',{className:'masterStatusLine'},h('span',{className:`masterBadge ${masterManifest?'ok':'loading'}`},masterStatus),masterManifest&&h('small',null,`${includedMasterSources.length} sorgenti nazionali derivate · ${validationOnlySources.length} solo validazione`)),
        h('div',{className:'aurora-results-heading'},h('h2',null,query.trim()?`Risultati per “${query.trim()}”`:'Esplora il database'),h('span',null,`${results.length} risultati`)),
       
h('div',{className:'inlineActions'},
  h('button',{
    className:'ghost',
    onClick:()=>{
      setFoodDraft({
        ...emptyFood(),
        name:query.trim(),
        aliases:query.trim()?[query.trim()]:[]
      });
    }
  },'Crea manualmente')
),

h('div',{className:'card labelImportCard'},
  h('h3',null,'Crea alimento dagli ingredienti'),

  h('p',{className:'muted tiny'},
    'Non serve la tabella nutrizionale. ' +
    'Le quantità non dichiarate restano sconosciute. ' +
    'I nutrienti AI sono stimati, non misurati.'
  ),

  h('label',null,
    'Nome alimento',
    h('input',{
      value:importName,
      placeholder:'Es. Biscotti integrali al cacao',
      onChange:e=>setImportName(e.target.value)
    })
  ),

  h('label',null,
    'Marca (facoltativa)',
    h('input',{
      value:importBrand,
      onChange:e=>setImportBrand(e.target.value)
    })
  ),

  h('label',null,
    'Ingredienti e percentuali (se presenti)',
    h('textarea',{
      rows:4,
      value:importIngredients,
      placeholder:
        'Es. farina integrale 58%, olio 14%, ' +
        'avena 8%, cacao, sale',
      onChange:e=>setImportIngredients(e.target.value)
    })
  ),

  h('button',{
    className:'cta',
    disabled:
      aiBusy==='draft' ||
      !importName.trim() ||
      !importIngredients.trim(),
    onClick:createFromIngredientList
  },
    aiBusy==='draft'
      ?'Analisi in corso…'
      :'Analizza e completa nutrienti'
  )
),

        datasetMeta.length?h('div',{className:'sourceBadges'},datasetMeta.map(m=>h('span',{className:'online',key:m.id},`${m.name} · ${datasets[m.id]?.length||0}`))):h('p',{className:'muted tiny'},'Nessun database personale aggiuntivo: il Master DB integrato resta disponibile.'),
        searchError&&h('p',{className:'errorText'},searchError),
        results.map(r=>h('div',{className:'searchResult',key:r.resultType==='master'?`m:${r.id}`:(r.localId||r.sourceId||r.id)},h('div',null,h('b',null,r.name),h('small',null,r.resultType==='master'?`NutriTrace Master DB · ${r.sc||1} ${Number(r.sc||1)===1?'fonte':'fonti'} · ${(r.sources||[]).join(', ')}`:`${SOURCE_META[r.source]?.name||'Database locale'}${r.brand?` · ${r.brand}`:''}`)),h('button',{className:'ghost',onClick:()=>openResult(r,query)},r.resultType==='master'?'Apri Master':'Apri / importa'))),
        query.trim()&&!results.length&&h('div',{className:'aiFallback'},h('div',null,h('b',null,'Nessuna corrispondenza affidabile?'),h('p',{className:'muted'},'Usa la Ricerca con AI per reinterpretare il nome. Se il Master non contiene davvero l’alimento, puoi inserirlo manualmente senza inventare valori nutrizionali.')),h('div',{className:'inlineActions'},h('button',{className:'ghost',disabled:aiBusy==='search-ai',onClick:searchFoodsWithAI},ui('search.aiButton','Ricerca con AI')),h('button',{className:'cta',onClick:()=>{setFoodDraft({...emptyFood(),name:query.trim(),aliases:[query.trim()]});setTab('alimenti');}},ui('search.manualButton','Inserisci manualmente')))),
        aiMsg&&h('p',{className:'errorText'},aiMsg)
      )
    ),

    tab==='alimenti'&&h('section',{className:'aurora-alimenti'},
      h(window.NutriTraceAurora.PageIntro,{kicker:'LA TUA RACCOLTA',title:'Archivio alimenti',description:'Tutti i tuoi prodotti e alimenti personalizzati, pronti per il diario.',icon:'food'}),
      h('span',{className:'a-kicker'},'ALIMENTI SALVATI'),
      !foods.length?h('article',{className:'card empty'},'Non hai ancora alimenti.'):h('div',{className:'foodCards'},foods.map(f=>h('article',{className:'card',key:f.id},h('div',{className:'cardTitle'},h('div',null,h('h3',null,f.name),h('p',null,f.brand||f.officialName||'')),h('div',{className:'inlineActions'},h('button',{className:'ghost',onClick:()=>setFoodDraft(structuredClone(f))},'Modifica'),h('button',{className:'ghost danger',onClick:()=>removeFood(f.id)},'Rimuovi'))),h('div',{className:'macroLine'},h('span',null,`${fmtMaybe(f.label?.kcal)} kcal`),h('span',null,`P ${fmtMaybe(f.label?.protein)} g`),h('span',null,`C ${fmtMaybe(f.label?.carbs)} g`),h('span',null,`G ${fmtMaybe(f.label?.fat)} g`)),h('small',{className:'sourceText'},`${f.masterId?'Master DB · ':''}Fonti: ${f.sources?.length?f.sources.map(s=>s?.name||s).join(', '):'manuale'} · N/D non conteggiati come zero`))))
    ),

    tab==='obiettivi'&&h('section',{className:'aurora-goals'},
      h('article',{className:'v5-wizard-launch card'},h('div',null,h('span',{className:'a-kicker'},'UN PERCORSO SU MISURA'),h('h2',null,'Personalizza i miei obiettivi'),h('p',null,'Un passo alla volta, fino a 20 domande. Le risposte restano sul dispositivo e decidi tu se condividerle con il Coach. Gli obiettivi rimangono sempre modificabili.')),h('div',{className:'v5-action-row'},h('button',{className:'cta',onClick:()=>setWizardOpen(true)},profile.wizardV5?'Rivedi il percorso':'Inizia il percorso'),wizardUndo&&h('button',{className:'ghost',onClick:undoWizard},'Ripristina obiettivi precedenti')),profile.wizardV5?.calculation&&h('p',{className:'v5-note v5-wizard-outcome',role:'status'},profile.wizardV5.calculation.eligible?'Ultimo percorso: calcolo applicato · '+fmt(profile.wizardV5.calculation.kcal,0)+' kcal/giorno (modificabile sotto).':'Ultimo percorso: preferenze salvate, obiettivi invariati. '+profile.wizardV5.calculation.reason)),
      h(window.NutriTraceAurora.GoalsHero,{
        metrics:[
    ['kcal','Calorie','kcal'],
    ['protein','Proteine','g'],
    ['carbs','Carboidrati','g'],
    ['fat','Grassi','g'],
    ['fiber','Fibre','g']
  ].map(([id,label,unit])=>{
    const g=goals.find(x=>x.id===id);
    return {
      id,label,unit,
      value:totals[id],
      target:effectiveTarget(g||{},profile.weight),
      coverage:dayLogs.length?macroCoverage(dayLogs,foods,id):1,
      kind:g?.kind||'target'
    };
  }),
        micros:pinnedGoals.map(g=>{const stat=DiaryV5.stats(dayLogs,foods,g);return {
          id:g.id,name:g.name,unit:g.unit,value:stat.sum,
          kind:g.kind,referenceType:g.referenceType,noOfficialTarget:g.noOfficialTarget,referenceNote:g.referenceNote,group:g.group,
          target:goalDailyReference(g,profile.weight),comparisonAvailable:stat.comparisonAvailable,
          coverage:stat.coverage,qualityNote:stat.basisReason||(stat.estimatedCount||stat.limitedQualityCount?'Include stime o dati di qualità limitata':'')
        };})
      }),
      
      h('div',{className:'twoCol goalsTop'},
        h('article',{className:'card'},h('h2',null,'Peso ed energia / macro'),h('p',{className:'muted'},'Proteine, carboidrati, grassi, zuccheri semplici e fibre sono impostabili in g/kg di peso corporeo.'),
          h('div',{className:'macroPlanGrid'},
            h('label',null,'Peso (kg)',h('input',{type:'number',step:'any',value:profile.weight,onChange:e=>setProfile({...profile,weight:e.target.value})})),
           h('button',{
  type:'button',
  className:'ghost',
  onClick:()=>{
    try {
      const stored=JSON.parse(
        localStorage.getItem('nutritrace_body_weight_v1')||'{}'
      );

      const entries=Array.isArray(stored.entries)
        ? stored.entries
        : [];

      const valid=entries.filter(e=>
        e &&
        typeof e.date==='string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
        Number.isFinite(Number(e.kg)) &&
        Number(e.kg)>=20 &&
        Number(e.kg)<=500
      );

      if(!valid.length){
        alert('Nessuna misurazione valida nel diario Peso.');
        return;
      }

      valid.sort((a,b)=>
        (a.date+' '+(a.time||'')).localeCompare(
          b.date+' '+(b.time||'')
        )
      );

      const last=valid[valid.length-1];

      setProfile(prev=>({
        ...prev,
        weight:Number(last.kg)
      }));

      alert(
        'Peso di riferimento aggiornato: '+
        Number(last.kg).toLocaleString('it-IT')+
        ' kg ('+last.date+').'
      );

    }catch(error){
      alert('Impossibile leggere il diario Peso.');
    }
  }
},'Usa ultimo peso registrato'),
            h('label',null,'Gestione calorie',h('select',{value:profile.macroPlan.calorieMode,onChange:e=>setProfile({...profile,macroPlan:{...profile.macroPlan,calorieMode:e.target.value}})},h('option',{value:'fixed'},'Calorie fisse · un macro automatico'),h('option',{value:'derived'},'Calorie automatiche dai macro'))),
            profile.macroPlan.calorieMode==='fixed'&&h('label',null,'Calorie target',h('input',{type:'number',step:'1',value:profile.macroPlan.kcal,onChange:e=>setProfile({...profile,macroPlan:{...profile.macroPlan,kcal:e.target.value}})})),
            profile.macroPlan.calorieMode==='fixed'&&h('label',null,'Macro automatico',h('select',{value:profile.macroPlan.autoMacro,onChange:e=>setProfile({...profile,macroPlan:{...profile.macroPlan,autoMacro:e.target.value}})},h('option',{value:'carbs'},'Carboidrati'),h('option',{value:'protein'},'Proteine'),h('option',{value:'fat'},'Grassi'))),
            ...[['protein','Proteine'],['carbs','Carboidrati'],['fat','Grassi'],['sugar','Zuccheri semplici'],['fiber','Fibre']].map(([k,l])=>h('label',{key:k},`${l} (g/kg)`,h('input',{type:'number',step:'any',disabled:profile.macroPlan.calorieMode==='fixed'&&profile.macroPlan.autoMacro===k,value:profile.macroPlan.calorieMode==='fixed'&&profile.macroPlan.autoMacro===k?Number(Number(macroPreview.perKg[k]).toFixed(2)):(typeof profile.macroPlan.perKg[k]==='number'?Number(profile.macroPlan.perKg[k].toFixed(2)):profile.macroPlan.perKg[k]),onChange:e=>setProfile({...profile,macroPlan:{...profile.macroPlan,perKg:{...profile.macroPlan.perKg,[k]:e.target.value}}})})))
          ),
          h('div',{className:'planPreview'},h('b',null,`${fmt(macroPreview.kcal,0)} kcal`),h('span',null,`P ${fmt(macroPreview.grams.protein)} g · C ${fmt(macroPreview.grams.carbs)} g · G ${fmt(macroPreview.grams.fat)} g · zuccheri ${fmt(macroPreview.grams.sugar)} g · fibre ${fmt(macroPreview.grams.fiber)} g`)),
          profile.macroPlan.calorieMode==='fixed'&&macroPreview.derivedKcal>macroPreview.kcal+1&&h('p',{className:'errorText tiny'},`Combinazione impossibile: i macro fissati richiedono già ${fmt(macroPreview.derivedKcal,0)} kcal, oltre il target di ${fmt(macroPreview.kcal,0)} kcal.`),
          macroPreview.grams.sugar>macroPreview.grams.carbs&&h('p',{className:'errorText tiny'},'Zuccheri semplici non possono superare i carboidrati totali: correggi il target g/kg.'),
          h('p',{className:'muted tiny'},'Nota tecnica: zuccheri semplici sono una sottoquota dei carboidrati e le fibre non vengono usate come “residuo calorico”. Il solver automatico agisce solo su proteine/carboidrati/grassi; se scegli tutti e tre, imposta “Calorie automatiche”.'),
          h('button',{className:'cta',onClick:applyMacroPlan},'Applica ai target')
        ),
        h('article',{className:'card'},h('h2',null,'Stato settimana selezionata'),h('p',{className:'muted'},`${shortDate(weekStart)} – ${shortDate(weekEnd)}`),goals.filter(g=>g.period==='week'&&effectiveTarget(g,profile.weight)>0).slice(0,10).map(g=>h('div',{key:g.id,className:'goalStatus'},h('span',null,g.name),h(Progress,{value:valueForGoal(g,weekTotals),goal:effectiveTarget(g,profile.weight),unit:g.unit,kind:g.kind}))),!goals.some(g=>g.period==='week'&&effectiveTarget(g,profile.weight)>0)&&h('p',{className:'empty'},'Nessun target settimanale attivo.'))
      ),
      h('article',{className:'card'},h('div',{className:'cardTitle'},h('div',null,h('h2',null,'Micronutrienti e componenti'),h('p',null,'Target assoluto oppure per kg di peso; raggruppati per rendere l’elenco gestibile.')),h('button',{className:'ghost',onClick:()=>setGoals([...goals,{id:newId(),name:'Nuovo nutriente',form:'*',unit:'mg',target:0,perKg:0,targetMode:'absolute',period:'day',kind:'minimum',group:'Personalizzati'}])},'+ Nutriente')),
        [...new Set(goals.filter(g=>g.group!=='Energia e macro').map(g=>g.group||'Personalizzati'))].map(group=>h('details',{className:'goalGroup',key:group,open:group==='Vitamine'||group==='Minerali e oligoelementi'},h('summary',null,h('b',null,group),h('span',null,`${goals.filter(g=>(g.group||'Personalizzati')===group).length} voci`)),h('div',{className:'goalRows'},goals.map((g,i)=>(g.group||'Personalizzati')===group?h(GoalRow,{key:g.id,g,index:i,goals,setGoals,weight:profile.weight,current:valueForGoal(g,g.period==='week'?weekTotals:totals)}):null))))
      )
    ),
tab==='peso'&&h('section',{className:'aurora-peso'},
      h(window.NutriTraceAurora.PageIntro,{kicker:'IL TUO BENESSERE',title:'Peso e composizione',description:'Misurazioni, progressi e grafici salvati nel tuo diario.',icon:'scale'}),
  h(window.NutriTraceBodyWeight),
  h(window.NutriTraceWeightCalorieChart,{
    logs,
    foods
  })
),
    tab==='analisi'&&h('section',{className:'aurora-analysis'},
      h(window.NutriTraceAurora.AnalysisHero,{
        average:reportAvg.kcal,
        previous:previousAvg.kcal,
        days:reportTrackedDays,
        formatPeriod:{day:'GIORNO',week:'SETTIMANA',month:'MESE',year:'ANNO',custom:'INTERVALLO'}[reportMode]
      }),
      
      h('p',{className:'a-analysis-sub'},'Report basati sul diario. N/D non viene trattato come zero.'),
      h('article',{className:'card reportControls'},
        h('div',{className:'reportModeButtons'},...['day','week','month','year','custom'].map(mode=>h('button',{className:reportMode===mode?'cta':'ghost',key:mode,onClick:()=>setReportMode(mode)},({day:'Giorno',week:'Settimana',month:'Mese',year:'Anno',custom:'Intervallo'}[mode])))),
        reportMode==='custom'?h('div',{className:'reportCustomRange'},h('label',null,'Dal',h('input',{type:'date',value:reportFrom,onChange:e=>setReportFrom(e.target.value)})),h('label',null,'Al',h('input',{type:'date',value:reportTo,onChange:e=>setReportTo(e.target.value)}))):h('label',{className:'reportAnchor'},'Periodo di riferimento',h('input',{type:'date',value:reportAnchor,onChange:e=>setReportAnchor(e.target.value)})),
        h('div',{className:'reportRangeLabel'},h('b',null,`${dayLabel(reportRange[0],deviceToday)}${reportRange[0]!==reportRange[1]?` → ${dayLabel(reportRange[1],deviceToday)}`:''}`),h('small',null,`${reportTrackedDays} giorni registrati su ${daysInclusive(reportRange[0],reportRange[1])}`))
      ),
  h(window.NutriTraceMealAnalyticsDashboard,{
  logs,
  foods,
  meals,
  goals,
  profile,
  from:reportRange[0],
  to:reportRange[1]
}),
                       h('div',{className:'reportMetricGrid'},
        [['kcal','kcal/die'],['protein','g proteine/die'],['carbs','g carboidrati/die'],['fat','g grassi/die'],['fiber','g fibre/die']].map(([k,label])=>h('article',{className:'metric',key:k},h('span',null,label),h('div',{className:'reportMetricValue'},h('strong',null,fmtMaybe(reportAvg[k],2))),h('small',null,previousTrackedDays?`Periodo precedente: ${fmtMaybe(previousAvg[k],2)}${previousAvg[k]?` · ${reportAvg[k]>=previousAvg[k]?'+':''}${fmt((reportAvg[k]-previousAvg[k])/previousAvg[k]*100,0)}%`:''}`:'Nessun confronto precedente')))
      ),
      h('div',{className:'twoCol reportColumns'},
        h('article',{className:'card'},h('h2',null,'Micronutrienti'),h('p',{className:'muted'},'Quantità, barre di avanzamento, medie e copertura sono raccolte nella sezione Micro.'),h('button',{className:'cta',onClick:()=>setTab('micro')},'Apri Micro')),
        h('article',{className:'card reportHistory'},h('h2',null,'Cronologia'),h('p',{className:'muted'},'Apri qualsiasi periodo passato: il report viene ricalcolato dai dati reali del diario.'),
          h('details',{open:true},h('summary',null,`Settimane · ${reportHistory.weeks.length}`),h('div',{className:'historyList'},...reportHistory.weeks.map(x=>h('button',{className:'historyRow',key:x.from,onClick:()=>{setReportMode('week');setReportAnchor(x.from);}},h('span',null,`${shortDate(x.from)} – ${shortDate(x.to)}`),h('small',null,`${x.trackedDays}/7 giorni · ${x.count} registrazioni`))))),
          h('details',null,h('summary',null,`Mesi · ${reportHistory.months.length}`),h('div',{className:'historyList'},...reportHistory.months.map(x=>h('button',{className:'historyRow',key:x.from,onClick:()=>{setReportMode('month');setReportAnchor(x.from);}},h('span',null,parseDateKey(x.from).toLocaleDateString('it-IT',{month:'long',year:'numeric'})),h('small',null,`${x.trackedDays} giorni · ${x.count} registrazioni`))))),
          h('details',null,h('summary',null,`Anni · ${reportHistory.years.length}`),h('div',{className:'historyList'},...reportHistory.years.map(x=>h('button',{className:'historyRow',key:x.from,onClick:()=>{setReportMode('year');setReportAnchor(x.from);}},h('span',null,x.from.slice(0,4)),h('small',null,`${x.trackedDays} giorni · ${x.count} registrazioni`)))))
        )
      )
    ),

    tab==='dati'&&h('section',{className:'aurora-dati'},
      h('div',{id:'v5-scientific-sources'},h(window.NutriTraceNutritionReferences.SourcesView,{profile,goals})),
      h(window.NutriTraceAurora.PageIntro,{kicker:'QUALITÀ DEI DATI',title:'Dati e database',description:'Fonti scientifiche, archivi personali e backup, tutti sotto il tuo controllo.',icon:'grid'}),
      h('article',{className:'card masterCard'},
        h('div',{className:'cardTitle'},h('div',null,h('span',{className:'eyebrow'},'DATABASE INTEGRATO'),h('h2',null,`NutriTrace Runtime DB ${masterManifest?.runtime_version||'v1'}`),h('p',null,'Fonte primaria dell’app: valori normalizzati per 100 g, provenance conservata, fusioni conservative e N/D espliciti.')),h('span',{className:`masterBadge ${masterManifest?'ok':'loading'}`},masterStatus)),
        masterManifest&&h('div',{className:'masterStats'},
          h('div',null,h('small',null,'Alimenti canonici'),h('strong',null,Number(masterManifest.food_count||0).toLocaleString('it-IT'))),
          h('div',null,h('small',null,'Valori numerici'),h('strong',null,Number(masterManifest.numeric_values||0).toLocaleString('it-IT'))),
          h('div',null,h('small',null,'Alimenti multi-fonte'),h('strong',null,Number(masterManifest.multisource_foods||0).toLocaleString('it-IT'))),
          h('div',null,h('small',null,'N/D espliciti'),h('strong',null,Number(masterManifest.explicit_nd_values||0).toLocaleString('it-IT')))
        ),
        h('div',{className:'inlineActions'},h('button',{className:'cta',onClick:downloadMasterOffline,disabled:!masterManifest},'Scarica Master completo offline'),masterOfflineMsg&&h('small',{className:masterOfflineMsg.startsWith('Download offline incompleto')?'errorText':'muted'},masterOfflineMsg)),
        h('p',{className:'muted tiny'},`Runtime derivato dal Master POST-AUDIT (${masterManifest?.source_master?.audit_test_suite||'audit completato'}). Grade A/B usati normalmente; C ammesso nelle carenze solo con copertura dati ≥65%; D resta informativo ma viene escluso dalla classifica. N/D non è mai zero. Il pulsante sopra forza il caching locale di tutti i chunk.`),
        masterManifest&&h('div',{className:'sourceGroups'},
          h('details',{open:true},h('summary',null,h('b',null,`Sorgenti incluse · ${includedMasterSources.length}`)),h('div',{className:'sourcePills'},includedMasterSources.map(x=>h('span',{key:x.code,title:x.licence_note||''},`${x.country} · ${x.version||'versione n/d'}`)))),
          validationOnlySources.length?h('details',null,h('summary',null,h('b',null,'Solo validazione / non fuse')),h('div',{className:'sourcePills'},validationOnlySources.map(x=>h('span',{key:x.code,title:x.licence_note||''},`${x.country} · ${x.name}`)))):null,
          missingMasterSources.length?h('details',null,h('summary',null,h('b',null,'Sorgenti predisposte da integrare')),h('div',{className:'sourcePills'},missingMasterSources.map(x=>h('span',{key:x.code},`${x.country} · file non presente in v1`)))):null
        ),
        h('div',{className:'qualityNotice'},h('b',null,'Policy qualità: '),'assenza = N/D; uno zero a bassa affidabilità proveniente da una sola fonte non viene mostrato come assenza biologica certa; nessun valore AI è incorporato nel Master.')
      ),
      h('div',{className:'twoCol'},
        h('article',{className:'card'},h('h2',null,'Database personali aggiuntivi'),!datasetMeta.length?h('p',{className:'empty'},'Nessun database aggiuntivo installato. Il Master integrato rimane sempre disponibile.'):h('div',{className:'localDbList'},datasetMeta.map(m=>h('div',{className:'localDbRow',key:m.id},h('div',null,h('b',null,m.name),h('small',null,`${datasets[m.id]?.length||m.count||0} alimenti · ${m.fileName||'file locale'}`)),h('button',{className:'ghost danger',onClick:()=>removeDataset(m.id)},'Rimuovi'))))),
        h('article',{className:'card'},h('h2',null,'Backup diario'),h('button',{className:'cta',onClick:exportData},'Esporta JSON'),h('label',{className:'importLabel'},'Importa backup',h('input',{type:'file',accept:'application/json',onChange:importBackup})),h('p',{className:'muted tiny'},'Il Master DB è distribuito con l’app e non viene duplicato nel backup. I database personali voluminosi restano in IndexedDB.'))
      ),
      h('article',{className:'card addDbCard'},h('div',{className:'cardTitle'},h('div',null,h('h2',null,'Aggiungi un tuo database'),h('p',null,'Nome libero e possibilità di rimozione. Il database viene aggiunto come fonte complementare, non sostituisce automaticamente il Master.'))),h('div',{className:'addDbGrid'},h('label',null,'Nome database',h('input',{value:newDatasetName,onChange:e=>setNewDatasetName(e.target.value),placeholder:'es. CREA Italia'})),h('label',null,'File',h('input',{type:'file',accept:'.csv,.xlsx,.xls,.ods,.json,.jsonl',onChange:e=>setNewDatasetFile(e.target.files?.[0]||null)})),h('button',{className:'cta',onClick:importCustomDataset,disabled:!newDatasetFile},'+ Aggiungi')),datasetMsg&&h('p',{className:'statusMsg'},datasetMsg),h('p',{className:'muted tiny'},'Per import CREA: macro a zero restano validi; gli zero nei campi di dettaglio/micronutrienti sono trattati conservativamente come N/D quando non è possibile distinguerli da “non disponibile”. Percentuali di acidi grassi e aminoacidi vengono convertite sulla quantità reale di lipidi/proteine.')),
      h('article',{className:'card notice'},h('h3',null,'Ruolo dell’AI dopo il Master DB'),h('p',null,'OpenRouter serve soprattutto a interpretare testo libero, ricette e ambiguità. La stima numerica AI è l’ultima risorsa: non sovrascrive dati strutturati, non usa 0 per “sconosciuto”, impone unità lato codice e rifiuta stime a bassa confidenza o nutrienti ad alto rischio. OPENROUTER_API_KEY resta esclusivamente nella Vercel Function.'))
    ),


    entryOpen&&h(V5.Dialog,{title:'Aggiungi a '+mealLabel,subtitle:shortDate(selectedDate),onClose:closeEntry},composer),
    directCapture&&h(V5.Dialog,{title:directCapture.product?'Conferma la porzione':directCapture.review?'Controlla il pasto':directCapture.mode==='photo'?'Foto del cibo':'Codice a barre',subtitle:shortDate(directCapture.context.date)+' · '+(meals.find(m=>m.id===directCapture.context.mealId)?.name||'Alimenti del giorno'),onClose:closeDirectCapture},
      directCapture.product?h(V5.ProductReview,{key:directCapture.product.barcode||directCapture.product.name,product:directCapture.product,foods,mealLabel:meals.find(m=>m.id===directCapture.context.mealId)?.name||'Alimenti del giorno',dateLabel:shortDate(directCapture.context.date),onBack:()=>setDirectCapture(prev=>({...prev,product:null})),onConfirm:commitCapturedProduct}):
      directCapture.review?recipeReviewView:
      directCapture.mode==='photo'?h(window.NutriTraceFoodCamera,{onLabel:captureLabel,onDish:captureDish,confirmLabel:'Controlla la porzione'}):h(window.NutriTraceBarcodeScanner,{onProduct:product=>setDirectCapture(prev=>prev?{...prev,product}:prev)})),
    mealPicker&&h(V5.MealPicker,{meals,onChoose:finishMealChoice,onClose:()=>finishMealChoice(null)}),
    wizardOpen&&h(window.NutriTraceGoalsWizard.View,{profile,goals,onApply:applyWizardResult,onClose:()=>setWizardOpen(false)}),

    candidatePreview&&h(CandidatePreviewModal,{food:candidatePreview,onClose:()=>setCandidatePreview(null)}),

    foodDraft&&h('div',{className:'modalBackdrop'},h('div',{className:'modal'},
      h('div',{className:'modalHead'},h('div',null,h('span',{className:'eyebrow'},'SCHEDA ALIMENTO'),h('h2',null,foodDraft.name||'Nuovo alimento')),h('button',{className:'close',onClick:()=>setFoodDraft(null)},'×')),
      foodDraft.mergeMeta?.mode==='review'&&h('div',{className:'mergeWarning'},h('b',null,'Possibile corrispondenza con un alimento già presente. '),'Controlla i dati prima di salvare.'),
      h('div',{className:'formGrid'},h('label',null,'Nome rapido',h('input',{value:foodDraft.name,onChange:e=>setFoodDraft({...foodDraft,name:e.target.value})})),h('label',null,'Marca (opzionale)',h('input',{value:foodDraft.brand||'',onChange:e=>setFoodDraft({...foodDraft,brand:e.target.value})})),h('label',null,'Valori riferiti a (g)',h('input',{type:'number',value:foodDraft.servingGrams,onChange:e=>setFoodDraft({...foodDraft,servingGrams:e.target.value})}))),
      foodDraft.officialName&&foodDraft.officialName!==foodDraft.name&&h('p',{className:'officialName'},h('b',null,'Voce ufficiale: '),foodDraft.officialName),
      h('label',null,'Alias di ricerca (separati da virgola)',h('input',{value:(foodDraft.aliases||[]).join(', '),onChange:e=>setFoodDraft({...foodDraft,aliases:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})})),
      h('div',{className:'cardTitle aiTitle'},h('h3',null,'Etichetta / macro'),h('button',{className:'ghost',disabled:aiBusy==='draft',onClick:()=>enrichDraft()},aiBusy==='draft'?'Completamento…':'Completa tutti i nutrienti mancanti')),
      aiMsg&&h('p',{className:'errorText'},aiMsg),
      h('div',{className:'formGrid'},Object.entries(MACROS).map(([k,l])=>h('label',{key:k},l,h('input',{type:'number',step:'any',value:foodDraft.label?.[k]??'',onChange:e=>setFoodDraft({...foodDraft,label:{...foodDraft.label,[k]:e.target.value}})})))),
      
h('details', { className: 'ndPanel' },
  h('summary', null,
    `Catalogo micronutrienti (${draftCatalogRows.length})`
  ),

  h('p', { className: 'muted tiny' },
    'Tutti i micronutrienti disponibili nel catalogo. ' +
    'N/D significa dato non disponibile, non zero. ' +
    'I valori manuali vengono conservati durante il completamento AI.'
  ),

  [...new Set(draftCatalogRows.map(row => row.group))]
    .map(group =>
      h('details', { key: group },
        h('summary', null, group),

        h('div', { className: 'ndList' },
          draftCatalogRows
            .filter(row => row.group === group)
            .map(row =>
              h('div', {
                className: 'ndItem',
                key: row.name
              },

                h('span', null,
                  h('b', null, row.name),
                  h('small', null,
                    row.nutrient
                      ? (row.nutrient.source || 'Valore presente')
                      : (row.status.reason || 'N/D')
                  )
                ),

                h('input', {
                  type: 'number',
                  step: 'any',
                  min: 0,
                  placeholder: 'N/D',
                  style: { width: '110px' },
                  value: row.nutrient?.amount ?? '',
                  onChange: e => editCatalogNutrient(
                    row.name,
                    row.nutrient?.unit || row.unit,
                    e.target.value
                  )
                }),

                h('small', null,
                  row.nutrient?.unit || row.unit
                )
              )
            )
        )
      )    )
),
h('h3',null,'Ingredienti completi'),
h('label',null,'Lista come in etichetta',h('textarea',{rows:4,value:foodDraft.ingredients||'',onChange:e=>setFoodDraft({...foodDraft,ingredients:e.target.value})})),
      parseAdditives(foodDraft.ingredients).length>0&&h('div',{className:'chips'},parseAdditives(foodDraft.ingredients).map(a=>h('span',{key:a},a))),
      h('div',{className:'cardTitle'},h('div',null,h('h3',null,'Nutrienti specifici / forme'),h('p',null,'Quantità riferite alla base indicata sopra.')),h('button',{className:'ghost',onClick:addNutrient},'+ Aggiungi')),
      (foodDraft.nutrients||[]).map((n,i)=>h('div',{className:'nutrientAdvanced',key:n.id},h('div',{className:'nutrientMain'},h('input',{placeholder:'Magnesio / EPA / Leucina',value:n.name,onChange:e=>editNutrient(i,{name:e.target.value})}),h('input',{placeholder:'forma / nota',value:n.form||'',onChange:e=>editNutrient(i,{form:e.target.value})}),h('input',{type:'number',step:'any',placeholder:'quantità',value:n.amount,onChange:e=>editNutrient(i,{amount:e.target.value})}),h('select',{value:n.unit,onChange:e=>editNutrient(i,{unit:e.target.value})},h('option',null,'mg'),h('option',null,'µg'),h('option',null,'g')),h('button',{className:'ghost danger',onClick:()=>setFoodDraft({...foodDraft,nutrients:foodDraft.nutrients.filter(x=>x.id!==n.id)})},'×')),h('div',{className:'bioEdit'},h('label',null,'Quantità elementare (opz.)',h('input',{type:'number',step:'any',value:n.elementalAmount??'',onChange:e=>editNutrient(i,{elementalAmount:e.target.value})})),h('label',null,'Assorbimento minimo %',h('input',{type:'number',min:0,max:100,step:'any',value:n.bio?.min??'',onChange:e=>editNutrient(i,{bio:{...(n.bio||{}),mode:'range',min:e.target.value}})})),h('label',null,'Assorbimento massimo %',h('input',{type:'number',min:0,max:100,step:'any',value:n.bio?.max??'',onChange:e=>editNutrient(i,{bio:{...(n.bio||{}),mode:'range',max:e.target.value}})})),h('label',null,'Fonte stima',h('input',{value:n.bio?.source??'',onChange:e=>editNutrient(i,{bio:{...(n.bio||{}),source:e.target.value}})})),h('label',null,'Fonte composizione',h('input',{value:n.source||'',onChange:e=>editNutrient(i,{source:e.target.value})}))))),
      h('div',{className:'cardTitle'},h('h3',null,'Fonti'),h('button',{className:'ghost',onClick:()=>setFoodDraft({...foodDraft,sources:[...(foodDraft.sources||[]),{id:newId(),name:'',reference:'',quality:'primaria'}]})},'+ Fonte')),
      (foodDraft.sources||[]).map((s,i)=>h('div',{className:'sourceEdit',key:s?.id||i},h('input',{value:s?.name||'',placeholder:'Fonte',onChange:e=>{const x=[...foodDraft.sources];x[i]={...s,name:e.target.value};setFoodDraft({...foodDraft,sources:x})}}),h('input',{value:s?.reference||'',placeholder:'Riferimento',onChange:e=>{const x=[...foodDraft.sources];x[i]={...s,reference:e.target.value};setFoodDraft({...foodDraft,sources:x})}}),h('select',{value:s?.quality||'primaria',onChange:e=>{const x=[...foodDraft.sources];x[i]={...s,quality:e.target.value};setFoodDraft({...foodDraft,sources:x})}},h('option',{value:'primaria'},'Primaria'),h('option',{value:'secondaria'},'Secondaria'),h('option',{value:'stimata'},'Stimata')),h('button',{className:'ghost danger',onClick:()=>setFoodDraft({...foodDraft,sources:foodDraft.sources.filter((_,j)=>j!==i)})},'×'))),
      h('label',null,'Note',h('textarea',{rows:3,value:foodDraft.notes||'',onChange:e=>setFoodDraft({...foodDraft,notes:e.target.value})})),
      foodDraft.barcodeDiary && h('div', {
  className: 'card',
  style: { marginTop: '12px' }
},

  h('label', {
    style: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8px'
    }
  },

    h('input', {
      type: 'checkbox',
      style: { width: 'auto' },
      checked: foodDraft.barcodeDiary.add,
      onChange: e => setFoodDraft(prev => ({
        ...prev,
        barcodeDiary: {
          ...prev.barcodeDiary,
          add: e.target.checked
        }
      }))
    }),

    'Aggiungi anche al diario (' + selectedDate + ')'
  ),

  foodDraft.barcodeDiary.add && h('div', {
    className: 'formGrid'
  },

    h('label', null,
      'Quantità (g)',

      h('input', {
        type: 'number',
        min: '0.01',
        max: '10000',
        step: 'any',
        value: foodDraft.barcodeDiary.grams,
        onChange: e => setFoodDraft(prev => ({
          ...prev,
          barcodeDiary: {
            ...prev.barcodeDiary,
            grams: e.target.value
          }
        }))
      })
    ),

    h('label', null,
      'Pasto',

      h('select', {
        value: foodDraft.barcodeDiary.mealId,
        onChange: e => setFoodDraft(prev => ({
          ...prev,
          barcodeDiary: {
            ...prev.barcodeDiary,
            mealId: e.target.value
          }
        }))
      },

        h('option', {
          value: ''
        }, 'Senza pasto'),

        ...meals.map(meal =>
          h('option', {
            key: meal.id,
            value: meal.id
          }, meal.name)
        )
      )
    )
  )
),
                                                     h('div',{className:'modalActions'},h('button',{className:'ghost',onClick:()=>setFoodDraft(null)},'Annulla'),h('button',{className:'cta',onClick:saveFood},'Salva alimento'))
    ))
  );
}
const root=ReactDOM.createRoot(document.getElementById('root'));
root.render(h(Home));
