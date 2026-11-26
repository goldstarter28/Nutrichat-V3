'use strict';
(function(root){
  const PREFIX='nutritrace_demo_v73::', SESSION='nutritrace_environment_v73';
  function create(options){
    const native=options.storage, session=options.sessionStorage;
    const url=new URL(options.url||'https://nutritrace.local/');
    let saved='personal';try{saved=session?.getItem(SESSION)||'personal';}catch{}
    const requested=url.searchParams.get('env');
    const mode=(requested==='demo'||requested==='personal')?requested:saved==='demo'?'demo':'personal';
    try{session?.setItem(SESSION,mode);}catch{}
    const own=key=>String(key).startsWith('nutritrace_')&&!String(key).startsWith(PREFIX);
    const scoped=key=>{key=String(key);if(!own(key))throw Error('Chiave di archivio non appartenente a NutriTrace.');return mode==='demo'?PREFIX+key:key;};
    function keys(){const result=[];for(let i=0;i<native.length;i++){const key=native.key(i);if(mode==='demo'){if(key?.startsWith(PREFIX))result.push(key.slice(PREFIX.length));}else if(own(key))result.push(key);}return result;}
    const storage=Object.freeze({getItem:key=>native.getItem(scoped(key)),setItem:(key,value)=>native.setItem(scoped(key),String(value)),removeItem:key=>native.removeItem(scoped(key)),key:index=>keys()[Number(index)]??null,clear:()=>keys().forEach(key=>native.removeItem(scoped(key))),get length(){return keys().length;}});
    function switchTo(next){if(!['personal','demo'].includes(next))throw Error('Ambiente non valido.');const target=new URL(options.url||url.href);target.searchParams.set('env',next);try{session?.setItem(SESSION,next);}catch{}options.navigate?.(target.href);return target.href;}
    function transaction(entries){const old=entries.map(([k])=>[k,storage.getItem(k)]);try{entries.forEach(([k,v])=>v===null?storage.removeItem(k):storage.setItem(k,v));}catch(error){for(const [k,v]of [...old].reverse()){try{v===null?storage.removeItem(k):storage.setItem(k,v);}catch{}}throw error;}}
    return Object.freeze({mode,isDemo:mode==='demo',storage,switchTo,transaction,databaseName:name=>mode==='demo'?'nutritrace-demo-v73-'+String(name):String(name),resetDemo:()=>{if(mode!=='demo')throw Error('Il ripristino demo è disponibile solo nella demo.');storage.clear();},PREFIX});
  }
  let env=null;try{if(root.localStorage&&root.location)env=create({storage:root.localStorage,sessionStorage:root.sessionStorage,url:root.location.href,navigate:href=>root.location.assign(href)});}catch(error){root.NutriTraceEnvironmentError=error.message;}
  function Switcher({hasUnsavedChanges=false}={}){const h=root.React.createElement;const active=root.NutriTraceEnvironment;const[error,setError]=root.React.useState('');if(!active?.storage)return h('p',{role:'alert'},'Archivio del browser non disponibile. Esporta i dati prima di continuare.');return h('aside',{className:'v73-environment '+(active.isDemo?'is-demo':''),'aria-label':'Ambiente attivo'},h('span',null,h('strong',null,active.isDemo?'AMBIENTE DEMO':'Ambiente personale'),h('span',null,active.isDemo?'Registrazioni sintetiche · i tuoi dati sono separati':'I tuoi dati su questo dispositivo')),h('button',{type:'button',className:'ghost',onClick:()=>{if(hasUnsavedChanges&&!root.confirm('Hai una schermata aperta con modifiche non confermate. Cambiando ambiente chiuderai questa schermata. Vuoi continuare?'))return;try{active.switchTo(active.isDemo?'personal':'demo');}catch(e){setError(e.message);}}},active.isDemo?'Torna ai tuoi dati':'Prova la demo'),error&&h('span',{role:'alert'},error));}
  root.NutriTraceEnvironment=Object.freeze({...env,create,Switcher});
  if(typeof module!=='undefined'&&module.exports)module.exports={create,PREFIX,SESSION};
})(typeof globalThis!=='undefined'?globalThis:this);
