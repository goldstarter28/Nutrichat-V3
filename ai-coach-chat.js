/* NutriTrace Coach V3: local-first persistent conversations, edit, continue, speech.
   Images are local attachments only: no vision inference without a verified multimodal provider. */
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
function View(props){
 const [data,setData]=useState(read);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [consent,setConsent]=useState(()=>localStorage.getItem(CONSENT)==='yes');
 const [share,setShare]=useState(false);
 const [weight,setWeight]=useState(false);
 const [editing,setEditing]=useState(null);
 const [listening,setListening]=useState(false);
 const [speech,setSpeech]=useState({id:null,status:'stopped'});
 const speechRef=useRef({id:null,utter:null});
 const [photo,setPhoto]=useState(null);
 const [storageError,setStorageError]=useState('');
 const [sidebar,setSidebar]=useState(false);
 const [sending,setSending]=useState(false);
 const recognition=useRef(null);
 const fileRef=useRef(null);
 const bottom=useRef(null);
 const analysis=useMemo(()=>previous.evaluate(props),[props.logs,props.foods,props.goals,props.profile]);
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
 function newThread(){const t=initial();setData(prev=>({threads:[t,...prev.threads].slice(0,30),active:t.id}));setDraft('');setEditing(null);setError('');setPhoto(null);setSidebar(false);}
 function selectThread(id){if(busy)return;setData(prev=>({...prev,active:id}));setDraft('');setEditing(null);setError('');setPhoto(null);setSidebar(false);}
 function deleteThread(id){if(busy||!confirm('Eliminare questa conversazione dal dispositivo?'))return;
  setData(prev=>{const rest=prev.threads.filter(t=>t.id!==id);const all=rest.length?rest:[initial()];return {threads:all,active:prev.active===id?all[0].id:prev.active};});}
 function exportChat(){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),threads:data.threads},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nutritrace-coach-chat.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function context(){
  if(!share)return{};
  const d={period:'ultimi 7 giorni',trackedDays:analysis.trackedDays,previousTrackedDays:analysis.previousTrackedDays,
   metrics:analysis.metrics.map(m=>({key:m.key,avg:m.avg,target:m.target,validDays:m.validDays,trackedDays:m.trackedDays,deltaPct:m.deltaPct})),
   insights:analysis.insights.map(x=>({title:x.title,body:x.body}))};
  if(weight){try{const raw=JSON.parse(localStorage.getItem('nutritrace_body_weight_v1')||'{}');
   d.weight={recent:(Array.isArray(raw.entries)?raw.entries:[]).filter(x=>Number.isFinite(Number(x.kg))).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-10).map(x=>({date:x.date,kg:Number(x.kg)})),
   target:raw.target==null?null:Number(raw.target)};}catch{}}
  return d;
 }
 async function ask(question,baseMessages,threadId,mode='new'){
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
  if(photo){setError('La foto è allegata soltanto localmente: la lettura delle immagini non è ancora abilitata. Rimuovila e invia il testo.');return;}
  const id=thread.id;
  let messages=thread.messages;
  if(editing){
   const idx=messages.findIndex(m=>m.id===editing);
   if(idx<0){setEditing(null);return;}
   messages=messages.slice(0,idx);
  }
  const msg={id:mkid(),role:'user',content:question,createdAt:Date.now()};
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
 function photoSelect(e){
  const f=e.target.files?.[0];e.target.value='';
  if(!f)return;
  if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>4*1024*1024){setError('Usa JPG, PNG o WebP fino a 4 MB.');return;}
  setPhoto({name:f.name,size:f.size});setError('Foto selezionata, ma la lettura AI delle immagini non è ancora abilitata. Nessuna foto viene inviata al server.');
 }
 return h('section',{className:'nutritrace-ai-coach coach-v3'},
  h('header',{className:'coach-head'},
   h('div',null,h('h2',null,'✦ NutriTrace Coach'),h('p',null,'Chat AI e analisi locale · GroqCloud in Preview')),
   h('div',{className:'coach-head-actions'},btn('Conversazioni',()=>setSidebar(x=>!x)),btn('+ Nuova chat',newThread,busy,'coach-btn coach-primary'))),
  sidebar&&h('nav',{className:'coach-thread-list','aria-label':'Conversazioni salvate'},
   ...data.threads.map(t=>h('div',{className:'coach-thread',key:t.id},
    btn(t.title,()=>selectThread(t.id),busy,'coach-btn coach-thread-title'),
    btn('Elimina',()=>deleteThread(t.id),busy))),
   btn('Esporta JSON',exportChat)),
  h('details',{className:'coach-details'},h('summary',null,'Statistiche e osservazioni locali · '+analysis.trackedDays+'/7 giorni'),
   h('div',{className:'coach-stats'},...analysis.metrics.map(m=>h('div',{className:'coach-stat',key:m.key},
    h('small',null,m.name),h('strong',null,m.avg==null?'N/D':Number(m.avg).toLocaleString('it-IT',{maximumFractionDigits:1})+' '+m.unit)))),
   ...analysis.insights.map((x,i)=>h('p',{key:i},h('strong',null,x.title),': ',x.body))),
  h('details',{className:'coach-details'},h('summary',null,'Privacy e condivisione dei dati'),
   h('p',null,'La domanda e gli ultimi messaggi contestuali vengono inviati a GroqCloud. Non inserire informazioni identificative o cliniche.'),
   h('label',null,h('input',{type:'checkbox',checked:consent,onChange:e=>setConsent(e.target.checked)}),' Autorizzo l’invio delle mie domande a GroqCloud'),
   h('label',null,h('input',{type:'checkbox',checked:share,onChange:e=>{setShare(e.target.checked);if(!e.target.checked)setWeight(false);}}),' Condividi statistiche nutrizionali aggregate (facoltativo)'),
   share&&h('label',null,h('input',{type:'checkbox',checked:weight,onChange:e=>setWeight(e.target.checked)}),' Condividi le ultime 10 misurazioni del peso (facoltativo)')),
  h('div',{className:'coach-messages',role:'log','aria-label':'Messaggi della conversazione'},
   thread.messages.length===0&&h('div',{className:'coach-empty'},h('h3',null,'Come posso aiutarti?'),
    h('p',null,'Chiedimi informazioni su alimentazione, allenamento e trend. I dati del diario sono condivisi solo se lo scegli.')),
   ...thread.messages.map(m=>h('article',{key:m.id,className:'coach-message '+m.role},
    h('div',{className:'coach-message-meta'},h('strong',null,m.role==='user'?'Tu':'Coach')),
    m.role==='assistant'?root.NutriTraceCoachMarkdown.render(m.content):h('p',{className:'coach-user-text'},m.content),
    h('div',{className:'coach-message-actions'},
     m.role==='user'?btn('Modifica',()=>editMessage(m),busy):h(root.React.Fragment,null,
      btn(speech.id===m.id?(speech.status==='paused'?'▶ Riprendi':'⏸ Pausa'):'▶ Ascolta',()=>toggleSpeech(m)),
      speech.id===m.id&&btn('■ Ferma',stopSpeech),
      m.truncated&&btn('Continua risposta',continueAnswer,busy,'coach-btn coach-primary'))))),
   busy&&h('p',{className:'coach-wait',role:'status'},'Il Coach sta preparando la risposta…'),
   h('div',{ref:bottom})),
  h('form',{className:'coach-composer',onSubmit:send},
   editing&&h('p',{className:'coach-editing'},'Modifica messaggio · ',btn('Annulla',()=>{setEditing(null);setDraft('');setError('');})),
   h('textarea',{value:draft,maxLength:3000,rows:3,onChange:e=>setDraft(e.target.value),placeholder:'Scrivi un messaggio…','aria-label':'Messaggio al Coach'}),
   photo&&h('p',{className:'coach-photo'},'📷 '+photo.name+' (solo locale) ',btn('Rimuovi',()=>{setPhoto(null);setError('');})),
   h('div',{className:'coach-composer-actions'},
    btn(listening?'Ferma microfono':'🎙 Detta',dictate,busy),
    btn('📷 Foto',()=>fileRef.current?.click(),busy),
    h('input',{type:'file',ref:fileRef,accept:'image/jpeg,image/png,image/webp',capture:'environment',style:{display:'none'},onChange:photoSelect}),
    h('button',{type:'submit',className:'coach-btn coach-primary',disabled:busy||!draft.trim()||Boolean(photo)},busy?'Invio…':editing?'Salva e rigenera':'Invia'))),
  !consent&&h('p',{className:'coach-notice',role:'status'},'Per conversare apri “Privacy e condivisione dei dati” e autorizza l’invio delle domande.'),
  error&&h('p',{className:'coach-error',role:'alert'},error),
  storageError&&h('p',{className:'coach-error',role:'alert'},storageError),
  h('small',{className:'coach-disclaimer'},'Conversazioni salvate soltanto su questo dispositivo/browser. La dettatura e la lettura vocale dipendono dal browser. Le foto non vengono ancora interpretate. Nessuna diagnosi medica.')
 );
}
root.NutriTraceAICoach={...previous,View,version:'3.0.0'};
})(window);
