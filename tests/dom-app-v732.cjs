'use strict';
// Actual React application flows. Network APIs and hardware are not exercised.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {setup,wait,until,TODAY}=require('./dom-v73.cjs');
(async()=>{
 const report={version:'7.3.2',date:TODAY,scope:'React application events with local data, real Master DB and mocked recipe HTTP response; no rendered browser layout or real API/hardware',checks:[]};
 let a;
 async function check(name,fn){await fn();assert.deepEqual(a.errors,[],name+' runtime');assert.deepEqual(a.warnings,[],name+' warnings');report.checks.push({name,status:'PASS'});console.log('PASS '+name);}
 try{
  a=await setup();let {w,q,all,button,click,input,submit,stored,logs,nav}=a;
  const beforePersonal={...a.personal},beforeLogs=JSON.stringify(logs());
  await check('User-selected icon is wired to the app header',async()=>{assert.equal(q('.a-logo-mark').tagName,'IMG');assert.equal(q('.a-logo-mark').getAttribute('src'),'./icon-user-192.png');});
  await check('Weight target saved in Goals is shown in Peso without changing calorie goals',async()=>{
   await nav('Obiettivi');const old=JSON.stringify(stored('nutritrace_goals_v23'));
   const target=q('[data-v732-weight-target]');assert.ok(target);await input(q('input',target),'72.5');await click(button('Salva obiettivo',target));
   assert.equal(stored('nutritrace_body_weight_v1').target,72.5);assert.equal(JSON.stringify(stored('nutritrace_goals_v23')),old);
   await nav('Peso');assert.equal(q('[data-v732-weight-target] input').value,'72.5');
  });
  await check('Full weight section ends with history after both graphs; selected interval is visible',async()=>{
   const history=q('[data-v732-weight-history]'),section=q('.aurora-peso');assert.ok(history);
   assert.equal(all('article.card',section).at(-1),history);assert.ok(all('svg',section).length>=2);
   await input(q('select[aria-label="Periodo delle variazioni di peso"]'),'7');
   assert.match(q('[data-v732-period-dates]').textContent,/\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}/);
   assert.equal(q('[data-v732-period-dates]').textContent.split(' → ')[1],TODAY);
  });
  await check('Food grades share the name row and search results do not trap vertical scrolling',async()=>{
   await nav('Oggi');await input(q('.quickInputs input[aria-label="Cerca un alimento"]'),'yogurt',600);
   await until(()=>all('.v5-search-list .quickChoice').length===20,'20 results');
   for(const row of all('.v5-search-list .quickChoice'))assert.ok(q('.v732-food-title>b',row)&&q('.v732-food-title .q73-grade',row));
   const style=w.document.createElement('style');style.textContent=fs.readFileSync(path.join(__dirname,'../environment-v73.css'),'utf8');w.document.head.appendChild(style);
   const css=w.getComputedStyle(q('.v5-search-list'));assert.equal(css.maxHeight,'none');assert.equal(css.overflow,'visible');
   await click(q('.v73-search-more'));assert.ok(all('.v5-search-list .quickChoice').length>20);
   await input(q('.quickInputs input[aria-label="Cerca un alimento"]'),'');
  });
  await check('Real link-entry handler cleans ingredient suffix weights and keeps q.b. unweighed',async()=>{
   const apiBefore=a.requests.filter(x=>x.path.startsWith('/api/')).length;
   w.__recipeReply=()=>({kind:'structured',url:'https://example.test/ricetta',name:'Ricetta QA',ingredients:['Riso integrale cotto 200g','Ceci cotti 100 g','Olio di oliva 10g','Sale q.b.'],instructions:'Unire gli ingredienti.',servings:'2 porzioni'});
   await click(button('Lista / ricetta / link'));await input(q('.v5-text-entry textarea'),'https://example.test/ricetta');await click(button('Recupera ricetta'),300);
   await until(()=>all('.v5-ingredient').length===4,'Imported ingredient review');
   const rows=all('.v5-ingredient');const names=rows.map(row=>q('.v5-two-fields input',row).value);
   assert.deepEqual(names,['Riso integrale cotto','Ceci cotti','Olio di oliva','Sale']);
   assert.deepEqual(rows.map(row=>q('input[type=number]',row).value),['200','100','10','']);
   for(const row of rows)assert.ok(q('select',row).options.length>1,'Food candidates exist');
   assert.match(rows[3].textContent,/q\.b\.:.*grammi/);
   assert.ok(q('button[aria-label="Foto etichetta ingrediente"]',rows[0]).closest('.v732-ingredient-actions'));
   assert.ok(q('button[aria-label="Codice a barre ingrediente"]',rows[0]).closest('.v732-ingredient-actions'));
   const calls=a.requests.filter(x=>x.path.startsWith('/api/')).slice(apiBefore);assert.deepEqual(calls.map(x=>x.path),['/api/recipe-url-import']);
   assert.equal(JSON.stringify(logs()),beforeLogs);
  });
  await check('All preceding edits remain inside the demo environment',async()=>{for(const[k,v]of Object.entries(beforePersonal))assert.equal(w.localStorage.getItem(k),v);});
  a.dom.window.close();
  a=await setup({scenario:'realistic',days:1096});({w,q,all,button,click,input,submit,stored,logs,nav}=a);
  await check('Three-year realistic demo opens assisted mode with a usable TDEE',async()=>{
   await nav('Analisi');const panel=q('.v70-metabolism');assert.equal(q('select',panel).value,'assisted');assert.ok(button('Calcola proposta',panel));
   assert.match(panel.textContent,/Incertezza indicativa/);assert.ok(q('svg',panel));
   await click(button('Calcola proposta',panel));assert.match(panel.textContent,/Nessuna revisione proposta/);
  });
  await check('Live demo proposal changes targets only after review and final confirmation',async()=>{
   await nav('Obiettivi');const label=all('.macroPlanGrid label').find(l=>l.textContent.startsWith('Calorie target'));assert.ok(label);
   await input(q('input',label),'1800');await click(button('Applica ai target'));await nav('Analisi');
   const panel=q('.v70-metabolism'),prior=JSON.stringify(stored('nutritrace_goals_v23'));
   assert.equal(stored('nutritrace_goals_v23').find(x=>x.id==='kcal').target,1800);
   await click(button('Calcola proposta',panel));assert.ok(button('Rivedi proposta',panel));assert.equal(JSON.stringify(stored('nutritrace_goals_v23')),prior);
   await click(button('Rivedi proposta',panel));assert.equal(JSON.stringify(stored('nutritrace_goals_v23')),prior);
   await click(button('Conferma nuovi obiettivi',panel));assert.equal(stored('nutritrace_goals_v23').find(x=>x.id==='kcal').target,1890);
   assert.ok(stored('nutritrace_profile_v23').goalHistoryV70.length>0);
   for(const[k,v]of Object.entries(a.personal))assert.equal(w.localStorage.getItem(k),v);
  });
  report.status='PASS';
 }catch(error){report.status='FAIL';report.error=error.stack;report.domExcerpt=a?.w.document.body.textContent.slice(-10000);process.exitCode=1;console.error(error.stack);}
 finally{report.errors=a?.errors||[];report.warnings=a?.warnings||[];a?.dom.window.close();fs.writeFileSync(path.join(__dirname,'../docs/qa-dom-app-v732.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors.length,warnings:report.warnings.length}));}
})();
