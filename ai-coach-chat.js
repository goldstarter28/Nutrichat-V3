/* NutriTrace Coach V5: existing chat, speech and API with explicit optional context. */
(function(root){
'use strict';
const h=root.React.createElement;
const {useState,useEffect,useMemo,useRef}=root.React;
const previous=root.NutriTraceAICoach;
if(!previous)throw Error('AI Coach base mancante');
const STORAGE='nutritrace_coach_threads_v3';
const CONSENT='nutritrace_coach_consent_v3';
const mkid=()=>root.crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const initial=()=>({id:mkid(),title:'Nuova conversazione',createdAt:Date.now(),updatedAt:Date.now(),messages:[]});
function read(){
 try{
  const v=JSON.parse(localStorage.getItem(STORAGE)||'null');
  if(v&&Array.isArray(v.threads)&&v.threads.length){
   return {threads:v.threads.slice(0,30).map(t=>({...t,messages:(Array.isArray(t.messages)?t.messages:[]).slice(-100)})),
    active:v.threads.some(t=>t.id===v.active)?v.active:v.threads[0].id};
  }
 }catch{}
 const t=initial();return {threads:[t],active:t.id};
}
const btn=(text,fn,disabled=false,cls='coach-btn')=>h('button',{type:'button',className:cls,onClick:fn,disabled},text);
function wizardContext(profile){
 const source=profile?.wizardV5?.context;
 if(!source||typeof source!=='object')return null;
 const out={};
 // An allowlist deliberately excludes raw answers, body measurements and health context.
 for(const key of ['goal','activity','training','preferences','mealPattern','cookingTime','focus']){
  const value=source[key];
  if(typeof value==='string'&&value.trim())out[key]=value.trim().slice(0,180);
  else if(Array.isArray(value)){
   const items=value.filter(x=>typeof x==='string'&&x.trim()).slice(0,8).map(x=>x.trim().slice(0,100));
   if(items.length)out[key]=items;
  }
 }
 return Object.keys(out).length?out:null;
}
function sharedContext({share=false,shareProfile=false,profile,analysis={},weightData=null}){
 if(!share)return{};
 const data={period:'ultimi 7 giorni',trackedDays:analysis.trackedDays,previousTrackedDays:analysis.previousTrackedDays,
  metrics:(analysis.metrics||[]).map(m=>({key:m.key,avg:m.avg,target:m.target,validDays:m.validDays,trackedDays:m.trackedDays,deltaPct:m.deltaPct})),
  insights:(analysis.insights||[]).map(x=>({title:x.title,body:x.body}))};
 const optionalProfile=shareProfile?wizardContext(profile):null;
 if(optionalProfile)data.preferences=optionalProfile;
 if(weightData)data.weight=weightData;
 return data;
}
function View(props){
 const [data,setData]=useState(read);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [consent,setConsent]=useState(()=>{try{return localStorage.getItem(CONSENT)==='yes';}catch{return false;}});
 const [share,setShare]=useState(false);
 const [shareProfile,setShareProfile]=useState(false);
 const [weight,setWeight]=useState(false);
 const [editing,setEditing]=useState(null);
 const [listening,setListening]=useState(false);
 const [speech,setSpeech]=useState({id:null,status:'stopped'});
 const speechRef=useRef({id:null,utter:null});
 const [storageError,setStorageError]=useState('');
 const [sidebar,setSidebar]=useState(false);
 const [sending,setSending]=useState(false);
 const recognition=useRef(null);
 const bottom=useRef(null);
 const analysis=useMemo(()=>previous.evaluate(props),[props.logs,props.foods,props.goals,props.profile]);
 const profileContext=useMemo(()=>wizardContext(props.profile),[props.profile]);
 const thread=data.threads.find(t=>t.id===data.active)||data.threads[0];
 useEffect(()=>{
  try{localStorage.setItem(STORAGE,JSON.stringify(data));setStorageError('');}
  catch{setStorageError('Memoria locale piena o non disponibile: esporta la chat prima di chiudere la pagina.');}
 },[data]);
 useEffect(()=>{try{localStorage.setItem(CONSENT,consent?'yes':'no');}catch{}},[consent]);
 useEffect(()=>{bottom.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'});},[thread?.messages.length,busy]);
 useEffect(()=>()=>{recognition.current?.stop?.();root.speechSynthesis?.cancel?.();speechRef.current={id:null,utter:null};},[]);
 useEffect(()=>{root.speechSynthesis?.cancel?.();speechRef.current={id:null,utter:null};setSpeech({id:null,status:'stopped'});},[data.active]);
 const updateThread=(id,fn)=>setData(prev=>({...prev,threads:prev.threads.map(t=>t.id===id?{...fn(t),updatedAt:Date.now()}:t)}));
 function newThread(){const t=initial();setData(prev=>({threads:[t,...prev.threads].slice(0,30),active:t.id}));setDraft('');setEditing(null);setError('');setSidebar(false);}
 function selectThread(id){if(busy)return;setData(prev=>({...prev,active:id}));setDraft('');setEditing(null);setError('');setSidebar(false);}
 function deleteThread(id){if(busy||!confirm('Eliminare questa conversazione dal dispositivo?'))return;
  setData(prev=>{const rest=prev.threads.filter(t=>t.id!==id);const all=rest.length?rest:[initial()];return {threads:all,active:prev.active===id?all[0].id:prev.active};});}
 function exportChat(){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),threads:data.threads},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nutritrace-coach-chat.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function context(){
  if(!share)return{};
  let weightData=null;
  if(weight){try{const raw=JSON.parse(localStorage.getItem('nutritrace_body_weight_v1')||'{}');
   weightData={recent:(Array.isArray(raw.entries)?raw.entries:[]).filter(x=>x.kg!==null&&x.kg!==''&&Number.isFinite(Number(x.kg))&&Number(x.kg)>0).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-10).map(x=>({date:x.date,kg:Number(x.kg)})),
   target:raw.target==null?null:Number(raw.target)};}catch{}}
  return sharedContext({share,shareProfile,profile:props.profile,analysis,weightData});
 }
 async function ask(question,baseMessages,threadId,mode='new'){
  if(!consent){setError('Autorizza l’invio dei messaggi prima di continuare.');return;}
  setBusy(true);setError('');setSending(true);
  try{
   const history=baseMessages.filter(m=>['user','assistant'].includes(m.role)).slice(-12).map(m=>({role:m.role,content:m.content}));
   const response=await fetch('/api/coach-chat',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({question,history,context:context()})});
   const json=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(json.error||'Impossibile ottenere una risposta');
   const answer=String(json.answer||'');
   updateThread(threadId,t=>({...t,messages:[...t.messages,{id:mkid(),role:'assistant',content:answer,
    truncated:Boolean(json.truncated),finishReason:json.finishReason,createdAt:Date.now()}].slice(-100)}));
  }catch(e){setError(e.message||'Servizio AI non disponibile');}
  finally{setBusy(false);setSending(false);}
 }
 function send(e){
  e?.preventDefault?.();
  if(busy)return;
  if(!consent){setError('Per inviare una domanda devi prima selezionare “Autorizzo l’invio delle domande a GroqCloud”.');return;}
  const question=draft.trim();
  if(!question){setError('Scrivi una domanda prima di inviare.');return;}
  const id=thread.id;
  let messages=thread.messages;
  if(editing){
   const idx=messages.findIndex(m=>m.id===editing);
   if(idx<0){setEditing(null);return;}
   messages=messages.slice(0,idx);
  }
  const msg={id:mkid(),role:'user',content:question,createdAt:Date.now(),sharedScopes:share?['statistiche',...(weight?['peso']:[]),...(shareProfile&&profileContext?['preferenze']:[])]:[]};
  updateThread(id,t=>({...t,title:t.messages.length===0?question.slice(0,58):t.title,messages:[...messages,msg].slice(-100)}));
  setDraft('');setEditing(null);
  ask(question,messages,id);
 }
 function continueAnswer(){
  if(busy||!consent)return;
  const messages=thread.messages;
  const last=messages[messages.length-1];
  if(!last||last.role!=='assistant'||!last.truncated)return;
  updateThread(thread.id,t=>({...t,messages:t.messages.map(m=>m.id===last.id?{...m,truncated:false}:m)}));
  ask('Continua esattamente dal punto in cui ti sei interrotto, senza ripetere quanto già scritto.',messages,thread.id,'continue');
 }
 function editMessage(m){if(busy)return;setDraft(m.content);setEditing(m.id);setError('Modificando e reinviando, le risposte successive saranno rigenerate.');}
 function stopSpeech(){
  if(root.speechSynthesis)root.speechSynthesis.cancel();
  speechRef.current={id:null,utter:null};
  setSpeech({id:null,status:'stopped'});
 }
 function toggleSpeech(message){
  if(!('speechSynthesis' in root)||!('SpeechSynthesisUtterance' in root)){
   setError('La lettura vocale non è supportata da questo browser.');return;
  }
  const engine=root.speechSynthesis;
  if(speechRef.current.id===message.id){
   if(speech.status==='playing'){
    engine.pause();setSpeech({id:message.id,status:'paused'});return;
   }
   if(speech.status==='paused'){
    engine.resume();setSpeech({id:message.id,status:'playing'});return;
   }
  }
  stopSpeech();
  const utter=new root.SpeechSynthesisUtterance(message.content.replace(/[#*`|_]/g,' ').slice(0,3500));
  utter.lang='it-IT';utter.rate=1;
  utter.onend=()=>{if(speechRef.current.utter===utter){speechRef.current={id:null,utter:null};setSpeech({id:null,status:'stopped'});}};
  utter.onerror=()=>{if(speechRef.current.utter===utter){speechRef.current={id:null,utter:null};setSpeech({id:null,status:'stopped'});}};
  speechRef.current={id:message.id,utter};
  setSpeech({id:message.id,status:'playing'});
  engine.speak(utter);
 }
 function dictate(){
  const SR=root.SpeechRecognition||root.webkitSpeechRecognition;
  if(!SR){setError('Dettatura non disponibile in questo browser. Usa il microfono della tastiera del dispositivo.');return;}
  if(listening){recognition.current?.stop();return;}
  try{
   const r=new SR();recognition.current=r;r.lang='it-IT';r.interimResults=false;r.maxAlternatives=1;
   r.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript||'';setDraft(v=>(v.trim()?v+' ':'')+t);};
   r.onerror=()=>{setError('Dettatura non disponibile o autorizzazione microfono negata.');setListening(false);};
   r.onend=()=>setListening(false);r.start();setListening(true);
  }catch{setError('Impossibile avviare il microfono.');}
 }
 return h('section',{className:'nutritrace-ai-coach coach-v3 v5-coach'},
  h('header',{className:'coach-head'},
   h('div',null,h('span',{className:'v5-coach-kicker'},'UNO SPAZIO PER LE TUE DOMANDE'),h('h2',null,'✦ NutriTrace Coach'),h('p',null,'Rifletti sulle tue abitudini, un messaggio alla volta.')),
   h('div',{className:'coach-head-actions'},btn('Conversazioni',()=>setSidebar(x=>!x)),btn('+ Nuova chat',newThread,busy,'coach-btn coach-primary'))),
  sidebar&&h('nav',{className:'coach-thread-list','aria-label':'Conversazioni salvate'},
   ...data.threads.map(t=>h('div',{className:'coach-thread',key:t.id},
    btn(t.title,()=>selectThread(t.id),busy,'coach-btn coach-thread-title'),
    btn('Elimina',()=>deleteThread(t.id),busy))),
   btn('Esporta JSON',exportChat)),
  h('section',{className:'v5-coach-sharing','aria-label':'Condivisione facoltativa con il Coach'},
   h('label',{className:'v5-coach-sharing-main'},
    h('input',{type:'checkbox',checked:share,onChange:e=>{setShare(e.target.checked);if(!e.target.checked){setWeight(false);setShareProfile(false);}}}),
    h('span',null,h('strong',null,'Condividi informazioni nutrizionali'),h('small',null,'Facoltativo · invia le medie e gli obiettivi degli ultimi 7 giorni insieme alla prossima domanda.')),
    h('span',{className:'v5-coach-sharing-badge'},share?'Attivo':'Spento')),
   share&&h('div',{className:'v5-coach-sharing-options'},
    h('label',null,h('input',{type:'checkbox',checked:weight,onChange:e=>setWeight(e.target.checked)}),h('span',null,'Includi anche le ultime 10 misurazioni e l’obiettivo di peso')),
    h('label',null,h('input',{type:'checkbox',checked:shareProfile,disabled:!profileContext,onChange:e=>setShareProfile(e.target.checked)}),h('span',null,'Includi le preferenze e le abitudini del percorso obiettivi',!profileContext&&h('small',null,'Disponibili dopo “Personalizza i miei obiettivi” nella sezione Obiettivi.'))),
    h('small',null,'Le risposte cliniche, età e sesso del questionario non sono incluse. Puoi spegnere la condivisione in qualsiasi momento.')),
   h('p',{className:'v5-coach-sharing-note'},share?'Queste informazioni saranno inviate a GroqCloud solo quando invii un messaggio autorizzato.':'Il diario rimane sul dispositivo. Puoi usare la chat anche senza condividere le statistiche.'),
   h('details',{className:'v5-coach-privacy-note'},h('summary',null,'Come funziona la privacy della chat'),
    h('p',null,'L’autorizzazione ai messaggi è separata dalla condivisione del diario. Ogni invio comprende gli ultimi messaggi della conversazione. Spegnere la condivisione interrompe i nuovi riepiloghi; informazioni già scritte nella chat possono restare nella sua cronologia. Per un contesto nuovo avvia una nuova chat.'))),
  h('details',{className:'coach-details'},h('summary',null,'Osservazioni sul dispositivo · '+analysis.trackedDays+'/7 giorni registrati'),
   h('div',{className:'coach-stats'},...analysis.metrics.map(m=>h('div',{className:'coach-stat',key:m.key},
    h('small',null,m.name),h('strong',null,m.avg==null?'N/D':Number(m.avg).toLocaleString('it-IT',{maximumFractionDigits:1})+' '+m.unit)))),
   ...analysis.insights.map((x,i)=>h('p',{key:i},h('strong',null,x.title),': ',x.body))),
  h('div',{className:'coach-messages',role:'log','aria-label':'Messaggi della conversazione'},
   thread.messages.length===0&&h('div',{className:'coach-empty'},h('span',{className:'v5-coach-empty-symbol','aria-hidden':'true'},'✦'),h('h3',null,'Da dove vuoi iniziare?'),
    h('p',null,'Alimentazione, allenamento o una domanda sulle tue abitudini.'),
    h('div',{className:'v5-coach-prompts'},...['Come rendere più vari i miei pasti?','Come leggere le stime dei micronutrienti?','Come organizzare i pasti quando ho poco tempo?'].map(question=>btn(question,()=>setDraft(question),busy,'coach-btn v5-coach-prompt')))),
   ...thread.messages.map(m=>h('article',{key:m.id,className:'coach-message '+m.role},
    h('div',{className:'coach-message-meta'},h('strong',null,m.role==='user'?'Tu':'✦ Coach'),m.sharedScopes?.length>0&&h('small',null,'Condiviso: '+m.sharedScopes.join(', '))),
    m.role==='assistant'?root.NutriTraceCoachMarkdown.render(m.content):h('p',{className:'coach-user-text'},m.content),
    h('div',{className:'coach-message-actions'},
     m.role==='user'?btn('Modifica',()=>editMessage(m),busy):h(root.React.Fragment,null,
      btn(speech.id===m.id?(speech.status==='paused'?'▶ Riprendi':'⏸ Pausa'):'▶ Ascolta',()=>toggleSpeech(m)),
      speech.id===m.id&&btn('■ Ferma',stopSpeech),
      m.truncated&&btn('Continua risposta',continueAnswer,busy,'coach-btn coach-primary'))))),
   busy&&h('p',{className:'coach-wait',role:'status'},'Il Coach sta preparando la risposta…'),
   h('div',{ref:bottom})),
  h('form',{className:'coach-composer',onSubmit:send},
   h('label',{className:'coach-consent-row'},
    h('input',{type:'checkbox',checked:consent,onChange:e=>{
      setConsent(e.target.checked);
      if(e.target.checked)setError('');
    }}),
    h('span',null,'Autorizzo l’invio delle mie domande e degli ultimi messaggi della chat a GroqCloud.')),
   editing&&h('p',{className:'coach-editing'},'Modifica messaggio · ',btn('Annulla',()=>{setEditing(null);setDraft('');setError('');})),
   h('textarea',{value:draft,maxLength:3000,rows:3,onChange:e=>setDraft(e.target.value),placeholder:'Scrivi un messaggio…','aria-label':'Messaggio al Coach'}),
   !consent&&h('p',{className:'coach-notice coach-inline-notice',role:'status'},
    'Per inviare un messaggio, seleziona la casella di autorizzazione qui sopra.'),
   error&&h('p',{className:'coach-error coach-inline-notice',role:'alert'},error),
   h('div',{className:'coach-composer-actions'},
    btn(listening?'Ferma microfono':'🎙 Detta',dictate,busy),
    h('span',{className:'v5-coach-input-count','aria-live':'off'},draft.length+'/3000'),
    h('button',{type:'submit',className:'coach-btn coach-primary',disabled:busy||!draft.trim()},busy?'Invio…':editing?'Salva e rigenera':'Invia ↗'))),
  storageError&&h('p',{className:'coach-error',role:'alert'},storageError),
  h('small',{className:'coach-disclaimer'},'Conversazioni salvate su questo dispositivo/browser. Per registrare un alimento da foto usa Foto in Oggi. Dettatura e lettura vocale dipendono dal browser. Le risposte del Coach sono informative e non sostituiscono indicazioni cliniche.')
 );
}
root.NutriTraceAICoach={...previous,View,sharedContext,wizardContext,version:'5.0.0'};
})(window);
