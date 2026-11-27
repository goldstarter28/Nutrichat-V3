'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),source=read('app.js');
const D=require('../diary-v5'),W=require('../goals-wizard-v5'),S=require('../strategy-v64'),P=require('../planner-v72'),L=require('../portion-learning-v731');
const master=JSON.parse(read('data/master/index.json')),catalog=JSON.parse(read('config/standard-portions.json'));
const food=(id,name)=>({id,name,servingGrams:100,label:{kcal:100},resultType:'personal'});
function env(foods=[]){
 const c={console,structuredClone,crypto:require('node:crypto').webcrypto,React:{memo:f=>f,createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}),useRef:()=>({current:null}),useEffect:()=>{},useState:v=>[v,()=>{}],useMemo:f=>f()},ReactDOM:{createPortal:x=>x},document:{body:{},querySelector:()=>({focus(){}})},requestAnimationFrame:f=>f()};
 c.window=c;c.globalThis=c;c.NutriTraceNutritionReferences=require('../nutrition-reference-v5');c.NutriTraceDiaryV5=D;c.NutriTraceGoalsWizard=W;c.NutriTraceStrategy=S;c.NutriTracePlanner=P;c.NutriTracePortionLearningV731=L;
 vm.createContext(c);vm.runInContext(source.replace(/const root=ReactDOM\.createRoot[\s\S]*$/,''),c);
 vm.runInContext(read('food-lexicon.js'),c);vm.runInContext(read('food-search-bridge.js'),c);
 c.foodLexicon=c.NutriTraceFoodLexicon.create(JSON.parse(read('data/food-lexicon-it-en.json')));
 Object.assign(c,{foods,masterIndex:[],datasets:{},appConfig:{standardPortions:catalog},mutationLock:{current:false},recipeRequest:{current:0},selectedDate:'2026-11-27',activeMealId:'lunch',deviceToday:'2026-11-27',resetTextEntry(){},openEntry(){},setSelectedDate(){},setEntryMode(){},setImportSource64(){},setRecipeDestination(){},setRecipeText(){},setRecipeBusy(){},setRecipeMsg(){},setRecipeReview:x=>c.review=x,parseFoodEntry:()=>{throw Error('Unexpected provider call');}});
 const a=source.indexOf('  function ingredientCandidates('),b=source.indexOf('  async function interpretRecipe(){',a);vm.runInContext(source.slice(a,b),c);
 return c;
}
async function storage(fn){const before=globalThis.NutriTraceEnvironment,m=new Map();globalThis.NutriTraceEnvironment={storage:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};try{return await fn(m);}finally{globalThis.NutriTraceEnvironment=before;}}
function quick(c,q){Object.assign(c,{quickSearchQuery:q,quickQuery:q,quickLimit:20,quickAiResult:null,recentFoods:[]});const a=source.indexOf('  const quickSuggestions=useMemo('),b=source.indexOf('  const macroPreview=',a);return vm.runInContext('(()=>{'+source.slice(a,b)+';return quickSuggestions})()',c);}
function quickHandler(c){Object.assign(c,{grams:'',quickAiResult:null,entryOpen:true,entryTimeChoice:null,chooseMeal:async id=>id,setQuickSelected:x=>c.selected=x,setGrams:x=>c.grams=x,setAiMsg:x=>c.message=x,setEntryFeedback(){},setV5Notice:x=>c.notice=x,setQuickQuery(){},setQuickSearchQuery(){},setEntryTimeChoice(){},setEntryOpen(){},entryTimeFor:()=>({}),persistDiaryBatch:(f,l)=>{c.created=f;c.recorded=l;}});const a=source.indexOf('  async function quickAdd('),b=source.indexOf('  function materializeImported(',a);vm.runInContext(source.slice(a,b),c);return c.quickAdd;}
test('V732 quantities before/after ingredient preserve food qualifiers and source text',()=>{
 for(const [text,name,grams] of [['cioccolato 20g','cioccolato',20],['20 g di cioccolato','cioccolato',20],['farina 00 0,2kg','farina 00',200],['0.5 kg zucchero','zucchero',500],['cioccolato fondente 70% (20 g)','cioccolato fondente 70%',20],['farina g 200','farina',200],['1/2 kg farina','farina',500],['1 1/2 g farina','farina',1.5],['farina 1 1/2 g','farina',1.5],['farina 1⁄2 g','farina',.5],['Cioccolato 20 g (fondente)','Cioccolato (fondente)',20]]){const r=L.parseLine(text);assert.equal(r.name,name,text);assert.equal(r.grams,grams,text);assert.equal(r.raw,text);assert.equal(r.quantity_kind,'mass');}
 for(const text of ['farina 00','cioccolato 70%','vitamina B12'])assert.equal(L.parseLine(text).name,text);
 for(const text of ['cioccolato -20g','farina - 20 g','farina 1/0 g'])assert.equal(L.parseLine(text).grams,null,text);
 assert.equal(L.parseLine('cioccolato -20g').grams,null);assert.equal(L.parseLine('cioccolato -20g').quantity_kind,'mass');
 assert.equal(L.parseLine('latte 100ml').grams,null);assert.equal(L.parseLine('latte 100ml').volumeMl,100);
});
test('V732 compact counts and repeated di retain exact household measure identity',()=>{
 for(const text of ['4spicchio di arancia','4 spicchi di arancia'])assert.equal(L.parse(text).count,4);
 for(const text of ['cucchiaio di di estratto di vaniglia','un cucchiaio di estratto di vaniglia','uno cucchiaio di estratto di vaniglia']){const x=L.parse(text);assert.equal(x.food,'estratto di vaniglia');assert.equal(x.unit,'tablespoon');assert.equal(x.count,1);}
 assert.equal(L.parse('4 spicchi di mandarini').food,'mandarino');assert.equal(L.parse('mandarini 4').unit,'whole');assert.equal(L.parse('2 cucchiaini di estratto di vaniglia').unit,'teaspoon');
});
test('V732 unsupported subportion syntax, quantity metadata and ranges cannot become whole-food grams',()=>{
 const c=env();
 for(const raw of ['arancia 4 spicchi','4 piccoli spicchi di arancia','mandarino 4 spicchi']){const r=c.applyPortionPolicy({raw,name:raw.includes('mandarino')?'mandarino':'arancia',quantity_text:'173g',estimated_piece_grams:173,unit_kind:'natural_unit'},c.appConfig);if(raw==='arancia 4 spicchi')assert.equal(r.grams,60);else assert.equal(r.grams,null,raw);}
 for(const i of [{name:'banana',raw:'banana',quantity_text:'q.b.'},{name:'mandarino',raw:'mandarino',quantity_text:'4 spicchi',count:4},{name:'arancia',raw:'arancia',quantity_text:'100 ml',unit_kind:'volume'},{name:'arancia',raw:'4spicchi',quantity_text:'560g',count:4},{name:'sale',raw:'2-3 g sale'},{name:'sale',raw:'sale 2 – 3 g'}])assert.equal(c.applyPortionPolicy(i,c.appConfig).grams,null,JSON.stringify(i));
 assert.equal(c.applyPortionPolicy({name:'arancia',raw:'arancia 20g',quantity_text:'4 spicchi',unit_kind:'volume'},c.appConfig).grams,20);
});
test('V732 actual structured URL import matches suffix grams and kilograms without AI',async()=>{
 const c=env([food('choc','cioccolato'),food('flour','farina 00'),food('sugar','zucchero')]);
 await c.importRecipe64({kind:'structured',name:'Torta',url:'https://example.test/recipe',ingredients:['cioccolato 20g','farina 00 0,2 kg','50g zucchero'],instructions:'Mescolare e cuocere.',servings:'4 porzioni'});
 assert.deepEqual(Array.from(c.review.ingredients,x=>x.name),['cioccolato','farina 00','zucchero']);assert.deepEqual(Array.from(c.review.ingredients,x=>x.grams),[20,200,50]);assert.deepEqual(Array.from(c.review.ingredients,x=>x.selectedKey),['p:choc','p:flour','p:sugar']);assert.equal(c.review.ingredients[0].raw,'cioccolato 20g');assert.equal(c.review.notes,'Mescolare e cuocere.');assert.equal(c.review.servings,'4');
});
test('V732 q.b. resolves food but never creates grams, natural-unit fallback or fake nutrition',async()=>{
 const c=env([food('salt','sale')]);c.findPortionCatalog=()=>{throw Error('q.b. cannot use a whole unit');};
 for(const text of ['sale q.b.','q.b. sale','Sale quanto basta','sale a piacere']){const p=L.parseLine(text);assert.equal(p.name.toLowerCase(),'sale');assert.equal(p.quantity_kind,'unspecified');}
 await c.importRecipe64({kind:'structured',name:'Prova',ingredients:['sale q.b.']});const i=c.review.ingredients[0];assert.equal(i.selectedKey,'p:salt');assert.equal(i.grams,null);assert.match(i.portion_assumption,/q\.b\.:.*grammi/);assert.match(S.ingredientErrors([i]).join(' '),/peso.*mancante/);
 await c.importRecipe64({kind:'structured',name:'Prova',ingredients:['sale']});assert.equal(c.review.ingredients[0].grams,null);
 for(const text of ['farina -20 g','farina - 20 g','farina 1/0 g'])assert.equal(c.applyPortionPolicy({name:'farina',raw:text},{}).grams,null,text);
 const r=c.applyPortionPolicy({name:'sale q.b.',raw:'sale q.b.',quantity_text:'100g',grams:100},{});assert.equal(r.grams,null);assert.equal(r.name,'sale');
});
test('V732 vanilla uses sourced CNF measures only for the matching extract, not pudding or heaped fills',()=>{
 const vanilla={...master.find(x=>x.id===174),resultType:'master'};
 assert.equal(L.lookup('cucchiaio di di estratto di vaniglia',vanilla).grams,13.2);assert.equal(L.lookup('2 cucchiaini di estratto di vaniglia',vanilla).grams,8.6);
 assert.match(L.lookup('1 cucchiaino di estratto di vaniglia',vanilla).sourceUrl,/canada.ca.*id=216/);
 assert.equal(L.lookup('cucchiaio di estratto di vaniglia',food('p','Vanilla pudding')),null);assert.equal(L.lookup('cucchiaio abbondante di estratto di vaniglia',vanilla),null);
});
test('V732 actual quick search and interpretation find vanilla and mandarin in full real master',async()=>{
 const c=env();c.masterIndex=master;
 const salt=c.ingredientCandidates({name:'sale',raw:'sale q.b.'});assert.equal(salt.selectedKey,'');assert.ok(salt.candidates.length);
 const vanilla=quick(c,'cucchiaio di di estratto di vaniglia');assert.equal(vanilla[0].id,174);
 const mandarin=quick(c,'4 spicchi di mandarino');assert.ok(mandarin.some(x=>L.sameFood(L.parse('4 spicchi di mandarino'),x)));
 const interpreted=await c.interpretText('cucchiaio di estratto di vaniglia');assert.equal(interpreted.localV731,true);assert.equal(interpreted.ingredients[0].grams,13.2);assert.equal(interpreted.ingredients[0].selectedKey,'m:174');
 const segments=await c.interpretText('4 spicchi di mandarino');assert.equal(segments.localV731,true);assert.equal(segments.ingredients[0].grams,null);assert.ok(segments.ingredients[0].selectedKey);assert.match(segments.ingredients[0].portion_assumption,/non del frutto intero/);
});
test('V732 quick add explicit recipe-like mass uses grams and leaves archive name unchanged',async()=>{
 const f=food('choc','cioccolato'),c=env([f]),add=quickHandler(c);c.quickQuery='cioccolato 20g';await add(f);assert.equal(c.recorded[0].grams,20);assert.equal(c.recorded[0].foodId,'choc');assert.equal(f.name,'cioccolato');assert.equal(c.created.length,0);
});
test('V732 manual mandarin segments are learned after actual confirmed diary save and reused by count',async()=>storage(async()=>{
 const f=food('mandarin','Mandarino'),c=env([f]),add=quickHandler(c);c.quickQuery='4 spicchi di mandarino';c.quickNaturalPortion=()=>{throw Error('segments cannot use whole-fruit catalog');};await add(f);assert.equal(c.recorded,undefined);assert.match(c.message,/Porzione riconosciuta/);
 c.grams='24';await add(f);assert.equal(c.recorded[0].grams,24);assert.equal(L.lookup('2 spicchi di mandarino',f).grams,12);assert.equal(L.lookup('2 mandarini',f),null);
 c.grams='';c.quickQuery='2 spicchi di mandarino';await add(f);assert.equal(c.recorded[0].grams,12);assert.equal(c.recorded[0].quantity,2);
 L.remove('segment|mandarino');assert.equal(L.lookup('2 spicchi di mandarino',f),null);
}));
test('V732 invalid or ranged quick amounts never record an extracted positive tail',async()=>{
 const f=food('flour','farina'),c=env([f]),add=quickHandler(c);for(const text of ['farina - 20 g','farina -20 g','farina 1/0 g','farina 2-3 g']){c.quickQuery=text;await add(f);assert.equal(c.recorded,undefined,text);}
});
test('V732 q.b. quick add requires user grams despite AI suggestions and does not train arbitrary amounts',async()=>storage(async()=>{
 const f=food('salt','sale'),c=env([f]),add=quickHandler(c);c.quickQuery='sale q.b.';c.quickAiResult={query:c.quickQuery,ingredient:{grams:100,candidates:[{...f,candidateKey:'p:salt'}],selectedKey:'p:salt'}};c.quickNaturalPortion=()=>{throw Error('q.b. cannot use whole unit');};await add(f);assert.equal(c.recorded,undefined);assert.match(c.message,/q\.b\./);c.grams='0,5';await add(f);assert.equal(c.recorded[0].grams,.5);assert.equal(L.read().length,0);
}));
