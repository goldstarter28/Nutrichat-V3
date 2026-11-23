'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const src=read('app.js'),coachSrc=read('ai-coach-chat.js'),wizard=require('../goals-wizard-v5.js'),D=require('../diary-v5.js');
const plain=x=>JSON.parse(JSON.stringify(x));
const noop=()=>{};
function extract(c,start,end){const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);vm.runInContext(src.slice(a,b),c);}
function entryEnvironment({modal=true,mode='single',meal='b'}={}){
 const review={mode,recipe_name:'Pasto test',yieldOverride:100,consumed_grams:50,ingredients:[{name:'Yogurt',grams:100,selectedKey:'p:a',ambiguity:'none'}]};
 const c={console,Date,structuredClone,DiaryV5:D,foods:[{id:'a',name:'Yogurt',servingGrams:100}],meals:[{id:'b'}],selectedDate:'2026-11-23',activeMealId:meal,recipeDestination:{date:'2026-11-23',mealId:meal},recipeText:'100 g yogurt',recipeReview:review,recipeMsg:'vecchio messaggio',recipeBusy:'',entryOpen:modal,entryMode:'text',liveReview:{current:review},recipeRequest:{current:5},speechRef:{current:null},mutationLock:{current:false},liveData:{current:{recipes:[]}},candidateBrowserIndex:0,candidatePreview:{old:true},photoReviewOpen:false,notice:null,writes:[],chooseMeal:async id=>id,fmt:String};
 let next=0;c.newId=()=>`new-${++next}`;
 for(const key of ['RecipeReview','RecipeDestination','RecipeMsg','RecipeBusy','CandidateBrowserIndex','CandidatePreview','CandidatePreviewBusy','PhotoReviewOpen','Listening','RecipeText','EntryOpen','EntryMode','DirectCapture','V5Notice','SelectedMealId','QuickQuery','QuickSearchQuery','Grams','QuickSelected','AiMsg']){const property=key[0].toLowerCase()+key.slice(1);c['set'+key]=value=>{c[property]=typeof value==='function'?value(c[property]):value;};}
 c.persistDiaryBatch=(created,logs,recipes)=>{c.writes.push({created:plain(created),logs:plain(logs),recipes:recipes?plain(recipes):null});if(recipes)c.liveData.current.recipes=recipes;};
 vm.createContext(c);
 extract(c,'  function stopEntryDictation(){','  function openDirectCapture(');
 extract(c,'  async function addSavedRecipe(','  function removeSavedRecipe(');
 extract(c,'async function commitRecipe(options={})','  async function downloadMasterOffline(');
 extract(c,'  async function interpretRecipe(){','  async function quickSearchWithAI(');
 return c;
}
function assertEmpty(c){assert.equal(c.recipeText,'');assert.equal(c.recipeReview,null);assert.equal(c.liveReview.current,null);assert.equal(c.recipeDestination,null);assert.equal(c.recipeMsg,'');assert.equal(c.recipeBusy,'');assert.equal(c.candidatePreview,null);}
test('V5.7.2 real commit clears voice review after successful diary write from both Home and meal dialog',async()=>{
 for(const modal of [true,false])for(const mode of ['single','multi','recipe']){const c=entryEnvironment({modal,mode});await c.commitRecipe();assertEmpty(c);assert.equal(c.entryOpen,false);assert.equal(c.writes.length,1);assert.equal(c.writes[0].logs[0].grams,mode==='recipe'?50:100);assert.equal(c.writes[0].logs[0].mealId,'b');assert.ok(c.v5Notice.text.includes('aggiunt'));}
});
test('V5.7.2 cancellation and failed validation or persistence never discard a review',async()=>{
 for(const kind of ['cancel','invalid','write-fails']){const c=entryEnvironment();const original=c.recipeReview;if(kind==='cancel')c.chooseMeal=async()=>null;if(kind==='invalid')c.recipeReview.ingredients[0].grams=0;if(kind==='write-fails')c.persistDiaryBatch=()=>{throw Error('storage full');};await c.commitRecipe();assert.equal(c.entryOpen,true);assert.equal(c.recipeReview,original);assert.equal(c.recipeText,'100 g yogurt');assert.equal(c.writes.length,0);assert.equal(c.mutationLock.current,false);if(kind!=='cancel')assert.ok(c.recipeMsg);}
});
test('V5.7.2 save only persists recipe but not diary, reopen or add saved recipe clears old review',async()=>{
 const c=entryEnvironment({mode:'recipe'});await c.commitRecipe({saveOnly:true});assertEmpty(c);assert.equal(c.entryMode,'recipes');assert.equal(c.entryOpen,true);assert.equal(c.writes[0].logs.length,0);assert.equal(c.writes[0].recipes.length,1);const saved=c.writes[0].recipes[0];c.editSavedRecipe(saved);assert.equal(c.recipeReview.recipeId,saved.id);c.closeEntry();assertEmpty(c);c.openEntry('b');assertEmpty(c);assert.equal(c.entryOpen,true);c.recipeText='stale';c.recipeReview={old:true};await c.addSavedRecipe(saved,25);assertEmpty(c);assert.equal(c.entryOpen,false);assert.equal(c.writes[1].logs[0].grams,25);
});
test('V5.7.2 closing or reopening invalidates in-flight interpretation and detaches late dictation',async()=>{
 const c=entryEnvironment();let resolve;let aborts=0;c.speechRef.current={onresult:noop,onerror:noop,onend:noop,abort:()=>aborts++};const recognizer=c.speechRef.current;c.interpretText=()=>new Promise(r=>{resolve=r;});const pending=c.interpretRecipe();assert.equal(aborts,1);assert.equal(recognizer.onresult,null);c.closeEntry();c.openEntry('b');resolve({mode:'single',ingredients:[{name:'Stale'}]});await pending;assertEmpty(c);assert.equal(c.writes.length,0);
});
const adult={goal:'lose',age:35,sex:'male',height:178,weight:61,careContext:'none',activity:'light',trainingDays:'0',dietaryPattern:'omnivore',mealsPerDay:'3',schedule:'regular',cookingTime:'quick',foodPriorities:['simple'],hydrationHabits:'regular',sleep:'regular',focus:'logging',confidence:'small'};
test('V5.7.2 deficit guard gives exact reason; maintenance is independently checked, no new automatic deficit',()=>{
 const low=wizard.calculatePlan(adult);assert.equal(low.eligible,false);assert.equal(low.maintenanceAvailable,true);assert.match(low.reason,/BMI/);assert.equal(low.restriction,'DEFICIT_GUARD');
 const older=wizard.calculatePlan({...adult,weight:75,age:70});assert.equal(older.eligible,false);assert.match(older.reason,/65 anni/);assert.equal(older.maintenanceAvailable,true);
 for(const x of [{age:17},{age:18},{age:79},{weight:45},{careContext:'professional'},{careContext:'unknown'},{sex:'female',physiologicalState:'pregnant'}]){const plan=wizard.calculatePlan({...adult,...x});assert.equal(plan.eligible,false);assert.notEqual(plan.maintenanceAvailable,true);}
 const eligible=wizard.calculatePlan({...adult,weight:75});assert.equal(eligible.eligible,true);assert.equal(eligible.adjustment,-0.10);
 const alternative=wizard.calculatePlan({...adult,goal:'maintain'});assert.equal(alternative.eligible,true);assert.equal(alternative.adjustment,0);assert.equal(alternative.kcal,2484);
});
function nodes(x){return x&&typeof x==='object'?[x,...(x.children||[]).flatMap(nodes)]:[];}
function text(x){return x==null||x===false?'':typeof x!=='object'?String(x):(x.children||[]).map(text).join('');}
test('V5.7.2 real wizard view requires explicit switch and Apply; preserves other answers and saves calculated goals',async()=>{
 const state=[null,adult,'goal','review',false,'',false,false];let pos=0,applied=null;
 const c={console,Date,Intl,React:{createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:v=>{const i=pos++;if(i>=state.length)state[i]=typeof v==='function'?v():v;return [state[i],x=>{state[i]=typeof x==='function'?x(state[i]):x;}];},useRef:()=>({current:null}),useEffect:noop}};c.window=c;vm.createContext(c);vm.runInContext(read('goals-wizard-v5.js'),c);
 const profile={weight:72,macroPlan:{calorieMode:'fixed',kcal:2350,perKg:{}}},goals=[{id:'kcal',target:2350,targetMode:'absolute',period:'day'}];
 const render=()=>{pos=0;return c.NutriTraceGoalsWizard.View({profile,goals,onApply:r=>{applied=plain(r);}});};
 let tree=render();const button=nodes(tree).find(x=>x.type==='button'&&text(x)==='Calcola mantenimento');assert.ok(button);assert.equal(applied,null);button.props.onClick();assert.equal(state[1].goal,'maintain');assert.equal(state[1].weight,adult.weight);assert.equal(applied,null);tree=render();assert.ok(nodes(tree).some(x=>text(x)==='Energia stimata al giorno'));await nodes(tree).find(x=>x.type==='button'&&text(x)==='Applica obiettivi').props.onClick();assert.equal(applied.summary.eligible,true);assert.equal(applied.goals[0].target,2484);assert.equal(applied.profile.wizardV5.answers.goal,'maintain');
});
function coachEnvironment(storage){const c={console,React:{createElement:noop,useState:noop,useEffect:noop,useMemo:noop,useRef:noop},NutriTraceAICoach:{evaluate:noop},localStorage:storage};c.window=c;vm.createContext(c);vm.runInContext(coachSrc,c);return c.NutriTraceAICoach;}
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}
test('V5.7.2 profile invite claimed once across chats and reloads, including denied browser storage',()=>{const store=storage();const a=coachEnvironment(store);assert.equal(a.claimProfileInvite(store),true);assert.equal(a.claimProfileInvite(store),false);assert.equal(coachEnvironment(store).claimProfileInvite(store),false);const broken=coachEnvironment(null);assert.equal(broken.claimProfileInvite(null),true);assert.equal(broken.claimProfileInvite(null),false);});
test('V5.7.2 consented wizard context reaches the actual Coach API outbound Groq request; no keys/network used',async()=>{
 const coach=coachEnvironment(storage()),profile=wizard.applyPlan({},[],{...adult,goal:'maintain'}).profile;
 let sent;const api={console,require,module:{exports:{}},process:{env:{GROQ_API_KEY:'fake-test-key',VERCEL_ENV:'preview'}},AbortController,setTimeout,clearTimeout,URL,fetch:async(url,opts)=>{assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');sent=JSON.parse(opts.body);return {status:200,ok:true,json:async()=>({choices:[{message:{content:'test'},finish_reason:'stop'}]})};}};vm.createContext(api);vm.runInContext(read('api/coach-chat.js'),api);
 for(const [share,shareProfile] of [[false,false],[true,false],[true,true]]){const context=coach.sharedContext({share,shareProfile,profile,analysis:{metrics:[],insights:[{title:'large',body:'x'.repeat(9500)}]}});let status=0;const res={setHeader:noop,status:n=>{status=n;return res;},json:noop};await api.module.exports({method:'POST',headers:{origin:'https://test.example',host:'test.example'},body:{question:'test',history:[],context}},res);assert.equal(status,200);const system=sent.messages[0].content,data=sent.messages[1].content;assert.match(system,/Non sollecitare mai/);if(share&&shareProfile){assert.match(data,/"preferences":\{/);assert.match(data,/Manten/);assert.ok(data.indexOf('"preferences"')<data.indexOf('"insights"'));}else assert.doesNotMatch(data,/"preferences"/);assert.doesNotMatch(data,/"answers"|"careContext"|"weight"/);}
});
