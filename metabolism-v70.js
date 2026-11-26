/* NutriTrace V7.0: local, conservative observational expenditure estimate and explicit target planning.
   No network requests. Not a clinical model or a validated NIDDK implementation. */
(function(root){'use strict';
const S=root.NutriTraceStrategy,Q=root.NutriTraceIntelligence,D=root.NutriTraceDiaryV5,W=root.NutriTraceGoalsWizard;
const N=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()&&Number.isFinite(Number(v.replace(',','.')))?Number(v.replace(',','.')):null;
const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const shift=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10), diff=(a,b)=>(Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/864e5;
const median=a=>{const b=a.slice().sort((x,y)=>x-y),i=Math.floor(b.length/2);return b.length?(b.length%2?b[i]:(b[i-1]+b[i])/2):null;};
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const round=x=>Math.round(x), keys=['kcal','protein','carbs','fat','fiber'];
const fmt=x=>Number.isFinite(x)?Math.round(x).toLocaleString('it-IT'):'N/D';
function weightRows(weights,start,end){const m=new Map();for(const e of weights||[]){const kg=N(e?.kg);if(!valid(e?.date)||e.date<start||e.date>end||!(kg>=20&&kg<=500))continue;if(!m.has(e.date))m.set(e.date,[]);m.get(e.date).push(kg);}return [...m].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v])=>({date,kg:median(v)}));}
function regression(rows){const first=rows[0].date,slopes=[];for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const dt=diff(rows[j].date,rows[i].date);if(dt>=14)slopes.push((rows[j].kg-rows[i].kg)/dt);}if(!slopes.length)return null;const slope=median(slopes),intercept=median(rows.map(x=>x.kg-slope*diff(x.date,first))),mad=median(rows.map(x=>Math.abs(x.kg-intercept-slope*diff(x.date,first))));return {slope,intercept,first,mad};}
function estimate({profile={},goals=[],logs=[],foods=[],qualityState,weights=[],today=S.localDate()}={}){
 const contextPolicy=W.policy(profile);
 if(contextPolicy.organizationalOnly)return {version:1,method:'Bilancio osservazionale locale (sperimentale)',status:'blocked',initial:null,days:0,weighDays:0,tdee:null,range:null,trend:null,reason:contextPolicy.reason,reasonCode:contextPolicy.reasonCode};
 const base=W.calculatePlan({...profile.wizardV5?.answers,weight:profile.weight});const initial=base.eligible?base.maintenance:null;
 const result={version:1,method:'Bilancio osservazionale locale (sperimentale)',status:'insufficient',initial,days:0,weighDays:0,tdee:null,range:null,trend:null,reason:'Servono almeno 28 giorni consecutivi confermati completi e pesate distribuite nel periodo.'};
 if(!base.eligible||!S.eligibility(profile,goals))return {...result,status:'blocked',reason:'Percorso non idoneo: nessun adattamento automatico o suggerimento di modifica.'};
 if(!valid(today))return result;
 const end=shift(today,-1),start=shift(end,-55),state=Q.normalizeState(qualityState),by=new Map();for(const l of logs){if(!valid(l.date)||l.date<start||l.date>end)continue;const a=by.get(l.date)||[];a.push(l);by.set(l.date,a);}
 const foodBy=new Map(foods.map(f=>[f.id,f])),series=new Map(D.stats(logs.filter(l=>l.date>=start&&l.date<=end),foods,{id:'kcal',name:'Energia',unit:'kcal'}).daily.map(x=>[x.date,x]));
 // A contiguous suffix is required: never average isolated intake records as if they were full days.
 const intake=[];for(let i=0;i<56;i++){const d=shift(end,-i),ls=by.get(d)||[],v=series.get(d);if(!ls.length||Q.status(state,d,ls)!=='complete'||!v||!Number.isFinite(v.value)||v.value<=0||!(v.totalMass>0)||v.knownMass<v.totalMass*.999999||v.estimated||v.basisUncertain||v.limitedQuality||ls.some(l=>!foodBy.has(l.foodId)||!(N(l.grams)>0)))break;intake.unshift({date:d,kcal:v.value});}
 result.days=intake.length;if(intake.length<28)return result;
 const rows=weightRows(weights,intake[0].date,end);result.weighDays=rows.length;
 if(rows.length<12||diff(rows.at(-1).date,rows[0].date)<21||diff(rows[0].date,intake[0].date)>3||diff(end,rows.at(-1).date)>3)return {...result,reason:'Servono almeno 12 date di pesata, distribuite su almeno 21 giorni e vicine agli estremi del periodo alimentare.'};
 // No long gaps in weighing, no rapid water-weight change treated as tissue change.
 if(rows.some((x,i)=>i>0&&diff(x.date,rows[i-1].date)>7))return {...result,reason:'Pesate troppo discontinue nel periodo.'};
 const fit=regression(rows);if(!fit||fit.mad>Math.max(.6,median(rows.map(x=>x.kg))*.01)||Math.abs(fit.slope*7)>median(rows.map(x=>x.kg))*.01)return {...result,reason:'Peso troppo variabile o variazione rapida: non possiamo distinguere acqua e tessuti con sufficiente prudenza.'};
 // Align energy observation to first/last observed weight dates; last day is excluded (interval ends at that weighing).
 const aligned=intake.filter(x=>x.date>=rows[0].date&&x.date<rows.at(-1).date);if(aligned.length<21)return result;
 const avg=mean(aligned.map(x=>x.kcal)),trend=fit.slope*7;
 // Sensitivity range of tissue energy equivalent, not a fixed rule for prospective weight prediction.
 const candidates=[6000,7700,9500].map(k=>avg-fit.slope*k),central=candidates[1];
 const currentWeight=median(rows.slice(-5).map(x=>x.kg)),current=W.calculatePlan({...profile.wizardV5?.answers,weight:currentWeight});
 if(!current.eligible||central<current.bmr*1.1||central>Math.min(5500,current.bmr*2.7)||Math.abs(central-initial)>initial*.35)return {...result,reason:'Stima incompatibile con il profilo iniziale o fuori dal perimetro gestito. Verifica diario e pesate.'};
 const noise=Math.max(200,Math.abs(fit.mad)*9500/Math.max(21,diff(rows.at(-1).date,rows[0].date)),avg*.08);
 const range=[round(Math.min(...candidates)-noise),round(Math.max(...candidates)+noise)];const extra=mean(aligned.map(x=>{const n=N(profile.activityHistoryV70?.[x.date]);return n!==null&&n>=0&&n<=2500?n:0;}));const habitualTdee=round(central-extra),habitualRange=[round(range[0]-extra*1.5),round(range[1]-extra*.5)];
 return {...result,status:'usable',reason:'Stima osservazionale, non misura del metabolismo. La copertura non esclude errori sistematici di registrazione.',from:aligned[0].date,to:aligned.at(-1).date,observedDays:aligned.length,averageIntake:round(avg),tdee:round(central),range,habitualTdee,habitualRange,meanReportedExtra:round(extra),trend:Math.round(trend*1000)/1000,weightTrend:rows.map(x=>({date:x.date,kg:x.kg,trend:Math.round((fit.intercept+fit.slope*diff(x.date,fit.first))*100)/100})),weight:currentWeight,height:profile.wizardV5.answers.height,quality:aligned.length>=42?'Copertura elevata':'Copertura sufficiente',methodNote:'Sensibilità 6000–9500 kcal/kg e margine euristico; non è un intervallo statistico validato.'};
}
function projection(model,goal){const g=N(goal);if(model.status!=='usable'||!(g>=20&&g<=500)||!Number.isFinite(model.weight)||!Number.isFinite(model.height)||g/(model.height/100)**2<20||g/(model.height/100)**2>=40||Math.abs(model.trend)<.05||(g-model.weight)*model.trend<=0)return null;const weeks=(g-model.weight)/model.trend;return weeks>0&&weeks<=12?{weeks:Math.ceil(weeks),note:'Scenario se il trend recente prosegue invariato; non è una data garantita.'}:null;}
// Proportional targets. Fiber remains a distinct reference; no automatic multiplication of micronutrients.
function macros(base,kcal,shares){if(!Number.isFinite(kcal)||!(base.kcal>0))throw Error('Obiettivo energetico non valido.');const macroEnergy=4*base.protein+4*base.carbs+9*base.fat;if(!(macroEnergy>0)||![base.protein,base.carbs,base.fat].every(v=>Number.isFinite(v)&&v>0))throw Error('Macro iniziali non validi.');const f=kcal/macroEnergy;const x={kcal,protein:base.protein*f,carbs:base.carbs*f,fat:base.fat*f,fiber:base.fiber};if(shares){const p=N(shares.protein),c=N(shares.carbs),g=N(shares.fat);if(![p,c,g].every(x=>x!==null&&x>=0)||Math.abs(p+c+g-100)>.01||g<20||g>40||p<10||p>35||c<40||c>70)throw Error('Ripartizione non valida (somma 100%; proteine 10–35%, grassi 20–40%, carboidrati 40–70%).');Object.assign(x,{protein:kcal*p/400,carbs:kcal*c/400,fat:kcal*g/900});}return x;}
const previousTarget=S.target;
const legacySignature=(p,g)=>JSON.stringify([S.baseline(p,g),p.weeklyStrategyV64||null,p.wizardV5?.answers?.goal,p.wizardV5?.answers?.age,p.wizardV5?.answers?.careContext]);
const signature=(p,g)=>JSON.stringify([S.baseline(p,g),p.weeklyStrategyV64||null,p.wizardV5?.answers?.goal,p.wizardV5?.answers?.age,p.wizardV5?.answers?.careContext,p.wizardV5?.answers?.physiologicalState,p.physiologicalState]);
const scheduled=(p,g,d)=>Object.fromEntries(keys.map(k=>[k,previousTarget({...p,dailyOverrideV641:null},g,k,d,D)]));
function dayCapabilities(p={},g=[]){
 const base=S.baseline(p,g),policy=W.policy(p),validBase=Number.isFinite(base.kcal)&&base.kcal>0&&base.kcal<=7000&&['protein','carbs','fat'].every(k=>Number.isFinite(base[k])&&base[k]>=0)&&(4*base.protein+4*base.carbs+9*base.fat)>0;
 return {allowed:validBase,manualTodayAllowed:validBase,redistributionAllowed:validBase&&policy.manualRedistributionAllowed,extraActivityAllowed:validBase&&policy.extraActivityAllowed,reason:validBase?'':'Inserisci prima un obiettivo energetico valido e i macro nella scheda Obiettivi. Il percorso non è obbligatorio.',policy,limits:{single:{minExclusive:0,max:7000},redistribution:{maxVariationPercent:15,min:1200,max:5000},extraActivity:{min:0,max:2500,totalMax:7000}}};
}
function canEditDay(p,g){return dayCapabilities(p,g).allowed;}
// BMI and age do not impose a floor at today's baseline on same-budget arithmetic.
function personalBounds(p,b){return {min:Math.max(1200,b.kcal*.85),max:Math.min(5000,b.kcal*1.15)};}
const within=(v,b)=>Number.isFinite(v)&&v>=b.min-1e-6&&v<=b.max+1e-6;
function manualMacros(base,kcal,shares){
 if(!Number.isFinite(kcal)||kcal<=0||kcal>7000)throw Error('Inserisci un obiettivo superiore a 0 e fino a 7000 kcal.');
 const energy=4*base.protein+4*base.carbs+9*base.fat;
 if(!(energy>0)||!['protein','carbs','fat'].every(k=>Number.isFinite(base[k])&&base[k]>=0))throw Error('I macro attuali non sono validi. Puoi correggerli negli Obiettivi.');
 let p=base.protein*4/energy*100,c=base.carbs*4/energy*100,f=base.fat*9/energy*100;
 if(shares){p=N(shares.protein);c=N(shares.carbs);f=N(shares.fat);if(![p,c,f].every(x=>x!==null&&x>=0&&x<=100)||Math.abs(p+c+f-100)>.01)throw Error('Le percentuali dei macro devono essere tra 0 e 100 e sommare a 100%.');}
 return {kcal,protein:kcal*p/400,carbs:kcal*c/400,fat:kcal*f/900,fiber:base.fiber};
}
const rowEnergy=row=>(Number.isFinite(row.singleKcal)?row.singleKcal:row.personalKcal)+row.extraKcal;
function readPlans(p,g){
 const out={},caps=dayCapabilities(p,g);if(!caps.allowed)return out;
 for(const [date,row] of Object.entries(p.dayPlansV70||{})){
  if(!valid(date)||!row||![signature(p,g),legacySignature(p,g)].includes(row.signature))continue;
  const b=scheduled(p,g,date),k=N(row.personalKcal),extra=N(row.extraKcal),single=row.singleKcal===null||row.singleKcal===undefined?null:N(row.singleKcal);
  if(k===null||extra===null||!Number.isFinite(b.kcal)||extra<0||extra>2500||(single!==null&&(single<=0||single>7000))||(row.singleKcal!=null&&single===null))continue;
  const balancedChange=Math.abs(k-b.kcal)>1e-6;
  if(balancedChange&&(!caps.redistributionAllowed||!within(k,personalBounds(p,b))))continue;
  if(extra>0&&!caps.extraActivityAllowed)continue;
  if(!caps.policy.manualRedistributionAllowed&&(balancedChange||extra>0))continue;
  const clean={...row,signature:signature(p,g),personalKcal:k,extraKcal:extra,singleKcal:single};
  try{manualMacros(b,rowEnergy(clean),row.shares);out[date]=clean;}catch{}
 }
 const weeks=new Map();for(const date of Object.keys(out)){const monday=shift(date,-S.idx(date)),dates=weeks.get(monday)||[];dates.push(date);weeks.set(monday,dates);}
 for(const dates of weeks.values()){
  const delta=dates.reduce((sum,date)=>sum+out[date].personalKcal-scheduled(p,g,date).kcal,0);
  if(Math.abs(delta)>.05)for(const date of dates){const row=out[date];if(row.singleKcal!==null){out[date]={...row,personalKcal:scheduled(p,g,date).kcal};}else delete out[date];}
 }
 return out;
}
function previewDay(p,g,d,mode,value,shares=null,today=S.localDate()){
 const caps=dayCapabilities(p,g);if(!valid(d)||d!==today||!caps.allowed)throw Error(caps.reason||'Questa modifica si applica alla giornata di oggi.');
 if(!['single','personal','activity'].includes(mode))throw Error('Modalità non valida.');
 if(mode==='personal'&&!caps.redistributionAllowed||mode==='activity'&&!caps.extraActivityAllowed)throw Error(caps.policy.reason+' È disponibile l’inserimento manuale per oggi soltanto.');
 const planned=scheduled(p,g,d),beforeRows=readPlans(p,g),rows={...beforeRows},sig=signature(p,g),day=rows[d]||{personalKcal:planned.kcal,extraKcal:0,singleKcal:null,signature:sig};
 const n=N(value);if(n===null)throw Error('Inserisci un valore valido.');
 const sun=shift(d,6-S.idx(d)),future=[];for(let date=shift(d,1);date<=sun;date=shift(date,1))future.push(date);
 if(mode==='single'){
  if(n<=0||n>7000)throw Error('Per oggi soltanto inserisci un totale superiore a 0 e fino a 7000 kcal. È un valore scelto da te, non una raccomandazione.');
  // This is the total, including any previously declared activity: never add it twice.
  rows[d]={...day,singleKcal:n,extraKcal:0,shares,signature:sig};
 }
 else if(mode==='activity'){
  const ordinary=day.singleKcal??day.personalKcal;
  if(n<0||n>2500||ordinary+n>7000)throw Error('Indica da 0 a 2500 kcal aggiuntive rispetto all’attività abituale; totale massimo gestito 7000 kcal.');
  rows[d]={...day,extraKcal:n,shares,signature:sig};
 }
 else{
  const bounds=personalBounds(p,planned);
  if(!within(n,bounds))throw Error('Inserisci il totale di oggi tra '+Math.ceil(bounds.min-1e-6)+' e '+Math.floor(bounds.max+1e-6)+' kcal. La redistribuzione gestisce ±15% del programma e 1200–5000 kcal/giorno; per un altro obiettivo usa “Oggi soltanto”.');
  if(future.some(date=>rows[date]?.singleKcal!=null))throw Error('Un giorno successivo ha un obiettivo manuale indipendente: usa “Oggi soltanto”, oppure rimuovi quella modifica prima di mantenere la media.');
  const delta=n-day.personalKcal;
  if(Math.abs(delta)>.001&&!future.length)throw Error('Non ci sono altri giorni in questa settimana: per cambiare oggi senza toccare il passato scegli “Oggi soltanto”.');
  rows[d]={...day,personalKcal:n,singleKcal:null,shares,signature:sig};
  let remainder=delta;
  const slots=future.map(date=>{const b=scheduled(p,g,date),row=rows[date]||{personalKcal:b.kcal,extraKcal:0,singleKcal:null,signature:sig},limits=personalBounds(p,b);return {date,row,cap:Math.max(0,delta>=0?row.personalKcal-limits.min:limits.max-row.personalKcal)};});
  if(Math.abs(delta)>slots.reduce((sum,x)=>sum+x.cap,0)+1e-6)throw Error('I giorni rimanenti non hanno margine sufficiente per mantenere la media. Puoi scegliere “Oggi soltanto”: in quel caso la media cambia.');
  let available=slots.filter(x=>x.cap>1e-7);
  while(available.length&&Math.abs(remainder)>1e-7){const amount=Math.abs(remainder)/available.length,sign=Math.sign(remainder);for(const slot of available){const moved=Math.min(amount,slot.cap);slot.row={...slot.row,personalKcal:slot.row.personalKcal-sign*moved,signature:sig};slot.cap-=moved;remainder-=sign*moved;}available=available.filter(x=>x.cap>1e-7);}
  for(const slot of slots)rows[slot.date]=slot.row;
 }
 const preview=[d,...future].map(date=>{const b=scheduled(p,g,date),row=rows[date]||{personalKcal:b.kcal,extraKcal:0,singleKcal:null};return {date,...manualMacros(b,rowEnergy(row),row.shares),extra:row.extraKcal,manualOnly:row.singleKcal!==null,changed:Math.abs(rowEnergy(row)-(beforeRows[date]?rowEnergy(beforeRows[date]):b.kcal))>1e-6};});
 for(const [date,row] of Object.entries(rows))if(Math.abs(row.personalKcal-scheduled(p,g,date).kcal)<.0001&&row.extraKcal===0&&!row.shares&&(row.singleKcal===null||Math.abs(row.singleKcal-row.personalKcal)<.0001))delete rows[date];
 const monday=shift(d,-S.idx(d));let before=0,after=0;
 for(let date=monday;date<=sun;date=shift(date,1)){const b=scheduled(p,g,date);before+=beforeRows[date]?rowEnergy(beforeRows[date]):b.kcal;after+=rows[date]?rowEnergy(rows[date]):b.kcal;}
 return {rows,preview,mode,week:{beforeMean:before/7,afterMean:after/7,delta:after-before},limits:caps.limits};
}
function target(p,g,id,d,diary=D){if(!keys.includes(id))return previousTarget(p,g,id,d,diary);const archived=p.targetArchiveV70?.[d]?.[id];if(valid(d)&&d<S.localDate()&&Number.isFinite(archived)&&archived>=0&&archived<=7000)return archived;const row=readPlans(p,g)[d];if(row){try{return manualMacros(scheduled(p,g,d),rowEnergy(row),row.shares)[id];}catch{}}return previousTarget(p,g,id,d,diary);}
S.target=target;
function proposal(p,g,model){if(model.status!=='usable'||!S.eligibility(p,g))return null;const b=S.baseline(p,g),plan=W.calculatePlan({...p.wizardV5.answers,weight:p.weight});if(!plan.eligible)return null;const chosenTdee=model.habitualTdee??model.tdee;const range=model.habitualRange??model.range;if(!Number.isFinite(chosenTdee)||!Array.isArray(range)||range.length!==2)return null;if(b.kcal>=range[0]*(1+plan.adjustment)&&b.kcal<=range[1]*(1+plan.adjustment))return null;const desired=chosenTdee*(1+plan.adjustment),step=Math.min(150,b.kcal*.05),kcal=round(Math.max(b.kcal-step,Math.min(b.kcal+step,desired)));if(kcal<1200||kcal>5000||Math.abs(kcal-b.kcal)<25||kcal<b.kcal&&(plan.adjustment<0||p.wizardV5.answers.age>=65||p.weight/(p.wizardV5.answers.height/100)**2<20))return null;try{const out=macros(b,kcal);if(out.protein<.83*p.weight||out.fat*9<out.kcal*.2)return null;return out;}catch{return null;}}
function applyProposal(p,g,model,today=S.localDate()){
 const next=proposal(p,g,model);if(!next||!valid(today)||model.status!=='usable'||!valid(model.to)||diff(today,model.to)<1||diff(today,model.to)>5)throw Error('Stima o proposta non disponibile.');if(Object.values(readPlans(p,g)).some(r=>r.signature===signature(p,g))&&Object.keys(readPlans(p,g)).some(d=>d>=today))throw Error('Sono presenti modifiche giornaliere programmate: attendi il termine della settimana.');
 const history=Array.isArray(p.goalHistoryV70)?p.goalHistoryV70:[];if(history.some(x=>valid(x.date)&&diff(today,x.date)>=0&&diff(today,x.date)<7))throw Error('Attendi almeno 7 giorni tra due revisioni del metabolismo.');
 const old=S.baseline(p,g),weight=p.weight,goals=g.map(x=>keys.slice(0,4).includes(x.id)?{...x,target:next[x.id],targetMode:x.id==='kcal'?'absolute':'perKg',perKg:x.id==='kcal'?0:next[x.id]/weight,period:'day'}:x),profile={...p,dailyOverrideV641:null,dayPlansV70:{},goalHistoryV70:[...history,{date:today,from:old,to:next,tdee:model.tdee,range:model.range,observedDays:model.observedDays,method:model.method}].slice(-104),macroPlan:{...p.macroPlan,calorieMode:'fixed',kcal:next.kcal,autoMacro:'carbs',perKg:{...p.macroPlan?.perKg,protein:next.protein/weight,carbs:next.carbs/weight,fat:next.fat/weight}}};
 // Preserve weekly selection when valid, and start the revised distribution on the next Monday.
 if(p.weeklyStrategyV64?.enabled){try{profile.weeklyStrategyV64=S.createStrategy(profile,goals,p.weeklyStrategyV64.days,p.weeklyStrategyV64.percent,today,D);}catch{profile.weeklyStrategyV64=null;}}return {profile,goals,summary:{eligible:true}};
}
function loadWeights(){try{return JSON.parse((globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage).getItem('nutritrace_body_weight_v1')||'{}');}catch{return {};}}
function initializeProfile(p,today=S.localDate()){return valid(p.targetEpochV70)?p:{...p,targetEpochV70:today};}
function saveDayPlans(p,g,rows,today=S.localDate()){const activity={...(p.activityHistoryV70||{})},r=rows[today];if(r?.extraKcal>0)activity[today]=r.extraKcal;else delete activity[today];return {...p,dailyOverrideV641:null,dayPlansV70:rows,activityHistoryV70:activity,targetEpochV70:valid(p.targetEpochV70)?p.targetEpochV70:today};}
function captureBeforeChange(old,oldGoals,next,nextGoals,today=S.localDate()){const archive={...(old.targetArchiveV70||{}),...(next.targetArchiveV70||{})};const epoch=valid(old.targetEpochV70)?old.targetEpochV70:today;for(let d=epoch>shift(today,-730)?epoch:shift(today,-730);d<today;d=shift(d,1)){if(!archive[d])archive[d]=Object.fromEntries(keys.map(k=>[k,target(old,oldGoals,k,d)]));}for(const d of Object.keys(archive))if(!valid(d)||d<shift(today,-730)||d>=today)delete archive[d];const activity={...(old.activityHistoryV70||{}),...(next.activityHistoryV70||{})};const a=S.baseline(old,oldGoals),b=S.baseline(next,nextGoals);const history=Array.isArray(next.goalHistoryV70)?next.goalHistoryV70.slice():Array.isArray(old.goalHistoryV70)?old.goalHistoryV70.slice():[];if(JSON.stringify([a,old.weeklyStrategyV64||null])!==JSON.stringify([b,next.weeklyStrategyV64||null])&&!history.some(x=>x.date===today&&x.to?.kcal===b.kcal&&x.from?.kcal===a.kcal&&x.tdee!=null))history.push({date:today,from:a,to:b,method:'Revisione esplicita del percorso'});return {...next,targetEpochV70:today,targetArchiveV70:archive,activityHistoryV70:activity,goalHistoryV70:history.slice(-104)};}
function bodyFatBandsV73(sex){const labels=sex==='female'?['< 18%','18–22%','23–27%','28–32%','33–37%','38–42%','43–47%','≥ 48%']:['< 10%','10–14%','15–19%','20–24%','25–29%','30–34%','35–39%','≥ 40%'];return labels.map((label,index)=>({id:'v73-'+(sex==='female'?'female':'male')+'-'+index,label}));}
const api={estimate,projection,weightRows,regression,macros,previewDay,readPlans,target,proposal,applyProposal,loadWeights,initializeProfile,saveDayPlans,captureBeforeChange,personalBounds,canEditDay,dayCapabilities,manualMacros,bodyFatBandsV73};root.NutriTraceMetabolism=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.React)return;const R=root.React,h=R.createElement;
api.DayEditor=function({profile,goals,date,onSave}){
 const current=readPlans(profile,goals)[date],base=scheduled(profile,goals,date),caps=dayCapabilities(profile,goals);
 const [mode,setMode]=R.useState('single'),[value,setValue]=R.useState(String(round(current?rowEnergy(current):base.kcal))),[custom,setCustom]=R.useState(false),[shares,setShares]=R.useState({protein:'20',carbs:'50',fat:'30'}),[error,setError]=R.useState('');
 let result=null,validation='';try{result=previewDay(profile,goals,date,mode,value,custom?shares:null);}catch(e){validation=e.message;}
 const choose=next=>{setMode(next);setError('');setValue(String(next==='activity'?(current?.extraKcal??0):round(next==='personal'?(current?.personalKcal??base.kcal):(current?rowEnergy(current):base.kcal))));};
 return h('section',{className:'v70-day-editor v73-day-editor'},h('h3',null,'Cambia gli obiettivi di oggi'),
  h('div',{className:'v73-day-modes'},...[['single','Oggi soltanto','Cambia questa giornata. Le altre restano uguali e la media settimanale cambia.',true],['personal','Mantieni la media settimanale','Adatta i giorni successivi, senza cambiare quelli già passati.',caps.redistributionAllowed],['activity','Attività extra','Aggiunge solo il consumo oltre l’attività abituale. Non riduce le altre giornate.',caps.extraActivityAllowed]].map(([id,title,description,enabled])=>h('button',{type:'button',key:id,className:'v5-wizard-option','aria-pressed':mode===id,disabled:!enabled,onClick:()=>choose(id)},h('strong',null,title),h('span',null,description)))),
  caps.policy.organizationalOnly&&h('p',{className:'v73-policy-notice'},caps.policy.reason),
  mode==='single'&&h('p',null,'Inserisci il totale desiderato per oggi (0 < kcal ≤ 7000). Il valore è scelto da te; l’app non lo presenta come fabbisogno consigliato. Le calorie extra eventualmente inserite prima sono comprese nel nuovo totale.'),
  mode==='personal'&&h('p',{className:'v72-target-range'},'Programma di oggi: '+fmt(base.kcal)+' kcal. Inserisci il totale, non la differenza. Intervallo gestito: '+Math.ceil(personalBounds(profile,base).min-1e-6)+'–'+Math.floor(personalBounds(profile,base).max+1e-6)+' kcal (±15%, tra 1200 e 5000). Sono limiti della redistribuzione, non un minimo calorico valido per tutti.'),
  mode==='activity'&&h('p',null,'Gli allenamenti abituali sono già inclusi nel TDEE. Inserisci soltanto l’extra stimato: da 0 a 2500 kcal, con totale massimo 7000 kcal. Non è una misurazione.'),
  h('label',null,mode==='activity'?'Calorie aggiuntive stimate (kcal)':mode==='single'?'Totale manuale di oggi (kcal)':'Obiettivo di oggi, esclusa attività extra (kcal)',h('input',{type:'number',min:mode==='activity'?0:1,max:mode==='activity'?2500:7000,step:1,value,onChange:e=>setValue(e.target.value)})),
  h('label',null,h('input',{type:'checkbox',checked:custom,onChange:e=>setCustom(e.target.checked)}),'Imposta anche le percentuali dei macro'),
  !custom&&h('p',{className:'muted'},'Proteine, carboidrati e grassi mantengono le proporzioni che hai già impostato. Fibre e micronutrienti restano separati.'),
  custom&&h('div',{className:'v64-fields'},...['protein','carbs','fat'].map((key,i)=>h('label',{key},['Proteine %','Carboidrati %','Grassi %'][i],h('input',{type:'number',min:0,max:100,step:'any',value:shares[key],onChange:e=>setShares(x=>({...x,[key]:e.target.value}))}))),h('p',null,'Percentuali scelte da te: devono sommare a 100%.')),
  result?h('div',{className:'v73-day-preview'},h('strong',null,'Anteprima prima di applicare'),h('p',null,'Media della settimana: '+fmt(result.week.beforeMean)+' → '+fmt(result.week.afterMean)+' kcal/giorno.'),mode==='personal'&&h('p',null,'I giorni successivi si ridistribuiscono per mantenere lo stesso budget. Le calorie extra da attività restano aggiuntive.'),h('ul',null,...result.preview.map(row=>h('li',{key:row.date},h('span',null,row.date===date?'Oggi':S.days[S.idx(row.date)]+' '+row.date.slice(8)),h('strong',null,fmt(row.kcal)+' kcal'),h('small',null,'P '+fmt(row.protein)+' · C '+fmt(row.carbs)+' · G '+fmt(row.fat)+' g'))))):h('p',{role:'alert'},validation),
  error&&h('p',{role:'alert'},error),
  h('button',{type:'button',className:'cta',disabled:!result,onClick:()=>{try{onSave(previewDay(profile,goals,date,mode,value,custom?shares:null).rows);}catch(e){setError(e.message);}}},mode==='single'?'Conferma per oggi soltanto':'Conferma modifica'),
  h('button',{type:'button',className:'ghost',onClick:()=>{try{let rows=readPlans(profile,goals);if(!current){onSave(rows);return;}if(Math.abs(current.personalKcal-base.kcal)>.0001)rows=previewDay(profile,goals,date,'personal',base.kcal,null).rows;delete rows[date];onSave(rows);}catch(e){setError(e.message);}}},'Ripristina oggi (se compatibile con la settimana)'));
};

api.Panel=function({profile,goals,logs,foods,qualityState,today,onMode,onApply}){const [revision,setRevision]=R.useState(0),[message,setMessage]=R.useState(''),[confirm,setConfirm]=R.useState(false),[requested,setRequested]=R.useState(false);const weights=loadWeights(),mode=['manual','assisted','adaptive'].includes(profile.metabolismModeV70)?profile.metabolismModeV70:'manual',m=R.useMemo(()=>estimate({profile,goals,logs,foods,qualityState,weights:weights.entries,today}),[profile,goals,logs,foods,qualityState,today,revision,JSON.stringify(weights.entries||[])]),p=proposal(profile,goals,m),project=projection(m,weights.target??profile.advancedV64?.goalWeight);const history=Array.isArray(profile.goalHistoryV70)?profile.goalHistoryV70:[];return h('article',{className:'card v70-metabolism'},h('h2',null,'Strategia e metabolismo'),h('p',null,'TDEE: energia totale consumata, incluse attività quotidiane, allenamenti abituali e digestione.'),h('label',null,'Modalità',h('select',{value:mode,onChange:e=>{setConfirm(false);setRequested(false);onMode(e.target.value);}},h('option',{value:'manual'},'Manuale · nessuna proposta'),h('option',{value:'assisted'},'Assistita · suggerimenti su richiesta'),h('option',{value:'adaptive'},'Adattiva · ricalcolo con dati nuovi, conferma obbligatoria'))),h('div',{className:'v64-fields'},h('div',null,h('small',null,'TDEE iniziale'),h('h3',null,fmt(m.initial)+' kcal')),h('div',null,h('small',null,'TDEE osservazionale'),h('h3',null,fmt(m.tdee)+' kcal'))),h('p',null,m.days+' giorni consecutivi completi · '+m.weighDays+' date di pesata'),h('p',{role:'status'},m.reason),m.status==='usable'&&h('div',null,h('p',null,'Incertezza indicativa: '+m.range.map(fmt).join('–')+' kcal/giorno. '+m.quality),m.meanReportedExtra>0&&h('p',null,'TDEE abituale stimato: '+fmt(m.habitualTdee)+' kcal/giorno (sottratto l’extra dichiarato medio di '+fmt(m.meanReportedExtra)+' kcal; stima, non misura).'),h('p',null,'Trend: '+m.trend.toFixed(2)+' kg/settimana. '+m.methodNote),h(api.TrendChart,{rows:m.weightTrend}),h('details',null,h('summary',null,'Trend delle pesate'),...m.weightTrend.map(w=>h('div',{key:w.date},w.date+' · '+w.kg.toFixed(2)+' kg · trend '+w.trend.toFixed(2)+' kg'))),project&&h('p',null,'Scenario al ritmo recente: circa '+project.weeks+' settimane. '+project.note)),h('button',{type:'button',className:'ghost',onClick:()=>{setRevision(x=>x+1);setConfirm(false);}},'Aggiorna stima'),mode==='assisted'&&!requested&&h('button',{type:'button',className:'ghost',onClick:()=>setRequested(true)},'Calcola proposta'),(mode==='adaptive'||mode==='assisted'&&requested)&&!p&&h('p',{className:'muted'},'Nessuna revisione proposta: dati insufficienti, intervallo compatibile con il target o limiti di sicurezza.'),(mode==='adaptive'||mode==='assisted'&&requested)&&p&&h('div',null,h('p',null,'Proposta: '+fmt(p.kcal)+' kcal · P '+fmt(p.protein)+' / C '+fmt(p.carbs)+' / G '+fmt(p.fat)+' g'),!confirm?h('button',{type:'button',className:'ghost',onClick:()=>setConfirm(true)},'Rivedi proposta'):h('button',{type:'button',className:'cta',onClick:()=>{try{onApply(applyProposal(profile,goals,m,today));setConfirm(false);setMessage('Proposta applicata.');}catch(e){setMessage(e.message);}}},'Conferma nuovi obiettivi')),message&&h('p',{role:'status'},message),history.length>0&&h(api.ExpenditureChart,{history,initial:m.initial,current:m.tdee}),h('details',{className:'v72-revision-history'},h('summary',null,'Storico delle revisioni ('+history.length+')'),...history.slice().reverse().map((x,i)=>h('p',{key:i},x.date+' · '+fmt(x.from?.kcal)+' → '+fmt(x.to?.kcal)+' kcal · TDEE '+fmt(x.tdee)))),h('small',null,'Modello sperimentale locale, non validato clinicamente. La stima è sensibile a errori di registrazione, acqua e variazioni del dispendio. Non aggiunge al TDEE le calorie degli allenamenti abituali.'),h('p',null,h('a',{href:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593/',target:'_blank',rel:'noopener noreferrer'},'Hall et al. 2011: modello dinamico e limiti delle proiezioni lineari')));};
api.TrendChart=function({rows}){if(!rows?.length)return null;const vals=rows.flatMap(x=>[x.kg,x.trend]),lo=Math.min(...vals)-.3,hi=Math.max(...vals)+.3,start=rows[0].date,span=Math.max(1,diff(rows.at(-1).date,start)),x=d=>35+diff(d,start)/span*285,y=v=>145-(v-lo)/(hi-lo)*115;return h('figure',{style:{margin:'12px 0'}},h('svg',{viewBox:'0 0 350 180',role:'img','aria-label':'Pesate osservate e trend robusto'},...[lo,(lo+hi)/2,hi].map(v=>h('g',{key:v},h('line',{x1:35,x2:320,y1:y(v),y2:y(v),stroke:'currentColor',opacity:.18}),h('text',{x:32,y:y(v)+3,fontSize:9,textAnchor:'end',fill:'currentColor'},v.toFixed(1)))),h('polyline',{points:rows.map(w=>x(w.date)+','+y(w.trend)).join(' '),fill:'none',stroke:'#18835e',strokeWidth:2.5}),...rows.map(w=>h('circle',{key:w.date,cx:x(w.date),cy:y(w.kg),r:2.8,fill:'#79939a'})),h('text',{x:35,y:165,fontSize:9,fill:'currentColor'},start),h('text',{x:320,y:165,textAnchor:'end',fontSize:9,fill:'currentColor'},rows.at(-1).date)),h('figcaption',{className:'muted'},'Punti: pesate. Linea verde: trend osservato, non previsione.'));};
api.ExpenditureChart=function({history,initial,current}){const values=history.filter(x=>valid(x.date)&&Number.isFinite(x.tdee)).slice(-16);if(Number.isFinite(current))values.push({date:'Stima attuale',tdee:current});if(!values.length)return null;const a=values.map(x=>x.tdee),lo=Math.min(...a)-100,hi=Math.max(...a)+100,x=i=>35+i*285/Math.max(1,a.length-1),y=v=>130-(v-lo)/(hi-lo)*100;return h('figure',{style:{margin:'12px 0'}},h('svg',{viewBox:'0 0 350 165',role:'img','aria-label':'Storico stime del dispendio energetico'},...[lo,hi].map(v=>h('g',{key:v},h('line',{x1:35,x2:320,y1:y(v),y2:y(v),stroke:'currentColor',opacity:.2}),h('text',{x:32,y:y(v)+3,fontSize:9,textAnchor:'end',fill:'currentColor'},Math.round(v)))),h('polyline',{points:a.map((v,i)=>x(i)+','+y(v)).join(' '),fill:'none',stroke:'#18835e',strokeWidth:2.5}),...a.map((v,i)=>h('circle',{key:i,cx:x(i),cy:y(v),r:4,fill:'#18835e'},h('title',null,values[i].date+' · '+Math.round(v)+' kcal')))),h('figcaption',{className:'muted'},'Stime alle revisioni successive (kcal/giorno; asse orizzontale per revisione).'));};
api.BodyFatGuide=function({sex,range,onRange}){
 const [view,setView]=R.useState(sex==='female'?'female':'male'),bands=api.bodyFatBandsV73(view);
 return h('div',{className:'v73-bodyfat-guide'},h('p',{className:'muted'},'Illustrazioni originali e schematiche, senza calibrazione clinica. Persone con la stessa percentuale possono avere aspetti diversi. Le fasce servono solo a orientarti; non misurano la composizione corporea e non modificano calorie o TDEE.'),
  h('div',{className:'v73-bodyfat-views'},...[['male','Riferimento maschile'],['female','Riferimento femminile']].map(([id,label])=>h('button',{type:'button',key:id,className:'ghost','aria-pressed':view===id,onClick:()=>setView(id)},label))),
  h('div',{className:'v73-bodyfat-grid'},...bands.map((band,index)=>{
   const feminine=view==='female',shoulder=35+index*1.5,waist=19+index*4.3,hip=26+index*3.6+(feminine?7:0),arm=8+index*.75,neck=12;
   // Parametric original paths. No imported, traced or re-coloured external artwork.
   const torso=`M${80-neck} 16 L${80-neck} 27 Q${80-shoulder} 29 ${80-shoulder-6} 43 Q${80-shoulder-11} 61 ${80-shoulder-arm-8} 105 L${80-shoulder-arm+2} 109 Q${80-shoulder+3} 82 ${80-shoulder+6} 64 Q${80-waist-3} 88 ${80-waist} 112 Q${80-hip-4} 135 ${80-hip} 154 L${80-hip+5} 195 L75 195 L77 155 Q80 151 83 155 L85 195 L${80+hip-5} 195 L${80+hip} 154 Q${80+hip+4} 135 ${80+waist} 112 Q${80+waist+3} 88 ${80+shoulder-6} 64 Q${80+shoulder-3} 82 ${80+shoulder+arm-2} 109 L${80+shoulder+arm+8} 105 Q${80+shoulder+11} 61 ${80+shoulder+6} 43 Q${80+shoulder} 29 ${80+neck} 27 L${80+neck} 16 Z`;
   return h('button',{key:band.id,type:'button',className:'v73-bodyfat-card','aria-pressed':range===band.id||range===band.label,'aria-label':band.label+' · fascia visiva orientativa',onClick:()=>onRange(band.id)},
    h('svg',{viewBox:'0 0 160 210','aria-hidden':true,focusable:'false'},h('rect',{x:1,y:1,width:158,height:208,rx:18,fill:'#f7f2e9'}),h('path',{d:torso,fill:'#d8bba3',stroke:'#8a7365',strokeWidth:2,strokeLinejoin:'round'}),
     h('path',{d:`M${80-shoulder+9} 47 Q64 ${feminine?75:65} 78 65 M82 65 Q96 ${feminine?75:65} ${80+shoulder-9} 47`,fill:'none',stroke:'#ac8b75',strokeWidth:2,opacity:.75}),
     index<3?h('g',{fill:'none',stroke:'#ac8b75',strokeWidth:1.7,opacity:1-index*.2},h('path',{d:'M80 72 L80 115 M66 81 Q73 85 78 81 M82 81 Q89 85 94 81 M66 95 Q73 99 78 95 M82 95 Q89 99 94 95 M69 109 Q75 113 78 109 M82 109 Q87 113 91 109'})):h('path',{d:`M${80-waist+7} 108 Q80 ${123+index*1.3} ${80+waist-7} 108`,fill:'none',stroke:'#ac8b75',strokeWidth:1.6,opacity:.6}),
     h('circle',{cx:80,cy:119,r:1.7,fill:'#987967'}),h('path',{d:`M${80-hip} 146 Q80 157 ${80+hip} 146 L${80+hip-2} 162 L87 175 L80 160 L73 175 L${80-hip+2} 162 Z`,fill:'#a7c8bd',stroke:'#789a8c',strokeWidth:1.5})),h('strong',null,band.label));
  })),
  range&&h('p',{className:'muted'},'Fascia selezionata: '+(api.bodyFatBandsV73('male').concat(api.bodyFatBandsV73('female')).find(x=>x.id===range)?.label||range)+'. È una stima orientativa, non una misurazione.'),
  h('button',{type:'button',className:'ghost',onClick:()=>onRange('Non lo so'),'aria-pressed':range==='Non lo so'},'Non lo so / nessuna fascia'));
};

})(typeof globalThis!=='undefined'?globalThis:this);
