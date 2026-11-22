
/* NutriTrace V3 — Offline food search bridge */
(function(root){
  'use strict';

  const norm=value=>String(value??'')
    .toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();

  function identity(row){
    if(row.resultType==='master')
      return 'm:'+row.id;

    if(row.resultType==='personal')
      return 'p:'+row.id;

    return 'l:'+(row.localId||row.sourceId||row.id);
  }

  function exactOriginal(query,row){
    const n=norm(query);

    return [
      row.name,
      row.officialName,
      row.name_en,
      ...(Array.isArray(row.aliases)?row.aliases:[])
    ].some(value=>norm(value)===n);
  }

  function search(query,originalSearch,lexicon,limit=12){
    if(typeof originalSearch!=='function'){
      throw new TypeError(
        'originalSearch must be a function'
      );
    }

    const cap=Math.max(
      1,Math.min(50,Math.trunc(Number(limit))||12)
    );

    const original=(originalSearch(query)||[])
      .slice(0,cap);

    if(
      !lexicon ||
      typeof lexicon.variants!=='function' ||
      original.some(row=>
        exactOriginal(query,row) ||
        Number(row.score)>=180
      )
    ){
      return original;
    }

    const seen=new Set(original.map(identity));
    const added=[];

    for(const translated of lexicon.variants(query,4)){
      if(norm(translated)===norm(query))continue;

      for(const row of originalSearch(translated)||[]){
        const key=identity(row);

        if(seen.has(key))continue;

        seen.add(key);

        added.push({
          ...row,
          lexiconMatch:translated
        });

        if(original.length+added.length>=cap)break;
      }

      if(original.length+added.length>=cap)break;
    }

    return [...original,...added];
  }

  root.NutriTraceFoodSearchBridge=Object.freeze({
    search
  });

})(
  typeof window!=='undefined'
    ? window
    : globalThis
);
