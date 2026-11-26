#!/usr/bin/env node
'use strict';
// Reads source DBs without modifying them. Writes only the explicitly requested derived report/index.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Q=require('../food-quality-v73');
const argv=process.argv.slice(2),get=(key,fallback)=>{const i=argv.indexOf(key);return i>=0?argv[i+1]:fallback;};
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const safeStatus=new Set(['available','available_outlier_excluded','logical_zero','available_zero_conflict']);
function masterFood(row,detail){
 const food={id:String(row.id),masterId:String(row.id),name:row.name||row.name_en,officialName:row.name_en||row.name,masterCategory:row.category,servingGrams:100,label:{},labelProvenance:{},sources:(row.sources||[]).map(code=>({name:code,reference:'Master DB'})),qualityV73:{sourceCategory:row.category}};
 const macros={kcal:['energy_kcal'],energyKj:['energy_kj'],protein:['protein'],carbs:['carbohydrate_available','carbohydrate_total'],sugar:['sugars_total'],fat:['fat_total'],saturatedFat:['fat_saturated'],fiber:['fiber'],salt:['salt']};
 for(const [key,ids] of Object.entries(macros)){
  for(const id of ids){const a=detail?.n?.[id];if(!a||Q.num(a[0])===null||!safeStatus.has(a[2]))continue;food.label[key]=a[0];food.labelProvenance[key]={status:a[2],sources:a[3]||[],reliability:a[1],grade:a[6],warning:a[5]||'',method:'source',canonicalId:id,estimated:/\bestimat(?:e|ed)\b|\bimputed\b|\bai(?:[_ -]?estimate)?\b/i.test(String(a[1])+' '+String(a[2])),quarantined:a[6]==='D'||/quarantin|conflict/i.test(String(a[2])+' '+String(a[5]||''))};break;}
  if(food.label[key]===undefined){const id=ids.find(i=>detail?.nd?.[i]);if(id)food.labelProvenance[key]={status:detail.nd[id][0],reason:detail.nd[id][1],sources:detail.nd[id][2]||[]};}
 }
 if(food.label.salt===undefined){const a=detail?.n?.sodium;if(a&&Q.num(a[0])!==null&&safeStatus.has(a[2])){food.label.salt=a[0]*2.5/1000;food.labelProvenance.salt={status:a[2],method:'calculated-from-sodium',sources:a[3]||[],grade:a[6],formula:'sodium mg × 2.5 / 1000 = salt g',originalValue:a[0],quarantined:a[6]==='D'||/quarantin|conflict/i.test(String(a[2])+' '+String(a[5]||''))};}}
 return food;
}
function auditMaster(directory){
 const manifestPath=path.join(directory,'manifest.json'),indexPath=path.join(directory,'index.json'),manifest=read(manifestPath),index=fs.existsSync(indexPath)?read(indexPath):null;
 if(index!==null&&!Array.isArray(index))throw new Error('Formato index.json non valido.');
 const chunks=new Map(),hashes={'manifest.json':sha(fs.readFileSync(manifestPath))},missingChunks=[],records=new Map();
 if(index)hashes['index.json']=sha(fs.readFileSync(indexPath));
 for(let i=0;i<Number(manifest.chunk_count||64);i++){
  const relative='chunks/'+String(i).padStart(2,'0')+'.json',filename=path.join(directory,relative);
  if(!fs.existsSync(filename)){missingChunks.push(relative);continue;}
  const raw=fs.readFileSync(filename),chunk=JSON.parse(raw);chunks.set(i,chunk);hashes[relative]=sha(raw);for(const [id,data] of Object.entries(chunk))records.set(id,data);
 }
 const byId={},foods=[],gradeCounts={A:0,B:0,C:0,D:0,E:0},missingDetails=[],eligibility={fullyKnownGeneralNutrients:0,missingByNutrient:{}},examples={calculated:[],missing:[]};
 const rows=index||[...records.keys()].map(id=>({id,name:'',name_en:'',chunk:null}));
 for(const row of rows){
  const detail=records.get(String(row.id));if(!detail){missingDetails.push(row.id);continue;}
  const food=masterFood(row,detail);foods.push(food);
  const required=['energyKj','sugar','saturatedFat','salt','protein','fiber'];let complete=true;
  for(const key of required)if(Q.num(food.label[key])===null){complete=false;eligibility.missingByNutrient[key]=(eligibility.missingByNutrient[key]||0)+1;}
  if(complete)eligibility.fullyKnownGeneralNutrients++;
  const result=Q.resolve(food);
  // flags: bit 1 = kcal->kJ conversion; bit 2 = unsupported category; bit 4 = input inconsistency.
  const flags=(result.energyConverted?1:0)+(result.reason?.startsWith('Categoria esclusa')?2:0)+(result.reason?.includes('non coerenti')?4:0);
  byId[String(row.id)]=[result.grade,result.method,result.category||null,result.missing||[],flags];
  if(result.grade&&result.comparable){gradeCounts[result.grade]++;if(examples.calculated.length<12)examples.calculated.push({id:row.id,name:row.name,grade:result.grade,category:result.category});}
  else if(examples.missing.length<12)examples.missing.push({id:row.id,name:row.name,missing:result.missing,reason:result.reason});
 }
 const report={...Q.auditFoods(foods),expectedFoods:manifest.food_count,recordsRead:records.size,indexAvailable:!!index,allChunksAvailable:missingChunks.length===0,missingChunks,missingDetails,completeAudit:!!index&&missingChunks.length===0&&missingDetails.length===0&&foods.length===Number(manifest.food_count),gradeCounts,nutrientCompleteness:eligibility,examples,notes:['I gradi A–D di affidabilità del Master non sono Nutri-Score.','La completezza dei nutrienti non dimostra categoria/FVL: i valori mancanti non sono inventati.','Il rapporto misura il database presente sul disco, non nuovi dati importati.']};
 const sourceFingerprint=sha(JSON.stringify(Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b))));
 return {schema:'nutritrace-quality-v73',version:1,algorithm:'2023',source:Q.SOURCE,manifestRevision:manifest.runtime_version+'|'+manifest.built_at,sourceFingerprint,sourceFiles:hashes,generatedAt:new Date().toISOString(),columns:['grade','method','category','missing','flags'],byId,report};
}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value)+'\n');}
function verifyIndex(bundle,filename){
 const previous=read(filename);
 if(!bundle.report.completeAudit)throw new Error('Impossibile verificare l’indice: database locale incompleto.');
 if(previous.schema!==bundle.schema||previous.version!==bundle.version||previous.algorithm!==bundle.algorithm)throw new Error('Formato/algoritmo dell’indice qualità non compatibile. Rigenera l’indice.');
 if(previous.manifestRevision!==bundle.manifestRevision||previous.sourceFingerprint!==bundle.sourceFingerprint)throw new Error('L’indice qualità non corrisponde agli hash del database sorgente. Rigenera l’indice.');
 if(JSON.stringify(previous.byId)!==JSON.stringify(bundle.byId))throw new Error('Le lettere derivate non corrispondono al calcolo corrente. Rigenera l’indice.');
 return {verified:true,sourceFingerprint:bundle.sourceFingerprint,foods:bundle.report.total};
}
function main(){
 if(argv.includes('--help')){console.log('node scripts/audit-food-quality-v73.js [--master data/master] [--foods backup.json] [--index-out data/master/quality-v73.json] [--report-out docs/quality-v73-audit.json] [--verify-index data/master/quality-v73.json]\nSenza --index-out/--report-out non scrive file. --verify-index confronta hash sorgente e ogni risultato derivato, senza scrivere. Nessuna chiamata di rete; DB di origine invariato.');return;}
 const foodFile=get('--foods'),master=get('--master','data/master');
 if(get('--verify-index')&&(foodFile||get('--index-out')||get('--report-out')))throw new Error('--verify-index è una verifica in sola lettura; non combinare con --foods o opzioni di scrittura.');
 if(foodFile){const data=read(foodFile),foods=Array.isArray(data)?data:data.foods;if(!Array.isArray(foods))throw new Error('Backup senza foods array.');const report=Q.auditFoods(foods);if(get('--report-out'))write(get('--report-out'),report);console.log(JSON.stringify(report,null,2));return;}
 const bundle=auditMaster(master);if(get('--verify-index')){console.log(JSON.stringify(verifyIndex(bundle,get('--verify-index')),null,2));return;}if(get('--index-out'))write(get('--index-out'),bundle);if(get('--report-out'))write(get('--report-out'),{...bundle.report,manifestRevision:bundle.manifestRevision,sourceFingerprint:bundle.sourceFingerprint,generatedAt:bundle.generatedAt});
 console.log(JSON.stringify({completeAudit:bundle.report.completeAudit,total:bundle.report.total,documentedGrades:bundle.report.reported2023+bundle.report.calculated2023,partialInvariantGrades:bundle.report.partial2023,documentedCoverage:bundle.report.documentedCoverage,comparableCoverage:bundle.report.comparableCoverage,missingChunks:bundle.report.missingChunks,indexAvailable:bundle.report.indexAvailable,gradeCounts:bundle.report.gradeCounts,nutrientCompleteness:bundle.report.nutrientCompleteness},null,2));
 if(!bundle.report.completeAudit)process.exitCode=2;
}
if(require.main===module)try{main();}catch(error){console.error('Audit qualità non completato:',error.message);process.exitCode=1;}
module.exports={masterFood,auditMaster,verifyIndex};
