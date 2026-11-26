'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const wizard=require('../goals-wizard-v5.js'), source=read('app.js');
const profile={weight:72,macroPlan:{kcal:2350,perKg:{}}},goals=[{id:'kcal',target:2350,period:'day'}];
const adult={goal:'gain',age:30,sex:'male',height:170,weight:72,careContext:'none',activity:'deskTraining',trainingDays:'3-4',trainingType:'strength',mealsPerDay:'3',schedule:'regular',dietaryPattern:'omnivore',cookingTime:'quick',foodPriorities:['simple'],hydrationHabits:'regular',sleep:'regular',focus:'logging',confidence:'small'};
const meals=[{id:'breakfast',name:'Colazione mia'},{id:'morning-snack',name:'Spuntino mattina'},{id:'lunch',name:'Pranzo'},{id:'afternoon-snack',name:'Spuntino pomeriggio'},{id:'dinner',name:'Cena'},{id:'extras',name:'Extra'}];
const plain=x=>JSON.parse(JSON.stringify(x));
const noop=()=>{};
test('V5.7.3 moderate seated training PAL, no double counting, old PAL values and safeguards unchanged',()=>{
 const plan=wizard.calculatePlan(adult);assert.equal(plan.eligible,true);assert.equal(plan.bmr,1637.5);assert.equal(plan.pal,1.5);assert.equal(plan.kcal,2579);assert.equal(plan.adjustment,.05);
 assert.equal(wizard.calculatePlan({...adult,trainingDays:'5+'}).kcal,plan.kcal);
 assert.equal(wizard.calculatePlan({...adult,activity:'active'}).kcal,3095);
 assert.equal(wizard.calculatePlan({...adult,activity:'light'}).kcal,2751);
 assert.equal(wizard.calculatePlan({...adult,age:17}).eligible,false);
 assert.equal(wizard.calculatePlan({...adult,careContext:'professional'}).eligible,false);
 assert.ok(Math.abs(plan.grams.protein*4+plan.grams.carbs*4+plan.grams.fat*9-plan.kcal)<1e-8);
});
test('V5.7.3 meal plans match selected count and preserve IDs and custom names; flexible leaves list unchanged',()=>{
 const old=plain(meals);
 for(const [count,ids] of Object.entries({'3':['breakfast','lunch','dinner'],'4':['breakfast','lunch','afternoon-snack','dinner'],'4-morning':['breakfast','morning-snack','lunch','dinner'],'5':['breakfast','morning-snack','lunch','afternoon-snack','dinner']})){
  for(const schedule of ['regular','variable','shifts']){const next=wizard.mealPlan({...adult,mealsPerDay:count,schedule},meals);assert.deepEqual(next.map(x=>x.id),ids);assert.equal(next[0].name,'Colazione mia');}
 }
 assert.equal(wizard.mealPlan({...adult,mealsPerDay:'flexible'},meals),null);assert.deepEqual(meals,old);
 assert.equal(new Set(wizard.mealPlan({...adult,mealsPerDay:'3'},[{id:'lunch',name:'Colazione'}]).map(m=>m.id)).size,3);
 const guarded=wizard.applyPlan(profile,goals,{...adult,age:17},{meals});assert.equal(guarded.summary.eligible,false);assert.deepEqual(guarded.goals,goals);assert.equal(guarded.meals.length,3);
});
function env(){
 const data=new Map(), initial={profile:plain(profile),goals:plain(goals),meals:plain(meals),logs:[{id:'log',mealId:'extras',grams:100}],mealFavorites:[{id:'fav',mealId:'extras'}]};
 const c={...initial,qualityState:{version:1,days:{},times:{},allergens:[]},Q61:require('../nutrition-intelligence-v61.js'),console,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},window:{NutriTraceMealConfig:{normalize:plain}},data};
 for(const name of ['Profile','Goals','Meals','WizardOpen','WizardUndo','V5Notice','QualityState'])c['set'+name]=v=>{c[name[0].toLowerCase()+name.slice(1)]=v;};
 data.set('nutritrace_profile_v23',JSON.stringify(profile));data.set('nutritrace_goals_v23',JSON.stringify(goals));data.set('nutritrace_meals_v3',JSON.stringify(meals));
 vm.createContext(c);const a=source.indexOf('  function applyWizardResult('),b=source.indexOf('  function valueForGoal(',a);assert.ok(a>=0&&b>a);vm.runInContext(source.slice(a,b),c);return c;
}
test('V5.7.3 actual app saves and restores meals together with goals, without writing logs or favorites',()=>{
 const c=env(), oldLogs=plain(c.logs),oldFavorites=plain(c.mealFavorites);const result=wizard.applyPlan(profile,goals,adult,{meals});
 c.applyWizardResult(result);assert.equal(c.meals.length,3);assert.equal(JSON.parse(c.data.get('nutritrace_meals_v3')).length,3);assert.equal(c.goals[0].target,2579);assert.deepEqual(c.logs,oldLogs);assert.deepEqual(c.mealFavorites,oldFavorites);
 c.undoWizard();assert.deepEqual(plain(c.meals),meals);assert.deepEqual(plain(c.goals),goals);assert.deepEqual(c.logs,oldLogs);assert.deepEqual(c.mealFavorites,oldFavorites);
});
test('V5.7.3 storage failure restores previous values including undo snapshot; no UI partial apply',()=>{
 const c=env();const before=new Map(c.data);const set=c.localStorage.setItem;let once=true;c.localStorage.setItem=(k,v)=>{if(once&&k==='nutritrace_meals_v3'){once=false;throw Error('full');}set(k,v);};
 assert.throws(()=>c.applyWizardResult(wizard.applyPlan(profile,goals,adult,{meals})),/Impossibile/);assert.deepEqual(c.data,before);assert.deepEqual(c.meals,meals);assert.deepEqual(c.goals,goals);
});
test('V5.7.3 review previews meal count before Apply, then delivers it to actual app callback',async()=>{
 const state=[null,{...adult,physiologicalState:'none'},'goal','review',false,'',false,false];let pos=0,applied=null;
 const c={console,Date,Intl,React:{createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:v=>{const i=pos++;if(i>=state.length)state[i]=typeof v==='function'?v():v;return [state[i],x=>{state[i]=typeof x==='function'?x(state[i]):x;}];},useRef:()=>({current:null}),useEffect:noop}};c.window=c;vm.createContext(c);vm.runInContext(read('goals-wizard-v5.js'),c);
 function nodes(x){return x&&typeof x==='object'?[x,...(x.children||[]).flatMap(nodes)]:[];}function txt(x){return x==null||x===false?'':typeof x!=='object'?String(x):(x.children||[]).map(txt).join('');}
 const tree=c.NutriTraceGoalsWizard.View({profile,goals,meals,onApply:r=>{applied=plain(r);}});assert.match(txt(tree),/Colazione mia · Pranzo · Cena/);assert.equal(applied,null);
 await nodes(tree).find(n=>n.type==='button'&&txt(n)==='Applica obiettivi').props.onClick();assert.equal(applied.meals.length,3);assert.equal(applied.goals[0].target,2579);
});
test('V5.7.3 last Home card is day food list, detail text only enlarged',()=>{
 const home=source.slice(source.indexOf("tab==='oggi'&&h('section'"),source.indexOf("tab==='micro'&&h(V5.MicroPage"));assert.equal((home.match(/NutriTraceMealDiary.DayFoods/g)||[]).length,1);assert.ok(home.lastIndexOf('NutriTraceMealDiary.DayFoods')>home.lastIndexOf("'+ Aggiungi pasto'"));assert.match(home,/NutriTraceMealDiary\.DayFoods[^\n]+\n\s*\),\s*$/);
 assert.match(read('aurora-v5.css'),/\.v5-meal-expand\{flex:none;font-size:14px/);assert.match(read('aurora-v5.css'),/content:'Chiudi ▴';font-size:14px/);
});
