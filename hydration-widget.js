
'use strict';

(function(root) {
  const React = root.React;
  const h = React.createElement;
  const {useState,useEffect} = React;

  const KEY = 'nutritrace_hydration_v1';
  const DEFAULT_GOAL = 2000;

  function validGoal(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 250 && n <= 10000;
  }

  function readStore() {
    try {
      const raw = JSON.parse((globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage).getItem(KEY) || '{}');

      return {
        goal:validGoal(raw.goal) ? Number(raw.goal) : DEFAULT_GOAL,
        days:raw.days && typeof raw.days === 'object' &&
          !Array.isArray(raw.days) ? raw.days : {},
        dayGoals:raw.dayGoals &&
          typeof raw.dayGoals === 'object' &&
          !Array.isArray(raw.dayGoals) ? raw.dayGoals : {}
      };
    } catch {
      return {goal:DEFAULT_GOAL,days:{},dayGoals:{}};
    }
  }

  function HydrationWidget({date}) {
    const [data,setData] = useState(readStore);
    const [custom,setCustom] = useState('');
    const [editing,setEditing] = useState(false);
    const [goalInput,setGoalInput] = useState('');
    const [message,setMessage] = useState('');

    useEffect(() => {
      try {
        (globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage).setItem(KEY,JSON.stringify(data));
      } catch {
        setMessage('Salvataggio non riuscito.');
      }
    },[data]);

    const entries = Array.isArray(data.days[date])
      ? data.days[date].filter(x=>Number(x.ml)>0)
      : [];

    const total = entries.reduce((sum,x)=>sum+Number(x.ml),0);

    const dayGoal = validGoal(data.dayGoals?.[date])
      ? Number(data.dayGoals[date])
      : data.goal;

    const reached = total >= dayGoal;
    const extra = Math.max(0,total-dayGoal);
    const maximum = Math.max(total,dayGoal,1);
    const greenWidth = reached ? dayGoal/maximum*100 : 0;
    const blueWidth = reached
      ? extra/maximum*100
      : total/dayGoal*100;

    const fmt = n=>Math.round(n).toLocaleString('it-IT');

    function addWater(amount) {
      const ml = Number(amount);

      if (!Number.isInteger(ml) || ml<1 || ml>5000) {
        setMessage('Inserisci una quantità da 1 a 5.000 ml.');
        return;
      }

      setData(prev=>({
        ...prev,
        days:{
          ...prev.days,
          [date]:[
            ...(Array.isArray(prev.days[date])?prev.days[date]:[]),
            {
              id:String(Date.now())+'-'+Math.random().toString(36).slice(2),
              ml,
              time:new Date().toISOString()
            }
          ]
        }
      }));

      setCustom('');
      setMessage('');
    }

    function undo() {
      setData(prev=>({
        ...prev,
        days:{
          ...prev.days,
          [date]:(prev.days[date]||[]).slice(0,-1)
        }
      }));
    }

    function saveDayGoal() {
      if (!validGoal(goalInput)) {
        setMessage('Obiettivo consentito: 250–10.000 ml.');
        return;
      }

      setData(prev=>({
        ...prev,
        dayGoals:{
          ...prev.dayGoals,
          [date]:Number(goalInput)
        }
      }));

      setEditing(false);
      setMessage('');
    }

    function resetDayGoal() {
      setData(prev=>{
        const dayGoals={...prev.dayGoals};
        delete dayGoals[date];
        return {...prev,dayGoals};
      });
      setEditing(false);
      setMessage('');
    }

    function beginEdit() {
      setGoalInput(String(dayGoal));
      setEditing(v=>!v);
      setMessage('');
    }

    const quick=[
      {ml:150,name:'Mezzo bicchiere'},
      {ml:250,name:'Bicchiere intero'},
      {ml:500,name:'Borraccia'}
    ];

    return h('article',{
      className:'card',
      style:{marginBottom:'16px',padding:'14px'}
    },

      h('div',{
        style:{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center',
          gap:'10px',
          flexWrap:'wrap'
        }
      },
        h('div',null,
          h('h2',{style:{margin:0,fontSize:'18px'}},'💧 Idratazione'),
          h('small',{className:'muted'},'Giorno selezionato')
        ),
        h('button',{
          className:'ghost',
          style:{fontSize:'12px',padding:'7px 10px'},
          onClick:beginEdit
        },'Cambia obiettivo del giorno')
      ),

      h('div',{
        style:{
          display:'flex',
          alignItems:'baseline',
          gap:'6px',
          margin:'14px 0 10px'
        }
      },
        h('strong',{
          style:{fontSize:'25px',lineHeight:1.2}
        },fmt(total)),
        h('span',{className:'muted'},
          '/ '+fmt(dayGoal)+' ml'
        )
      ),

      h('div',{
        role:'progressbar',
        'aria-label':'Progresso idratazione',
        'aria-valuemin':0,
        'aria-valuemax':dayGoal,
        'aria-valuenow':Math.min(total,dayGoal),
        style:{
          height:'12px',
          display:'flex',
          background:'#dce7e8',
          borderRadius:'20px',
          overflow:'hidden',
          position:'relative'
        }
      },
        reached
          ? h(React.Fragment,null,
              h('div',{
                style:{
                  width:greenWidth+'%',
                  background:'#279c71',
                  height:'100%'
                }
              }),
              extra>0&&h('div',{
                style:{
                  width:blueWidth+'%',
                  background:'#318bc4',
                  height:'100%'
                }
              })
            )
          : h('div',{
              style:{
                width:blueWidth+'%',
                background:'#318bc4',
                height:'100%',
                borderRadius:'20px'
              }
            })
      ),

      h('div',{
        style:{
          display:'flex',
          justifyContent:'space-between',
          gap:'8px',
          margin:'7px 0 12px'
        }
      },
        h('small',{className:'muted'},
          fmt(total/dayGoal*100)+'% dell’obiettivo'
        ),
        reached
          ? h('small',{
              style:{color:'#279c71',fontWeight:600}
            },extra>0?'+'+fmt(extra)+' ml extra':'Obiettivo raggiunto')
          : h('small',{className:'muted'},
              'Mancano '+fmt(dayGoal-total)+' ml'
            )
      ),

      h('div',{
        style:{display:'flex',gap:'7px',width:'100%'}
      },
        ...quick.map(item=>
          h('button',{
            key:item.ml,
            className:'ghost',
            onClick:()=>addWater(item.ml),
            style:{
              flex:'1 1 0',
              minWidth:0,
              padding:'9px 3px',
              display:'flex',
              flexDirection:'column',
              alignItems:'center',
              gap:'3px'
            }
          },
            h('strong',{style:{fontSize:'12px'}},
              '+'+item.ml+' ml'
            ),
            h('small',{
              style:{
                fontSize:'10px',
                fontWeight:400,
                textAlign:'center',
                lineHeight:1.2,
                whiteSpace:'normal'
              }
            },item.name)
          )
        )
      ),

      h('div',{
        style:{
          display:'flex',
          gap:'8px',
          alignItems:'center',
          marginTop:'10px',
          flexWrap:'wrap'
        }
      },
        h('input',{
          type:'number',
          min:1,
          max:5000,
          step:1,
          placeholder:'Altri ml',
          'aria-label':'Altri millilitri',
          value:custom,
          onChange:e=>setCustom(e.target.value),
          style:{flex:'1 1 90px',minWidth:'80px'}
        }),
        h('button',{
          className:'ghost',
          disabled:!custom.trim(),
          onClick:()=>addWater(custom)
        },'+ Aggiungi'),
        h('button',{
          className:'ghost',
          disabled:!entries.length,
          onClick:undo
        },'↶ Annulla')
      ),

      editing&&h('div',{
        style:{
          marginTop:'12px',
          padding:'12px',
          border:'1px solid #dce7e8',
          borderRadius:'10px'
        }
      },
        h('label',null,'Obiettivo per questa data (ml)',
          h('input',{
            type:'number',
            min:250,
            max:10000,
            step:50,
            value:goalInput,
            onChange:e=>setGoalInput(e.target.value)
          })
        ),
        h('div',{
          style:{
            display:'flex',
            flexWrap:'wrap',
            gap:'8px',
            marginTop:'8px'
          }
        },
          h('button',{
            className:'cta',
            onClick:saveDayGoal
          },'Salva'),
          h('button',{
            className:'ghost',
            onClick:resetDayGoal
          },'Ripristina predefinito'),
          h('button',{
            className:'ghost',
            onClick:()=>setEditing(false)
          },'Annulla')
        )
      ),

      message&&h('p',{
        role:'alert',
        className:'errorText'
      },message),

      h('p',{
        className:'muted tiny',
        style:{margin:'10px 0 0'}
      },
        entries.length+' registrazioni · '+
        'Dati salvati sul dispositivo'
      )
    );
  }

  root.NutriTraceHydrationWidget=HydrationWidget;

})(window);
