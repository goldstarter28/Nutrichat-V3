'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('../diary-v5.js'),M=require('../meal-diary.js'),S=require('../meal-shortcuts.js'),B=require('../api/barcode-lookup.js'),W=require('../goals-wizard-v5.js');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8'),plain=x=>JSON.parse(JSON.stringify(x)),noop=()=>{};
const foods=[{id:'a',name:'Farina',servingGrams:100,label:{kcal:350,protein:10,carbs:70,fat:1,fiber:3},nutrients:[{name:'Calcio',amount:10,unit:'mg'}]},{id:'b',name:'Latte',servingGrams:100,label:{kcal:60,protein:3,carbs:5,fat:3,fiber:0},nutrients:[{name:'Calcio',amount:120,unit:'mg'}]}];
const recipe={id:'r',name:'Torta',yieldGrams:400,servings:4,ingredients:[{foodId:'a',name:'Farina',grams:200},{foodId:'b',name:'Latte',grams:300}]};
const date='2026-11-24',mealId='breakfast',meals=[{id:mealId,name:'Colazione'},{id:'lunch',name:'Pranzo'}];
const logs=(id='g1',day=date,meal=mealId,amount=100)=>D.scaleRecipe(recipe,amount,foods,'fette').map((l,i)=>({...l,id:id+'-'+day+'-'+meal+'-'+i,recipeGroupId:id,date:day,mealId:meal}));
const adult={goal:'maintain',age:18,sex:'male',height:170,weight:72,careContext:'none',activity:'deskTraining'};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function nodes(x){return x&&typeof x==='object'?[x,...(x.children||[]).flatMap(nodes)]:[];}
function txt(x){return x==null||x===false?'':typeof x!=='object'?String(x):(x.children||[]).map(txt).join('');}
function cls(tree,n){return nodes(tree).filter(y=>(y.props.className||'').split(' ').includes(n));}
function resolve(x){return x&&typeof x==='object'?(typeof x.type==='function'?resolve(x.type(x.props)):{...x,children:x.children.map(resolve)}):x;}
function ui(files){const c={console,Intl,Date,structuredClone,React:{Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useMemo:fn=>fn(),useState:v=>[typeof v==='function'?v():v,noop]}};c.window=c;vm.createContext(c);for(const n of files)vm.runInContext(read(n),c);return c;}
test('V5.9 adult age 18 uses Henry 18–30, adult age 19 keeps Mifflin and original protections',()=>{
 const p=W.calculatePlan(adult);assert.equal(p.eligible,true);assert.match(p.method,/Henry/);close(p.bmr,14.4*72+313*1.7+113);assert.equal(p.kcal,Math.round(p.bmr*1.5));assert.ok(p.sourceIds.includes('energy-henry-2005'));
 const female=W.calculatePlan({...adult,sex:'female',physiologicalState:'none'});assert.equal(female.eligible,true);close(female.bmr,10.4*72+615*1.7-282);
 const older=W.calculatePlan({...adult,age:19});assert.match(older.method,/Mifflin/);close(older.bmr,10*72+6.25*170-5*19+5);
 for(const x of [{age:17},{age:79},{careContext:'professional'},{weight:45},{sex:'female',physiologicalState:'pregnant'}])assert.equal(W.calculatePlan({...adult,...x}).eligible,false);
 assert.equal(W.calculatePlan({...adult,goal:'lose',weight:55}).eligible,false);
});
test('V5.9 recipe group appears once, without changing macro or micronutrient arithmetic, repeated entries distinct',()=>{
 const all=[...logs(),...logs('g2'),{id:'standalone',date,mealId,foodId:'a',grams:20}];const old=plain(all),g=D.displayGroups(all,foods);
 assert.equal(g.length,3);assert.equal(g[0].name,'Torta');assert.equal(g[0].entries.length,2);assert.equal(D.recipePortionText(g[0].entries),'1 fetta · 100 g');assert.equal(g[2].name,'Farina');
 close(M.totals(all,foods).kcal,510);close(D.stats(all,foods,{name:'Calcio',unit:'mg'}).sum,192);assert.deepEqual(all,old);
});
test('V5.9 group identity is scoped to date and meal; legacy group without cooked weight never guesses',()=>{
 const other=[...logs('g1','2026-11-23'),...logs('g1',date,'lunch')],all=[...logs(),...other];assert.equal(D.displayGroups(all,foods).length,3);assert.equal(D.groupEntries(all,all[0].id).length,2);
 const legacy=logs().map(l=>{const x={...l};delete x.recipeConsumedGrams;return x;});assert.equal(D.recipeWeight(legacy),null);assert.match(D.recipePortionText(legacy),/non specificata/);assert.throws(()=>D.recipeSnapshot(legacy));assert.equal(D.recipeSnapshot(legacy,100).yieldGrams,100);
});
test('V5.9 resizing scales every ingredient, portions and calories; invalid resize preserves original',()=>{
 const all=[...logs(),...logs('g2')],old=plain(all);const updated=D.resizeRecipeGroup(all,all[0].id,'150,5');assert.equal(updated[0].recipeConsumedGrams,150.5);close(updated[0].grams,all[0].grams*1.505);close(updated[1].grams,all[1].grams*1.505);assert.equal(updated[2],all[2]);close(updated[0].recipePortionCount,1.505);assert.deepEqual(all,old);for(const v of [0,null,true,10001,''])assert.throws(()=>D.resizeRecipeGroup(all,all[0].id,v));
});
test('V5.9 move and copy maintain group boundaries even when old group IDs collide',()=>{
 const all=[...logs(),...logs('g1',date,'lunch'),...logs('g1','2026-11-23')],old=plain(all);const next=D.assignGroup(all,all[0].id,'lunch',()=> 'newgroup');assert.equal(next[0].mealId,'lunch');assert.equal(next[1].recipeGroupId,'newgroup');assert.equal(next[2],all[2]);assert.equal(D.displayGroups(next,foods).length,3);assert.deepEqual(all,old);
 let k=0;const copy=D.copyRecipeGroupIds([...logs(),...logs('g2')],()=>String(++k));assert.equal(copy[0].recipeGroupId,copy[1].recipeGroupId);assert.notEqual(copy[0].recipeGroupId,copy[2].recipeGroupId);
});
test('V5.9 meal and end-of-day render one recipe with original group actions and no unwanted note',()=>{
 const c=ui(['diary-v5.js','meal-diary.js']),l=logs(),calls=[];const tree=resolve(c.NutriTraceMealDiary({meals,logs:l,foods,onEditRecipe:id=>calls.push(['edit',id]),onRemove:id=>calls.push(['remove',id]),onAddFavorite:(m,id)=>calls.push(['favorite',m,id]),onAssign:(id,m)=>calls.push(['move',id,m])}));
 assert.equal(cls(tree,'v5-meal-food').length,1);assert.equal(cls(tree,'v5-day-food-main').length,1);assert.match(txt(cls(tree,'v5-meal-inline-names')[0]),/Torta 1 fetta/);assert.doesNotMatch(txt(cls(tree,'v5-meal-inline-names')[0]),/Farina|Latte/);assert.match(txt(cls(tree,'v59-recipe-ingredients')[0]),/Farina/);assert.doesNotMatch(txt(tree),/Totali incompleti|Totale parziale/);
 cls(tree,'v58-edit-food')[0].props.onClick();cls(tree,'v5-meal-remove')[0].props.onClick();cls(tree,'v5-day-remove')[0].props.onClick();nodes(tree).find(n=>n.type==='select').props.onChange({target:{value:'lunch'}});nodes(tree).find(n=>n.props.title==='Salva porzione nei preferiti').props.onClick();assert.deepEqual(calls,[['edit',l[0].id],['remove',l[0].id],['remove',l[0].id],['move',l[0].id,'lunch'],['favorite',mealId,l[0].id]]);
});
test('V5.9 recipe favorite round trips, edits weight, scales snapshot and keeps normal favorites untouched',()=>{
 const l=logs(),snap=D.recipeSnapshot(l),old=S.addFavorite([],{mealId,foodId:'a',grams:10},meals,foods),f=S.addFavorite(old,{mealId,recipe:snap,grams:100},meals,foods);assert.equal(f.length,2);assert.deepEqual(f[0],old[0]);assert.deepEqual(S.normalize(plain(f)),f);assert.deepEqual(S.addFavorite(f,{mealId,recipe:snap,grams:100},meals,foods),f);const next=M.updateFavoriteWeight(f,f[1].id,150);assert.equal(next[0],f[0]);assert.equal(next[1].grams,150);assert.equal(next[1].recipe.yieldGrams,100);const scaled=D.scaleRecipe(next[1].recipe,150,foods);assert.equal(scaled[0].recipePortionUnit,'fette');close(scaled[0].grams,75);assert.equal(S.removeFavorite(next,next[1].id).length,1);assert.throws(()=>S.createFavoriteLog(f[1],date,meals,foods));assert.throws(()=>S.addFavorite(old,{mealId,recipe:snap,grams:100},meals,[foods[0]]));
});
test('V5.9 OFF normalized micronutrients convert grams to mg/µg exactly once and preserve explicit zero',()=>{
 const raw={product_name:'Test',quantity:'200 g',nutrition_data_per:'100g',ingredients_text_it:'Latte, cacao',nutriments:{'energy-kcal_100g':90,'calcium_100g':0.12,calcium_unit:'mg','vitamin-b12_100g':0.0000025,'vitamin-b12_unit':'µg','vitamin-c_100g':0,'iron_100g':null,'zinc_100g':'0.1','vitamin-a_100g':0.0001,'folates_100g':0.00003,'vitamin-b9_100g':0.00002}};
 const product=B.normalizeProduct(raw,'8000000000001');assert.equal(product.microBasis,'mass');assert.equal(product.ingredients,'Latte, cacao');const f=D.productFood(product,[],'new').food;const n=name=>f.nutrients.find(x=>x.name===name);
 close(n('Calcio').amount,120);assert.equal(n('Calcio').unit,'mg');close(n('Vitamina B12').amount,2.5);assert.equal(n('Vitamina B12').unit,'µg');assert.equal(n('Vitamina C').amount,0);assert.equal(n('Ferro'),undefined);assert.equal(n('Zinco'),undefined);assert.equal(f.nutrients.filter(x=>x.name==='Folati').length,1);assert.equal(n('Vitamina A').nutrientBasis,'unspecified');assert.equal(n('Calcio').source,'Open Food Facts');
 const stats=D.stats([{foodId:'new',grams:100,date}],[f],{name:'Vitamina A',unit:'µg',referenceBasis:'RAE'});assert.equal(stats.comparisonAvailable,false);
});
test('V5.9 unknown or volume basis never auto-imports micros, confirmed mass can import',()=>{
 for(const q of ['1 l','330 ml','33cl','500 ml (2 x 250 ml)','']){const p=B.normalizeProduct({product_name:'Test',quantity:q,nutrition_data_per:'100g',nutriments:{'calcium_100g':0.1}},'8000000000001');assert.notEqual(p.microBasis,'mass');assert.deepEqual(D.barcodeNutrients(p,'new'),[]);assert.equal(D.barcodeNutrients({...p,microBasis:'mass'},'new')[0].amount,100);}
});
test('V5.9 existing manual nutrient values, zeros, label and ingredients preserved; missing micro scaled to existing base',()=>{
 const old={id:'old',barcode:'123',name:'Manuale',servingGrams:50,label:{kcal:15},ingredients:'Manuali',nutrients:[{id:'c',name:'Calcio',amount:0,unit:'mg',source:'manuale'}]};const before=plain(old);const p={barcode:'123',microBasis:'mass',microGrams:{calcium:.12,iron:.003},ingredients:'Altro',label:{kcal:999}};const result=D.mergeBarcodeFood(old,p);assert.equal(result.label.kcal,15);assert.equal(result.ingredients,'Manuali');assert.equal(result.nutrients[0].amount,0);close(result.nutrients[1].amount,1.5);assert.equal(result.nutrients[1].name,'Ferro');assert.deepEqual(old,before);assert.equal(D.mergeBarcodeFood(result,p),result);assert.equal(D.mergeBarcodeFood(old,{...p,barcode:'456'}),old);
});
test('V5.9 actual barcode API returns micros and requests the correct fields without another AI call',async()=>{
 const original=global.fetch;let requested;global.fetch=async url=>{requested=url;return {ok:true,status:200,json:async()=>({product:{product_name:'Test',quantity:'100 g',nutriments:{'calcium_100g':0.12}}})};};try{let data,status;const response={setHeader:noop,status:n=>{status=n;return response;},json:d=>{data=d;return d;}};await B({method:'GET',query:{barcode:'4006381333931'}},response);assert.equal(status,200);assert.equal(data.product.microGrams.calcium,0.12);assert.ok(new URL(requested).searchParams.get('fields').includes('ingredients_text_it'));assert.ok(new URL(requested).searchParams.get('fields').includes('nutriments'));assert.equal(new URL(requested).hostname,'world.openfoodfacts.org');}finally{global.fetch=original;}
});
test('V5.9 saved recipe Add button is immediately before Edit and X; no save checkbox in creation',()=>{
 const c=ui(['diary-v5.js','aurora-v5.js']);const r=c.NutriTraceV5.Recipes({recipes:[recipe],foods,onAdd:noop,onEdit:noop,onRemove:noop,onNew:noop});const header=cls(r,'v5-saved-recipe-head')[0];assert.deepEqual(plain(header.children.map(txt)).slice(1),['Aggiungi','Modifica','×']);assert.match(cls(r,'v59-recipe-add')[0].props.className,/ghost/);
 const review=c.NutriTraceV5.RecipeReview({review:{mode:'recipe',recipe_name:'Torta',ingredients:[]},onChange:noop,onSave:noop,onCommit:noop});assert.equal(nodes(review).some(n=>n.type==='input'&&n.props.type==='checkbox'),false);assert.match(txt(review),/Salva ricetta/);assert.match(txt(review),/Salva e aggiungi al pasto/);
});
test('V5.9 scoped weight layout and group-aware actual app callbacks, old backup accepted and new schema version',()=>{
 const a=read('app.js'),css=read('aurora-v5.css');assert.match(a,/className:'v59-body-weight'/);assert.match(css,/v59-body-weight.*column-gap:20px/);assert.match(css,/label:has\(input\[type="number"\]\).*grid-column:1;grid-row:2/);assert.match(css,/label:has\(input\[type="time"\]\).*grid-column:2;grid-row:2/);assert.match(a,/DiaryV5\.assignGroup\(previous,logId,id,newId\)/);assert.match(a,/DiaryV5\.groupEntries\(previous,logId\)/);assert.match(a,/DiaryV5\.copyRecipeGroupIds\(copied,newId\)/);assert.match(a,/version: 8,/);assert.match(a,/Number\(data.version \|\| 4\) > 8/);
});

test('V5.9 duplicating a single recipe creates a separate complete group and leaves history intact',()=>{
 const all=logs(),old=plain(all);let k=0;const copied=D.duplicateRecipeGroup(all,all[0].id,()=>`copy-${++k}`,'2026-11-24T10:00:00Z');assert.equal(copied.length,2);assert.equal(copied[0].recipeGroupId,copied[1].recipeGroupId);assert.notEqual(copied[0].recipeGroupId,all[0].recipeGroupId);assert.equal(copied[0].grams,all[0].grams);assert.equal(D.displayGroups([...all,...copied],foods).length,2);assert.deepEqual(all,old);
});
function stateUI(files){const state=[];let i=0;const c=ui([]);c.React.useState=v=>{const at=i++;if(!(at in state))state[at]=typeof v==='function'?v():v;return [state[at],n=>state[at]=typeof n==='function'?n(state[at]):n];};for(const n of files)vm.runInContext(read(n),c);return {c,render(fn){i=0;return fn(c);}};}
test('V5.9 direct saved-recipe button opens quantity first, one slice calculates cooked grams and cancellation keeps controls',async()=>{
 const env=stateUI(['diary-v5.js','aurora-v5.js']),calls=[];let cancelled=true;const props={recipes:[recipe],foods,onAdd:async(r,g,u)=>{calls.push([r.id,g,u]);return cancelled?false:true;},onEdit:noop,onRemove:noop,onNew:noop};const render=()=>env.render(c=>c.NutriTraceV5.Recipes(props));let t=render();cls(t,'v59-recipe-add')[0].props.onClick();t=render();assert.equal(nodes(t).some(n=>n.type==='ul'),false);nodes(t).find(n=>n.type==='select').props.onChange({target:{value:'fette'}});t=render();nodes(t).find(n=>n.type==='input').props.onChange({target:{value:'1'}});t=render();await cls(t,'cta')[0].props.onClick();assert.deepEqual(calls,[['r',100,'fette']]);assert.ok(cls(render(),'v5-recipe-portion').length);cancelled=false;await cls(render(),'cta')[0].props.onClick();assert.equal(cls(render(),'v5-recipe-portion').length,0);
});
test('V5.9 actual direct product review blocks ambiguous mass until explicit confirmation',async()=>{
 const env=stateUI(['diary-v5.js','aurora-v5.js']),calls=[];const props={product:{barcode:'123',name:'Latte',microBasis:'volume',label:{kcal:50},microGrams:{calcium:.12}},foods:[],mealLabel:'Colazione',dateLabel:'oggi',onConfirm:async(p,g)=>{calls.push([p.microBasis,g]);return false;},onBack:noop};const render=()=>env.render(c=>c.NutriTraceV5.ProductReview(props));let t=render();nodes(t).find(n=>n.type==='input'&&n.props.type==='number').props.onChange({target:{value:'100'}});t=render();await t.props.onSubmit({preventDefault:noop});assert.equal(calls.length,0);t=render();nodes(t).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});t=render();await t.props.onSubmit({preventDefault:noop});assert.deepEqual(calls,[['mass',100]]);
});
