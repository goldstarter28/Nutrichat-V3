'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
function environment({more=false}={}){
 const context={console,Intl,Number,Map,Set,Object,Array,Date,Math,JSON};
 context.window=context;context.globalThis=context;context.scrollTo=()=>{};
 context.React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!==null&&x!==undefined&&x!==false)}),
  useState:()=>[more,()=>{}],useEffect:()=>{},useRef:()=>({current:null}),useMemo:fn=>fn()};
 context.NutriTraceAICoach={evaluate:()=>({})};
 return vm.createContext(context);
}
function load(context,name){vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),context,{filename:name});return context;}
function walk(node,out=[]){
 if(!node||typeof node!=='object')return out;
 if(typeof node.type==='function')return walk(node.type(node.props),out);
 out.push(node);for(const child of node.children||[])walk(child,out);return out;
}
function text(node){if(node===null||node===undefined||node===false)return '';if(typeof node!=='object')return String(node);return(node.children||[]).map(text).join(' ');}
function nodes(root,tag){return walk(root).filter(n=>n.type===tag);}
function cls(root,name){return walk(root).filter(n=>(n.props.className||'').split(' ').includes(name));}
function plain(x){return JSON.parse(JSON.stringify(x));}

test('meal totals scale by serving, include fiber, and keep unknown distinct from measured zero',()=>{
 const env=load(environment(),'meal-diary.js');
 const food={id:'a',servingGrams:50,label:{kcal:100,protein:10,carbs:0,fat:null,fiber:2}};
 const result=env.NutriTraceMealDiary.totals([{foodId:'a',grams:75},{foodId:'missing',grams:10}],[food]);
 assert.equal(result.kcal,150);assert.equal(result.protein,15);assert.equal(result.carbs,0);assert.equal(result.fiber,3);
 assert.equal(result.known.carbs,1);assert.equal(result.known.fat,0);assert.equal(result.count,2);
 const invalid=env.NutriTraceMealDiary.totals([{foodId:'a',grams:10}],[{...food,servingGrams:0}]);
 assert.equal(invalid.known.kcal,0);
});
test('meal amounts preserve explicit quantity/unit without contaminating food definitions',()=>{
 const env=load(environment(),'meal-diary.js');
 assert.equal(env.NutriTraceMealDiary.amountText({grams:155,quantity:150,unit:'ml'}),'150 ml · 155 g');
 assert.equal(env.NutriTraceMealDiary.amountText({grams:80}),'80 g');
});
test('food rows and copy action are directly visible in their meal, callbacks keep identifiers',()=>{
 const env=load(environment(),'meal-diary.js');
 const calls=[];
 const tree=env.NutriTraceMealDiary({meals:[{id:'breakfast',name:'Colazione'}],logs:[{id:'l1',foodId:'a',grams:100,mealId:'breakfast'}],
  foods:[{id:'a',name:'Yogurt',servingGrams:100,label:{kcal:70,protein:9,carbs:4,fat:2,fiber:0}}],
  onCopyYesterday:id=>calls.push(['copy',id]),onRemove:id=>calls.push(['remove',id]),onAdd:id=>calls.push(['add',id]),onAssign:(id,meal)=>calls.push(['move',id,meal])});
 assert.equal(nodes(tree,'details').length,0);
 assert.equal(cls(tree,'v5-meal-card').length,1);
 assert.equal(cls(tree,'v5-meal-food').length,1);
 assert.equal(cls(tree,'v5-day-foods').length,1);
 assert.ok(text(cls(tree,'v5-meal-macros')[0]).includes('F'));
 cls(tree,'v5-meal-copy')[0].props.onClick();
 cls(tree,'v5-meal-add')[0].props.onClick();
 cls(tree,'v5-meal-remove')[0].props.onClick();
 nodes(tree,'select')[0].props.onChange({target:{value:''}});
 assert.deepEqual(calls,[['copy','breakfast'],['add','breakfast'],['remove','l1'],['move','l1',null]]);
});
test('Altro contains only destinations absent from the primary bar, including Micro',()=>{
 const env=load(environment({more:true}),'aurora-components.js');
 const changes=[];const tree=env.NutriTraceAurora.Navigation({tab:'oggi',onChange:id=>changes.push(id)});
 const panel=cls(tree,'a-more-grid')[0];
 const labels=nodes(panel,'button').map(text);
 assert.equal(labels.length,4);
 assert.ok(labels.some(x=>x.includes('Micronutrienti')));
 assert.ok(labels.every(x=>!['Oggi','Ricerca','Obiettivi','Coach AI','Analisi'].some(primary=>x.includes(primary))));
 nodes(panel,'button').find(x=>text(x).includes('Micronutrienti')).props.onClick();
 assert.deepEqual(changes,['micro']);
 const dialog=walk(tree).find(n=>n.props.role==='dialog');
 assert.equal(dialog.props['aria-modal'],true);
});
test('meal panel delegates once to the live diary without a duplicate summary',()=>{
 const env=environment();load(env,'meal-diary.js');load(env,'aurora-components.js');
 const tree=env.NutriTraceAurora.MealDiaryPanel({meals:[{id:'breakfast',name:'Colazione'}]});
 assert.equal(cls(tree,'v5-meal-card').length,1);
 assert.equal(nodes(tree,'details').length,0);
});
test('Coach context is empty when sharing is off, and wizard sharing requires an independent opt-in',()=>{
 const env=load(environment(),'ai-coach-chat.js'), coach=env.NutriTraceAICoach;
 const profile={wizardV5:{context:{goal:'Mantenimento',activity:'Attivo',preferences:['Vegetariano'],weight:70,sex:'male',careContext:'private'},answers:{age:34,weight:70,careContext:'private'}}};
 const args={analysis:{trackedDays:3,metrics:[],insights:[]},profile,shareProfile:true,weightData:{recent:[{kg:70}]}};
 assert.deepEqual(plain(coach.sharedContext({...args,share:false})),{});
 assert.equal(coach.sharedContext({...args,share:true,shareProfile:false}).preferences,undefined);
 const shared=plain(coach.sharedContext({...args,share:true,weightData:null}));
 assert.deepEqual(shared.preferences,{goal:'Mantenimento',activity:'Attivo',preferences:['Vegetariano']});
 assert.equal(shared.weight,undefined);
 assert.ok(!JSON.stringify(shared).includes('private'));
 assert.ok(!JSON.stringify(shared).includes('answers'));
});
test('Coach profile allowlist ignores nested objects and bounds free strings',()=>{
 const env=load(environment(),'ai-coach-chat.js');
 const value=plain(env.NutriTraceAICoach.wizardContext({wizardV5:{context:{goal:'x'.repeat(500),training:{medical:'secret'},preferences:['one',{},'two']}}}));
 assert.equal(value.goal.length,180);assert.equal(value.training,undefined);assert.deepEqual(value.preferences,['one','two']);
});
