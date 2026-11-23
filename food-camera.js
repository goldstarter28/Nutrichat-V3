
'use strict';

(function(root) {
  const React = root.React;
  const h = React.createElement;
  const {useState} = React;

  const KEYS = [
    ['kcal','Calorie','kcal'],
    ['protein','Proteine','g'],
    ['carbs','Carboidrati','g'],
    ['sugar','Zuccheri','g'],
    ['fat','Grassi','g'],
    ['saturatedFat','Saturi','g'],
    ['fiber','Fibre','g'],
    ['salt','Sale','g']
  ];

  const CONFIDENCE = {
    high:'Alta',
    medium:'Media',
    low:'Bassa',
    none:'Non stimabile'
  };

  function validGrams(value) {
    if (value === '' || value === null ||
        value === undefined) return null;

    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 10000
      ? n : null;
  }

  function inputNumber(value) {
    const n = validGrams(value);
    return n === null ? '' : String(n);
  }

  async function compress(file) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Seleziona una fotografia.');
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error('Fotografia originale troppo grande (max 15 MB).');
    }

    let bitmap = null;
    let image = null;
    let url = null;

    try {
      if (typeof createImageBitmap === 'function') {
        try {
          bitmap = await createImageBitmap(file);
        } catch {}
      }

      if (!bitmap) {
        url = URL.createObjectURL(file);
        image = new Image();
        image.src = url;

        await new Promise((resolve,reject)=>{
          image.onload = resolve;
          image.onerror = ()=>reject(
            new Error('Impossibile leggere questa immagine.')
          );
        });
      }

      const source = bitmap || image;
      const width = source.width;
      const height = source.height;

      if (!width || !height) {
        throw new Error('Dimensioni immagine non valide.');
      }

      const scale = Math.min(
        1,1800/Math.max(width,height)
      );

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(width*scale));
      canvas.height = Math.max(1,Math.round(height*scale));

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Elaborazione immagine non disponibile.');
      }

      ctx.drawImage(source,0,0,canvas.width,canvas.height);

      for (const quality of [0.86,0.74,0.60,0.45]) {
        const result = canvas.toDataURL('image/jpeg',quality);

        if (result.length < 3.5*1024*1024) {
          return result;
        }
      }

      throw new Error('Immagine troppo grande dopo la compressione.');

    } finally {
      if (bitmap) bitmap.close();
      if (url) URL.revokeObjectURL(url);
    }
  }

  function FoodCamera({onLabel,onDish,confirmLabel='Crea scheda alimento'}) {
    const [busy,setBusy] = useState(false);
    const [result,setResult] = useState(null);
    const [error,setError] = useState('');
    const [preview,setPreview] = useState('');
    const [manualType,setManualType] = useState('auto');

    const [name,setName] = useState('');
    const [brand,setBrand] = useState('');
    const [ingredients,setIngredients] = useState('');
    const [description,setDescription] = useState('');
    const [label,setLabel] = useState({});
    const [basis,setBasis] = useState('unknown');
    const [portions,setPortions] = useState([]);

    const type = manualType === 'auto'
      ? result?.type
      : manualType;

    const inputStyle = {width:'100%'};

    function updatePortion(index,patch) {
      setPortions(previous=>previous.map((p,i)=>
        i === index ? {...p,...patch} : p
      ));
    }

    async function analyze(file) {
      if (!file || busy) return;

      setBusy(true);
      setError('');
      setResult(null);
      setPreview('');
      setManualType('auto');
      setPortions([]);

      try {
        const image = await compress(file);

        setPreview(image);

        const response = await fetch('/api/analyze-food-image',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({image})
        });

        const data = await response.json().catch(()=>({}));

        if (!response.ok) {
          const code = data.code ? ` (${data.code})` : '';
          const model = data.model ? ` · ${data.model}` : '';

          throw new Error(
            (data.error || `Errore Vision ${response.status}`) +
            code + model
          );
        }

        setResult(data);
        setName(data.name || '');
        setBrand(data.brand || '');
        setIngredients(data.ingredients || '');
        setDescription(data.dishDescription || '');
        setLabel(data.label || {});
        setBasis(data.basis || 'unknown');

        const normalized = Array.isArray(data.portions)
          ? data.portions.map((p,i)=>({
              id:`portion-${i}`,
              name:String(p.name || ''),
              grams:inputNumber(p.estimatedGrams),
              minGrams:p.minGrams ?? null,
              maxGrams:p.maxGrams ?? null,
              confidence:CONFIDENCE[p.confidence]
                ? p.confidence : 'none',
              reason:String(p.reason || ''),
              preparation:String(p.preparation || ''),
              source:'ai_visual_estimate'
            }))
          : [];

        setPortions(normalized);

      } catch (e) {
        setError(e.message || 'Analisi fotografica non riuscita.');
      } finally {
        setBusy(false);
      }
    }

    async function confirm() {
      if (busy) return;

      setError('');
      setBusy(true);

      try {
        if (type === 'label') {
          if (!name.trim()) {
            throw new Error('Inserisci il nome del prodotto.');
          }

          await onLabel({
            name:name.trim(),
            brand:brand.trim(),
            ingredients:ingredients.trim(),
            basis,
            label
          });

        } else if (type === 'dish') {
          const prepared = portions
            .filter(p=>p.name.trim())
            .map(p=>({
              name:p.name.trim(),
              estimatedGrams:validGrams(p.grams),
              minGrams:p.minGrams,
              maxGrams:p.maxGrams,
              confidence:p.confidence,
              reason:p.reason,
              preparation:p.preparation,
              source:p.source
            }));

          if (!description.trim() && !prepared.length) {
            throw new Error(
              'Descrivi almeno un alimento presente nel piatto.'
            );
          }

          await onDish({
            description:description.trim(),
            portions:prepared
          });

        } else {
          throw new Error('Seleziona Etichetta oppure Piatto.');
        }

        setResult(null);
        setPreview('');
        setPortions([]);

      } catch (e) {
        setError(e.message || 'Conferma non riuscita.');
      } finally {
        setBusy(false);
      }
    }

    const total = portions.reduce(
      (sum,p)=>sum+(validGrams(p.grams)||0),0
    );

    return h('article',{
      className:'card',
      style:{marginBottom:'16px'}
    },

      h('h2',null,'📷 Analisi fotografica'),

      h('p',{className:'muted'},
        'Fotografa un’etichetta o un piatto, '+
        'poi controlla i risultati prima di confermare.'
      ),

      h('div',{
        style:{display:'flex',gap:'8px',flexWrap:'wrap'}
      },

        ...[
          {title:'📷 Scatta foto',capture:true},
          {title:'🖼 Scegli dalla galleria',capture:false}
        ].map(item=>
          h('label',{
            key:item.title,
            className:'ghost',
            style:{
              cursor:busy?'default':'pointer',
              display:'inline-block',
              padding:'10px 14px',
              opacity:busy?.6:1
            }
          },
            item.title,
            h('input',{
              type:'file',
              accept:'image/*',
              ...(item.capture?{capture:'environment'}:{}),
              disabled:busy,
              style:{display:'none'},
              onChange:e=>{
                const file=e.target.files?.[0];
                e.target.value='';
                analyze(file);
              }
            })
          )
        )
      ),

      busy&&h('p',{role:'status'},
        'Elaborazione in corso…'
      ),

      preview&&h('img',{
        src:preview,
        alt:'Fotografia selezionata',
        style:{
          display:'block',
          width:'100%',
          maxHeight:'280px',
          objectFit:'contain',
          marginTop:'14px',
          borderRadius:'12px'
        }
      }),

      result&&h('div',{style:{marginTop:'16px'}},

        h('label',null,'Tipo di contenuto',
          h('select',{
            value:manualType,
            disabled:busy,
            onChange:e=>setManualType(e.target.value)
          },
            h('option',{value:'auto'},
              `Automatico: ${result.type}`
            ),
            h('option',{value:'label'},'Etichetta'),
            h('option',{value:'dish'},'Piatto')
          )
        ),

        type==='label'&&h('div',null,

          h('h3',null,'Etichetta riconosciuta'),

          h('label',null,'Nome prodotto',
            h('input',{
              style:inputStyle,
              value:name,
              onChange:e=>setName(e.target.value)
            })
          ),

          h('label',null,'Marca',
            h('input',{
              style:inputStyle,
              value:brand,
              onChange:e=>setBrand(e.target.value)
            })
          ),

          h('label',null,'Ingredienti',
            h('textarea',{
              style:inputStyle,
              rows:4,
              value:ingredients,
              onChange:e=>setIngredients(e.target.value)
            })
          ),

          h('p',{className:'muted tiny'},
            basis==='per_100g'
              ? 'Nutrienti dichiarati per 100 g. Controlla i numeri.'
              : 'Base della tabella non riconosciuta: valori non importabili.'
          ),

          ...KEYS.map(([key,title,unit])=>
            h('label',{key},
              `${title} (${unit})`,
              h('input',{
                type:'number',
                min:0,
                step:'any',
                disabled:basis!=='per_100g',
                style:inputStyle,
                value:label[key] ?? '',
                onChange:e=>setLabel(prev=>({
                  ...prev,
                  [key]:e.target.value===''
                    ? null:Number(e.target.value)
                }))
              })
            )
          )
        ),

        type==='dish'&&h('div',null,

          h('h3',null,'Alimenti e porzioni stimate'),

          h('p',{className:'muted tiny'},
            'I grammi sono ipotesi basate sulla foto, '+
            'non pesature. Puoi correggerli liberamente.'
          ),

          portions.map((p,i)=>
            h('div',{
              key:p.id,
              style:{
                border:'1px solid #dce7e8',
                borderRadius:'12px',
                padding:'12px',
                marginBottom:'10px'
              }
            },

              h('label',null,'Alimento',
                h('input',{
                  style:inputStyle,
                  value:p.name,
                  onChange:e=>updatePortion(i,{
                    name:e.target.value
                  })
                })
              ),

              h('label',null,'Peso stimato (g)',
                h('input',{
                  type:'number',
                  min:1,
                  max:10000,
                  step:'any',
                  style:inputStyle,
                  value:p.grams,
                  placeholder:'Peso non stimabile',
                  onChange:e=>updatePortion(i,{
                    grams:e.target.value,
                    source:'user_confirmed_visual_estimate'
                  })
                })
              ),

              h('div',{
                style:{
                  display:'flex',
                  gap:'8px',
                  flexWrap:'wrap',
                  alignItems:'center'
                }
              },

                h('strong',{
                  style:{fontSize:'13px'}
                },`Confidenza: ${CONFIDENCE[p.confidence]}`),

                p.minGrams!==null &&
                p.maxGrams!==null &&
                h('small',{className:'muted'},
                  `Intervallo AI: ${p.minGrams}–${p.maxGrams} g`
                )
              ),

              p.reason&&h('p',{
                className:'muted tiny'
              },p.reason),

              h('button',{
                className:'ghost',
                disabled:busy,
                style:{fontSize:'12px'},
                onClick:()=>setPortions(prev=>
                  prev.filter((_,idx)=>idx!==i)
                )
              },'Rimuovi alimento')
            )
          ),

          h('button',{
            className:'ghost',
            disabled:busy,
            onClick:()=>setPortions(prev=>[
              ...prev,
              {
                id:`manual-${Date.now()}-${Math.random()}`,
                name:'',
                grams:'',
                minGrams:null,
                maxGrams:null,
                confidence:'none',
                reason:'Aggiunto manualmente',
                preparation:'',
                source:'manual'
              }
            ])
          },'+ Aggiungi alimento'),

          h('div',{
            style:{
              margin:'14px 0',
              display:'flex',
              justifyContent:'space-between',
              alignItems:'center'
            }
          },
            h('span',null,'Peso totale proposto'),
            h('strong',{
              style:{fontSize:'21px'}
            },`${Math.round(total)} g`)
          ),

          h('label',null,'Descrizione del piatto',
            h('textarea',{
              rows:4,
              style:inputStyle,
              value:description,
              onChange:e=>setDescription(e.target.value)
            })
          ),

          h('p',{className:'muted tiny'},
            'Gli ingredienti nascosti e i condimenti '+
            'non distinguibili dalla foto non vengono '+
            'considerati misurati.'
          )
        ),

        result.uncertainty?.length>0&&
        h('details',null,
          h('summary',null,'Incertezze rilevate'),
          h('ul',null,
            ...result.uncertainty.map((text,i)=>
              h('li',{key:i},text)
            )
          )
        ),

        result.warning&&h('p',{
          className:'muted'
        },result.warning),

        h('button',{
          className:'cta',
          disabled:busy || !['label','dish'].includes(type),
          onClick:confirm,
          style:{marginTop:'12px'}
        },
          type==='dish'
            ? 'Conferma e prepara il diario'
            : confirmLabel
        )
      ),

      error&&h('p',{
        className:'errorText',
        role:'alert'
      },error),

      h('p',{
        className:'muted tiny',
        style:{marginTop:'12px'}
      },
        'L’immagine viene inviata al provider AI. '+
        'Non includere documenti o informazioni personali.'
      )
    );
  }

  root.NutriTraceFoodCamera=FoodCamera;

})(window);
