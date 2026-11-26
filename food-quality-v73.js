/* NutriTrace V7.3 — local food quality, provenance and calendar history.
 * SPF updated algorithm 2023, FAQ v11 (17 March 2025). This module contains no network calls.
 * A meal/period average and the 1–100 index are NutriTrace descriptors, not an official Nutri-Score.
 */
(function(root){
'use strict';
const Q=root.NutriTraceIntelligence||(typeof require==='function'?require('./nutrition-intelligence-v61.js'):null);
const SOURCE='https://www.santepubliquefrance.fr/sites/default/files/rdd/document/FAQ-updatedAlgo-V11.pdf';
const GRADES=['A','B','C','D','E'];
const CATEGORIES=['general','cheese','red-meat','fats-nuts-seeds','beverage'];
const LABELS={kcal:'energia',sugar:'zuccheri',saturatedFat:'grassi saturi',salt:'sale',protein:'proteine',fiber:'fibre',fat:'grassi totali',category:'categoria verificata',fvlPercent:'quota frutta, verdura e legumi',energyKj100:'energia kJ',basis:'base per 100 ml o densità',nonNutritiveSweeteners:'presenza/assenza di edulcoranti'};
const num=v=>{const n=typeof v==='number'?v:typeof v==='string'&&/^[-+]?\d+(?:[.,]\d+)?$/.test(v.trim())?Number(v.trim().replace(',','.')):NaN;return Number.isFinite(n)?n:null;};
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]+/g,' ').replace(/[^a-z0-9% ]/g,' ').replace(/\s+/g,' ').trim();
const validGrade=g=>typeof g==='string'&&/^[a-e]$/i.test(g)?g.toUpperCase():null;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const badKey=k=>['__proto__','constructor','prototype'].includes(k);
const clone=x=>JSON.parse(JSON.stringify(x));
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const shift=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const tagSet=food=>new Set([...(food?.qualityV61?.categories||[]),...(food?.qualityV73?.categories||[]),...(food?.categories||[])].filter(x=>typeof x==='string').map(x=>x.toLowerCase()));
const estimatedField=p=>p?.estimated===true||p?.aiEstimate===true||['ai','ai-estimate','estimated','inferred-ai'].includes(String(p?.method||p?.status||'').toLowerCase())||/\bai\b.{0,12}\bstima\b|\bai[_ -]?estimate\b/i.test(String(p?.source||'')+' '+String(p?.reliability||''));
const unavailableField=p=>['nd','trace','trace_only','present_unknown','quarantined','quarantined_audit','conflict','conflict_dispersion','conflict_positive_vs_zero','runtime_stage5_quarantine'].includes(String(p?.status||'').toLowerCase())||p?.quarantined===true;
const foodName=f=>norm(f?.officialName||f?.name);
const unsupported=food=>{
 const tags=tagSet(food),n=foodName(food),category=norm(food?.masterCategory||food?.qualityV73?.sourceCategory);
 if(food?.qualityV73?.excluded===true||['en:food-supplements','en:baby-foods','en:infant-formulas','en:foods-for-special-medical-purposes','en:meal-replacements','en:sports-nutrition'].some(t=>tags.has(t)))return true;
 return /\b(?:babyfoods?|infant|medical foods?|food supplements?|sports nutrition)\b/.test(category)||/\b(?:integratore|integratori|supplement|supplements|babyfoods?|infant formula|latte per lattanti|formula infantile|alimenti a fini medici|meal replacement|sostitutivo del pasto|sport nutrition|nutrizione sportiva)\b/.test(n)||(num(food?.qualityV73?.alcoholPercent)>1.2)||(/\b(?:birra|beer|vino|wine|whisky|vodka|rum|liquore)\b/.test(n)&&num(food?.qualityV73?.alcoholPercent)===null);
};
// Restricted identity rules. They apply to basic foods, never arbitrary composite ingredient lists.
// A brand name or a flavoured/prepared product without explicit taxonomy does not get a fabricated FVL %.
const SIMPLE_RULES=[
 ['beverage',0,/^(?:acqua(?: minerale| naturale| frizzante| di sorgente| potabile)?|(?:mineral |spring |table |tap |bottled )?water)$/,{water:true}],
 ['fats-nuts-seeds',100,/^(?:olio (?:extra ?vergine )?(?:di |d )?(?:oliva|avocado|soia)|(?:extra virgin )?(?:olive|avocado|soybean) oil)$/,{}],
 ['fats-nuts-seeds',0,/^(?:(?:olio (?:di |d )?(?:semi (?:di )?)?(?:girasole|mais|colza|arachidi|cocco|palma|noci|sesamo|lino|vinaccioli))|(?:(?:sunflower|corn|rapeseed|canola|peanut|coconut|palm|walnut|sesame|linseed|grapeseed) oil)|burro|butter|strutto|lard|panna|cream)$/,{}],
 ['fats-nuts-seeds',0,/^(?:mandorle|mandorla|almonds?|nocciole|hazelnuts?|noci(?: del brasile| pecan| macadamia)?|walnuts?|brazil nuts?|pecans?|macadamia nuts?|anacardi|cashews?|pistacchi|pistachios?|pinoli|pine nuts?|arachidi|peanuts?|cocco|coconut|semi di (?:lino|chia|sesamo|girasole|zucca|canapa)|(?:flax|linseed|chia|sesame|sunflower|pumpkin|hemp) seeds?)$/,{}],
 ['general',100,/^(?:mela|mele|apples?|pera|pere|pears?|banana|banane|bananas?|arancia|arance|oranges?|mandarini|mandarins?|kiwi|kiwifruit|fragola|fragole|strawberr(?:y|ies)|mirtilli|blueberr(?:y|ies)|lamponi|raspberr(?:y|ies)|uva|grapes?|pesca|pesche|peaches|albicocche|apricots?|prugne|plums?|ciliegie|cherries|limone|limoni|lemons?|avocado|avocados?|mango|mangos?|melone|melon|anguria|watermelon|ananas|pineapple|pomodoro|pomodori|tomatoes|carota|carote|carrots?|broccoli|cavolfiore|cauliflower|spinaci|spinach|zucchine|zucchini|courgettes?|lattuga|lettuce|cetrioli|cucumbers?|cipolla|cipolle|onions?|peperoni|bell peppers?|melanzane|aubergines?|eggplant|funghi|mushrooms?|piselli|peas|fagioli|beans|ceci|chickpeas|lenticchie|lentils|soia|soybeans|fave|broad beans)$/,{}],
 ['red-meat',0,/^(?:manzo|beef|vitello|veal|maiale|pork|agnello|lamb|montone|mutton|cavallo|horse meat|capra|goat meat|cervo|venison)(?: (?:petto|coscia|filetto|loin|fillet|sirloin|leg|bistecca|steak|macinato|ground))?$/,{}],
 ['general',0,/^(?:pollo|chicken|tacchino|turkey|coniglio|rabbit|anatra|duck)(?: (?:petto|coscia|filetto|breast|thigh|leg))?$|^(?:uovo|uova|eggs?|albume|egg whites?|tuorlo|egg yolks?|salmone|salmon|tonno|tuna|merluzzo|cod|sgombro|mackerel|sardine|sardines|trota|trout|orata|sea bream|branzino|sea bass|gamberi|shrimp|prawns?|polpo|octopus|cozze|mussels?|vongole|clams?)$/,{}],
 ['general',0,/^(?:riso|rice|avena|oats?|fiocchi d avena|rolled oats|grano saraceno|buckwheat|quinoa|orzo|barley|farro|spelt|mais|corn|miglio|millet|patate|potato(?:es)?|patate dolci|sweet potatoes|castagne|chestnuts?)$/,{}],
 ['cheese',0,/^(?:parmigiano(?: reggiano)?|grana padano|mozzarella|ricotta|feta|cheddar|gouda|emmental|pecorino|gorgonzola|parmesan)$/,{}],
 ['general',0,/^(?:yogurt(?: greco| bianco| naturale)?|(?:greek |plain )?yogh?urt)$/,{}],
 ['beverage',0,/^(?:latte(?: intero| parzialmente scremato| scremato| senza lattosio)?|(?:whole |skimmed |semi skimmed |skim |lactose free )?milk)$/,{}]
];
function simpleIdentity(food){
 if(!food||food.brand||unsupported(food))return null;
 // Master import is a documented generic identity. Explicit single ingredient is also supported.
 if(!food.masterId&&food?.qualityV73?.singleIngredient!==true)return null;
 let name=foodName(food);
 name=name.replace(/\b(?:crudo|cruda|crudi|crude|cotto|cotta|cotti|cotte|raw|cooked|boiled|steamed|bollito|bollita|al vapore|fresh|fresco|fresca|fresche|freschi|frozen|surgelato|surgelati|freschi|edible portion|parte edibile|unsalted|senza sale|roasted|tostate|tostati|dried|secche|secchi|shelled|sgusciate|sgusciati|peeled|sbucciata|sbucciate|integrale|integrali|brown|white|bianco|bianca)\b/g,' ').replace(/\s+/g,' ').trim();
 // Added sauces, sugar, flavours, flour etc. are intentionally not stripped.
 for(const [category,fvlPercent,re,extra] of SIMPLE_RULES)if(re.test(name))return {category,fvlPercent,...extra,confirmed:true,source:'SPF 2023 · regola identità semplice: '+name,categoryMethod:'identity-rule'};
 // National DB descriptions use comma-separated identity and preparation descriptors.
 // Only a fixed vocabulary of non-composite qualifiers is stripped. An unrecognized word stays unknown.
 const original=String(food.officialName||food.name||''),parts=original.split(',').map(norm).filter(Boolean);
 let head=parts.shift()||'',tail=parts.join(' ');
 if(['nuts','seeds','vegetable oil'].includes(head)&&parts.length){head=head==='vegetable oil'?parts[0]+' oil':parts[0];tail=parts.slice(1).join(' ');}
 const qualifier=/\b(?:raw|cooked|uncooked|boiled|steamed|roasted|unroasted|dry roasted|toasted|unheated|heated|microwaved|stewed|frozen|fresh|dried|dehydrated|sliced|chopped|diced|grated|whole|ground|mashed|without skin|with skin|skinless|boneless|edible portion|unpeeled|peeled|shelled|unshelled|unblanched|blanched|without salt|with salt|salted|unsalted|no added sugar|without added sugar|unsweetened|without added fat|without fat|low moisture|sulphured|unsulphured|regular|long grain|medium grain|short grain|white|brown|wild|red|green|yellow|enriched|unenriched|unfortified|fortified|drained|unprepared|flour|powder|flaked|flakes|rolled)\b/g;
 const tailRemainder=tail.replace(qualifier,' ').replace(/\s+/g,' ').trim();
 if(!tailRemainder){for(const [category,fvlPercent,re,extra] of SIMPLE_RULES)if(re.test(head))return {category,fvlPercent,...extra,confirmed:true,source:'SPF 2023 · identità e preparazione documentate: '+original,categoryMethod:'identity-rule'};}
 // Plain meat cuts: the optional qualifiers describe anatomy, trimming and heat treatment.
 const meatHead=head.match(/^(beef|veal|lamb|pork|mutton|bison|elk|venison|goat|horse|ostrich|chicken|turkey|rabbit|duck|goose|game meat)\b/);
 if(meatHead){
  const rest=(head.slice(meatHead[0].length)+' '+tail).replace(qualifier,' ').replace(/\b(?:broiler|fryer|fryers|broilers|young|adult|mature|domestic|domesticated|light|dark|meat|and|or|skin|only|fat|lean|separable|visible|trimmed|untrimmed|to|less|than|all|grades|grade|prime|choice|select|composite|retail|cuts|cut|leg|legs|breast|breasts|thigh|thighs|drumstick|drumsticks|wing|wings|neck|back|backs|shoulder|arm|loin|tenderloin|sirloin|strip|striploin|round|top|bottom|tip|flank|rib|ribs|ribeye|brisket|chuck|rump|shank|fore shank|foreshank|hind shank|hindshank|blade|eye|roast|roasts|steak|steaks|chop|chops|center|centre|portion|half|whole|trim|usda|imported|new zealand|australian|australia|canada|canadian|cutlet|cutlets|ground|minced|variety|meats|by products|liver|kidney|kidneys|heart|tongue|brain|brains|gizzard|gizzards|giblets|pan|broiled|braised|simmered|baked|grilled|rotisserie|oven|cured|smoked|ham|picnic|fresh|bone|in|out|removed|both|skin on|m f|mm|cm|inch|inches|percent|yield|average|rib end|ground round|patties|patty)\b/g,' ').replace(/\b\d+(?:\.\d+)?\b|%/g,' ').replace(/\s+/g,' ').trim();
  if(!rest){const category=/^(chicken|turkey|rabbit|duck|goose)$/.test(meatHead[1])?'general':'red-meat';return {category,fvlPercent:0,confirmed:true,source:'SPF 2023 · taglio o preparazione semplice: '+original,categoryMethod:'identity-rule'};}
 }
 return null;
}
function categoryCompatible(food,category){
 if(unsupported(food))return false;
 const simple=simpleIdentity(food);if(simple&&simple.category!==category)return false;
 const t=tagSet(food);
 if(category==='general'&&['en:nuts','en:seeds','en:vegetable-oils','en:animal-fats','en:beverages','en:milks','en:cheeses','en:red-meats'].some(x=>t.has(x)))return false;
 // Guard even an AI-provided category on an otherwise unclassified plain nut.
 const n=foodName(food);
 if(category!=='fats-nuts-seeds'&&/^(?:mandorle|mandorla|almonds?|noci|walnuts?|nocciole|hazelnuts?|arachidi|peanuts?|pistacchi|pistachios?|anacardi|cashews?)(?: (?:raw|roasted|crude|tostate|tostati|sgusciate|unsalted|senza sale))*$/.test(n))return false;
 return true;
}
function taxonomy(food){
 const explicit=food?.qualityV73?.taxonomy,manual=food?.qualityV61?.scoreInput;
 if(explicit?.confirmed===true&&CATEGORIES.includes(explicit.category))return {...explicit,source:explicit.source||'Categoria verificata localmente',categoryMethod:'declared'};
 if(manual?.confirmed===true&&CATEGORIES.includes(manual.category))return {...manual,source:'Composizione verificata localmente',categoryMethod:'declared'};
 const simple=simpleIdentity(food);if(simple)return simple;
 // A source's broad "mixed dishes" category is insufficient. These prefix rules only
 // establish an unambiguous food family; the FVL content remains explicitly unknown.
 if(food?.masterId){
  const original=String(food.officialName||food.name||''),head=norm(original.split(',')[0]),cat=norm(food.masterCategory||food?.qualityV73?.sourceCategory);
  const knownMeat=/^(beef|veal|lamb|pork|mutton|bison|elk|venison|goat|horse|ostrich)$/.test(head)&&/meat|beef|pork|lamb|veal|game/.test(cat);
  const knownPoultry=/^(chicken|turkey|rabbit|duck|goose)$/.test(head)&&/poultry|meat/.test(cat);
  if(knownMeat||knownPoultry)return {category:knownMeat?'red-meat':'general',fvlPercent:null,confirmed:true,source:'Famiglia master documentata; composizione FVL sconosciuta',categoryMethod:'source-family'};
  if(head==='cheese'&&/dairy|cheese/.test(cat)&&!/(quark|plant|vegan|alternative|soy|tofu)/.test(norm(original)))return {category:'cheese',fvlPercent:null,confirmed:true,source:'Formaggio identificato dal DB; composizione FVL sconosciuta',categoryMethod:'source-family'};
  if(/fruit|vegetable|legume/.test(cat)&&!/(juice|drink|beverage|milk|sauce|oil|butter|chocolate|nuts|seeds)/.test(norm(original))){
   const pureHead=SIMPLE_RULES.find(([c,f,re])=>c==='general'&&f===100&&re.test(head));
   if(pureHead)return {category:'general',fvlPercent:null,confirmed:true,source:'Frutto/ortaggio/legume identificato; quota finale FVL sconosciuta',categoryMethod:'source-family'};
  }
 }
 // Category tags do not establish a composition percentage, but can complete an explicitly supplied one.
 const q=food?.qualityV73||{},fvl=num(q.fvlPercent),t=tagSet(food);
 if(q.fvlConfirmed===true&&fvl!==null&&fvl>=0&&fvl<=100){
  const mappings=[['beverage',['en:beverages','en:milks','en:drinkable-yogurts','en:plant-milks']],['fats-nuts-seeds',['en:nuts','en:seeds','en:vegetable-oils','en:animal-fats']],['cheese',['en:cheeses']],['red-meat',['en:red-meats']]];
  for(const [category,tags] of mappings)if(tags.some(v=>t.has(v)))return {category,fvlPercent:fvl,confirmed:true,source:'Tassonomia documentata + quota FVL verificata',categoryMethod:'taxonomy'};
 }
 return null;
}
function sweeteners(food){
 const q=food?.qualityV73||{};
 if(typeof q.nonNutritiveSweeteners==='boolean'&&q.sweetenersConfirmed===true)return q.nonNutritiveSweeteners;
 const ingredients=String(food?.ingredients||'');
 // Positive presence may be found in a partial ingredient list; absence requires a complete declaration.
 if(/\be\s*(?:950|951|952|954|955|957|959|960(?:[a-d])?|961|962|969)\b|acesulfam|aspartam|cyclamat|ciclamat|saccharin|saccarin|sucralos|thaumatin|taumatin|neohesperidin|neohesperidin|steviol|neotam|advantam/i.test(ingredients+' '+(food?.qualityV61?.additives||[]).join(' ')))return true;
 if(q.ingredientsComplete===true)return false;
 const s=simpleIdentity(food);if(s&&(s.water||/^latte\b|\bmilk$/.test(foodName(food))))return false;
 return null;
}
function inputFor(food){
 const missing=[],meta=taxonomy(food),base=num(food?.servingGrams),q=food?.qualityV73||{},provenance=food?.labelProvenance||{};
 if(!meta)missing.push('category','fvlPercent');
 const input={...(meta||{}),confirmed:true};
 if(unsupported(food))return {input:null,missing:[],reason:'Categoria esclusa dall’algoritmo Nutri-Score.',estimated:false};
 if(meta&&!categoryCompatible(food,meta.category))return {input:null,missing:['category'],reason:'La categoria dichiarata non è compatibile con l’identità dell’alimento.',estimated:false};
 if(!(base>0)&&!meta?.water)missing.push('basis');
 const fvl=num(meta?.fvlPercent);if(meta&&(fvl===null||fvl<0||fvl>100))missing.push('fvlPercent');
 const facts={},used=[];
 for(const key of ['kcal','sugar','saturatedFat','salt','protein','fiber','fat']){
  const raw=num(food?.label?.[key]);
  if(raw!==null&&raw>=0&&base>0&&!unavailableField(provenance[key]))facts[key]=raw*100/base;
 }
 if(!meta?.water){
  for(const key of ['sugar','saturatedFat','salt','protein','fiber'])if(facts[key]===undefined)missing.push(key);else used.push(key);
  if(meta?.category==='fats-nuts-seeds'){if(facts.fat===undefined)missing.push('fat');else used.push('fat');}
 }
 let kj=num(meta?.energyKj100??q.energyKj100);
 if(kj===null&&base>0&&num(food?.label?.energyKj)!==null&&!unavailableField(provenance.energyKj)){kj=num(food.label.energyKj)*100/base;if(meta?.category!=='fats-nuts-seeds')used.push('energyKj');}
 let energyConverted=false;
 if(kj===null&&facts.kcal!==undefined&&meta?.category!=='fats-nuts-seeds'&&!meta?.water){kj=facts.kcal*4.184;energyConverted=true;used.push('kcal');}
 if(meta?.category==='beverage'&&!meta.water){
  const ml=num(meta.servingMl??q.servingMl??food.servingMl),density=num(meta.densityGPerMl??q.densityGPerMl??food.densityGPerMl);
  // Conversion of an explicitly mass-based label requires measured/documented density.
  if((meta.basis==='100ml'||q.basis==='100ml')&&ml>0){input.basis='100ml';input.servingMl=ml;if(kj!==null&&meta.energyKj100===undefined&&q.energyKj100===undefined)kj=kj*base/ml;}
  else if(density>0&&(meta.densityConfirmed===true||q.densityConfirmed===true)){input.densityGPerMl=density;if(kj!==null&&meta.energyKj100===undefined&&q.energyKj100===undefined)kj*=density;}
  else missing.push('basis');
  input.nonNutritiveSweeteners=typeof meta.nonNutritiveSweeteners==='boolean'?meta.nonNutritiveSweeteners:sweeteners(food);
  if(input.nonNutritiveSweeteners===null)missing.push('nonNutritiveSweeteners');
 }
 if(meta?.water){input.water=true;input.waterConfirmed=true;}
 if(meta?.category!=='fats-nuts-seeds'&&!meta?.water&&(kj===null||kj<0))missing.push('energyKj100');
 input.energyKj100=kj;
 const legacyAIAmbiguous=(food?.sources||[]).some(s=>s?.name==='AI · stima integrativa')&&used.some(k=>!provenance[k]);
 const estimated=q.estimated===true||legacyAIAmbiguous||used.some(k=>estimatedField(provenance[k]));
 return {input,missing:[...new Set(missing)],estimated,legacyAIAmbiguous,energyConverted,categorySource:meta?.source||null,categoryMethod:meta?.categoryMethod||null,reason:missing.length?'Dati necessari ancora mancanti.':null};
}
function calculateFood(food){
 const info=inputFor(food);
 const empty={grade:null,score:null,version:'2023',method:null,comparable:false,missing:info.missing,reason:info.reason,category:info.input?.category||null,source:SOURCE};
 if(!info.input)return empty;
 if(info.missing.length){
  const bounded=boundedCalculation(food,info);if(!bounded)return empty;
  return {...bounded,method:info.estimated?'estimated':'calculated-partial',comparable:true,missing:info.missing,source:SOURCE,categorySource:info.categorySource,categoryMethod:info.categoryMethod,energyConverted:info.energyConverted,estimated:info.estimated,bounded:true,reason:'Calcolo con dati parziali · grado invariato nell’intervallo dei valori mancanti.'};
 }
 const result=Q?.calculateNutriScore(food,info.input);
 if(!result)return {...empty,reason:'Valori, unità o composizione non coerenti con il calcolo.'};
 return {...result,method:info.estimated?'estimated':'calculated',comparable:true,missing:[],source:SOURCE,categorySource:info.categorySource,categoryMethod:info.categoryMethod,energyConverted:info.energyConverted,estimated:info.estimated,reason:info.legacyAIAmbiguous?'Macro di una precedente integrazione AI senza provenienza per campo: trattati come stime.':info.energyConverted?'Energia convertita da kcal in kJ; l’arrotondamento dell’etichetta può incidere sui valori di confine.':null};
}
function boundedCalculation(food,info){
 if(!CATEGORIES.includes(info.input.category)||info.missing.some(k=>['category','basis','food'].includes(k)))return null;
 // Explicit conflicts/quarantines cannot be repaired by interval reasoning.
 if(info.missing.some(k=>unavailableField(food?.labelProvenance?.[k])))return null;
 const base=num(food.servingGrams);if(!(base>0))return null;
 const best={...food,label:{...(food.label||{})}},worst={...food,label:{...(food.label||{})}},a={...info.input},b={...info.input};
 const maxAmount=info.input.category==='beverage'&&info.input.basis==='100ml'?num(info.input.servingMl):base;
 const maxPerBasis=info.input.category==='beverage'&&info.input.densityGPerMl?base/info.input.densityGPerMl:maxAmount;
 for(const key of ['sugar','saturatedFat','salt'])if(info.missing.includes(key)){best.label[key]=0;worst.label[key]=maxPerBasis;}
 for(const key of ['protein','fiber'])if(info.missing.includes(key)){best.label[key]=maxPerBasis;worst.label[key]=0;}
 if(info.missing.includes('energyKj100')){a.energyKj100=0;b.energyKj100=4000;}
 if(info.missing.includes('fvlPercent')){a.fvlPercent=100;b.fvlPercent=0;}
 if(info.missing.includes('nonNutritiveSweeteners')){a.nonNutritiveSweeteners=false;b.nonNutritiveSweeteners=true;}
 if(info.input.category==='fats-nuts-seeds'){
  if(info.missing.includes('fat')){best.label.fat=base;worst.label.fat=num(worst.label.saturatedFat);}
  else if(info.missing.includes('saturatedFat'))worst.label.saturatedFat=num(worst.label.fat);
 }
 const lower=Q?.calculateNutriScore(best,a),upper=Q?.calculateNutriScore(worst,b);
 if(!lower||!upper||lower.grade!==upper.grade||lower.score>upper.score)return null;
 return {grade:lower.grade,score:null,version:'2023',category:info.input.category,bounds:{minimumScore:lower.score,maximumScore:upper.score}};
}
function resolveBase(food,options={}){
 if(!food)return {grade:null,method:null,comparable:false,missing:['food'],reason:'Alimento non disponibile.'};
 const q=food.qualityV61||{},reported=validGrade(q.nutriScore),version=String(q.nutriScoreVersion||'');
 if(reported&&version==='2023'&&!q.scoreEstimated&&!unsupported(food))return {grade:reported,score:num(q.nutriScoreNumeric),version,method:'reported',comparable:true,missing:[],source:q.source||'Dato riportato',reason:null};
 const calculated=calculateFood(food);
 if(calculated.grade&&['calculated','calculated-partial'].includes(calculated.method))return calculated;
 if(options.includeEstimates===true){
  if(calculated.grade&&calculated.method==='estimated')return calculated;
  const e=Q?.validEstimate(food),score=e?.scoreEstimate;
  if(validGrade(score?.grade)&&categoryCompatible(food,score.category))return {grade:validGrade(score.grade),score:null,version:'2023',method:'estimated',comparable:true,estimated:true,source:'OpenRouter · stima AI',missing:[],reason:score.reason};
 }
 if(reported)return {grade:reported,score:null,version:version||null,method:q.scoreEstimated?'estimated':'reported',comparable:false,missing:[],reason:unsupported(food)?'Categoria fuori dall’ambito Nutri-Score: dato riportato escluso dalle medie.':q.scoreEstimated?'Stima esclusa dalle statistiche documentate.':'Versione diversa dal 2023 o non indicata: esclusa dalle medie comparabili.',source:q.source||'Dato riportato'};
 return {...calculated,grade:null,method:null,comparable:false,reason:calculated.method==='estimated'?'Il calcolo dipende da valori stimati; attiva le stime per includerlo.':calculated.reason};
}
function resolve(food,options={}){const result=resolveBase(food,options);return food?.demoSynthetic===true?{...result,synthetic:true,source:'DEMO · dati sintetici',reason:[result.reason,'Valori sintetici per provare l’app.'].filter(Boolean).join(' ')}:result;}
function foodMap(foods){return foods instanceof Map?foods:new Map((foods||[]).map(f=>[f.id,f]));}
function summarize(logs,foods,options={}){
 const byId=foodMap(foods),byGrade=Object.fromEntries(GRADES.map(g=>[g,0])),byMethod={reported:0,calculated:0,'calculated-partial':0,estimated:0};
 let knownKcal=0,classifiedKcal=0,unknownGradeKcal=0,missingEnergyEntries=0,missingFoodEntries=0,invalidEntries=0,totalMass=0,knownEnergyMass=0,gradedEntries=0;
 const resultCache=new Map(),byFood=new Map(),dates=new Set();
 for(const entry of logs||[]){
  const grams=num(entry?.grams);if(!(grams>0)){invalidEntries++;continue;}
  totalMass+=grams;if(validDate(entry.date))dates.add(entry.date);
  const f=byId.get(entry.foodId);if(!f){missingFoodEntries++;missingEnergyEntries++;continue;}
  const base=num(f.servingGrams),kcal=num(f.label?.kcal),energy=base>0&&kcal!==null&&kcal>=0&&!unavailableField(f.labelProvenance?.kcal)?kcal*grams/base:null;
  if(energy===null){missingEnergyEntries++;continue;}
  knownKcal+=energy;knownEnergyMass+=grams;
  let quality=resultCache.get(f.id);if(!quality){quality=resolve(f,options);resultCache.set(f.id,quality);}
  const grade=quality.comparable?quality.grade:null;
  if(grade){byGrade[grade]+=energy;classifiedKcal+=energy;byMethod[quality.method]+=energy;gradedEntries++;}else unknownGradeKcal+=energy;
  const key=f.id,previous=byFood.get(key)||{foodId:key,name:String(f.name||'Alimento'),kcal:0,grams:0,grade:quality.grade,method:quality.method,comparable:quality.comparable,reason:quality.reason,missing:quality.missing||[]};
  previous.kcal+=energy;previous.grams+=grams;byFood.set(key,previous);
 }
 const weightedClass=classifiedKcal>0?GRADES.reduce((s,g,i)=>s+(5-i)*byGrade[g],0)/classifiedKcal:null;
 const index=weightedClass===null?null:1+99*(weightedClass-1)/4;
 const grade=weightedClass===null?null:GRADES[5-Math.round(weightedClass)];
 return {grade,index:round(index,1),rawIndex:index,weightedClass,knownKcal,classifiedKcal,unknownGradeKcal,byGrade,byMethod,coverage:knownKcal>0?classifiedKcal/knownKcal:null,abShare:classifiedKcal>0?(byGrade.A+byGrade.B)/classifiedKcal:null,abShareAllKnown:knownKcal>0?(byGrade.A+byGrade.B)/knownKcal:null,missingEnergyEntries,missingFoodEntries,invalidEntries,totalMass,energyMassCoverage:totalMass>0?knownEnergyMass/totalMass:null,entries:(logs||[]).length,gradedEntries,days:dates.size,foods:[...byFood.values()].sort((a,b)=>b.kcal-a.kcal),includeEstimates:options.includeEstimates===true};
}
function periodBounds(period,anchor=dateKey(new Date())){
 if(!validDate(anchor))throw new Error('Data del periodo non valida.');
 const year=Number(anchor.slice(0,4)),month=Number(anchor.slice(5,7));
 if(period==='year')return {start:year+'-01-01',end:year+'-12-31',period,anchor};
 if(period==='month')return {start:anchor.slice(0,7)+'-01',end:new Date(Date.UTC(year,month,0,12)).toISOString().slice(0,10),period,anchor};
 if(period!=='week')throw new Error('Periodo non valido.');
 const day=new Date(anchor+'T12:00:00Z').getUTCDay(),start=shift(anchor,-((day+6)%7));return {start,end:shift(start,6),period,anchor};
}
function movePeriod(period,anchor,delta){
 const b=periodBounds(period,anchor);if(period==='week')return shift(b.start,7*delta);
 const d=new Date(b.start+'T12:00:00Z');if(period==='month')d.setUTCMonth(d.getUTCMonth()+delta);else d.setUTCFullYear(d.getUTCFullYear()+delta);return d.toISOString().slice(0,10);
}
function history(logs,foods,{period='week',anchor=dateKey(new Date()),includeEstimates=false}={}){
 const bounds=periodBounds(period,anchor),rows=(logs||[]).filter(l=>validDate(l?.date)&&l.date>=bounds.start&&l.date<=bounds.end),buckets=[];
 if(period==='year'){
  for(let m=1;m<=12;m++){const start=bounds.start.slice(0,4)+'-'+String(m).padStart(2,'0')+'-01',end=periodBounds('month',start).end;buckets.push({start,end,label:new Date(start+'T12:00:00Z').toLocaleDateString('it-IT',{month:'short',timeZone:'UTC'})});}
 }else for(let d=bounds.start;d<=bounds.end;d=shift(d,1))buckets.push({start:d,end:d,label:period==='week'?new Date(d+'T12:00:00Z').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',timeZone:'UTC'}):String(Number(d.slice(-2)))});
 const options={includeEstimates};return {...bounds,summary:summarize(rows,foods,options),points:buckets.map(b=>({...b,...summarize(rows.filter(l=>l.date>=b.start&&l.date<=b.end),foods,options)}))};
}
function provenanceOf(food,key){return food?.labelProvenance?.[key]||null;}
function stateWords(food){
 const n=norm([food?.name,food?.officialName,food?.preparation,food?.qualityV73?.state].filter(Boolean).join(' ')),out=[];
 for(const [k,re] of [['raw',/\b(raw|uncooked|crud[oaie])\b/],['cooked',/\b(cooked|boiled|steamed|roasted|fried|broiled|braised|cott[oaie]|bollit[oaie]|fritt[oaie]|al forno|al vapore)\b/],['lactose-free',/\b(lactose free|senza lattosio)\b/]])if(re.test(n))out.push(k);
 if(/\b(milk|latte)\b/.test(n)){if(/semi skimmed|partly skimmed|parzialmente scremato/.test(n))out.push('semi-milk');else if(/skimmed|skim|scremato/.test(n))out.push('skim-milk');else if(/whole|intero/.test(n))out.push('whole-milk');}
 return out;
}
function identityMatch(target,candidate){
 if(!target||!candidate)return {match:false,reason:'Alimento mancante.'};
 const a=stateWords(target),b=stateWords(candidate);
 if(a.includes('raw')&&b.includes('cooked')||a.includes('cooked')&&b.includes('raw'))return {match:false,reason:'Stato crudo/cotto diverso.'};
 const milk=x=>x.find(k=>k.endsWith('-milk'));
 if(milk(a)&&milk(b)&&milk(a)!==milk(b))return {match:false,reason:'Tipo di latte diverso.'};
 if(a.includes('lactose-free')!==b.includes('lactose-free')&&milk(a)&&milk(b))return {match:false,reason:'Lattosio: descrizioni diverse.'};
 const barcode=f=>String(f?.barcode||f?.qualityV61?.barcode||f?.offBarcode||'').trim();
 if(barcode(target)&&barcode(candidate)&&barcode(target)!==barcode(candidate))return {match:false,reason:'Codice prodotto diverso.'};
 if(target.masterId&&candidate.masterId&&String(target.masterId)!==String(candidate.masterId))return {match:false,reason:'Identità master diversa.'};
 if(norm(target.brand)&&norm(candidate.brand)&&norm(target.brand)!==norm(candidate.brand))return {match:false,reason:'Marca diversa.'};
 if(target.masterId&&candidate.masterId&&String(target.masterId)===String(candidate.masterId))return {match:true,key:'master:'+target.masterId};
 if(barcode(target)&&barcode(target)===barcode(candidate))return {match:true,key:'barcode:'+barcode(target)};
 const ids=f=>(f?.qualityV73?.sourceIds||[]).filter(x=>typeof x==='string'&&/^[a-z0-9_-]+:.+/i.test(x));
 const common=ids(target).find(id=>ids(candidate).includes(id));if(common)return {match:true,key:'source:'+common};
 return {match:false,reason:'Manca un’identità documentata comune. La somiglianza del nome non basta.'};
}
function complementFields(target,candidate){
 const match=identityMatch(target,candidate),out=clone(target||{}),filled=[],conflicts=[];
 if(!match.match)return {food:out,changed:false,filled,conflicts,reason:match.reason};
 const base=num(target?.servingGrams),sourceBase=num(candidate?.servingGrams);
 if(!(base>0&&sourceBase>0))return {food:out,changed:false,filled,conflicts,reason:'Base in grammi mancante.'};
 const factor=base/sourceBase;out.label={...(out.label||{})};out.labelProvenance={...(out.labelProvenance||{})};
 for(const key of ['kcal','energyKj','protein','carbs','sugar','fat','saturatedFat','fiber','salt']){
  const value=num(candidate?.label?.[key]),p=provenanceOf(candidate,key),current=num(target?.label?.[key]);
  if(value===null||value<0||estimatedField(p)||unavailableField(p))continue;
  // A source object or documented macro provenance is necessary, not just another anonymous value.
  if(!p&&!(candidate.sources||[]).length&&!candidate.masterId)continue;
  if(current!==null){if(Math.abs(current-value*factor)>1e-8)conflicts.push(key);continue;}
  // Explicit unknown/conflict/quarantine is not a hole to silently override.
  if(unavailableField(provenanceOf(target,key)))continue;
  out.label[key]=round(value*factor,8);out.labelProvenance[key]={...(p||{}),method:p?.method||'source-complement',sourceFoodId:candidate.id||null,identity:match.key,originalBasisGrams:sourceBase,originalValue:value,sources:p?.sources||(candidate.sources||[]).map(s=>s.name||s.reference).filter(Boolean)};filled.push('label.'+key);
 }
 const nutrients=[...(out.nutrients||[])];
 for(const n of candidate.nutrients||[]){
  const value=num(n?.amount);if(value===null||value<0||estimatedField(n)||unavailableField(n)||!n.source)continue;
  const key=n.canonicalId||norm(n.name)+'|'+norm(n.form),matches=nutrients.filter(t=>(t.canonicalId||norm(t.name)+'|'+norm(t.form))===key);
  if(matches.length)continue;
  const status=out.nutrientStatus?.[n.name];if(unavailableField(status))continue;
  // Same canonical nutrient retains its original unit and chemical definition; do not collapse forms.
  nutrients.push({...clone(n),id:'q73:'+String(candidate.id||match.key)+':'+key,amount:round(value*factor,8),provenance:{...(n.provenance||{}),identity:match.key,sourceFoodId:candidate.id||null,originalBasisGrams:sourceBase,originalValue:value}});filled.push('nutrients.'+key);
 }
 out.nutrients=nutrients;
 if(filled.length){out.mergeMeta={...(out.mergeMeta||{}),qualityV73Complements:[...(out.mergeMeta?.qualityV73Complements||[]),{identity:match.key,sourceFoodId:candidate.id||null,filled,conflicts}]};out.sources=[...(out.sources||[])];for(const s of candidate.sources||[])if(!out.sources.some(x=>x.name===s.name&&x.reference===s.reference&&x.version===s.version))out.sources.push(clone(s));}
 return {food:out,changed:filled.length>0,filled,conflicts,reason:filled.length?null:'Nessun valore documentato mancante compatibile.'};
}
function auditFoods(foods){
 const report={total:0,reported2023:0,calculated2023:0,partial2023:0,estimatedAvailable:0,otherVersion:0,unknown:0,categories:{},missing:{}};
 for(const food of foods||[]){report.total++;const r=resolve(food),all=resolve(food,{includeEstimates:true});if(r.grade&&r.comparable){report[r.method==='reported'?'reported2023':r.method==='calculated-partial'?'partial2023':'calculated2023']++;if(r.category)report.categories[r.category]=(report.categories[r.category]||0)+1;}else if(r.grade)report.otherVersion++;else report.unknown++;if(all.method==='estimated'&&all.comparable)report.estimatedAvailable++;for(const k of r.missing||[])report.missing[k]=(report.missing[k]||0)+1;}
 report.documentedCoverage=report.total?(report.reported2023+report.calculated2023)/report.total:null;report.partialCoverage=report.total?report.partial2023/report.total:null;report.comparableCoverage=report.total?(report.reported2023+report.calculated2023+report.partial2023)/report.total:null;return report;
}
function indexResult(bundle,id,manifest){
 if(bundle?.schema!=='nutritrace-quality-v73'||bundle.version!==1||bundle.algorithm!=='2023')return {grade:null,method:null,comparable:false,missing:[],reason:'Indice qualità non disponibile o non compatibile.'};
 if(manifest&&bundle.manifestRevision!==String(manifest.runtime_version)+'|'+String(manifest.built_at))return {grade:null,method:null,comparable:false,missing:[],reason:'Indice qualità da rigenerare per questa versione del database.'};
 const row=bundle.byId?.[String(id)];if(!Array.isArray(row))return {grade:null,method:null,comparable:false,missing:[],reason:'Alimento non presente nell’indice qualità.'};
 const [grade,method,category,missing,flags]=row;
 return {grade:validGrade(grade),method:['reported','calculated','calculated-partial','estimated'].includes(method)?method:null,category:CATEGORIES.includes(category)?category:null,missing:Array.isArray(missing)?missing.filter(x=>typeof x==='string'):[],version:'2023',source:bundle.source||SOURCE,comparable:!!validGrade(grade)&&['reported','calculated','calculated-partial'].includes(method),bounded:method==='calculated-partial',energyConverted:!!(flags&1),reason:method==='calculated-partial'?'Calcolo con dati parziali · grado invariato nell’intervallo dei valori mancanti.':flags&2?'Categoria esclusa dall’algoritmo.':flags&4?'Dati non coerenti per il calcolo.':!grade?'Dati necessari non disponibili.':null};
}
const api={SOURCE,GRADES,LABELS,num,round,validDate,dateKey,shift,categoryCompatible,taxonomy,simpleIdentity,sweeteners,inputFor,calculateFood,boundedCalculation,resolve,summarize,periodBounds,movePeriod,history,identityMatch,complementFields,auditFoods,indexResult};
root.NutriTraceFoodQualityV73=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.React)return;
const h=root.React.createElement,{useState,useMemo,useId}=root.React;
const pct=v=>v===null?'N/D':Math.round(v*100)+'%';
const fmt=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('it-IT',{maximumFractionDigits:d}):'N/D';
const methodLabel=m=>m==='estimated'?'Stima':m==='calculated-partial'?'Dati parziali':m==='calculated'?'Calcolato':m==='reported'?'Riportato':'';
const legacyQualityFields=Q?.QualityFields;
if(legacyQualityFields)Q.QualityFields=function QualityFieldsWithProvenance(props){const q=resolve(props.food);return h(root.React.Fragment,null,h(legacyQualityFields,props),q.bounded&&h('p',{className:'q73-explanation'},'Calcolo con dati parziali · grado invariato nell’intervallo dei valori mancanti. Dati ancora da completare: '+q.missing.map(k=>LABELS[k]||k).join(', ')+'.'));};
api.GradeBadge=function GradeBadge({food,result,grade,includeEstimates=false,showLabel=false}){
 const q=result||(!grade?resolve(food,{includeEstimates}):{grade:validGrade(grade),method:null}),value=q.grade;
 const label=(q.synthetic?'DEMO · ':'')+(value?'Grado '+value+(q.method?' · '+methodLabel(q.method):'')+(q.version?' · '+q.version:'')+(q.comparable===false?' · escluso dalla media':''):'Grado non disponibile'+(q.missing?.length?': '+q.missing.map(k=>LABELS[k]||k).join(', '):''));
 return h('span',{className:'q73-badge-wrap',title:label+(q.reason?' · '+q.reason:''),'aria-label':label},h('span',{'aria-hidden':'true',className:'q73-grade q73-grade-'+(value||'unknown')+(q.method==='estimated'?' q73-estimated':'')},value||'—'),(showLabel||q.synthetic||q.bounded||q.method==='estimated'||q.comparable===false)&&h('small',null,q.synthetic?'Demo':q.comparable===false?(q.grade?'Versione '+(q.version||'N/D'):'N/D'):methodLabel(q.method)));
};
api.MealBadge=function MealBadge({logs,foods,includeEstimates=false}){
 const s=useMemo(()=>summarize(logs,foods,{includeEstimates}),[logs,foods,includeEstimates]);
 return h('span',{className:'q73-meal-summary',title:'Media delle lettere ponderata per le kcal classificate. Indicatore NutriTrace, non Nutri-Score del pasto.'},h(api.GradeBadge,{grade:s.grade}),h('span',null,'Media ',h('strong',null,s.grade||'N/D'),h('small',null,s.index===null?'Dati incompleti':fmt(s.index,1)+'/100 · copertura '+pct(s.coverage))));
};
function Chart({points,label}){
 const id=useId?useId():'q73-chart',width=720,height=220,pad={l:38,r:18,t:18,b:38},plotW=width-pad.l-pad.r,plotH=height-pad.t-pad.b;
 const x=i=>pad.l+(points.length>1?i*plotW/(points.length-1):plotW/2),y=v=>pad.t+(100-v)*plotH/99;
 const segments=[];let line=[];points.forEach((p,i)=>{if(p.index===null){if(line.length)segments.push(line);line=[];}else line.push([x(i),y(p.index)]);});if(line.length)segments.push(line);
 return h('figure',{className:'q73-chart'},h('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-labelledby':id+'-title','aria-describedby':id+'-desc'},h('title',{id:id+'-title'},label),h('desc',{id:id+'-desc'},'Indice interno da 1 a 100, ponderato per energia classificata. Le interruzioni sono periodi senza dati comparabili; tabella dettagliata disponibile sotto il grafico.'),...[1,25,50,75,100].map(v=>h('g',{key:'grid'+v},h('line',{x1:pad.l,x2:width-pad.r,y1:y(v),y2:y(v),className:'q73-gridline'}),h('text',{x:pad.l-8,y:y(v)+4,textAnchor:'end'},v))),...segments.map((s,i)=>h('polyline',{key:'line'+i,points:s.map(p=>p.join(',')).join(' '),className:'q73-line',fill:'none'})),...points.map((p,i)=>h('g',{key:p.start},p.index!==null&&h('circle',{cx:x(i),cy:y(p.index),r:4.5,className:'q73-point q73-point-'+p.grade},h('title',null,p.label+': '+fmt(p.index,1)+'/100, media '+p.grade+', copertura '+pct(p.coverage))),((points.length<=12||i%5===0||i===points.length-1)&&h('text',{x:x(i),y:height-13,textAnchor:'middle'},p.label))))),h('figcaption',null,'I vuoti restano vuoti. La media del periodo usa tutte le registrazioni, senza fare la media delle medie.'));
}
function Distribution({summary:s}){
 const items=[...GRADES.map(g=>[g,s.byGrade[g]]),['unknown',s.unknownGradeKcal]];
 return h('div',{className:'q73-distribution'},h('div',{className:'q73-distribution-bar','aria-hidden':'true'},...items.filter(x=>x[1]>0).map(([g,n])=>h('span',{key:g,className:'q73-fill-'+g,style:{width:(s.knownKcal?n/s.knownKcal*100:0)+'%'}}))),h('ul',{className:'q73-distribution-list'},...items.map(([g,n])=>h('li',{key:g},h('span',{className:'q73-dot q73-fill-'+g}),h('span',null,g==='unknown'?'Non classificato':g),h('strong',null,fmt(n)+' kcal'),h('small',null,s.knownKcal?pct(n/s.knownKcal):'N/D')))));
}
api.QualityHistoryPanel=function QualityHistoryPanel({logs=[],foods=[],today=dateKey(new Date()),initialPeriod='week'}){
 const [period,setPeriod]=useState(initialPeriod),[anchor,setAnchor]=useState(validDate(today)?today:dateKey(new Date())),[includeEstimates,setIncludeEstimates]=useState(false);
 const data=useMemo(()=>history(logs,foods,{period,anchor,includeEstimates}),[logs,foods,period,anchor,includeEstimates]),s=data.summary;
 const year=Number(anchor.slice(0,4)),years=[...new Set([year,Number(today.slice(0,4)),...logs.filter(l=>validDate(l?.date)).map(l=>Number(l.date.slice(0,4)))])].sort((a,b)=>b-a);
 const range=period==='year'?String(year):period==='month'?new Date(data.start+'T12:00:00Z').toLocaleDateString('it-IT',{month:'long',year:'numeric',timeZone:'UTC'}):new Date(data.start+'T12:00:00Z').toLocaleDateString('it-IT',{day:'numeric',month:'short',timeZone:'UTC'})+' – '+new Date(data.end+'T12:00:00Z').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 return h('section',{className:'card q73-history'},h('header',{className:'q73-heading'},h('div',null,h('h2',null,'Qualità nel tempo'),h('p',{className:'muted'},'Lettere A–E dei cibi registrati e loro media ponderata.')),h('span',{className:'q73-meta'},'Algoritmo 2023')),
  h('div',{className:'q73-period-tabs',role:'group','aria-label':'Periodo qualità'},...[['week','Settimana'],['month','Mese'],['year','Anno']].map(([v,label])=>h('button',{type:'button',key:v,'aria-pressed':period===v,className:period===v?'active':'ghost',onClick:()=>setPeriod(v)},label))),
  h('div',{className:'q73-period-nav'},h('button',{type:'button',className:'ghost','aria-label':'Periodo precedente',onClick:()=>setAnchor(movePeriod(period,anchor,-1))},'‹'),h('strong',{'aria-live':'polite'},range),h('button',{type:'button',className:'ghost','aria-label':'Periodo successivo',onClick:()=>setAnchor(movePeriod(period,anchor,1))},'›')),
  h('div',{className:'q73-selectors'},period==='year'?h('label',null,'Anno',h('select',{value:year,onChange:e=>setAnchor(e.target.value+'-01-01')},...years.map(y=>h('option',{key:y,value:y},y)))):h('label',null,'Scegli una data',h('input',{type:'date',value:anchor,onChange:e=>{if(validDate(e.target.value))setAnchor(e.target.value);}})),h('button',{type:'button',className:'ghost',onClick:()=>setAnchor(today)},'Periodo attuale'),h('label',{className:'q73-estimate-toggle'},h('input',{type:'checkbox',checked:includeEstimates,onChange:e=>setIncludeEstimates(e.target.checked)}),'Includi stime AI / dati stimati')),
  h('div',{className:'q73-summary-grid'},h('div',{className:'q73-summary-main'},h(api.GradeBadge,{grade:s.grade}),h('div',null,h('small',null,'Media delle lettere'),h('strong',null,s.grade||'N/D'),h('span',null,s.index===null?'Indice non disponibile':fmt(s.index,1)+'/100'))),h('div',null,h('small',null,'Energia classificata'),h('strong',null,pct(s.coverage)),h('span',null,fmt(s.classifiedKcal)+' / '+fmt(s.knownKcal)+' kcal note')),h('div',null,h('small',null,'Quota A/B'),h('strong',null,pct(s.abShare)),h('span',null,'dell’energia classificata'))),
  h('p',{className:'q73-explanation'},'L’indice 1–100 è un indicatore interno NutriTrace: A=100, B=75,25, C=50,5, D=25,75, E=1, pesati per le calorie. Non è un Nutri-Score ufficiale del pasto o della dieta, né un voto alla persona.'),
  h('p',{className:'q73-coverage',role:'status'},fmt(s.unknownGradeKcal)+' kcal hanno un grado sconosciuto/non confrontabile. '+s.missingEnergyEntries+' registrazioni hanno energia mancante'+(s.missingFoodEntries?' (di cui '+s.missingFoodEntries+' con alimento non disponibile)':'')+'. '+(s.coverage===null?'Non ci sono kcal note nel periodo.':'La percentuale di copertura usa solo le calorie note.')+' Calcoli con dati parziali e grado invariato: '+fmt(s.byMethod['calculated-partial'])+' kcal.'+(includeEstimates?' Stime incluse: '+fmt(s.byMethod.estimated)+' kcal; restano riconoscibili.':' Stime escluse.')),
  h(Chart,{points:data.points,label:'Andamento della qualità · '+range}),h('h3',null,'Distribuzione A–E'),h(Distribution,{summary:s}),
  h('details',null,h('summary',null,'Dati del grafico e metodo'),h('div',{className:'q73-table-wrap'},h('table',null,h('caption',null,'Indice, copertura e calorie dei periodi visualizzati'),h('thead',null,h('tr',null,...['Periodo','Media','Indice interno','Copertura','Kcal classificate','Kcal grado ignoto'].map(t=>h('th',{key:t,scope:'col'},t)))),h('tbody',null,...data.points.map(p=>h('tr',{key:p.start},h('th',{scope:'row'},p.start+(p.start!==p.end?' – '+p.end:'')),h('td',null,p.grade||'N/D'),h('td',null,fmt(p.index,1)),h('td',null,pct(p.coverage)),h('td',null,fmt(p.classifiedKcal)),h('td',null,fmt(p.unknownGradeKcal))))))),h('p',null,'Settimana: lunedì–domenica. Mese e anno: calendario, compresi gli anni bisestili. I giorni vuoti non diventano zero e non vengono interpolati. La lettera media arrotonda la media dei valori A=5…E=1; l’indice conserva più dettaglio. Le versioni diverse dal 2023 e quelle sconosciute restano fuori dalla media.'),h('p',null,'Copertura bassa significa dati incompleti: nessun valore minimo blocca il grafico. La classificazione descrive i prodotti per 100 g/100 ml, non porzioni consigliate o adeguatezza di tutti i nutrienti.'),h('a',{href:SOURCE,target:'_blank',rel:'noopener noreferrer'},'Regole ufficiali SPF · FAQ 2023 v11')),
  h('details',null,h('summary',null,'Alimenti e origine dei gradi ('+s.foods.length+')'),...s.foods.map(f=>h('div',{className:'q73-food-detail',key:f.foodId},h(api.GradeBadge,{result:{grade:f.grade,method:f.method,comparable:f.comparable,missing:f.missing,reason:f.reason},showLabel:true}),h('div',null,h('strong',null,f.name),h('small',null,fmt(f.kcal)+' kcal · '+fmt(f.grams)+' g'+(f.missing.length?' · mancano: '+f.missing.map(k=>LABELS[k]||k).join(', '):'')))))));
};
})(typeof globalThis!=='undefined'?globalThis:this);
