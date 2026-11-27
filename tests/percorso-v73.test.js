'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('../diary-v5'),W=require('../goals-wizard-v5'),S=require('../strategy-v64'),Q=require('../nutrition-intelligence-v61'),M=require('../metabolism-v70');
const today='2026-11-25',answers={goal:'maintain',age:35,sex:'male',physiologicalState:'none',height:160,weight:50,careContext:'none',activity:'light',trainingDays:'3-4',trainingType:'mixed',dietaryPattern:'omnivore',mealsPerDay:'4',schedule:'regular',cookingTime:'quick',foodPriorities:['simple'],hydrationHabits:'regular',sleep:'regular',focus:'logging',confidence:'small'};
const profile={weight:50,wizardV5:{completedAt:'2026-11-01',answers,calculation:{eligible:true}}},goals=[{id:'kcal',target:1800},{id:'protein',target:90},{id:'carbs',target:225},{id:'fat',target:60},{id:'fiber',target:25}];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),plain=x=>JSON.parse(JSON.stringify(x)),sum=rows=>rows.reduce((n,row)=>n+row.kcal,0);
function memory(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
function ui(storage=memory()){
 const states={},refs={};let key='root',index=0,refIndex=0;
 const c={console,Date,Intl,TextEncoder,localStorage:storage,document:{body:{}},React:{Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:v=>{const state=states[key]||(states[key]=[]),i=index++;if(!(i in state))state[i]=typeof v==='function'?v():v;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useRef:v=>{const list=refs[key]||(refs[key]=[]),i=refIndex++;return list[i]||(list[i]={current:v});},useEffect:()=>{},useMemo:fn=>fn()}};c.window=c;vm.createContext(c);
 for(const file of ['diary-v5.js','goals-wizard-v5.js','strategy-v64.js','nutrition-intelligence-v61.js','metabolism-v70.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
 return {c,states,storage,render(name,fn){key=name;index=0;refIndex=0;return fn(c);},unmount(name){delete states[name];delete refs[name];}};
}
const nodes=x=>x&&typeof x==='object'?[x,...(x.children||[]).flatMap(nodes)]:[],text=x=>x==null||x===false?'':typeof x==='object'?(x.children||[]).map(text).join(''):String(x);
const button=(tree,label)=>{const found=nodes(tree).find(x=>x.type==='button'&&text(x)===label);assert.ok(found,'button '+label);return found;};

test('V7.3 50 kg / 160 cm redistributes +/-1 kcal without a BMI or age baseline floor',()=>{
 for(const goal of ['maintain','lose'])for(const age of [35,70])for(const value of [1799,1801]){
  const p={...profile,wizardV5:{...profile.wizardV5,answers:{...answers,goal,age}}};
  const r=M.previewDay(p,goals,today,'personal',value,null,today);near(sum(r.preview),9000);near(r.week.afterMean,1800);near(r.preview[0].kcal,value);near(r.preview[1].kcal,1800-(value-1800)/4);
  const saved=M.saveDayPlans(p,goals,r.rows,today);near(S.target(saved,goals,'kcal',today),value);near(S.target(saved,goals,'kcal','2026-11-24'),1800);for(const row of r.preview)near(row.protein*4+row.carbs*4+row.fat*9,row.kcal);
 }
});
test('V7.3 manual today and same-budget redistribution work before completing any percorso',()=>{
 const p={weight:50};assert.equal(M.canEditDay(p,goals),true);assert.equal(W.policy(p).automaticNutritionAllowed,false);assert.equal(W.policy(p).organizationalOnly,false);
 const single=M.previewDay(p,goals,today,'single',1700,null,today);near(single.preview[0].kcal,1700);near(single.preview[1].kcal,1800);near(single.week.delta,-100);near(single.week.afterMean,1800-100/7);
 const balanced=M.previewDay(p,goals,today,'personal',1801,null,today);near(sum(balanced.preview),9000);near(balanced.week.delta,0);
});
test('V7.3 today-only accepts independent manual targets and Sunday; invalid numbers never save',()=>{
 const p={weight:50},sun='2026-11-29';const r=M.previewDay(p,goals,sun,'single',1100,null,sun);assert.equal(r.preview.length,1);near(r.preview[0].kcal,1100);near(r.week.delta,-700);
 for(const bad of ['',null,NaN,Infinity,0,-1,7001])assert.throws(()=>M.previewDay(p,goals,today,'single',bad,null,today));assert.throws(()=>M.previewDay(p,goals,sun,'personal',1801,null,sun),/Non ci sono/);
});
test('V7.3 today total absorbs a prior activity entry, no double counting and no future change',()=>{
 const extra=M.previewDay(profile,goals,today,'activity',600,null,today),p=M.saveDayPlans(profile,goals,extra.rows,today),single=M.previewDay(p,goals,today,'single',2000,null,today);
 near(single.preview[0].kcal,2000);near(single.preview[1].kcal,1800);assert.equal(single.rows[today].extraKcal,0);const saved=M.saveDayPlans(p,goals,single.rows,today);assert.equal(saved.activityHistoryV70[today],undefined);
});
test('V7.3 manual macro shares preserve exact energy with no hidden protein-per-weight floor',()=>{
 const p={weight:100},r=M.previewDay(p,goals,today,'single',1500,{protein:10,carbs:80,fat:10},today);near(r.preview[0].protein,37.5);near(r.preview[0].fiber,25);near(r.preview[0].protein*4+r.preview[0].carbs*4+r.preview[0].fat*9,1500);
 assert.throws(()=>M.previewDay(p,goals,today,'single',1500,{protein:10,carbs:81,fat:10},today),/100%/);
});
test('V7.3 pregnancy and lactation are independent of equation coefficient and block every automatic path',()=>{
 for(const physiologicalState of ['pregnant','lactating'])for(const sex of ['male','female','manual']){
  const a={...answers,sex,physiologicalState},p={...profile,wizardV5:{...profile.wizardV5,answers:a}},policy=W.policy(p);
  assert.equal(policy.organizationalOnly,true);assert.equal(policy.automaticNutritionAllowed,false);assert.equal(W.calculatePlan(a).eligible,false);assert.equal(S.eligibility(p,goals),null);
  const changed=W.answerWith(a,'sex','male');assert.equal(changed.physiologicalState,physiologicalState);assert.ok(W.getQuestions(changed).some(q=>q.id==='physiologicalState'));
  const applied=W.applyPlan(p,goals,a,{updateMicros:true});assert.equal(applied.summary.eligible,false);assert.deepEqual(applied.goals,goals);
  const estimate=M.estimate({profile:p,goals,today});assert.equal(estimate.status,'blocked');assert.equal(estimate.initial,null);assert.equal(estimate.tdee,null);
  assert.equal(M.proposal(p,goals,{status:'usable',tdee:2500,range:[2400,2600]}),null);assert.throws(()=>M.applyProposal(p,goals,{status:'usable',tdee:2500,range:[2400,2600],to:'2026-11-24'},today));
  assert.throws(()=>M.previewDay(p,goals,today,'personal',1801,null,today));assert.throws(()=>M.previewDay(p,goals,today,'activity',100,null,today));
  const manual=M.previewDay(p,goals,today,'single',1900,null,today);near(manual.preview[0].kcal,1900);near(manual.preview[1].kcal,1800);
 }
});
test('V7.3 top-level protected declaration cannot bypass policy through saved ordinary answers',()=>{
 const p={...profile,physiologicalState:'pregnant'};assert.equal(W.policy(p).reasonCode,'PREGNANCY');assert.equal(S.eligibility(p,goals),null);assert.equal(W.applyPlan(p,goals,answers).summary.eligible,false);assert.equal(M.estimate({profile:p,goals,today}).initial,null);
 const previous=M.previewDay(profile,goals,today,'activity',100,null,today);assert.deepEqual(M.readPlans({...p,dayPlansV70:previous.rows},goals),{});
});
test('V7.3 retained automatic deficit guard never blocks independent manual redistribution',()=>{
 const a={...answers,goal:'lose'},p={...profile,wizardV5:{...profile.wizardV5,answers:a}};assert.equal(W.calculatePlan(a).eligible,false);assert.equal(W.policy(p).reasonCode,'AUTO_DEFICIT_GUARD');assert.equal(W.policy(p).manualRedistributionAllowed,true);assert.equal(M.dayCapabilities(p,goals).redistributionAllowed,true);
});
test('V7.3 essential count stays <=20 and every coefficient can declare physiological state',()=>{
 for(const sex of ['male','female','manual'])for(const trainingDays of ['0','3-4']){const q=W.getQuestions({...answers,sex,trainingDays});assert.ok(q.length<=20);assert.ok(q.some(x=>x.id==='physiologicalState'));}
 assert.equal(W.getQuestions(answers).length,19);assert.equal(W.getQuestions({...answers,sex:'female',menstrualStatus:'menstruating'}).length,20);
});
test('V7.3 legacy preferences migrate without inventing trend magnitude or reference-weight meaning',()=>{
 const p=S.preferences({recentWeightMax:81,recentWeightTrend:'In aumento',trainingMinutes:65,trainingTime:'19:30',trainingIntensity:'Moderata',fasted:'Dopo uno spuntino'});
 assert.equal(p.recentWeightMax,81);assert.equal(p.referenceWeightV73,undefined);assert.equal(p.recentWeightTrend,'up_unspecified');assert.equal(p.trainingSessionsPerDay,1);assert.deepEqual(p.trainingSessions,[{minutes:65,time:'19:30',intensity:'Moderata',mealRelation:'Dopo uno spuntino'}]);assert.deepEqual(S.preferences(p),p);
 const rows=S.optionalAnswerSummaryV73({...profile,advancedV64:p});assert.match(rows.find(r=>r.id==='advanced-recentWeightMax-legacy').question,/massimo/);assert.match(rows.find(r=>r.id==='advanced-recentWeightTrend').answer,/non indicata/);
});
test('V7.3 1/2 sessions are conditional, bounded and included in progress and summary',()=>{
 const p=S.preferences({trainingSessionsPerDay:2,trainingSessions:[{minutes:50,time:'07:30',intensity:'Moderata',mealRelation:'Prima di colazione'},{minutes:75,time:'18:30',intensity:'Intensa',mealRelation:'Prima di cena'}]}),q=S.optionalQuestionsV73(answers,p);
 assert.ok(q.length<=19);assert.ok(q.some(x=>x.id==='trainingSession2'));assert.ok(!S.optionalQuestionsV73({...answers,trainingDays:'0'},p).some(x=>x.type==='session'));
 assert.ok(!S.optionalQuestionsV73(answers,{trainingSessionsPerDay:1}).some(x=>x.id==='trainingSession2'));
 const summary=S.optionalAnswerSummaryV73({...profile,advancedV64:p});assert.match(summary.find(x=>x.id==='advanced-trainingSession2').answer,/75 min.*18:30.*Intensa.*Prima di cena/);
 const progress=S.optionalProgressV73({preferences:p,optionalAnswered:q.map(x=>x.id).filter(id=>id!=='trainingSession2'),navigation:{phase:'question',questionId:'trainingSession2'}},answers);assert.equal(progress.complete,false);assert.equal(progress.remaining,1);
});
test('V7.3 visual body-fat ranges and measured percentages never affect calories',()=>{
 assert.equal(M.bodyFatBandsV73('male').length,8);assert.equal(M.bodyFatBandsV73('female').length,8);
 const plan=W.calculatePlan(answers),payload=W.applyPlan(profile,goals,answers);S.applyExtras(payload,{preferences:{bodyFatMethod:'visual',bodyFatRange:'v73-male-2'},distribution:'uniform'});assert.equal(payload.summary.kcal,plan.kcal);assert.equal(payload.profile.advancedV64.bodyFat,undefined);
 assert.equal(S.preferences({bodyFat:25,bodyFatMethod:'unknown'}).bodyFat,undefined);assert.equal(S.preferences({bodyFat:25}).bodyFatMethod,'legacy_estimate');
});
test('V7.3 optional completion rewards prefer-not, not partial review and not sensitive disclosure',()=>{
 const questions=S.optionalQuestionsV73(answers,{}),ids=questions.map(x=>x.id),extra={distribution:'uniform',preferences:{optionalSkippedV73:ids},optionalAnswered:ids};
 const complete=W.applyPlan(profile,goals,answers);S.applyExtras(complete,extra);assert.ok(complete.profile.optionalCompletedV73.completedAt);assert.equal(S.badgeProgress({profile:complete.profile,today}).find(b=>b.id==='optional').value,1);
 const partial=W.applyPlan(profile,goals,answers);S.applyExtras(partial,{...extra,optionalAnswered:ids.slice(0,-1)});assert.equal(partial.profile.optionalCompletedV73,undefined);
});
test('V7.3 allergy choices apply via one callback field, never by avoid text or profile duplication',()=>{
 const untouched=W.applyPlan(profile,goals,answers);S.applyExtras(untouched,{preferences:{avoid:'latte'},allergens:['milk'],allergenChoice:'unchanged'});assert.equal(Object.hasOwn(untouched,'allergens'),false);
 const p=W.applyPlan(profile,goals,answers);S.applyExtras(p,{allergens:['milk','unknown','milk','eggs'],allergenChoice:'selected'});assert.deepEqual(p.allergens,['milk','eggs']);assert.equal(p.profile.advancedV64.allergens,undefined);
 const none=W.applyPlan(profile,goals,answers);S.applyExtras(none,{allergens:['milk'],allergenChoice:'none'});assert.deepEqual(none.allergens,[]);
});
test('V7.3 persisted drafts restore optional phase, second-session question, preferences and micro choice',()=>{
 const storage=memory(),extra={preferences:{trainingSessionsPerDay:2,trainingSessions:[{minutes:30},{minutes:70,time:'18:15'}]},navigation:{phase:'question',questionId:'trainingSession2'},optionalAnswered:['trainingSession1'],allergens:['nuts'],allergenChoice:'selected'};
 assert.equal(W.saveDraft(answers,'confidence',storage,{stage:'extras',extra,updateMicros:true}),true);const draft=W.readDraft(storage);assert.equal(draft.stage,'extras');assert.equal(draft.extra.navigation.questionId,'trainingSession2');assert.equal(draft.extra.preferences.trainingSessions[1].minutes,70);assert.equal(draft.updateMicros,true);assert.deepEqual(draft.extra.allergens,['nuts']);
 W.saveDraft(answers,'confidence',storage,{stage:'review',extra});assert.equal(W.readDraft(storage).stage,'review');
});
test('V7.3 actual optional component survives unmount and preserves Back plus changing session count',()=>{
 const u=ui();let value={preferences:{trainingSessionsPerDay:2,trainingSessions:[{minutes:30},{minutes:70}]},navigation:{phase:'question',questionId:'trainingSession2'},optionalAnswered:[]},next=0;
 const render=()=>u.render('optional',c=>c.NutriTraceStrategy.WizardExtras({value,onChange:fn=>value=fn(value),answers,plan:W.calculatePlan(answers),onBack(){},onNext(){next++;}}));
 let tree=render();assert.match(text(tree),/secondo allenamento/);u.unmount('optional');tree=render();assert.match(text(tree),/secondo allenamento/);button(tree,'← Indietro').props.onClick();assert.equal(value.navigation.questionId,'trainingSession1');tree=render();button(tree,'← Indietro').props.onClick();assert.equal(value.navigation.questionId,'trainingSessionsPerDay');tree=render();button(tree,'Una sessione').props.onClick();assert.equal(value.preferences.trainingSessionsPerDay,1);assert.equal(value.navigation.questionId,'trainingSession1');tree=render();button(tree,'Continua →').props.onClick();assert.equal(value.navigation.questionId,'mealTiming');assert.equal(next,0);
});
test('V7.3 real wizard exit/resume and persisted reload return to optional question instead of fork',()=>{
 const storage=memory(),extra={preferences:{trainingSessionsPerDay:2,trainingSessions:[{minutes:30},{minutes:70}]},navigation:{phase:'question',questionId:'trainingSession2'},optionalAnswered:['trainingSession1']};W.saveDraft(answers,'confidence',storage,{stage:'extras',extra});
 const u=ui(storage),render=()=>u.render('wizard',c=>c.NutriTraceGoalsWizard.View({profile,goals,allergens:['milk'],onClose(){}}));let tree=render();button(tree,'Riprendi percorso').props.onClick();tree=render();let child=nodes(tree).find(x=>x.type===u.c.NutriTraceStrategy.WizardExtras);assert.equal(child.props.value.navigation.questionId,'trainingSession2');
 nodes(tree).find(x=>x.type==='button'&&x.props['aria-label']==='Esci dal percorso').props.onClick();tree=render();assert.ok(!nodes(tree).some(x=>x.type===u.c.NutriTraceStrategy.WizardExtras));button(tree,'Riprendi percorso').props.onClick();tree=render();child=nodes(tree).find(x=>x.type===u.c.NutriTraceStrategy.WizardExtras);assert.equal(child.props.value.navigation.questionId,'trainingSession2');
 nodes(tree).find(x=>x.type==='button'&&x.props['aria-label']==='Esci dal percorso').props.onClick();tree=render();button(tree,'Salva bozza ed esci').props.onClick();const restored=u.c.NutriTraceGoalsWizard.readDraft();assert.equal(restored.stage,'extras');assert.equal(restored.extra.navigation.questionId,'trainingSession2');assert.equal(restored.extra.preferences.trainingSessions[1].minutes,70);
 const reloaded=ui(storage),view=reloaded.render('wizard',c=>c.NutriTraceGoalsWizard.View({profile,goals,allergens:['milk'],onClose(){}}));button(view,'Riprendi percorso').props.onClick();const again=reloaded.render('wizard',c=>c.NutriTraceGoalsWizard.View({profile,goals,allergens:['milk'],onClose(){}}));assert.equal(nodes(again).find(x=>x.type===reloaded.c.NutriTraceStrategy.WizardExtras).props.value.navigation.questionId,'trainingSession2');
});
test('V7.3 quality milestone rewards seven distinct documented A/B foods, never estimates or unknown grades',()=>{
 require('../food-quality-v73');
 const foods=Array.from({length:7},(_,i)=>({id:'ab'+i,name:'Alimento '+i,servingGrams:100,label:{kcal:100},qualityV61:{nutriScore:i%2?'B':'A',nutriScoreVersion:'2023',source:'Test fixture'}}));
 const logs=foods.map(f=>({id:'log-'+f.id,foodId:f.id,date:today,grams:100})),find=(fs,ls)=>S.badgeProgress({foods:fs,logs:ls,today}).find(b=>b.id==='quality-explorer');
 assert.equal(find(foods,logs).value,7);assert.equal(find(foods,[...logs.slice(0,6),{...logs[0],id:'duplicate'}]).value,6);
 const estimate=foods.map((f,i)=>i===6?{...f,qualityV61:{...f.qualityV61,scoreEstimated:true}}:f);assert.equal(find(estimate,logs).value,6);
 const unknown=foods.map((f,i)=>i===6?{...f,qualityV61:{}}:f);assert.equal(find(unknown,logs).value,6);
 const oldVersion=foods.map((f,i)=>i===6?{...f,qualityV61:{...f.qualityV61,nutriScoreVersion:'2021'}}:f);assert.equal(find(oldVersion,logs).value,6);
 assert.equal(find(foods,logs.map((l,i)=>i===6?{...l,grams:0}:l)).value,6);assert.equal(find(foods,logs.map((l,i)=>i===6?{...l,date:'2099-01-01'}:l)).value,6);
});
