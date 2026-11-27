'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const os=require('node:os');
const Q=require('../nutrition-intelligence-v61');
const F=require('../food-quality-v73');
const base=(label={},extra={})=>({id:'f',name:'Alimento test',servingGrams:100,label:{kcal:0,energyKj:0,protein:0,carbs:0,fat:0,sugar:0,saturatedFat:0,fiber:0,salt:0,...label},...extra});
const calc=(label={},input={},extra={})=>Q.calculateNutriScore(base(label,extra),{category:'general',energyKj100:0,fvlPercent:0,confirmed:true,...input});
const tagged=(grade,kcal=100,id=grade,version='2023')=>base({kcal},{id,qualityV61:{nutriScore:grade,nutriScoreVersion:version,source:'Fonte test'}});
const entry=(foodId,grams=100,date='2026-11-23',id=foodId)=>({id,foodId,grams,date,mealId:'breakfast'});
const facts={kcal:580,energyKj:2427,protein:21,carbs:7,fat:50,saturatedFat:3.8,sugar:4.4,fiber:12.5,salt:.01};
const manual=(label={},meta={})=>base(label,{qualityV73:{taxonomy:{category:'general',fvlPercent:0,confirmed:true,source:'Etichetta verificata',...meta}}});

test('2023 general boundaries use strict greater-than for energy, sugar, salt, protein and fibre',()=>{
 for(const [field,thresholds,point] of [['sugar',[3.4,6.8,10,14,17,20,24,27,31,34,37,41,44,48,51],'sugars'],['salt',Array.from({length:20},(_,i)=>(i+1)/5),'salt'],['saturatedFat',[1,2,3,4,5,6,7,8,9,10],'saturated'],['protein',[2.4,4.8,7.2,9.6,12,14,17],'protein'],['fiber',[3,4.1,5.2,6.3,7.4],'fiber']]){
  thresholds.forEach((t,i)=>{assert.equal(calc({[field]:t}).points[point],i,field+' equality '+t);assert.equal(calc({[field]:t+.00001}).points[point],i+1,field+' above '+t);});
 }
 for(let i=1;i<=10;i++){assert.equal(calc({}, {energyKj100:335*i}).points.energy,i-1);assert.equal(calc({}, {energyKj100:335*i+.0001}).points.energy,i);}
});
test('general FVL, red-meat protein cap and cheese protein exception follow 2023 rules',()=>{
 for(const [fvl,p] of [[40,0],[40.01,1],[60,1],[60.01,2],[80,2],[80.01,5]])assert.equal(calc({}, {fvlPercent:fvl}).points.fruitVegetablesLegumes,p);
 const label={protein:25,saturatedFat:1.1};
 assert.equal(calc(label,{energyKj100:4000}).points.negative,11);
 assert.equal(calc(label,{energyKj100:4000}).points.protein,0);
 assert.equal(calc(label,{energyKj100:4000,category:'cheese'}).points.protein,7);
 assert.equal(calc({protein:25},{category:'red-meat'}).points.protein,2);
 assert.equal(calc({protein:25},{category:'general'}).points.protein,7);
 assert.equal(calc({}, {energyKj100:0}).grade,'A');
 assert.equal(calc({}, {energyKj100:336}).grade,'B');
 assert.equal(calc({}, {energyKj100:1006}).grade,'C');
 assert.equal(calc({saturatedFat:1.1},{energyKj100:4000}).grade,'D');
 assert.equal(calc({saturatedFat:9.1},{energyKj100:4000}).grade,'E');
});
test('fats/nuts/seeds use energy from saturates and exact inclusive ratio boundaries',()=>{
 const ratioThresholds=[10,16,22,28,34,40,46,52,58,64];
 ratioThresholds.forEach((t,i)=>{
  assert.equal(calc({fat:100,saturatedFat:t},{category:'fats-nuts-seeds'}).points.saturated,i+1);
  assert.equal(calc({fat:100,saturatedFat:t-.00001},{category:'fats-nuts-seeds'}).points.saturated,i);
 });
 const a=calc({fat:50,saturatedFat:3.8},{category:'fats-nuts-seeds',energyKj100:1});
 const b=calc({fat:50,saturatedFat:3.8},{category:'fats-nuts-seeds',energyKj100:4000});
 assert.deepEqual(a,b);assert.equal(a.points.energy,1);
 assert.equal(calc({fat:null,saturatedFat:0},{category:'fats-nuts-seeds'}),null);
 assert.equal(calc({fat:1,saturatedFat:2},{category:'fats-nuts-seeds'}),null);
 assert.ok(calc({fat:0,saturatedFat:0},{category:'fats-nuts-seeds'}));
});
test('fats protein gate uses TOTAL negative points <7, not only saturates/ratio',()=>{
 assert.equal(calc({fat:100,saturatedFat:16,protein:18},{category:'fats-nuts-seeds'}).points.negative,6);
 assert.equal(calc({fat:100,saturatedFat:16,protein:18},{category:'fats-nuts-seeds'}).points.protein,7);
 const seven=calc({fat:100,saturatedFat:16.3,protein:18},{category:'fats-nuts-seeds'});
 assert.equal(seven.points.negative,7);assert.equal(seven.points.protein,0);
 const noProtein=calc({fat:100,saturatedFat:16,protein:18,sugar:3.5},{category:'fats-nuts-seeds'});
 assert.equal(noProtein.points.negative,7);assert.equal(noProtein.points.protein,0);
 assert.equal(calc({fat:100,protein:2.5},{category:'fats-nuts-seeds',fvlPercent:100}).score,-6);
 assert.equal(calc({fat:100,protein:2.5},{category:'fats-nuts-seeds',fvlPercent:100}).grade,'A');
 assert.equal(calc({fat:100},{category:'fats-nuts-seeds',fvlPercent:100}).grade,'B');
});
test('beverage energy, sugar, protein and FVL tables are different from general foods',()=>{
 const b={category:'beverage',basis:'100ml',servingMl:100,nonNutritiveSweeteners:false};
 const fields=[['sugar',[.5,2,3.5,5,6,7,8,9,10,11],'sugars'],['protein',[1.2,1.5,1.8,2.1,2.4,2.7,3],'protein']];
 for(const [field,limits,key] of fields)limits.forEach((v,i)=>{assert.equal(calc({[field]:v},b).points[key],i);assert.equal(calc({[field]:v+.00001},b).points[key],i+1);});
 [30,90,150,210,240,270,300,330,360,390].forEach((v,i)=>{assert.equal(calc({}, {...b,energyKj100:v}).points.energy,i);assert.equal(calc({}, {...b,energyKj100:v+.00001}).points.energy,i+1);});
 for(const [fvl,p] of [[40,0],[40.1,2],[60,2],[60.1,4],[80,4],[80.1,6]])assert.equal(calc({}, {...b,fvlPercent:fvl}).points.fruitVegetablesLegumes,p);
 assert.equal(calc({},b).grade,'B');assert.equal(calc({}, {...b,nonNutritiveSweeteners:true}).grade,'C');
 assert.equal(calc({}, {...b,energyKj100:150}).grade,'B');
 assert.equal(calc({}, {...b,energyKj100:151}).grade,'C');
 assert.equal(calc({}, {...b,energyKj100:301}).grade,'D');
 assert.equal(calc({}, {...b,energyKj100:391}).grade,'E');
});
test('only confirmed plain water can receive beverage A, without a mandatory nutrient declaration',()=>{
 assert.equal(Q.calculateNutriScore({}, {category:'beverage',water:true,waterConfirmed:true,confirmed:true}).grade,'A');
 assert.equal(Q.calculateNutriScore({}, {category:'beverage',water:true,confirmed:true}),null);
 assert.equal(calc({}, {category:'beverage',basis:'100ml',servingMl:100,nonNutritiveSweeteners:false,water:false}).grade,'B');
 const water=base({}, {name:'Acqua minerale',masterId:'water'});assert.equal(F.resolve(water).grade,'A');
 const flavoured={...water,name:'Acqua aromatizzata'};assert.equal(F.resolve(flavoured).grade,null);
});
test('beverage mass-to-volume conversion requires a declared density; no hidden 1g=1ml',()=>{
 const milk=base({kcal:64,protein:3.4,fat:3.6,saturatedFat:2.3,sugar:4.8,fiber:0,salt:.1},{name:'Latte intero',masterId:'milk'});
 assert.equal(F.resolve(milk).grade,null);assert.ok(F.resolve(milk).missing.includes('basis'));
 const known={...milk,qualityV73:{densityGPerMl:1.03,densityConfirmed:true}};
 assert.ok(F.resolve(known).grade);assert.equal(F.resolve(known).category,'beverage');
 assert.equal(calc({}, {category:'beverage',basis:'100ml',nonNutritiveSweeteners:false}),null);
 assert.equal(calc({}, {category:'beverage',basis:'100ml',servingMl:100}),null);
});
test('non-nutritive sweeteners differ from excluded polyols; absent ingredient list is unknown',()=>{
 assert.equal(F.sweeteners({ingredients:'acqua, E950, aromi'}),true);
 assert.equal(F.sweeteners({ingredients:'acqua, glicosidi steviolici'}),true);
 assert.equal(F.sweeteners({ingredients:'acqua, eritritolo, E968',qualityV73:{ingredientsComplete:true}}),false);
 assert.equal(F.sweeteners({ingredients:'E953'}),null);
 assert.equal(F.sweeteners({ingredients:''}),null);
 assert.equal(F.sweeteners({ingredients:'acqua',qualityV73:{ingredientsComplete:true}}),false);
});
test('plain almonds are auto-classified under fats/nuts/seeds and never general by AI',()=>{
 const almonds=base(facts,{name:'Mandorle',masterId:'almonds',officialName:'Almonds, raw'});
 const result=F.resolve(almonds);assert.equal(result.category,'fats-nuts-seeds');assert.equal(result.grade,'A');assert.equal(result.method,'calculated');assert.equal(result.comparable,true);
 assert.equal(Q.calculateNutriScore(almonds,{category:'general',confirmed:true,energyKj100:2427,fvlPercent:0}),null);
 assert.equal(Q.scoreEstimate({...almonds,masterId:null},{category:'general',reason:'mandorle',fvlPercent:0,missing:{}}),null);
 assert.equal(F.resolve({...almonds,name:'Torta alle mandorle',officialName:'Almond cake'}).grade,null);
 assert.equal(F.resolve({...almonds,name:'Castagne',officialName:'Chestnuts, raw'}).category,'general');
});
test('FVL for olive oil is counted, walnut oil/nuts are not; no guessed zero for composites',()=>{
 const olive=base({fat:100,saturatedFat:14,sugar:0,salt:0,protein:0,fiber:0},{name:'Olio extravergine di oliva',masterId:'olive'});
 assert.equal(F.inputFor(olive).input.fvlPercent,100);assert.equal(F.resolve(olive).grade,'B');
 const walnut={...olive,name:'Olio di noci'};assert.equal(F.inputFor(walnut).input.fvlPercent,0);
 const composite=base(facts,{name:'Snack alle noci',masterId:'snack'});assert.equal(F.resolve(composite).grade,null);assert.ok(F.resolve(composite).missing.includes('fvlPercent'));
 const branded=base(facts,{name:'Mandorle',brand:'Snack company',masterId:null});assert.equal(F.resolve(branded).grade,null);
});
test('unknown is never zero; explicit zero stays valid and quarantined values cannot be used',()=>{
 const declared=manual();assert.equal(F.resolve(declared).grade,'A');
 for(const value of [null,undefined,'',NaN]){const f={...declared,label:{...declared.label,fiber:value}};const r=F.resolve(f);assert.equal(r.grade,'A');assert.equal(r.method,'calculated-partial');assert.equal(r.score,null);assert.deepEqual(r.bounds,{minimumScore:-5,maximumScore:0});assert.ok(r.missing.includes('fiber'));assert.equal(f.label.fiber,value);}
 const quarantined={...declared,labelProvenance:{fiber:{status:'quarantined_audit'}}};assert.equal(F.resolve(quarantined).grade,null);
 const partial=manual({sugar:0,salt:0,fiber:0});assert.equal(F.resolve(partial).grade,'A');
});
test('estimated nutrients are separated by default and cannot leak through legacy qualitySummary',()=>{
 const f={...manual(),labelProvenance:{fiber:{estimated:true,method:'ai'}}};
 assert.equal(F.resolve(f).grade,null);assert.equal(F.resolve(f,{includeEstimates:true}).method,'estimated');
 assert.equal(Q.quality(f).score,null);assert.equal(Q.qualitySummary([entry('f')],[{...f,label:{...f.label,kcal:100}}]).nutriScoreKcal.unknown,100);
 const e={...manual(),labelProvenance:{energyKj:{estimated:true}}};assert.equal(F.resolve(e).grade,null);
 const legacy={...manual(),sources:[{name:'AI · stima integrativa'}]};assert.equal(F.resolve(legacy).grade,null);assert.equal(F.resolve(legacy,{includeEstimates:true}).method,'estimated');
});
test('reported 2023 grade preserves provenance; old version stays visible but out of averages',()=>{
 const a=tagged('B',100);assert.equal(F.resolve(a).method,'reported');assert.equal(F.resolve(a).source,'Fonte test');
 const old=tagged('A',100,'old','2017');assert.equal(F.resolve(old).grade,'A');assert.equal(F.resolve(old).comparable,false);
 assert.equal(F.summarize([entry('old')],[old]).index,null);
 const fake=base({}, {grade:'A',qualityGrade:'A',masterId:'f'});assert.equal(F.resolve(fake).grade,null);
 const demo={...a,demoSynthetic:true};assert.equal(F.resolve(demo).synthetic,true);assert.match(F.resolve(demo).source,/DEMO/);
});
test('period index is energy-weighted from records, never a mean of meal/day means',()=>{
 const foods=[tagged('A',100,'a'),tagged('E',100,'e')],logs=[entry('a',100,'2026-11-23'),entry('e',900,'2026-11-24')];
 const s=F.summarize(logs,foods);assert.equal(s.index,10.9);assert.equal(s.grade,'E');assert.equal(s.abShare,.1);assert.equal(s.coverage,1);assert.equal(s.byGrade.E,900);
 const split=[entry('a',100),...Array.from({length:9},(_,i)=>entry('e',100,'2026-11-24','split'+i))];assert.equal(F.summarize(split,foods).index,s.index);
 const annual=F.history(logs,foods,{period:'year',anchor:'2026-11-26'});assert.equal(annual.summary.index,10.9);assert.equal(annual.points[10].index,10.9);
});
test('unknown grade, missing energy, removed foods and zero-energy water remain distinct',()=>{
 const foods=[tagged('A',100,'a'),base({kcal:100},{id:'unknown'}),base({kcal:null},{id:'noenergy'}),tagged('A',0,'water')];
 const s=F.summarize([entry('a'),entry('unknown'),entry('noenergy'),entry('deleted'),entry('water')],foods);
 assert.equal(s.index,100);assert.equal(s.coverage,.5);assert.equal(s.unknownGradeKcal,100);assert.equal(s.knownKcal,200);assert.equal(s.missingEnergyEntries,2);assert.equal(s.missingFoodEntries,1);assert.equal(s.energyMassCoverage,.6);
 assert.equal(F.summarize([entry('water')],foods).index,null);assert.equal(F.summarize([],foods).index,null);
 const low=F.summarize([entry('a',1),entry('unknown',999)],foods);assert.equal(low.coverage,.001);assert.equal(low.index,100);
});
test('estimates toggle includes only explicitly requested estimates and records their energy share',()=>{
 const f=manual({kcal:100,energyKj:418}),e={...f,id:'e',labelProvenance:{fiber:{estimated:true}}};
 const off=F.summarize([entry('f'),entry('e')],[f,e]),on=F.summarize([entry('f'),entry('e')],[f,e],{includeEstimates:true});
 assert.equal(off.classifiedKcal,100);assert.equal(off.unknownGradeKcal,100);assert.equal(off.byMethod.estimated,0);assert.equal(on.classifiedKcal,200);assert.equal(on.byMethod.estimated,100);
});
test('calendar week, leap February, full year and prior-year navigation preserve exact dates',()=>{
 assert.deepEqual(F.periodBounds('week','2026-11-29'),{period:'week',anchor:'2026-11-29',start:'2026-11-23',end:'2026-11-29'});
 assert.equal(F.periodBounds('month','2024-02-20').end,'2024-02-29');assert.equal(F.periodBounds('year','2024-02-20').end,'2024-12-31');
 assert.equal(F.movePeriod('month','2024-03-31',-1),'2024-02-01');assert.equal(F.movePeriod('year','2024-02-29',-1),'2023-01-01');
 assert.throws(()=>F.periodBounds('month','2026-02-29'));assert.throws(()=>F.periodBounds('nonsense','2026-11-26'));
 const f=tagged('A',100,'a'),logs=[entry('a',100,'2023-12-31'),entry('a',100,'2024-01-01'),entry('a',100,'2024-02-29'),entry('a',100,'2024-12-31'),entry('a',100,'2025-01-01')];
 const annual=F.history(logs,[f],{period:'year',anchor:'2024-07-01'});assert.equal(annual.points.length,12);assert.equal(annual.summary.entries,3);assert.equal(annual.points[2].index,null);assert.equal(annual.points[11].knownKcal,100);
 assert.equal(F.history(logs,[f],{period:'month',anchor:'2024-02-01'}).points.length,29);
});
test('source fusion requires stable common identity and refuses raw/cooked, milk types and products',()=>{
 const a=base({fiber:null},{name:'Riso crudo',masterId:'rice',sources:[{name:'DB1'}]});
 assert.equal(F.complementFields(a,base({fiber:2},{name:'Riso cotto',masterId:'rice',sources:[{name:'DB2'}]})).changed,false);
 assert.equal(F.identityMatch({...a,name:'Latte intero'},{...a,name:'Latte scremato'}).match,false);
 assert.equal(F.identityMatch({...a,name:'Latte intero'},{...a,name:'Latte intero senza lattosio'}).match,false);
 assert.equal(F.identityMatch({...a,masterId:null},{...a,masterId:null,id:'other'}).match,false);
 assert.equal(F.identityMatch({...a,barcode:'123'},{...a,barcode:'456'}).match,false);
 assert.equal(F.identityMatch({...a,masterId:'one'},{...a,masterId:'two'}).match,false);
});
test('source fusion fills only missing values at correct basis, retaining zero, provenance and original records',()=>{
 const target=base({fiber:null,salt:0},{name:'Riso crudo',masterId:'rice',servingGrams:50,nutrients:[],sources:[{name:'DB1',reference:'v1'}]}),source=base({fiber:4,salt:1},{id:'source',name:'Riso crudo',masterId:'rice',sources:[{name:'DB2',reference:'v2'}],labelProvenance:{fiber:{source:'DB2',status:'available'}},nutrients:[{id:'fe',name:'Ferro',canonicalId:'iron',amount:2,unit:'mg',source:'DB2'}]});
 const r=F.complementFields(target,source);assert.equal(r.changed,true);assert.equal(r.food.label.fiber,2);assert.equal(r.food.label.salt,0);assert.ok(r.conflicts.includes('salt'));assert.equal(r.food.nutrients[0].amount,1);assert.equal(r.food.nutrients[0].unit,'mg');assert.equal(r.food.labelProvenance.fiber.originalValue,4);assert.equal(r.food.labelProvenance.fiber.identity,'master:rice');assert.equal(r.food.sources.length,2);
 assert.equal(target.label.fiber,null);assert.equal(source.label.fiber,4);assert.equal(F.complementFields(r.food,source).changed,false);
});
test('fusion does not bypass quarantine or import AI values, and does not collapse nutrient forms',()=>{
 const a=base({fiber:null,sugar:null},{masterId:'m',labelProvenance:{fiber:{status:'quarantined_audit'}},nutrients:[{name:'Vitamina A',form:'retinolo',amount:1,unit:'mg',source:'DB'}]});
 const b=base({fiber:3,sugar:4},{masterId:'m',labelProvenance:{sugar:{estimated:true}},sources:[{name:'DB'}],nutrients:[{name:'Vitamina A',form:'beta-carotene',amount:2,unit:'mg',source:'DB'}]});
 const r=F.complementFields(a,b);assert.equal(r.food.label.fiber,null);assert.equal(r.food.label.sugar,null);assert.equal(r.food.nutrients.length,2);
});
test('audit gives actual counts and missing fields; does not imply whole-master coverage',()=>{
 const list=[tagged('A'),manual(),base(),base({}, {qualityV61:{nutriScore:'A',nutriScoreVersion:'2017'}})];
 const a=F.auditFoods(list);assert.equal(a.total,4);assert.equal(a.reported2023,1);assert.equal(a.calculated2023,1);assert.equal(a.otherVersion,1);assert.equal(a.unknown,1);assert.equal(a.documentedCoverage,.5);
});
test('partial computation only emits an invariant letter with a known category; incomplete inputs are preserved',()=>{
 const uncertain=manual({energyKj:700,fiber:null});assert.equal(F.resolve(uncertain).grade,null);assert.equal(uncertain.label.fiber,null);
 const definite=manual({energyKj:4000,saturatedFat:20,salt:3,sugar:null,fiber:null},{fvlPercent:null});
 const r=F.resolve(definite);assert.equal(r.grade,'E');assert.equal(r.method,'calculated-partial');assert.equal(r.score,null);assert.ok(r.bounds.minimumScore<=r.bounds.maximumScore);assert.ok(r.missing.includes('fvlPercent'));assert.match(r.reason,/grado invariato/);
 for(const sugar of [0,3.4,3.41,6.8,6.81,10,10.01,20,20.01,34,34.01,51,51.01,100])for(const fiber of [0,3,3.01,4.1,4.11,5.2,5.21,6.3,6.31,7.4,7.41,100])for(const fvl of [0,40,40.01,60,60.01,80,80.01,100]){
  const c=Q.calculateNutriScore({...definite,label:{...definite.label,sugar,fiber}},{category:'general',energyKj100:4000,confirmed:true,fvlPercent:fvl});assert.equal(c.grade,r.grade);assert.ok(c.score>=r.bounds.minimumScore&&c.score<=r.bounds.maximumScore);
 }
 assert.equal(F.resolve({...definite,qualityV73:{}}).grade,null);
 assert.equal(F.taxonomy(base(facts,{masterId:'dish',masterCategory:'Mixed Dishes',name:'Dinner plate'})),null);
 const summary=F.summarize([entry('f')],[{...definite,label:{...definite.label,kcal:100}}]);assert.equal(summary.byMethod['calculated-partial'],100);
});
test('real DB descriptor rules distinguish simple foods and composite or different-category names',()=>{
 for(const [name,category] of [['Nuts, almonds, dried, unblanched, unroasted','fats-nuts-seeds'],['Apple, raw, without skin','general'],['Chicken, broiler, breast, skinless, boneless, meat, raw','general'],['Beef, tenderloin, separable lean and fat, trimmed to 0 mm fat, raw','red-meat']]){
  const f=base(facts,{name,officialName:name,masterId:'test'});assert.equal(F.taxonomy(f).category,category,name);
 }
 for(const name of ['Nuts, almonds, with chocolate and dried fruit','Apple cake','Chicken with broccoli and cheese stuffing','Yogurt drink','Milk, human, breast milk'])assert.equal(F.simpleIdentity(base(facts,{masterId:'f',name,officialName:name})),null,name);
});
test('derived search index validates revision and exposes partial provenance without converting it to official',()=>{
 const bundle={schema:'nutritrace-quality-v73',version:1,algorithm:'2023',manifestRevision:'v1|date',source:'SPF',byId:{1:['A','calculated','general',[],0],2:['E','calculated-partial','general',['fiber'],0]}};
 assert.equal(F.indexResult(bundle,1,{runtime_version:'v1',built_at:'date'}).grade,'A');assert.equal(F.indexResult(bundle,1,{runtime_version:'v2',built_at:'date'}).grade,null);
 const partial=F.indexResult(bundle,2);assert.equal(partial.bounded,true);assert.equal(partial.method,'calculated-partial');assert.match(partial.reason,/grado invariato/);assert.equal(F.indexResult(bundle,500).grade,null);
});
test('read-only index verification rejects changed sources and tampered derived letters',()=>{
 const {verifyIndex}=require('../scripts/audit-food-quality-v73');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nt-quality-')),file=path.join(dir,'quality.json');
 const bundle={schema:'nutritrace-quality-v73',version:1,algorithm:'2023',manifestRevision:'v1',sourceFingerprint:'hash1',byId:{1:['A','calculated','general',[],0]},report:{completeAudit:true,total:1}};
 try{
  fs.writeFileSync(file,JSON.stringify(bundle));assert.equal(verifyIndex(bundle,file).verified,true);
  assert.throws(()=>verifyIndex({...bundle,sourceFingerprint:'hash2'},file),/hash/);
  fs.writeFileSync(file,JSON.stringify({...bundle,byId:{1:['E','calculated','general',[],0]}}));assert.throws(()=>verifyIndex(bundle,file),/lettere/);
  assert.throws(()=>verifyIndex({...bundle,report:{completeAudit:false}},file),/incompleto/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

function ui(){let state=[],position=0;const context={console,Date,Intl,React:{createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:v=>{const i=position++;if(!(i in state))state[i]=typeof v==='function'?v():v;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useMemo:f=>f(),useId:()=>'test-chart'}};vm.createContext(context);for(const file of ['nutrition-intelligence-v61.js','food-quality-v73.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);return {context,render:props=>{position=0;return context.NutriTraceFoodQualityV73.QualityHistoryPanel(props);}};}
function nodes(x){return x&&typeof x==='object'?[x,...(x.children||[]).flatMap(nodes)]:[];}
function text(x){return x==null||x===false?'':typeof x==='object'?(x.children||[]).map(text).join(''):String(x);}
test('quality panel period/date controls work and chart has accessible gaps instead of zeros',()=>{
 const u=ui(),props={today:'2026-11-26',foods:[tagged('A',100,'a')],logs:[entry('a',100,'2026-11-23'),entry('a',100,'2026-11-25')]};
 let tree=u.render(props);const chart=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='Chart');const svg=chart.type(chart.props);assert.equal(nodes(svg).filter(n=>n.type==='polyline').length,2);assert.equal(nodes(svg).filter(n=>n.type==='circle').length,2);assert.equal(nodes(svg).find(n=>n.type==='svg').props.role,'img');
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Anno').props.onClick();tree=u.render(props);assert.match(text(tree),/2026/);assert.ok(nodes(tree).some(n=>n.type==='select'));
 nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']==='Periodo precedente').props.onClick();tree=u.render(props);assert.ok(nodes(tree).some(n=>n.type==='select'&&n.props.value===2025));
 nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});tree=u.render(props);assert.match(text(tree),/Stime incluse/);
});
test('badge shows estimates and synthetic demo labels independently of color',()=>{
 const u=ui(),B=u.context.NutriTraceFoodQualityV73.GradeBadge;
 assert.match(text(B({result:{grade:'C',method:'estimated',comparable:true}})),/Stima/);
 assert.match(text(B({food:{...tagged('B'),demoSynthetic:true}})),/Demo/);
 assert.match(B({food:base()}).props['aria-label'],/non disponibile/);
});
