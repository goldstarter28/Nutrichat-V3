'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('../diary-v5'),W=require('../goals-wizard-v5'),S=require('../strategy-v64'),Q=require('../nutrition-intelligence-v61'),M=require('../metabolism-v70'),P=require('../planner-v72'),Quality=require('../food-quality-v73');
const Env=require('../environment-v73'),Demo=require('../demo-data-v73');
const today='2026-11-26',plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,tolerance=1e-4)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function storage(limit=Infinity){
 const data=new Map();return {getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem(k,v){k=String(k);v=String(v);const next=new Map(data);next.set(k,v);const bytes=[...next].reduce((sum,[key,value])=>sum+(key.length+value.length)*2,0);if(bytes>limit)throw Object.assign(new Error('QuotaExceededError'),{name:'QuotaExceededError'});data.set(k,v);},removeItem:k=>data.delete(String(k)),key:i=>[...data.keys()][i]??null,clear:()=>data.clear(),get length(){return data.size;},snapshot:()=>Object.fromEntries([...data].sort((a,b)=>a[0].localeCompare(b[0]))),bytes:()=>[...data].reduce((sum,[k,v])=>sum+(k.length+v.length)*2,0)};
}
function environments(native=storage(),session=storage()){
 return {native,session,personal:Env.create({storage:native,sessionStorage:session,url:'https://nutritrace.example/?env=personal'}),demo:Env.create({storage:native,sessionStorage:session,url:'https://nutritrace.example/?env=demo'})};
}
function inEnv(env,fn){const before=globalThis.NutriTraceEnvironment;globalThis.NutriTraceEnvironment=env;try{return fn();}finally{globalThis.NutriTraceEnvironment=before;}}
function estimate(data){return M.estimate({profile:data.profile,goals:data.goals,logs:data.logs,foods:data.foods,qualityState:data.quality,weights:data.bodyWeight.entries,today:data.manifest.today});}

test('V7.3 synthetic datasets contain 91/365/1096 real calendar dates with linked food/recipe/meal IDs',()=>{
 for(const days of [91,365,1096]){
  const data=Demo.generate({days,today}),dates=new Set(data.logs.map(l=>l.date)),foodIds=new Set(data.foods.map(f=>f.id)),mealIds=new Set(data.meals.map(m=>m.id));
  assert.equal(dates.size,days);assert.equal([...dates].sort().at(-1),today);assert.equal([...dates].sort()[0],Q.shift(today,1-days));assert.equal(data.bodyWeight.entries.length,days);assert.equal(new Set(data.logs.map(l=>l.id)).size,data.logs.length);
  assert.ok(data.logs.every(l=>Q.validDate(l.date)&&l.id.startsWith('demo-')&&l.grams>0&&foodIds.has(l.foodId)&&mealIds.has(l.mealId)));
  assert.ok(data.foods.every(f=>f.demoSynthetic===true&&f.sources.some(s=>/DEMO/.test(s.name))));assert.equal(data.manifest.synthetic,true);assert.equal(data.manifest.recordCount,data.logs.length);
  assert.equal(D.normalizeRecipes(data.recipes).length,data.recipes.length);assert.equal(P.normalize(data.profile.plannerV72).plans.length,1);assert.equal(P.normalize(data.profile.plannerV72).pantry.length,2);assert.equal(Object.keys(data.hydration.days).length,days);
  assert.equal(data.profile.targetEpochV70,Q.shift(today,1-days));assert.deepEqual(S.preferences(data.profile.advancedV64),data.profile.advancedV64);assert.equal(data.profile.advancedV64.trainingSessions.length,2);assert.equal(data.profile.optionalCompletedV73,undefined);assert.equal(W.policy(data.profile).automaticNutritionAllowed,true);assert.equal(data.profile.wizardV5.answers.physiologicalState,'none');
 }
});
test('V7.3 demo today is partial, each of the prior 56 days has a valid complete signature',()=>{
 const data=Demo.generate({days:91,today}),state=Q.normalizeState(data.quality);
 for(let i=0;i<=56;i++){const date=Q.shift(today,-i),logs=data.logs.filter(l=>l.date===date);assert.equal(Q.status(state,date,logs),i===0?'partial':'complete');near(D.stats(logs,data.foods,{id:'kcal'}).sum,2400,1e-4);}
 const yesterday=Q.shift(today,-1),modified=data.logs.filter(l=>l.date===yesterday).map((l,i)=>i?l:{...l,grams:l.grams+1});assert.notEqual(Q.status(state,yesterday,modified),'complete');
});
test('V7.3 stable three-year demo runs actual observational TDEE at 2400 without fabricated eligibility',()=>{
 for(const days of [91,365,1096]){const data=Demo.generate({scenario:'stable',days,today}),model=estimate(data);assert.equal(model.status,'usable');assert.equal(model.days,56);assert.equal(model.weighDays,56);near(model.tdee,2400);near(model.trend,0);assert.ok(model.range[0]<2400&&model.range[1]>2400);}
});
test('V7.3 loss/gain fixtures produce correct actual energy-balance direction and approximate programmed slope',()=>{
 const loss=Demo.generate({scenario:'loss',days:365,today}),gain=Demo.generate({scenario:'gain',days:365,today}),a=estimate(loss),b=estimate(gain);
 assert.equal(a.status,'usable');assert.equal(b.status,'usable');assert.ok(a.tdee>2400);assert.ok(b.tdee<2400);near(a.trend,-.084,.003);near(b.trend,.084,.003);assert.equal(loss.profile.advancedV64.recentWeightTrend,'slight_down');assert.equal(gain.profile.advancedV64.recentWeightTrend,'slight_up');
});
test('V7.3 missing observations and noisy weights produce insufficient actual TDEE, no proposal',()=>{
 for(const scenario of ['gaps','noise']){const data=Demo.generate({scenario,days:1096,today}),model=estimate(data);assert.equal(model.status,'insufficient');assert.equal(model.tdee,null);assert.equal(M.proposal(data.profile,data.goals,model),null);if(scenario==='gaps'){assert.ok(new Set(data.logs.map(l=>l.date)).size<1096);assert.ok(data.bodyWeight.entries.length<1096);}else assert.match(model.reason,/variabile|rapida/);}
});
test('V7.3 demo grades and annual chart are computed from synthetic facts; incomplete food stays unknown',()=>{
 const data=Demo.generate({days:1096,today});const unknown=data.foods.find(f=>f.id==='demo-unknown');assert.equal(Quality.resolve(unknown).grade,null);
 const chart=Quality.history(data.logs,data.foods,{period:'year',anchor:today});assert.ok(chart.summary);assert.ok(chart.summary.coverage<1);assert.ok(chart.summary.coverage>0);assert.ok(chart.points.length>=12);
});
test('V7.3 generation rejects bad options and is deterministic apart from creation timestamp',()=>{
 for(const options of [{days:90},{scenario:'bad'},{today:'2026-02-30'},{today:'today'}])assert.throws(()=>Demo.generate(options));
 const a=Demo.generate({scenario:'loss',days:91,today}),b=Demo.generate({scenario:'loss',days:91,today});delete a.manifest.createdAt;delete b.manifest.createdAt;assert.deepEqual(a,b);
});
test('V7.3 personal/demo get, set, enumeration, clear and reset never cross namespaces',()=>{
 const e=environments();e.native.setItem('unrelated-app','unmodified');e.personal.storage.setItem('nutritrace_logs','personal');e.demo.storage.setItem('nutritrace_logs','demo');e.demo.storage.setItem('nutritrace_profile_v23','synthetic');
 assert.equal(e.personal.storage.getItem('nutritrace_logs'),'personal');assert.equal(e.demo.storage.getItem('nutritrace_logs'),'demo');assert.equal(e.personal.storage.length,1);assert.equal(e.demo.storage.length,2);assert.equal(e.personal.storage.key(0),'nutritrace_logs');assert.equal(e.demo.storage.key(1),'nutritrace_profile_v23');
 assert.throws(()=>e.demo.storage.getItem('unrelated-app'));assert.throws(()=>e.personal.storage.getItem(Env.PREFIX+'nutritrace_logs'));assert.throws(()=>e.personal.resetDemo());
 e.demo.storage.clear();assert.equal(e.demo.storage.length,0);assert.equal(e.personal.storage.getItem('nutritrace_logs'),'personal');assert.equal(e.native.getItem('unrelated-app'),'unmodified');e.demo.storage.setItem('nutritrace_logs','demo2');e.personal.storage.clear();assert.equal(e.demo.storage.getItem('nutritrace_logs'),'demo2');assert.equal(e.native.getItem('unrelated-app'),'unmodified');
});
test('V7.3 environment switch reloads explicit URL and preserves other URL parts without copying data',()=>{
 const native=storage(),session=storage();let destination='';const env=Env.create({storage:native,sessionStorage:session,url:'https://nutritrace.example/app?x=1&env=personal#today',navigate:url=>destination=url});env.storage.setItem('nutritrace_logs','personal');const before=native.snapshot(),url=env.switchTo('demo');assert.equal(destination,url);assert.equal(new URL(url).searchParams.get('env'),'demo');assert.equal(new URL(url).searchParams.get('x'),'1');assert.equal(new URL(url).hash,'#today');assert.deepEqual(native.snapshot(),before);assert.equal(session.getItem(Env.SESSION),'demo');assert.equal(Env.create({storage:native,sessionStorage:session,url:'https://nutritrace.example/'}).isDemo,true);assert.equal(Env.create({storage:native,sessionStorage:session,url:'https://nutritrace.example/?env=personal'}).isDemo,false);assert.throws(()=>env.switchTo('prod'));
});
test('V7.3 actual app IndexedDB open uses distinct database namespaces',async()=>{
 const e=environments(),opened=[],databases=new Map(),source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),start=source.indexOf('function openDb()'),end=source.indexOf('async function dbSet(',start);
 const c={window:{NutriTraceEnvironment:e.personal},indexedDB:{open(name){opened.push(name);if(!databases.has(name))databases.set(name,{name,records:new Map()});const req={result:databases.get(name)};queueMicrotask(()=>req.onsuccess());return req;}}};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 const personal=await c.openDb();personal.records.set('foods','personal catalog');c.window.NutriTraceEnvironment=e.demo;const demo=await c.openDb();demo.records.set('foods','demo catalog');assert.notEqual(personal,demo);assert.equal(personal.records.get('foods'),'personal catalog');assert.equal(demo.records.get('foods'),'demo catalog');assert.deepEqual(opened,['nutritrace-db','nutritrace-demo-v73-nutritrace-db']);
});
test('V7.3 quota failure rolls back in reverse order, including removed keys and prior growth',()=>{
 const e=environments(storage(4500));e.demo.storage.setItem('nutritrace_a','a'.repeat(1000));e.demo.storage.setItem('nutritrace_b','b'.repeat(1000));const before=e.native.snapshot();
 assert.throws(()=>e.demo.transaction([['nutritrace_a',null],['nutritrace_b','b'.repeat(2000)],['nutritrace_c','c'.repeat(3000)]]),/Quota/);assert.deepEqual(e.native.snapshot(),before);
});
test('V7.3 demo seed only runs in demo, survives regeneration failure, and never alters personal data',()=>{
 const e=environments(storage(900000));e.personal.storage.setItem('nutritrace_logs','PERSONAL LOGS');e.personal.storage.setItem('nutritrace_body_weight_v1','PERSONAL WEIGHTS');const original=e.native.snapshot();
 assert.throws(()=>inEnv(e.personal,()=>Demo.seed({days:91,today})),/solo.*demo/);assert.deepEqual(e.native.snapshot(),original);
 const manifest=inEnv(e.demo,()=>Demo.seed({days:91,today}));assert.equal(manifest.days,91);assert.equal(e.personal.storage.getItem('nutritrace_logs'),'PERSONAL LOGS');assert.equal(e.personal.storage.getItem('nutritrace_body_weight_v1'),'PERSONAL WEIGHTS');const before=e.native.snapshot();
 assert.throws(()=>inEnv(e.demo,()=>Demo.seed({days:1096,today})),/Quota/);assert.deepEqual(e.native.snapshot(),before);assert.equal(JSON.parse(e.demo.storage.getItem(Demo.KEY)).days,91);e.demo.resetDemo();assert.deepEqual(e.native.snapshot(),original);
});
test('V7.3 full three-year seed fits a five-MiB fixture including modest personal data',()=>{
 const e=environments(storage(5*1024*1024));e.personal.storage.setItem('nutritrace_logs','PERSONAL'.repeat(1000));inEnv(e.demo,()=>Demo.seed({days:1096,today}));assert.ok(e.native.bytes()<5*1024*1024);assert.equal(JSON.parse(e.demo.storage.getItem(Demo.KEY)).days,1096);assert.equal(e.personal.storage.getItem('nutritrace_logs'),'PERSONAL'.repeat(1000));
});
test('V7.3 real draft, quality, weight and badge APIs read only the active environment',()=>{
 const e=environments(),data=Demo.generate({days:91,today});e.personal.storage.setItem('nutritrace_body_weight_v1',JSON.stringify({entries:[{date:today,kg:81}]}));e.demo.storage.setItem('nutritrace_body_weight_v1',JSON.stringify({entries:[{date:today,kg:75}]}));e.demo.storage.setItem('nutritrace_badges_v641',JSON.stringify({optional:today+'T12:00:00Z'}));
 inEnv(e.demo,()=>{assert.equal(W.saveDraft(data.profile.wizardV5.answers,'confidence'),true);Q.update(state=>({...state,allergens:['milk']}));assert.equal(M.loadWeights().entries[0].kg,75);assert.ok(S.readBadgeLedger().optional);});
 inEnv(e.personal,()=>{assert.equal(W.readDraft(),null);assert.deepEqual(Q.read().allergens,[]);assert.equal(M.loadWeights().entries[0].kg,81);assert.equal(S.readBadgeLedger().optional,undefined);});
 inEnv(e.demo,()=>{assert.equal(W.readDraft().questionId,'confidence');assert.deepEqual(Q.read().allergens,['milk']);});
});
