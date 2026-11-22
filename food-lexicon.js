
/* NutriTrace offline food lexicon engine.
 * Dataset provided separately.
 */
(function(root){
  'use strict';

  const normalize=value=>String(value??'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();

  const normalizeRow=row=>({
    qid:String(row.qid||''),
    it:normalize(row.it),
    en:[...new Set(
      (Array.isArray(row.en)?row.en:[row.en])
        .map(normalize).filter(Boolean)
    )],
    ambiguous:row.ambiguous===true
  });

  const create=(input={})=>{
    if(
      input.license!=='CC0-1.0' ||
      input.source!=='wikidata-structured-data'
    ){
      throw new Error(
        'Lexicon source not verified as Wikidata CC0 structured data'
      );
    }

    const rows=Array.isArray(input.entries)
      ? input.entries.map(normalizeRow)
      : [];

    const byIt=new Map();

    for(const row of rows){
      if(!row.it||!row.en.length||row.ambiguous)
        continue;

      const list=byIt.get(row.it)||[];
      list.push(row);
      byIt.set(row.it,list);
    }

    return Object.freeze({
      provenance:Object.freeze({
        source:input.source,
        license:input.license,
        version:String(input.version||'')
      }),

      count:rows.length,

      variants(query,limit=8){
        const q=normalize(query);
        if(!q)return [];

        const matches=byIt.get(q)||[];

        const concepts=new Set(
          matches.map(x=>x.qid)
        );

        if(concepts.size!==1)return [];

        return [...new Set(
          matches.flatMap(x=>x.en)
        )].slice(0,limit);
      }
    });
  };

  const load=async(
    path='/data/food-lexicon-it-en.json'
  )=>{
    const response=await fetch(path,{
      cache:'force-cache'
    });

    if(!response.ok){
      throw new Error(
        'Offline food lexicon unavailable'
      );
    }

    return create(await response.json());
  };

  root.NutriTraceFoodLexicon={
    create,
    load,
    normalize
  };

})(
  typeof window!=='undefined'
    ? window
    : globalThis
);
