
/* NutriTrace Food Lexicon — Wikidata CC0 V1/V2 */
(function(root){
  'use strict';

  const normalize=value=>String(value??'')
    .toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();

  const list=value=>Array.isArray(value)?value:[value];

  const unique=values=>[
    ...new Set(values.map(normalize).filter(Boolean))
  ];

  const blocked=new Set(['frutta secca']);

  function create(input={}){
    if(
      input.source!=='wikidata-structured-data' ||
      input.license!=='CC0-1.0' ||
      !Array.isArray(input.entries)
    ){
      throw new Error('Dataset Wikidata CC0 non valido');
    }

    const byItalian=new Map();
    let accepted=0;

    for(const row of input.entries){
      const qid=String(row?.qid||'');

      if(
        !/^Q[1-9]\d*$/.test(qid) ||
        row.ambiguous===true
      ) continue;

      const italian=unique([
        row.it,
        ...list(row.aliases_it||[])
      ]);

      const english=unique([
        ...list(row.en),
        ...list(row.aliases_en||[])
      ]);

      if(!italian.length||!english.length)continue;

      accepted++;

      for(const term of italian){
        if(blocked.has(term))continue;

        if(!byItalian.has(term))
          byItalian.set(term,new Map());

        byItalian.get(term).set(qid,english);
      }
    }

    return Object.freeze({
      provenance:Object.freeze({
        source:input.source,
        license:input.license,
        version:String(input.version||'')
      }),

      count:accepted,

      variants(query,limit=8){
        const key=normalize(query);

        if(!key||blocked.has(key))return [];

        const concepts=byItalian.get(key);

        if(!concepts||concepts.size!==1)return [];

        const cap=Math.max(
          0,Math.min(20,Math.trunc(Number(limit)||0))
        );

        return [
          ...new Set([...concepts.values()].flat())
        ]
          .filter(term=>term!==key)
          .slice(0,cap);
      }
    });
  }

  async function load(
    path='./data/food-lexicon-it-en-v2.json'
  ){
    const response=await fetch(path,{
      cache:'force-cache'
    });

    if(!response.ok)
      throw new Error('Dizionario offline non disponibile');

    return create(await response.json());
  }

  root.NutriTraceFoodLexicon=Object.freeze({
    create,
    load,
    normalize
  });

})(
  typeof window!=='undefined'
    ? window
    : globalThis
);
