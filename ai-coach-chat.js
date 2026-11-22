/* NutriTrace Coach V2 — optional Groq chat, consent-first. */
(function(global){
'use strict';
const h=global.React.createElement;
const {useMemo,useState}=global.React;
const old=global.NutriTraceAICoach;
if(!old)throw Error('AI Coach V1 non caricato');
const panel={padding:16,border:'1px solid var(--line,#dfe4df)',borderRadius:16,background:'var(--card,#fff)',minWidth:0};
const grid={display:'grid',gap:12};
function CoachV2(props){
 const [question,setQuestion]=useState('');
 const [history,setHistory]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [share,setShare]=useState(false);
 const [notice,setNotice]=useState(false);
 const analysis=useMemo(()=>old.evaluate(props),[props.logs,props.foods,props.goals,props.profile]);
 const [weight,setWeight]=useState(false);
 function context(){
  if(!share)return{};
  const data={period:'ultimi 7 giorni',trackedDays:analysis.trackedDays,previousTrackedDays:analysis.previousTrackedDays,
    metrics:analysis.metrics.map(m=>({key:m.key,avg:m.avg,target:m.target,validDays:m.validDays,trackedDays:m.trackedDays,deltaPct:m.deltaPct})),
    insights:analysis.insights.map(x=>({title:x.title,body:x.body}))};
  if(weight){
   try{
    const raw=JSON.parse(localStorage.getItem('nutritrace_body_weight_v1')||'{}');
    const entries=(Array.isArray(raw.entries)?raw.entries:[]).filter(x=>Number.isFinite(Number(x.kg))&&/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')).sort((a,b)=>a.date.localeCompare(b.date)).slice(-10);
    data.weight={recent:entries.map(x=>({date:x.date,kg:Number(x.kg)})),target:Number.isFinite(Number(raw.target))?Number(raw.target):null};
   }catch{}
  }
  return data;
 }
 async function send(e){
  e.preventDefault();
  const q=question.trim();if(!q||busy)return;
  setBusy(true);setError('');
  try{
   const res=await fetch('/api/coach-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     question:q,history:history.slice(-6),context:context()
   })});
   const d=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(d.error||'AI non disponibile');
   setHistory(prev=>[...prev,{role:'user',content:q},{role:'assistant',content:String(d.answer||'')}].slice(-12));
   setQuestion('');
  }catch(e){setError(e.message||'AI non disponibile');}finally{setBusy(false);}
 }
 return h('section',{style:grid,className:'nutritrace-ai-coach'},
  h('article',{style:panel},h('h2',null,'✦ NutriTrace AI Coach'),h('p',null,'Conversazione libera con GroqCloud (quota gratuita). Le statistiche sono calcolate localmente.'),
    h('small',null,`Ultimi 7 giorni: ${analysis.trackedDays} giorni registrati. Giorni mancanti ≠ zero.`)),
  h('div',{style:{...grid,gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,170px),1fr))'}},
    ...analysis.metrics.map(m=>h('article',{key:m.key,style:panel},h('small',null,m.name),h('h3',null,m.avg===null?'N/D':Number(m.avg).toLocaleString('it-IT',{maximumFractionDigits:1})+' '+m.unit),h('small',null,`${m.validDays}/${m.trackedDays} giorni con valori dichiarati`)))),
  h('article',{style:panel},h('h3',null,'Osservazioni locali (0 crediti)'),
    ...analysis.insights.map((x,i)=>h('p',{key:i},h('strong',null,x.title),': ',x.body))),
  h('article',{style:panel},
    h('h3',null,'Chat AI'),
    h('p',null,'La domanda viene inviata a GroqCloud tramite Vercel. Il diario non viene inviato salvo tua scelta esplicita. Evita di inserire informazioni identificative o cliniche nella domanda.'),
    h('label',{style:{display:'block',marginBottom:10}},h('input',{type:'checkbox',checked:notice,onChange:e=>setNotice(e.target.checked)}),' Ho letto e accetto di inviare la mia domanda a GroqCloud per ottenere una risposta.'),
    h('label',{style:{display:'block',marginBottom:10}},h('input',{type:'checkbox',checked:share,onChange:e=>{setShare(e.target.checked);if(!e.target.checked)setWeight(false);}}),' Invia anche le statistiche nutrizionali aggregate (facoltativo)'),
    share&&h('label',{style:{display:'block',marginBottom:10}},h('input',{type:'checkbox',checked:weight,onChange:e=>setWeight(e.target.checked)}),' Includi anche le ultime 10 misurazioni di peso (facoltativo)'),
    h('div',{style:{...grid,maxHeight:360,overflowY:'auto',marginBottom:12},role:'log','aria-live':'polite'},
      ...history.map((m,i)=>h('div',{key:i,style:{...panel,background:m.role==='user'?'var(--accent2,#e5f2e9)':'var(--card,#fff)',whiteSpace:'pre-wrap'}},h('strong',null,m.role==='user'?'Tu':'Coach'),m.role==='assistant'?global.NutriTraceCoachMarkdown.render(m.content):h('p',null,m.content)))),
    h('form',{onSubmit:send},
      h('textarea',{value:question,onChange:e=>setQuestion(e.target.value),maxLength:1000,rows:3,placeholder:'Es. Come posso aumentare peso gradualmente?'}),
      h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}},
        h('button',{className:'cta',type:'submit',disabled:busy||!notice||!question.trim()},busy?'Risposta in arrivo…':'Chiedi al Coach'),
        h('button',{className:'ghost',type:'button',onClick:()=>{setHistory([]);setError('');}},'Cancella conversazione'))),
    error&&h('p',{role:'alert',style:{color:'var(--danger,#a22)'}},error),
    h('small',null,'Cronologia conservata solo nella memoria della pagina e cancellata alla chiusura/ricarica. Servizio sperimentale Preview: non usare per dati clinici.')),
  h('small',null,'Consigli informativi, non diagnosi. Non usare l’assistente per decisioni mediche. Il consenso qui è un controllo funzionale, non sostituisce gli adempimenti GDPR.')
 );
}
global.NutriTraceAICoach={...old,View:CoachV2,version:'2.0.0'};
})(window);
