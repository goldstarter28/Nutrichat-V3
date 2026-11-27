'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('../diary-v5'),W=require('../goals-wizard-v5'),S=require('../strategy-v64'),Q=require('../nutrition-intelligence-v61'),M=require('../metabolism-v70'),Demo=require('../demo-data-v73'),Env=require('../environment-v73');
const today='2026-11-27',plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const answers={goal:'lose',age:35,sex:'male',physiologicalState:'none',height:170,weight:50,careContext:'none',activity:'light',trainingDays:'3-4',trainingType:'mixed',dietaryPattern:'omnivore',mealsPerDay:'4',schedule:'regular',cookingTime:'quick',foodPriorities:['simple'],hydrationHabits:'regular',sleep:'regular',focus:'logging',confidence:'small'};
const profile={weight:50,wizardV5:{completedAt:today,answers,calculation:W.calculatePlan(answers)}},goals=[{id:'kcal',target:1800},{id:'protein',target:90},{id:'carbs',target:225},{id:'fat',target:60},{id:'fiber',target:25}];
function storage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,clear:()=>m.clear(),get length(){return m.size;},snapshot:()=>[...m]};}
function inEnvironment(environment,fn){const previous=globalThis.NutriTraceEnvironment;globalThis.NutriTraceEnvironment=environment;try{return fn();}finally{globalThis.NutriTraceEnvironment=previous;}}
function estimate(data){return M.estimate({profile:data.profile,goals:data.goals,logs:data.logs,foods:data.foods,qualityState:data.quality,weights:data.bodyWeight.entries,today:data.manifest.today});}
function ui(store=storage()){
 const states={},refs={};let key='root',index=0,refIndex=0;
 const c={console,Date,Intl,TextEncoder,localStorage:store,document:{body:{}},React:{Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:v=>{const state=states[key]||(states[key]=[]),i=index++;if(!(i in state))state[i]=typeof v==='function'?v():v;return [state[i],next=>state[i]=typeof next==='function'?next(state[i]):next];},useRef:v=>{const list=refs[key]||(refs[key]=[]),i=refIndex++;return list[i]||(list[i]={current:v});},useEffect:()=>{},useMemo:fn=>fn()}};c.window=c;vm.createContext(c);
 for(const name of ['diary-v5.js','goals-wizard-v5.js','strategy-v64.js','nutrition-intelligence-v61.js','metabolism-v70.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c);
 return {c,store,render(name,fn){key=name;index=0;refIndex=0;return fn(c);}};
}
const nodes=x=>x&&typeof x==='object'?[x,...(x.children||[]).flatMap(nodes)]:[],text=x=>x==null||x===false?'':typeof x==='object'?(x.children||[]).map(text).join(''):String(x);
const button=(tree,label)=>{const node=nodes(tree).find(n=>n.type==='button'&&text(n)===label);assert.ok(node,label);return node;};

test('V7.3.2 weekly redistribution at 50 kg / 170 cm preserves budget without the automatic BMI gate',()=>{
 assert.equal(W.calculatePlan(answers).eligible,false);assert.equal(S.eligibility(profile,goals),null);assert.ok(S.weeklyEligibility(profile,goals));
 const strategy=S.createStrategy(profile,goals,[5,6],15,today),p={...profile,weeklyStrategyV64:strategy};assert.equal(strategy.start,'2026-11-30');
 const week=S.active(p,goals,'2026-12-05');assert.ok(week);near(week.reduce((n,row)=>n+row.kcal,0),12600);near(week[5].kcal,2070);near(week[6].kcal,2070);near(week[0].kcal,1692);
 for(const row of week){near(row.protein,90);near(row.fat,60);near(row.fiber,25);assert.ok(Math.abs(row.kcal-1800)<=1800*.15+1e-6);}
 near(S.target(p,goals,'kcal','2026-12-05'),2070);near(S.target(p,goals,'kcal','2026-11-29'),1800);
 assert.throws(()=>S.createStrategy(profile,goals,[5,6],16,today),/15%/);assert.throws(()=>S.createStrategy(profile,[{id:'kcal',target:1200},...goals.slice(1)],[5,6],15,today),/limiti/);
 assert.equal(S.active({...p,wizardV5:{...p.wizardV5,answers:{...answers,age:17}}},goals,'2026-12-05'),null);
});

test('V7.3.2 weekly arithmetic retains pregnancy, lactation, underage and professional-context exclusions',()=>{
 for(const changes of [{physiologicalState:'pregnant'},{physiologicalState:'lactating'},{age:17},{careContext:'professional'},{careContext:'unknown'}]){
  const p={...profile,wizardV5:{...profile.wizardV5,answers:{...answers,...changes}}};assert.equal(S.weeklyEligibility(p,goals),null);assert.throws(()=>S.createStrategy(p,goals,[5,6],5,today));
 }
 assert.equal(S.weeklyEligibility({...profile,physiologicalState:'pregnant'},goals),null);assert.equal(S.weeklyPlanV732({...profile,physiologicalState:'pregnant'},goals,answers,{eligible:true,kcal:1800,grams:{protein:90,carbs:225,fat:60}}).eligible,false);
 const deficit={...answers,weight:55,goal:'lose'};assert.equal(W.calculatePlan(deficit).eligible,false);assert.equal(W.policy({weight:55,wizardV5:{answers:deficit}}).reasonCode,'AUTO_DEFICIT_GUARD');
});

test('V7.3.2 percorso offers weekend distribution of existing goals and never invents an automatic energy plan',()=>{
 const u=ui(),plan=W.calculatePlan(answers);let extra={distribution:'uniform',days:[5,6],percent:15,average:'',preferences:{}};
 const render=()=>u.render('extras',c=>c.NutriTraceStrategy.WizardExtras({profile,goals,answers,plan,value:extra,onChange:f=>extra=f(extra),onBack(){},onNext(){}}));
 let tree=render();button(tree,'Più calorie in alcuni giorni (es. sabato e domenica)').props.onClick();tree=render();assert.match(text(tree),/La media resta invariata/);
 const meanInput=nodes(tree).find(n=>n.type==='input'&&n.props.readOnly);assert.ok(meanInput);assert.equal(meanInput.props.value,1800);
 const manual=S.weeklyPlanV732(profile,goals,answers,plan);assert.equal(manual.manualDistribution,true);assert.throws(()=>S.adjustedBase(manual,1801),/resta invariata/);
 const payload=W.applyPlan(profile,goals,answers);S.applyExtras(payload,extra);assert.equal(payload.summary.eligible,false);assert.equal(payload.summary.manualWeeklyV732,true);assert.deepEqual(payload.goals,goals);assert.deepEqual(payload.profile.macroPlan,profile.macroPlan);assert.equal(payload.profile.weeklyStrategyV64.enabled,true);
});

test('V7.3.2 actual percorso review identifies unchanged mean and explicit distribution confirmation',()=>{
 const u=ui(),extra={distribution:'variable',days:[5,6],percent:15,average:'',preferences:{},navigation:{phase:'weekly',questionId:'steps'}};
 assert.equal(u.c.NutriTraceGoalsWizard.saveDraft(answers,'confidence',undefined,{stage:'review',extra}),true);
 const render=()=>u.render('wizard',c=>c.NutriTraceGoalsWizard.View({profile,goals,onClose(){}}));let tree=render();button(tree,'Riprendi percorso').props.onClick();tree=render();
 assert.match(text(tree),/Media attuale invariata/);assert.match(text(tree),/Non viene calcolato un nuovo fabbisogno/);assert.ok(button(tree,'Salva preferenze e distribuzione'));
});

test('V7.3.2 realistic demo starts assisted with a real usable observational TDEE in every duration',()=>{
 for(const days of [91,365,1096]){
  const data=Demo.generate({scenario:'realistic',days,today}),model=estimate(data);assert.equal(data.profile.metabolismModeV70,'assisted');assert.equal(model.status,'usable');assert.equal(model.days,56);assert.equal(model.weighDays,56);assert.equal(model.tdee,2234);assert.deepEqual(model.range,[2002,2465]);assert.equal(M.proposal(data.profile,data.goals,model),null);
  assert.equal(data.manifest.synthetic,true);assert.equal(data.profile.wizardV5.answers.goal,'maintain');assert.equal(data.profile.shareProfile,undefined);assert.equal(data.profile.shareNutrition,undefined);
 }
});

test('V7.3.2 existing demo receives missing mode only, never changing personal data or explicit demo choices',()=>{
 const native=storage(),session=storage(),personal=Env.create({storage:native,sessionStorage:session,url:'https://example.test/?env=personal'}),demo=Env.create({storage:native,sessionStorage:session,url:'https://example.test/?env=demo'});
 personal.storage.setItem('nutritrace_profile_v23',JSON.stringify({weight:81,metabolismModeV70:'manual'}));demo.storage.setItem(Demo.KEY,JSON.stringify({synthetic:true,scenario:'realistic'}));demo.storage.setItem('nutritrace_profile_v23',JSON.stringify({weight:74}));
 const originalPersonal=personal.storage.getItem('nutritrace_profile_v23');assert.equal(inEnvironment(personal,()=>Demo.enableAssistedModeV732()),false);assert.equal(inEnvironment(demo,()=>Demo.enableAssistedModeV732()),true);assert.equal(JSON.parse(demo.storage.getItem('nutritrace_profile_v23')).metabolismModeV70,'assisted');assert.equal(inEnvironment(demo,()=>Demo.enableAssistedModeV732()),false);
 demo.storage.setItem('nutritrace_profile_v23',JSON.stringify({weight:74,metabolismModeV70:'manual'}));assert.equal(inEnvironment(demo,()=>Demo.enableAssistedModeV732()),false);assert.equal(JSON.parse(demo.storage.getItem('nutritrace_profile_v23')).metabolismModeV70,'manual');assert.equal(personal.storage.getItem('nutritrace_profile_v23'),originalPersonal);
});

test('V7.3.2 assisted and adaptive panels use demo data and require separate review then confirmation',()=>{
 const data=Demo.generate({scenario:'realistic',days:1096,today});
 // Explicit test edit in the synthetic environment, like changing demo goals in the app.
 const goals=data.goals.map(g=>g.id==='kcal'?{...g,target:1800}:g);const before=plain(goals),store=storage();store.setItem('nutritrace_body_weight_v1',JSON.stringify(data.bodyWeight));
 for(const mode of ['assisted','adaptive']){
  const u=ui(store);let applied=null,count=0;const p={...data.profile,metabolismModeV70:mode};const render=()=>u.render(mode,c=>c.NutriTraceMetabolism.Panel({profile:p,goals,logs:data.logs,foods:data.foods,qualityState:data.quality,today,onMode(){},onApply:r=>{applied=r;count++;}}));
  let tree=render();assert.match(text(tree),/2[.]?234 kcal/);assert.equal(count,0);if(mode==='assisted'){assert.ok(!nodes(tree).some(n=>n.type==='button'&&text(n)==='Rivedi proposta'));button(tree,'Calcola proposta').props.onClick();tree=render();}
  assert.match(text(tree),/Proposta: 1[.]?890 kcal/);button(tree,'Rivedi proposta').props.onClick();tree=render();assert.equal(count,0);assert.deepEqual(goals,before);button(tree,'Conferma nuovi obiettivi').props.onClick();assert.equal(count,1);assert.equal(applied.goals[0].target,1890);assert.equal(applied.profile.goalHistoryV70.at(-1).date,today);assert.deepEqual(goals,before);
 }
});
