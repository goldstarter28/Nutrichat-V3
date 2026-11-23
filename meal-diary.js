'use strict';

/* NutriTrace V5 — the meal cards are the diary, with no duplicate hidden view. */
(function (root) {
  const h = root.React?.createElement;
  const ICONS = { breakfast:'☕', 'morning-snack':'🍎', lunch:'🥗', 'afternoon-snack':'🥜', dinner:'🌙', extras:'🍪' };
  const METRICS = [['protein','P','Proteine'],['carbs','C','Carboidrati'],['fat','G','Grassi'],['fiber','F','Fibre']];

  function number(value) {
    if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null;
    const n = Number(typeof value === 'string' ? value.replace(',', '.') : value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function fmt(value, digits=1) { return Number(value).toLocaleString('it-IT', {maximumFractionDigits:digits}); }
  function totals(logs=[], foods=[]) {
    const byId = new Map(foods.map(food => [food.id, food]));
    const result = {kcal:0,protein:0,carbs:0,fat:0,fiber:0,knownKcal:0,count:logs.length,
      known:{kcal:0,protein:0,carbs:0,fat:0,fiber:0}};
    for (const log of logs) {
      const food=byId.get(log.foodId), grams=number(log.grams);
      if (!food || grams === null || grams <= 0) continue;
      const rawServing=food.servingGrams;
      const serving=rawServing == null || rawServing === '' ? 100 : number(rawServing);
      if (serving === null || serving <= 0) continue;
      for (const key of ['kcal','protein','carbs','fat','fiber']) {
        const value=number(food.label?.[key]);
        if (value === null) continue;
        result[key] += value * grams / serving;
        result.known[key]++;
      }
    }
    result.knownKcal=result.known.kcal;
    return result;
  }
  function metricValue(data,key,digits=1) {
    if (data.count && !data.known[key]) return 'N/D';
    return fmt(data[key],digits)+(data.known[key] < data.count ? '*' : '');
  }
  function amountText(log) {
    const grams=number(log.grams), quantity=number(log.quantity);
    if (log.unit && log.unit !== 'g' && quantity !== null && quantity > 0)
      return fmt(quantity)+' '+log.unit+(grams !== null ? ' · '+fmt(grams)+' g' : '');
    return grams === null ? 'Quantità non disponibile' : fmt(grams)+' g';
  }
  function MacroLine({data}) {
    return h('div',{className:'v5-meal-macros','aria-label':'Totali del pasto'},
      ...METRICS.map(([key,short,label])=>h('span',{key,title:label},
        h('abbr',{title:label},short),h('strong',null,metricValue(data,key)),h('small',null,'g'))));
  }
  function MealCard({meal,logs,foods,meals,favorites,onAdd,onAssign,onRemove,onAddFavorite,onRemoveFavorite,onQuickFavorite,onCopyYesterday}) {
    const data=totals(logs,foods), isUnassigned=meal.id==='__unassigned__';
    const mealFavorites=favorites.filter(item=>item.mealId===meal.id && foods.some(f=>f.id===item.foodId));
    const partial=logs.length > 0 && Object.values(data.known).some(n=>n<data.count);
    return h('article',{className:'card v5-meal-card','aria-label':meal.name},
      h('header',{className:'v5-meal-heading'},
        h('span',{className:'v5-meal-icon','aria-hidden':'true'},ICONS[meal.id]||'🥣'),
        h('div',{className:'v5-meal-title'},h('h3',null,meal.name),
          h('span',{className:'v5-meal-count'},logs.length ? logs.length+' '+(logs.length===1?'alimento':'alimenti') : 'Aggiungi il tuo primo alimento')),
        h('div',{className:'v5-meal-energy'},h('strong',null,metricValue(data,'kcal',0)),h('span',null,'kcal')),
        !isUnassigned && h('button',{type:'button',className:'v5-meal-add',onClick:()=>onAdd(meal.id),'aria-label':'Aggiungi a '+meal.name},'+')),
      h(MacroLine,{data}),
      partial && h('small',{className:'v5-meal-partial'},'* Totale parziale. N/D: dato non disponibile.'),
      h('div',{className:'v5-meal-foods'},...logs.map(log=>{
        const food=foods.find(f=>f.id===log.foodId), single=totals([log],foods);
        return h('div',{className:'v5-meal-food',key:log.id},
          h('div',{className:'v5-meal-food-main'},
            h('div',{className:'v5-meal-food-name'},h('strong',null,food?.name||'Alimento non trovato'),
              h('span',null,amountText(log))),
            h('span',{className:'v5-meal-food-energy'},metricValue(single,'kcal',0)+' kcal')),
          h('div',{className:'v5-meal-food-actions'},
            h('label',{className:'v5-meal-move'},h('span',{className:'v5-sr-only'},'Sposta '+(food?.name||'alimento')+' nel pasto'),
              h('select',{value:meals.some(m=>m.id===log.mealId)?log.mealId:'','aria-label':'Pasto di '+(food?.name||'alimento'),onChange:e=>onAssign(log.id,e.target.value||null)},
                h('option',{value:''},'Senza pasto'),...meals.map(target=>h('option',{key:target.id,value:target.id},target.name)))),
            !isUnassigned && food && h('button',{type:'button',className:'v5-meal-action',title:'Salva porzione nei preferiti','aria-label':'Salva '+food.name+' nei preferiti di '+meal.name,onClick:()=>onAddFavorite(meal.id,log.id)},'☆',h('span',null,'Preferito')),
            h('button',{type:'button',className:'v5-meal-action v5-meal-remove',title:'Rimuovi alimento','aria-label':'Rimuovi '+(food?.name||'alimento')+' da '+meal.name,onClick:()=>onRemove(log.id)},'×',h('span',null,'Rimuovi'))));
      })),
      !isUnassigned && h('footer',{className:'v5-meal-footer'},
        h('button',{type:'button',className:'v5-meal-copy',onClick:()=>onCopyYesterday(meal.id)},h('span',{'aria-hidden':'true'},'↺'),'Copia '+meal.name.toLowerCase()+' di ieri'),
        mealFavorites.length > 0 && h('div',{className:'v5-meal-favorites','aria-label':'Porzioni preferite di '+meal.name},
          ...mealFavorites.map(favorite=>{
            const food=foods.find(f=>f.id===favorite.foodId), name=favorite.label||food.name;
            return h('div',{className:'v5-meal-favorite',key:favorite.id},
              h('button',{type:'button',className:'v5-meal-favorite-add',onClick:()=>onQuickFavorite(favorite)},'+ '+fmt(favorite.quantity??favorite.grams)+' '+(favorite.unit||'g')+' '+name),
              h('button',{type:'button',className:'v5-meal-favorite-remove','aria-label':'Rimuovi '+name+' dai preferiti',onClick:()=>onRemoveFavorite(favorite.id)},'×'));
          }))));
  }
  function DayFoods({logs,foods,meals}) {
    return h('section',{className:'card v5-day-foods','aria-labelledby':'v5-day-foods-title'},
      h('div',{className:'v5-day-foods-heading'},h('span',{'aria-hidden':'true'},'▤'),h('h3',{id:'v5-day-foods-title'},'Alimenti del giorno'),h('span',{className:'v5-day-foods-count'},logs.length)),
      logs.length===0 ? h('p',{className:'muted'},'Gli alimenti che registri compaiono qui, in un unico elenco.') :
      h('ul',null,...logs.map(log=>{
        const food=foods.find(f=>f.id===log.foodId), meal=meals.find(m=>m.id===log.mealId), data=totals([log],foods);
        return h('li',{key:log.id},
          h('div',{className:'v5-day-food-main'},h('strong',null,food?.name||'Alimento non trovato'),h('span',null,amountText(log)+' · '+(meal?.name||'Senza pasto'))),
          h('div',{className:'v5-day-food-metrics'},h('span',null,metricValue(data,'kcal',0)+' kcal'),...METRICS.map(([key,short,label])=>h('span',{key,title:label},short+' '+metricValue(data,key)+' g'))));
      })));
  }
  function MealDiary({meals=[],logs=[],foods=[],favorites=[],showDayFoods=true,onAdd=()=>{},onAssign=()=>{},onRemove=()=>{},onConfigure=()=>{},onAddFavorite=()=>{},onRemoveFavorite=()=>{},onQuickFavorite=()=>{},onCopyYesterday=()=>{}}) {
    const validIds=new Set(meals.map(meal=>meal.id));
    const unassigned=logs.filter(log=>!log.mealId||!validIds.has(log.mealId));
    const groups=meals.map(meal=>({meal,logs:logs.filter(log=>log.mealId===meal.id)}));
    if(unassigned.length)groups.push({meal:{id:'__unassigned__',name:'Senza pasto'},logs:unassigned});
    return h('section',{className:'nutritraceMealDiary v5-meal-diary'},
      h('header',{className:'v5-diary-heading'},
        h('div',null,h('span',{className:'a-kicker'},'IL TUO DIARIO'),h('h2',null,'I pasti della giornata')),
        h('button',{type:'button',className:'v5-meal-manage',onClick:onConfigure},'Gestisci pasti')),
      h('div',{className:'v5-meal-grid'},...groups.map(group=>h(MealCard,{key:group.meal.id,...group,foods,meals,favorites,onAdd,onAssign,onRemove,onAddFavorite,onRemoveFavorite,onQuickFavorite,onCopyYesterday}))),
      !groups.length && h('p',{className:'muted'},'Configura almeno un pasto per iniziare.'),
      showDayFoods && h(DayFoods,{logs,foods,meals}));
  }
  MealDiary.totals=totals;
  MealDiary.amountText=amountText;
  MealDiary.DayFoods=DayFoods;
  root.NutriTraceMealDiary=MealDiary;
  if(typeof module!=='undefined'&&module.exports)module.exports=MealDiary;
})(typeof globalThis!=='undefined'?globalThis:this);
