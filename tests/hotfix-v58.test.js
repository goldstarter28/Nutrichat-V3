'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const wizard=require('../goals-wizard-v5.js'),D=require('../diary-v5.js'),mealDiary=require('../meal-diary.js');
const plain=x=>JSON.parse(JSON.stringify(x)),noop=()=>{};
const adult={goal:'gain',age:30,sex:'male',height:170,weight:72,careContext:'none',activity:'deskTraining',trainingDays:'3-4',trainingType:'strength',mealsPerDay:'3',schedule:'regular',dietaryPattern:'omnivore',cookingTime:'quick',foodPriorities:['simple'],hydrationHabits:'regular',sleep:'regular',focus:'logging',confidence:'small'};
function nodes(x){return x&&typeof x==='object'?[x,...(x.children||[]).flatMap(nodes)]:[];}
function txt(x){return x==null||x===false?'':typeof x!=='object'?String(x):(x.children||[]).map(txt).join('');}
function byClass(x,n){return nodes(x).find(y=>(y.props.className||'').split(' ').includes(n));}
function wizardUI(answers,id){
 const state=[null,plain(answers),id,'questions',false,'',false,false],refs=[];let pos=0,rpos=0;
 const c={console,Date,Intl,React:{createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:v=>{const i=pos++;if(i>=state.length)state[i]=typeof v==='function'?v():v;return[state[i],x=>{state[i]=typeof x==='function'?x(state[i]):x;}];},useRef:v=>{const i=rpos++;return refs[i]||(refs[i]={current:v});},useEffect:noop}};c.window=c;vm.createContext(c);vm.runInContext(read('goals-wizard-v5.js'),c);
 return{state,render(){pos=0;rpos=0;return c.NutriTraceGoalsWizard.View({profile:{},goals:[],meals:[]});}};
}
test('V5.8 single-choice click advances, Back stays present, and repeated click cannot advance twice',()=>{
 const u=wizardUI(adult,'goal'),tree=u.render(),option=nodes(tree).find(n=>n.type==='button'&&txt(n).includes('Mantenere il mio equilibrio'));
 assert.ok(option);assert.ok(byClass(tree,'v58-back'));assert.equal(byClass(tree,'v58-next'),undefined);
 option.props.onClick();assert.equal(u.state[1].goal,'maintain');assert.equal(u.state[2],'age');option.props.onClick();assert.equal(u.state[2],'age');
 const second=u.render();assert.ok(byClass(second,'v58-next'));assert.equal(byClass(second,'v58-next').props.form,'v58-wizard-question-form');
});
test('V5.8 conditional single choices skip irrelevant questions, discard stale dependent answers',()=>{
 const input={...adult,sex:'female',physiologicalState:'none',menstrualStatus:'menstruating'};
 const male=wizard.answerWith(input,'sex','male');assert.equal(male.physiologicalState,undefined);assert.equal(male.menstrualStatus,undefined);assert.equal(input.sex,'female');
 const nonTraining=wizard.answerWith(input,'trainingDays','0');assert.equal(nonTraining.trainingType,undefined);assert.equal(wizard.nextStep(nonTraining,'trainingDays').questionId,'dietaryPattern');
 const u=wizardUI(input,'trainingDays');const tree=u.render();nodes(tree).find(n=>n.type==='button'&&txt(n)==='Per ora non mi alleno').props.onClick();assert.equal(u.state[2],'dietaryPattern');assert.equal(u.state[1].trainingType,undefined);
});
test('V5.8 multiple answers need Continue and numeric answers need confirmation',()=>{
 const u=wizardUI(adult,'foodPriorities');const tree=u.render();assert.match(txt(byClass(tree,'v58-multi-label')),/Risposta multipla/);assert.ok(byClass(tree,'v58-next'));const checkbox=nodes(tree).find(n=>n.type==='input'&&n.props.value==='variety');checkbox.props.onChange();assert.equal(u.state[2],'foodPriorities');assert.ok(u.state[1].foodPriorities.includes('variety'));
 const next=u.render();nodes(next).find(n=>n.type==='form').props.onSubmit({preventDefault:noop});assert.notEqual(u.state[2],'foodPriorities');
 const num=wizardUI(adult,'age');const nt=num.render();nodes(nt).find(n=>n.type==='input').props.onChange({target:{value:'4'}});assert.equal(num.state[2],'age');assert.equal(byClass(num.render(),'v58-next').props.disabled,true);
});
test('V5.8 completed questionnaire summary reads saved answers only, is immutable, respects conditional questions',()=>{
 const profile={weight:90,wizardV5:{completedAt:'2026-11-24',answers:{...adult,physiologicalState:'pregnant',mealsPerDay:'4'}}};const before=plain(profile);const rows=wizard.completedAnswers(profile);
 assert.equal(rows.find(r=>r.id==='weight').answer,'72 kg');assert.match(rows.find(r=>r.id==='mealsPerDay').answer,/pomeriggio/);assert.equal(rows.some(r=>r.id==='physiologicalState'),false);assert.deepEqual(profile,before);assert.deepEqual(wizard.completedAnswers({}),[]);assert.deepEqual(wizard.completedAnswers({wizardV5:{answers:adult}}),[]);
});
test('V5.8 six recent foods are meal-specific, distinct, chronological and preserve last portion',()=>{
 const foods=Array.from({length:9},(_,i)=>({id:String(i),name:'Alimento '+i}));const day='2026-11-24';const logs=foods.map((f,i)=>({id:'a'+i,foodId:f.id,grams:50+i,mealId:i===8?'lunch':'breakfast',date:day}));logs.push({id:'b',foodId:'2',grams:123,date:day,mealId:'breakfast'},{id:'c',foodId:'2',grams:234,date:day,mealId:'lunch'});
 const meal=D.recentFoods(logs,foods,6,day,'breakfast');assert.equal(meal.length,6);assert.equal(meal[0].id,'2');assert.equal(meal[0].recentLog.grams,123);assert.ok(meal.every(f=>f.recentLog.mealId==='breakfast'));assert.equal(new Set(meal.map(f=>f.id)).size,6);assert.equal(D.recentFoods(logs,foods,6,day)[0].recentLog.grams,234);assert.deepEqual(D.recentFoods(logs,foods,6,day,'dinner'),[]);assert.equal(foods[2].grams,undefined);
});
function quickEnv({recent=true,modal=true,meal='b',cancel=false,fail=false}={}){
 const food={id:'a',name:'Latte',resultType:'personal'},row={...food,...(recent?{recentLog:{grams:200,quantity:200,unit:'ml',gramsPerUnit:1}}:{})};const c={DiaryV5:D,console,foods:[food],quickQuery:recent?'':'Latte',grams:recent?'':'150',selectedDate:'2026-11-24',activeMealId:meal,entryOpen:modal,mutationLock:{current:false},fmt:String,explicitMassFromText:()=>null,quickNaturalPortion:()=>null,chooseMeal:async id=>cancel?null:id||'b',newId:()=>String(Math.random()),writes:[],resetTextEntry:noop};
 for(const key of ['RecipeBusy','AiMsg','EntryFeedback','V5Notice','QuickQuery','QuickSearchQuery','Grams','QuickSelected','EntryOpen'])c['set'+key]=v=>{c[key[0].toLowerCase()+key.slice(1)]=v;};
 c.persistDiaryBatch=(created,logs)=>{if(fail)throw Error('storage full');c.writes.push(...plain(logs));};
 const src=read('app.js');vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  async function quickAdd(r)'),src.indexOf('  function materializeImported(')),c);return{c,row};
}
test('V5.8 actual recent add keeps dialog open and permits multiple additions; regular search closes',async()=>{
 const {c,row}=quickEnv();await c.quickAdd(row);assert.equal(c.entryOpen,true);assert.equal(c.writes[0].mealId,'b');assert.equal(c.writes[0].grams,200);assert.match(c.entryFeedback,/aggiunti/);await c.quickAdd(row);assert.equal(c.writes.length,2);assert.equal(c.mutationLock.current,false);
 const regular=quickEnv({recent:false});await regular.c.quickAdd(regular.row);assert.equal(regular.c.entryOpen,false);assert.equal(regular.c.writes[0].grams,150);
});
test('V5.8 cancelled meal picker and storage errors never show false success or close popup',async()=>{
 for(const options of [{cancel:true,meal:null},{fail:true}]){const {c,row}=quickEnv(options);await c.quickAdd(row);assert.equal(c.writes.length,0);assert.equal(c.entryOpen,true);assert.equal(c.entryFeedback,'');assert.equal(c.mutationLock.current,false);if(options.fail)assert.match(c.aiMsg,/storage full/);}
});
test('V5.8 favorite weight edit preserves ID, portion unit, factor and other favorites, rejects invalid and duplicates',()=>{
 const old=[{id:'x',foodId:'a',mealId:'b',grams:100,quantity:2,unit:'pz',gramsPerUnit:50},{id:'y',foodId:'a',mealId:'b',grams:200,quantity:4,unit:'pz',gramsPerUnit:50}];const snapshot=plain(old);
 const next=mealDiary.updateFavoriteWeight(old,'x','125,5');assert.equal(next[0].grams,125.5);assert.equal(next[0].quantity,2.51);assert.equal(next[0].unit,'pz');assert.equal(next[0].id,'x');assert.equal(next[1],old[1]);assert.deepEqual(old,snapshot);
 for(const value of [null,'',0,-1,10001,'a',true,Infinity])assert.throws(()=>mealDiary.updateFavoriteWeight(old,'x',value));assert.throws(()=>mealDiary.updateFavoriteWeight(old,'x',200),/Esiste già/);assert.throws(()=>mealDiary.updateFavoriteWeight(old,'missing',150));
});
test('V5.8 meal summary includes quantities, partial explanation only in details, edit and add favorite separate',()=>{
 const c={console,React:{createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)})}};c.window=c;vm.createContext(c);vm.runInContext(read('meal-diary.js'),c);
 const calls=[],food={id:'a',name:'Latte',label:{kcal:40,protein:4,carbs:5,fat:null,fiber:0}};const favorite={id:'f',mealId:'b',foodId:'a',grams:200,quantity:200,unit:'g'};
 function resolve(x){return x&&typeof x==='object'?(typeof x.type==='function'?resolve(x.type(x.props)):{...x,children:x.children.map(resolve)}):x;}
 const t=resolve(c.NutriTraceMealDiary({meals:[{id:'b',name:'Colazione'}],logs:[{id:'l',foodId:'a',mealId:'b',grams:200}],foods:[food],favorites:[favorite],onEditFood:id=>calls.push(['food',id]),onEditFavorite:id=>calls.push(['edit',id]),onQuickFavorite:f=>calls.push(['add',f.id])}));
 assert.match(txt(byClass(t,'v5-meal-inline-names')),/Latte 200 g/);assert.match(txt(byClass(t,'v5-meal-foods')),/N\/D/);assert.doesNotMatch(txt(t),/Totale parziale\. N\/D/);byClass(t,'v58-edit-food').props.onClick();byClass(t,'v58-favorite-weight').props.onClick();byClass(t,'v5-meal-favorite-add').props.onClick();assert.deepEqual(calls,[['food','a'],['edit','f'],['add','f']]);
});
test('V5.8 uses one existing add flow, scopes recent list and keeps scientific and strategy code unchanged',()=>{
 const a=read('app.js');assert.match(a,/recentFoods\(logs,foods,6,deviceToday,entryOpen\?entryRecentMeal:null\)/);assert.match(a,/onQuickAdd:tab==='oggi'\?\(\)=>openEntry\(null\):undefined/);assert.match(a,/Rifai il percorso/);assert.match(a,/Riepilogo risposte/);assert.match(a,/Ricette salvate/);assert.equal(wizard.calculatePlan(adult).kcal,2579);assert.equal(wizard.calculatePlan({...adult,age:17}).eligible,false);
});
