
'use strict';

(function(root) {
  const React = root.React;
  const h = React.createElement;
  const {useState, useEffect} = React;

  const STORAGE_KEY = 'nutritrace_hydration_v1';
  const DEFAULT_GOAL = 2000;

  function readStore() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '{}'
      );

      return {
        goal: Number.isFinite(Number(parsed.goal)) &&
              Number(parsed.goal) >= 250 &&
              Number(parsed.goal) <= 10000
          ? Number(parsed.goal)
          : DEFAULT_GOAL,

        days: parsed.days && typeof parsed.days === 'object' &&
              !Array.isArray(parsed.days)
          ? parsed.days
          : {}
      };
    } catch {
      return {goal:DEFAULT_GOAL, days:{}};
    }
  }

  function HydrationWidget({date}) {
    const [data,setData] = useState(readStore);
    const [custom,setCustom] = useState('');
    const [editingGoal,setEditingGoal] = useState(false);
    const [goalText,setGoalText] = useState('');
    const [message,setMessage] = useState('');

    useEffect(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(data)
        );
        setMessage('');
      } catch {
        setMessage('Impossibile salvare i dati sul dispositivo.');
      }
    }, [data]);

    const rawEntries = data.days[date];
    const entries = Array.isArray(rawEntries)
      ? rawEntries.filter(e =>
          Number.isFinite(Number(e.ml)) &&
          Number(e.ml) > 0
        )
      : [];

    const total = entries.reduce(
      (sum,e) => sum + Number(e.ml),
      0
    );

    const progress = Math.min(
      100,
      (total / data.goal) * 100
    );

    const fmt = value =>
      Math.round(value).toLocaleString('it-IT');

    function addWater(ml) {
      const amount = Number(ml);

      if (!Number.isFinite(amount) ||
          !Number.isInteger(amount) ||
          amount <= 0 || amount > 5000) {
        setMessage('Inserisci una quantità da 1 a 5.000 ml.');
        return;
      }

      setData(prev => ({
        ...prev,
        days: {
          ...prev.days,
          [date]: [
            ...(Array.isArray(prev.days[date])
              ? prev.days[date]
              : []),
            {
              id: String(Date.now()) + '-' +
                  Math.random().toString(36).slice(2),
              ml:amount,
              time:new Date().toISOString()
            }
          ]
        }
      }));

      setCustom('');
      setMessage('');
    }

    function undoLast() {
      setData(prev => {
        const list = Array.isArray(prev.days[date])
          ? prev.days[date]
          : [];

        if (!list.length) return prev;

        return {
          ...prev,
          days: {
            ...prev.days,
            [date]:list.slice(0,-1)
          }
        };
      });
    }

    function updateGoal() {
      const value = Number(goalText);

      if (!Number.isInteger(value) ||
          value < 250 || value > 10000) {
        setMessage(
          'Obiettivo non valido: inserisci da 250 a 10.000 ml.'
        );
        return;
      }

      setData(prev => ({
        ...prev,
        goal:value
      }));

      setEditingGoal(false);
      setMessage('');
    }

    const quickButtons = [
      {ml:150,label:'Mezzo bicchiere'},
      {ml:250,label:'Bicchiere intero'},
      {ml:500,label:'Borraccia'}
    ];

    const buttonStyle = {
      flex:'1 1 0',
      minWidth:0,
      display:'flex',
      flexDirection:'column',
      alignItems:'center',
      justifyContent:'center',
      gap:'4px',
      padding:'12px 5px'
    };

    return h('article', {
      className:'card',
      style:{marginBottom:'16px'}
    },

      h('div', {
        className:'cardTitle',
        style:{display:'flex',justifyContent:'space-between',
          alignItems:'center',gap:'12px'}
      },

        h('div',null,
          h('h2',null,'💧 Idratazione'),
          h('p',{className:'muted'},
            'Acqua registrata nel giorno selezionato'
          )
        ),

        h('button',{
          className:'ghost',
          onClick:() => {
            setGoalText(String(data.goal));
            setEditingGoal(v => !v);
          }
        },'⚙ Obiettivo')
      ),

      h('div',{
        style:{display:'flex',alignItems:'baseline',
          gap:'8px',margin:'14px 0 8px'}
      },

        h('strong',{
          style:{fontSize:'30px',lineHeight:1.2}
        },fmt(total)),

        h('span',{className:'muted'},
          '/ ' + fmt(data.goal) + ' ml'
        )
      ),

      h('div',{
        role:'progressbar',
        'aria-label':'Obiettivo idratazione',
        'aria-valuemin':0,
        'aria-valuemax':data.goal,
        'aria-valuenow':Math.min(total,data.goal),
        style:{
          height:'12px',
          background:'#dce7e8',
          borderRadius:'20px',
          overflow:'hidden'
        }
      },

        h('div',{
          style:{
            width:progress+'%',
            height:'100%',
            background:'#298fc5',
            borderRadius:'20px',
            transition:'width .2s ease'
          }
        })
      ),

      h('p',{
        className:'muted',
        style:{margin:'7px 0 14px'}
      },
        Math.round(total/data.goal*100) +
        '% dell’obiettivo giornaliero'
      ),

      h('div',{
        style:{display:'flex',gap:'8px',width:'100%'}
      },

        quickButtons.map(item =>
          h('button',{
            key:item.ml,
            className:'ghost',
            style:buttonStyle,
            onClick:()=>addWater(item.ml)
          },

            h('strong',null,'+'+item.ml+' ml'),

            h('small',{
              style:{
                fontSize:'11px',
                fontWeight:400,
                textAlign:'center',
                lineHeight:1.3,
                whiteSpace:'normal'
              }
            },item.label)
          )
        )
      ),

      h('div',{
        style:{
          display:'flex',
          gap:'8px',
          alignItems:'center',
          marginTop:'12px',
          flexWrap:'wrap'
        }
      },

        h('input',{
          type:'number',
          min:1,
          max:5000,
          step:1,
          placeholder:'Altri ml',
          'aria-label':'Quantità personalizzata in ml',
          value:custom,
          onChange:e=>setCustom(e.target.value),
          style:{flex:'1 1 100px',minWidth:'90px'}
        }),

        h('button',{
          className:'ghost',
          disabled:!custom.trim(),
          onClick:()=>addWater(custom)
        },'+ Aggiungi'),

        h('button',{
          className:'ghost',
          disabled:!entries.length,
          onClick:undoLast
        },'↶ Annulla ultima')
      ),

      editingGoal &&
        h('div',{
          style:{
            marginTop:'12px',
            display:'flex',
            gap:'8px',
            flexWrap:'wrap',
            alignItems:'center'
          }
        },

          h('label',null,'Obiettivo (ml)',
            h('input',{
              type:'number',
              min:250,
              max:10000,
              step:50,
              value:goalText,
              onChange:e=>setGoalText(e.target.value)
            })
          ),

          h('button',{
            className:'cta',
            onClick:updateGoal
          },'Salva obiettivo')
        ),

      message &&
        h('p',{
          role:'alert',
          style:{marginTop:'10px'}
        },message),

      h('p',{
        className:'muted tiny',
        style:{marginTop:'12px'}
      },
        entries.length+' registrazioni · '+
        'Dati salvati su questo dispositivo'
      )
    );
  }

  root.NutriTraceHydrationWidget = HydrationWidget;

})(window);
