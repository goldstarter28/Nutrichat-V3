/* NutriTrace AI Coach V1 — local-first, deterministic, no remote requests.
   Independent of the food lexicon. No provider credentials in browser. */
(function (global) {
  'use strict';
  const h = global.React.createElement;
  const { useMemo, useState } = global.React;
  const METRICS = { kcal: ['Energia','kcal'], protein: ['Proteine','g'], carbs: ['Carboidrati','g'], fat: ['Grassi','g'], fiber: ['Fibre','g'] };
  const round = (x,d=0)=>Number(x).toLocaleString('it-IT',{maximumFractionDigits:d});
  const dateKey = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const shiftDate = (d,days)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()+days);return dateKey(x)};
  const makeTotals = (logs,foods)=>{
    const index=new Map((foods||[]).map(f=>[f.id,f]));
    const days=new Map();
    for(const l of logs||[]){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(l?.date||''))continue;
      const f=index.get(l.foodId);
      const grams=Number(l.grams),base=Number(f?.servingGrams)||100;
      if(!f||!Number.isFinite(grams)||grams<=0||!Number.isFinite(base)||base<=0)continue;
      if(!days.has(l.date))days.set(l.date,{date:l.date,entries:0,totals:{kcal:0,protein:0,carbs:0,fat:0,fiber:0},known:{kcal:0,protein:0,carbs:0,fat:0,fiber:0}});
      const d=days.get(l.date);d.entries++;
      for(const k of Object.keys(METRICS)){
        const raw=f.label?.[k];
        if(raw===undefined||raw===null||raw===''||!Number.isFinite(Number(raw)))continue;
        d.totals[k]+=Number(raw)*(grams/base);d.known[k]++;
      }
    }
    return days;
  };
  function evaluate({logs=[],foods=[],goals=[],profile={}},now=new Date()){
    const dayIndex=makeTotals(logs,foods);
    const current=[],previous=[];
    for(let i=6;i>=0;i--){const key=shiftDate(now,-i);if(dayIndex.has(key))current.push(dayIndex.get(key));}
    for(let i=13;i>=7;i--){const key=shiftDate(now,-i);if(dayIndex.has(key))previous.push(dayIndex.get(key));}
    const result={trackedDays:current.length,previousTrackedDays:previous.length,metrics:[],insights:[],generatedAt:dateKey(now)};
    if(current.length===0){result.insights.push({level:'info',title:'Nessuna giornata registrata',body:'Registra i tuoi pasti per ottenere le prime statistiche. I giorni senza registrazioni non vengono conteggiati come zero.'});return result;}
    const targetFor=k=>{
      const g=goals.find(x=>x.id===k);
      if(!g)return null;
      const weight=Number(profile?.weight);
      const n=g.targetMode==='perKg'?Number(g.perKg)*weight:Number(g.target);
      return Number.isFinite(n)&&n>0?n:null;
    };
    for(const [key,[name,unit]] of Object.entries(METRICS)){
      const values=rows=>rows.filter(d=>d.known[key]===d.entries).map(d=>d.totals[key]);
      const a=values(current),b=values(previous);
      const avg=a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
      const prev=b.length?b.reduce((x,y)=>x+y,0)/b.length:null;
      const target=targetFor(key);
      result.metrics.push({key,name,unit,avg,prev,target,validDays:a.length,trackedDays:current.length,previousValidDays:b.length,deltaPct:avg!==null&&prev>0?100*(avg-prev)/prev:null});
    }
    const kcal=result.metrics.find(m=>m.key==='kcal');
    if(current.length<4)result.insights.push({level:'info',title:'Storico ancora limitato',body:`Hai registrazioni in ${current.length} giorni su 7. Prima di interpretare i trend sono utili altre giornate complete.`});
    for(const m of result.metrics){
      if(m.avg===null||m.validDays<4)continue;
      if(m.target&&['protein','fiber'].includes(m.key)&&m.avg<m.target*.8){
        result.insights.push({level:'attention',title:`${m.name}: sotto il tuo obiettivo`,body:`Media nei ${m.validDays} giorni con dati disponibili: ${round(m.avg,1)} ${m.unit} rispetto al target impostato di ${round(m.target,1)} ${m.unit}. Verifica la completezza del diario prima di modificare l'alimentazione.`});
      }
      if(m.deltaPct!==null&&Math.abs(m.deltaPct)>=15&&m.validDays>=4&&m.previousValidDays>=4){
        result.insights.push({level:'trend',title:`${m.name}: variazione rispetto alla settimana precedente`,body:`Media ${m.deltaPct>0?'aumentata':'diminuita'} del ${round(Math.abs(m.deltaPct),0)}% nei giorni con nutrienti dichiarati. Un cambiamento dei dati registrati non prova, da solo, un cambiamento effettivo del consumo.`});
      }
    }
    if(!result.insights.length)result.insights.push({level:'info',title:'Riepilogo disponibile',body:'Le medie registrate sono riportate qui sotto. Al momento non emergono scostamenti che superino le soglie del coach.'});
    result.insights=result.insights.slice(0,5);
    return result;
  }
  function reply(question,analysis){
    const q=String(question||'').toLowerCase();
    if(!analysis.trackedDays)return 'Non posso ancora analizzare i tuoi consumi: il diario non contiene registrazioni negli ultimi 7 giorni.';
    const metric=analysis.metrics.find(m=>/protein/.test(q)?m.key==='protein':/calori|energi/.test(q)?m.key==='kcal':/fibr/.test(q)?m.key==='fiber':/grass/.test(q)?m.key==='fat':/carbo/.test(q)?m.key==='carbs':false);
    if(metric){if(metric.avg===null)return `Per ${metric.name.toLowerCase()} non ci sono valori sufficienti e affidabili nei giorni analizzati.`;return `${metric.name}: ${round(metric.avg,1)} ${metric.unit} al giorno, nei ${metric.validDays} giorni con valori dichiarati.${metric.target?' Obiettivo impostato: '+round(metric.target,1)+' '+metric.unit+'.':''}${metric.deltaPct!==null?' Differenza rispetto alla settimana precedente: '+round(metric.deltaPct,0)+'%.':''} Non posso verificare se hai registrato tutti i pasti.`;}
    return `Negli ultimi 7 giorni risultano ${analysis.trackedDays} giorni con registrazioni. ${analysis.insights.map(x=>x.title+': '+x.body).join(' ')} Per approfondire chiedimi di calorie, proteine, carboidrati, grassi o fibre.`;
  }
  const skin={display:'grid',gap:12};
  const panel={padding:16,border:'1px solid var(--line,#dfe4df)',borderRadius:16,background:'var(--card,#fff)',minWidth:0};
  function View(props){
    const [question,setQuestion]=useState('');
    const [asked,setAsked]=useState('');
    const model=useMemo(()=>evaluate(props),[props.logs,props.foods,props.goals,props.profile]);
    return h('section',{className:'nutritrace-ai-coach',style:skin},
      h('div',{style:panel},h('h2',null,'✦ Assistente NutriTrace'),h('p',null,'Analisi locale e gratuita dei tuoi dati. Questa versione non invia informazioni a servizi AI esterni.'),h('small',null,`Periodo: ultimi 7 giorni · ${model.trackedDays}/7 giorni con registrazioni · giorni mancanti ≠ zero`)),
      h('div',{style:{...skin,gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,170px),1fr))'}},...model.metrics.map(m=>h('article',{key:m.key,style:panel},h('small',null,m.name),h('h3',null,m.avg===null?'N/D':`${round(m.avg,1)} ${m.unit}`),h('small',null,`${m.validDays}/${model.trackedDays} giorni con valori dichiarati`),m.target?h('p',null,`Obiettivo: ${round(m.target,1)} ${m.unit}`):null))),
      h('div',{style:panel},h('h3',null,'Osservazioni dai tuoi dati'),...model.insights.map((x,i)=>h('div',{key:i,style:{marginBottom:14}},h('strong',null,x.title),h('p',null,x.body)))),
      h('div',{style:panel},h('h3',null,'Chiedi al coach'),h('p',null,'Risposte contestuali locali. La chat generativa con provider gratuiti arriverà in una fase separata.'),h('form',{onSubmit:e=>{e.preventDefault();if(question.trim())setAsked(question.trim());}},h('input',{type:'text',value:question,maxLength:300,onChange:e=>setQuestion(e.target.value),placeholder:'Es. Come vanno le proteine?',style:{width:'100%',marginBottom:10},'aria-label':'Domanda per il coach'}),h('button',{type:'submit',className:'cta'},'Analizza')),asked?h('p',{role:'status',style:{marginTop:12}},reply(asked,model)):null),
      h('small',null,'Strumento informativo di benessere generale: non formula diagnosi né sostituisce un professionista sanitario. I dati mancanti non equivalgono a zero.')
    );
  }
  global.NutriTraceAICoach=Object.freeze({evaluate,reply,View,version:'1.0.0'});
})(window);
