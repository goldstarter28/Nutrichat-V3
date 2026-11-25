/* NutriTrace Coach V5: existing chat, speech and API with explicit optional context. */
(function(root){
'use strict';
const h=root.React.createElement;
const {useState,useEffect,useMemo,useRef}=root.React;
const previous=root.NutriTraceAICoach;
if(!previous)throw Error('AI Coach base mancante');
const STORAGE='nutritrace_coach_threads_v3';
const CONSENT='nutritrace_coach_consent_v3';
const PROFILE_INVITE='nutritrace_coach_profile_invite_v5';
const SETTINGS_COMPACT='nutritrace_coach_compact_v5';
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
 const optionalProfile=shareProfile?wizardContext(profile):null;
 // The backend caps the JSON length; put the explicitly consented profile first.
 const data={...(optionalProfile?{preferences:optionalProfile}:{}),period:'ultimi 7 giorni',trackedDays:analysis.trackedDays,previousTrackedDays:analysis.previousTrackedDays,
  metrics:(analysis.metrics||[]).map(m=>({key:m.key,avg:m.avg,target:m.target,validDays:m.validDays,trackedDays:m.trackedDays,deltaPct:m.deltaPct})),
  insights:(analysis.insights||[]).map(x=>({title:x.title,body:x.body}))};
 if(weightData)data.weight=weightData;
 return data;
}
// Persist the invitation once per browser, not once per chat. A voluntary opt-in
// also counts as a decision; never ask again after the user later revokes it.
let profileInviteClaimed=false;
function claimProfileInvite(storage){
 if(profileInviteClaimed)return false;
 try{if(storage.getItem(PROFILE_INVITE)==='yes'){profileInviteClaimed=true;return false;}storage.setItem(PROFILE_INVITE,'yes');}catch{}
 profileInviteClaimed=true;return true;
}
const SHARING_V61='nutritrace_coach_sharing_v61';
function readSharing(){try{return JSON.parse(root.localStorage.getItem(SHARING_V61)||'{}')||{};}catch{return {};}}
function View(props){
 const [data,setData]=useState(read);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [consent,setConsent]=useState(()=>{try{return localStorage.getItem(CONSENT)==='yes';}catch{return false;}});
 const [share,setShare]=useState(()=>readSharing().nutrition===true);
 const [compact,setCompact]=useState(()=>{try{return localStorage.getItem(SETTINGS_COMPACT)==='yes';}catch{return false;}});
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [profileInvite,setProfileInvite]=useState(false);
 const [shareProfile,setShareProfile]=useState(()=>readSharing().nutrition===true&&readSharing().profile===true);
 const [weight,setWeight]=useState(()=>readSharing().nutrition===true&&readSharing().weight===true);
 const [shareHealth,setShareHealth]=useState(()=>readSharing().nutrition===true&&readSharing().profile===true&&readSharing().health===true);
 const [editing,setEditing]=useState(null);
 const [listening,setListening]=useState(false);
 const [speech,setSpeech]=useState({id:null,status:'stopped'});
 const speechRef=useRef({id:null,utter:null});
 const [storageError,setStorageError]=useState('');
 const [sidebar,setSidebar]=useState(false);
 const [sending,setSending]=useState(false);
 const recognition=useRef(null);
 const bottom=useRef(null);
 const [localPeriod,setLocalPeriod]=useState('90');
 const localHistory=useMemo(()=>root.NutriTraceIntelligence?.buildHistory(props),[props.logs,props.foods,props.goals,props.profile]);
 const localWindow=localHistory?.windows[Number(localPeriod)];
 const profileContext=useMemo(()=>wizardContext(props.profile),[props.profile]);
 const thread=data.threads.find(t=>t.id===data.active)||data.threads[0];
 useEffect(()=>{
  try{localStorage.setItem(STORAGE,JSON.stringify(data));setStorageError('');}
  catch{setStorageError('Memoria locale piena o non disponibile: esporta la chat prima di chiudere la pagina.');}
 },[data]);
 useEffect(()=>{try{localStorage.setItem(CONSENT,consent?'yes':'no');}catch{}},[consent]);
 useEffect(()=>{try{localStorage.setItem(SHARING_V61,JSON.stringify({nutrition:share,profile:share&&shareProfile,weight:share&&weight,health:share&&shareProfile&&shareHealth}));}catch{}},[share,shareProfile,weight,shareHealth]);
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
 function collapseSettings(){setCompact(true);setSettingsOpen(false);try{localStorage.setItem(SETTINGS_COMPACT,'yes');}catch{}}
 function offerProfileOnce(){
  if(!profileContext)return;
  let storage;try{storage=root.localStorage;}catch{}
  if(claimProfileInvite(storage)&&!shareProfile)setProfileInvite(true);
 }
 function context(question){
  if(!share)return{};
  const Q=root.NutriTraceIntelligence;
  if(!Q)throw Error('Modulo contesto non disponibile. Ricarica l’app.');
  let weightData={};if(weight){try{weightData=JSON.parse(localStorage.getItem('nutritrace_body_weight_v1')||'{}');}catch{}}
  return Q.fitContext(Q.coachContext(props,question,{share,shareProfile,shareHealth:shareProfile&&shareHealth,shareWeight:weight,weights:weightData.entries,weightTarget:weightData.target,state:props.qualityState}),8500);
 }
 async function ask(question,baseMessages,threadId,mode='new'){
  if(!consent){setError('Autorizza l’invio dei messaggi prima di continuare.');return;}
  setBusy(true);setError('');setSending(true);
  try{
   const history=baseMessages.filter(m=>['user','assistant'].includes(m.role)).slice(-12).map(m=>({role:m.role,content:m.content}));
   const response=await fetch('/api/coach-chat',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({question,history,context:context(question)})});
   const json=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(json.error||'Impossibile ottenere una risposta');
   const answer=String(json.answer||'');
   updateThread(threadId,t=>({...t,messages:[...t.messages,{id:mkid(),role:'assistant',content:answer,
    truncated:Boolean(json.truncated),finishReason:json.finishReason,createdAt:Date.now()}].slice(-100)}));
   if(mode==='new')offerProfileOnce();
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
  const msg={id:mkid(),role:'user',content:question,createdAt:Date.now(),sharedScopes:share?['statistiche',...(weight?['peso']:[]),...(shareProfile&&profileContext?['percorso']:[]),...(shareProfile&&shareHealth?['informazioni fisiologiche e allergeni personali']:[])]:[]};
  updateThread(id,t=>({...t,title:t.messages.length===0?question.slice(0,58):t.title,messages:[...messages,msg].slice(-100)}));
  setDraft('');setEditing(null);
  collapseSettings();
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
 const sharingPanel=h('section',{className:'v5-coach-sharing','aria-label':'Condivisione facoltativa con il Coach'},
   h('label',{className:'v5-coach-sharing-main'},
    h('input',{type:'checkbox',checked:share,onChange:e=>{setShare(e.target.checked);if(!e.target.checked){setWeight(false);setShareProfile(false);setShareHealth(false);}}}),
    h('span',null,h('strong',null,'Condividi informazioni nutrizionali'),h('small',null,'Facoltativo · obiettivi attuali, statistiche fino a 90 giorni e riepiloghi fino a 52 settimane; dettagli selezionati secondo la domanda e le quote. La scelta resta sul dispositivo.')),
    h('span',{className:'v5-coach-sharing-badge'},share?'Attivo':'Spento')),
   share&&h('div',{className:'v5-coach-sharing-options'},
    h('label',null,h('input',{type:'checkbox',checked:weight,onChange:e=>setWeight(e.target.checked)}),h('span',null,'Includi anche lo storico aggregato delle pesate e l’obiettivo di peso')),
    h('label',null,h('input',{type:'checkbox',checked:shareProfile,disabled:!profileContext,onChange:e=>{setShareProfile(e.target.checked);if(!e.target.checked)setShareHealth(false);if(e.target.checked){let storage;try{storage=root.localStorage;}catch{}claimProfileInvite(storage);setProfileInvite(false);}}}),h('span',null,'Includi le risposte del percorso, età, altezza, peso del profilo, coefficiente fisiologico e calcolo degli obiettivi',!profileContext&&h('small',null,'Disponibili dopo “Personalizza i miei obiettivi” nella sezione Obiettivi.'))),
    shareProfile&&h('label',null,h('input',{type:'checkbox',checked:shareHealth,onChange:e=>setShareHealth(e.target.checked)}),h('span',null,'Autorizzo separatamente le risposte fisiologiche e di assistenza del wizard e gli allergeni personali.')),
    h('small',null,'Le informazioni vengono inviate a GroqCloud. Nessun invio a OpenRouter. Puoi revocare la condivisione in qualsiasi momento.')),
   h('p',{className:'v5-coach-sharing-note'},share?'Queste informazioni saranno inviate a GroqCloud solo quando invii un messaggio autorizzato.':'Il diario rimane sul dispositivo. Puoi usare la chat anche senza condividere le statistiche.'),
   share&&h('button',{type:'button',className:'ghost v5-coach-sharing-done',onClick:collapseSettings},'Fatto'),
   h('details',{className:'v5-coach-privacy-note'},h('summary',null,'Come funziona la privacy della chat'),
    h('p',null,'L’autorizzazione ai messaggi è separata dalla condivisione del diario. Ogni invio comprende gli ultimi messaggi della conversazione. Spegnere la condivisione interrompe i nuovi riepiloghi; informazioni già scritte nella chat possono restare nella sua cronologia. Per un contesto nuovo avvia una nuova chat.')));
 const consentControl=h('label',{className:'coach-consent-row'},
    h('input',{type:'checkbox',checked:consent,onChange:e=>{
      setConsent(e.target.checked);
      if(e.target.checked)setError('');
    }}),
    h('span',null,'Autorizzo l’invio delle mie domande e degli ultimi messaggi della chat a GroqCloud.'));
 return h('section',{className:'nutritrace-ai-coach coach-v3 v5-coach'},
  h('header',{className:'coach-head'},
   h('div',null,h('span',{className:'v5-coach-kicker'},'UNO SPAZIO PER LE TUE DOMANDE'),h('h2',null,'✦ NutriTrace Coach'),h('p',null,'Rifletti sulle tue abitudini, un messaggio alla volta.')),
   h('div',{className:'coach-head-actions'},btn('Conversazioni',()=>setSidebar(x=>!x)),btn('+ Nuova chat',newThread,busy,'coach-btn coach-primary'))),
  sidebar&&h('nav',{className:'coach-thread-list','aria-label':'Conversazioni salvate'},
   ...data.threads.map(t=>h('div',{className:'coach-thread',key:t.id},
    btn(t.title,()=>selectThread(t.id),busy,'coach-btn coach-thread-title'),
    btn('Elimina',()=>deleteThread(t.id),busy))),
   btn('Esporta JSON',exportChat)),
  !compact&&sharingPanel,
  localWindow&&h('details',{className:'coach-details'},h('summary',null,'Riepilogo locale · '+localWindow.days+'/'+localPeriod+' giorni registrati'),
   h('label',null,'Periodo del riepilogo',h('select',{value:localPeriod,onChange:e=>setLocalPeriod(e.target.value)},...[7,30,60,90,364].map(n=>h('option',{key:n,value:String(n)},n===364?'52 settimane':n+' giorni')))),
   h('p',{className:'muted'},localWindow.entries+' registrazioni · '+(Number(localPeriod)-localWindow.days)+' giorni senza registrazioni. Medie dei soli giorni con dati, non consumi confermati.'),
   h('div',{className:'coach-stats'},...localHistory.metrics.slice(0,5).map(m=>h('div',{className:'coach-stat',key:m.id},h('small',null,m.name),h('strong',null,localWindow.metrics[m.id]?.avg==null?'N/D':Number(localWindow.metrics[m.id].avg).toLocaleString('it-IT',{maximumFractionDigits:1})+' '+m.unit)))),
   h('small',{className:'muted'},share?'Il periodo qui scelto cambia solo questo riepilogo. Il Coach riceve contesto fino a 90 giorni e riepiloghi settimanali fino a 52 settimane, nei limiti del budget e dei consensi.':'Il riepilogo è locale. Il Coach non riceve statistiche finché non autorizzi la condivisione.')),
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
   (!compact||!consent)&&consentControl,
   editing&&h('p',{className:'coach-editing'},'Modifica messaggio · ',btn('Annulla',()=>{setEditing(null);setDraft('');setError('');})),
   h('textarea',{value:draft,maxLength:3000,rows:3,onChange:e=>setDraft(e.target.value),placeholder:'Scrivi un messaggio…','aria-label':'Messaggio al Coach'}),
   !consent&&h('p',{className:'coach-notice coach-inline-notice',role:'status'},
    'Per inviare un messaggio, seleziona la casella di autorizzazione qui sopra.'),
   error&&h('p',{className:'coach-error coach-inline-notice',role:'alert'},error),
   h('div',{className:'coach-composer-actions'},
    btn(listening?'Ferma microfono':'🎙 Detta',dictate,busy),
    h('span',{className:'v5-coach-input-count','aria-live':'off'},draft.length+'/3000'),
    h('button',{type:'submit',className:'coach-btn coach-primary',disabled:busy||!draft.trim()},busy?'Invio…':editing?'Salva e rigenera':'Invia ↗'))),
  profileInvite&&h('article',{className:'v5-coach-profile-invite',role:'status'},h('strong',null,'Vuoi includere anche le informazioni del tuo percorso?'),h('p',null,'È facoltativo: le risposte restano locali finché non autorizzi la condivisione.'),h('div',{className:'v5-action-row'},btn('Apri impostazioni',()=>{setCompact(true);setSettingsOpen(true);setProfileInvite(false);}),btn('No, grazie',()=>setProfileInvite(false)))),
  compact&&h('section',{className:'v5-coach-settings-compact'},h('button',{type:'button',className:'ghost v5-coach-settings-toggle','aria-expanded':settingsOpen,onClick:()=>setSettingsOpen(v=>!v)},'Condivisione e privacy · '+(share?'Statistiche attive':'Statistiche spente')+(share&&shareProfile?' · Preferenze attive':'')+(settingsOpen?' ▴':' ▾')),settingsOpen&&h('div',null,sharingPanel,consent&&consentControl,btn('Chiudi impostazioni',()=>setSettingsOpen(false)))),
  storageError&&h('p',{className:'coach-error',role:'alert'},storageError),
  h('small',{className:'coach-disclaimer'},'Conversazioni salvate su questo dispositivo/browser. Per registrare un alimento da foto usa Foto in Oggi. Dettatura e lettura vocale dipendono dal browser. Le risposte del Coach sono informative e non sostituiscono indicazioni cliniche.')
 );
}
root.NutriTraceAICoach={...previous,View,sharedContext,wizardContext,claimProfileInvite,version:'5.0.0'};
})(window);
