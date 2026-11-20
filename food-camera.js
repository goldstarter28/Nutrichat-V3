
'use strict';

(function(root) {
  const h = root.React.createElement;
  const {useState} = root.React;

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

  async function compress(file) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Seleziona una fotografia.');
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error('Immagine originale troppo grande (max 15 MB).');
    }

    const bitmap = await createImageBitmap(file);

    try {
      const maxSide = 1800;
      const ratio = Math.min(
        1,
        maxSide / Math.max(bitmap.width, bitmap.height)
      );

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1,Math.round(bitmap.height * ratio));

      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas non disponibile.');

      context.drawImage(bitmap,0,0,canvas.width,canvas.height);

      for (const quality of [0.85,0.72,0.58]) {
        const result = canvas.toDataURL('image/jpeg',quality);
        if (result.length < 3.5 * 1024 * 1024) {
          return result;
        }
      }

      throw new Error('Immagine troppo grande dopo la compressione.');
    } finally {
      bitmap.close();
    }
  }

  function FoodCamera({onLabel,onDish}) {
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

    async function analyze(file) {
      if (!file) return;

      setBusy(true);
      setError('');
      setResult(null);

      try {
        const image = await compress(file);
        setPreview(image);

        const response = await fetch('/api/analyze-food-image',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({image})
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || `Vision HTTP ${response.status}`);
        }

        setResult(data);
        setName(data.name || '');
        setBrand(data.brand || '');
        setIngredients(data.ingredients || '');
        setDescription(data.dishDescription || '');
        setLabel(data.label || {});
        setBasis(data.basis || 'unknown');

      } catch (e) {
        setError(e.message || 'Analisi fotografica non riuscita.');
      } finally {
        setBusy(false);
      }
    }

    const type = manualType === 'auto'
      ? result?.type
      : manualType;

    async function confirm() {
      setError('');

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
          if (!description.trim()) {
            throw new Error('Descrivi gli alimenti visibili.');
          }

          await onDish(description.trim());

        } else {
          throw new Error('Seleziona Etichetta o Piatto.');
        }

        setResult(null);
        setPreview('');

      } catch (e) {
        setError(e.message || 'Impossibile confermare.');
      }
    }

    const inputStyle = {width:'100%'};

    return h('article',{className:'card',style:{marginBottom:'16px'}},

      h('h2',null,'📷 Fotocamera intelligente'),

      h('p',{className:'muted'},
        'Fotografa un’etichetta oppure un piatto. '+
        'L’AI riconosce automaticamente il contenuto.'
      ),

      h('div',{
        style:{display:'flex',gap:'8px',flexWrap:'wrap'}
      },

        h('label',{
          className:'ghost',
          style:{
            cursor:'pointer',
            display:'inline-block',
            padding:'10px 14px'
          }
        },
          '📷 Scatta foto',
          h('input',{
            type:'file',
            accept:'image/*',
            capture:'environment',
            disabled:busy,
            style:{display:'none'},
            onChange:e=>{
              const file=e.target.files?.[0];
              e.target.value='';
              analyze(file);
            }
          })
        ),

        h('label',{
          className:'ghost',
          style:{
            cursor:'pointer',
            display:'inline-block',
            padding:'10px 14px'
          }
        },
          '🖼 Galleria',
          h('input',{
            type:'file',
            accept:'image/*',
            disabled:busy,
            style:{display:'none'},
            onChange:e=>{
              const file=e.target.files?.[0];
              e.target.value='';
              analyze(file);
            }
          })
        )
      ),

      busy && h('p',{role:'status'},
        'Analisi fotografica in corso…'
      ),

      preview && h('img',{
        src:preview,
        alt:'Anteprima della fotografia selezionata',
        style:{
          width:'100%',
          maxHeight:'260px',
          objectFit:'contain',
          marginTop:'12px',
          borderRadius:'10px'
        }
      }),

      result && h('div',{style:{marginTop:'14px'}},

        h('label',null,'Tipo di fotografia',
          h('select',{
            value:manualType,
            onChange:e=>setManualType(e.target.value)
          },
            h('option',{value:'auto'},
              'Automatico: '+result.type
            ),
            h('option',{value:'label'},'Etichetta'),
            h('option',{value:'dish'},'Piatto')
          )
        ),

        type === 'label' && h('div',null,

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
              rows:4,
              style:inputStyle,
              value:ingredients,
              onChange:e=>setIngredients(e.target.value)
            })
          ),

          h('p',{className:'muted tiny'},
            basis === 'per_100g'
              ? 'Tabella riconosciuta per 100 g.'
              : 'Base nutrizionale non verificata: i numeri non verranno importati.'
          ),

          ...KEYS.map(([key,title,unit]) =>
            h('label',{key},
              `${title} (${unit})`,
              h('input',{
                type:'number',
                min:0,
                step:'any',
                style:inputStyle,
                disabled:basis !== 'per_100g',
                value:label[key] ?? '',
                onChange:e=>setLabel(p=>({
                  ...p,
                  [key]:e.target.value === ''
                    ? null : Number(e.target.value)
                }))
              })
            )
          )
        ),

        type === 'dish' && h('div',null,
          h('label',null,'Alimenti riconosciuti',
            h('textarea',{
              rows:5,
              style:inputStyle,
              value:description,
              onChange:e=>setDescription(e.target.value)
            })
          ),

          h('p',{className:'muted tiny'},
            'Controlla la descrizione. Pesi e ingredienti '+
            'non visibili non sono misurabili dalla fotografia.'
          )
        ),

        (result.uncertainty || []).length > 0 &&
          h('details',null,
            h('summary',null,'Incertezze rilevate'),
            h('ul',null,
              ...result.uncertainty.map((x,i)=>
                h('li',{key:i},x)
              )
            )
          ),

        result.warning &&
          h('p',{className:'muted'},result.warning),

        h('button',{
          className:'cta',
          disabled:busy || !['label','dish'].includes(type),
          onClick:confirm
        },
          type === 'dish'
            ? 'Interpreta il pasto nel diario'
            : 'Crea scheda alimento'
        )
      ),

      error && h('p',{
        className:'errorText',
        role:'alert'
      },error),

      h('p',{
        className:'muted tiny',
        style:{marginTop:'12px'}
      },
        'La fotografia viene inviata al provider AI '+
        'per l’analisi. Non fotografare informazioni personali.'
      )
    );
  }

  root.NutriTraceFoodCamera = FoodCamera;

})(window);
