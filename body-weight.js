'use strict';

(function (root) {
  const h = root.React.createElement;
  const { useState, useMemo, useEffect } = root.React;

  const STORAGE_KEY = 'nutritrace_body_weight_v1';

  function today() {
    const d = new Date();
    const local = new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    );
    return local.toISOString().slice(0, 10);
  }

  function numeric(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value, digits = 1) {
    return value === null || !Number.isFinite(value)
      ? 'N/D'
      : value.toLocaleString('it-IT', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits
        });
  }

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const d = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === value;
  }

  function load() {
    try {
      const raw = JSON.parse(
        (globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage).getItem(STORAGE_KEY) || '{}'
      );

      const entries = Array.isArray(raw.entries)
        ? raw.entries
          .filter(x =>
            x &&
            validDate(x.date) &&
            numeric(x.kg) !== null &&
            Number(x.kg) >= 20 &&
            Number(x.kg) <= 500
          )
          .map(x => ({
            id: String(x.id),
            date: x.date,
            time: String(x.time || ''),
            kg: Number(x.kg),
            note: String(x.note || '').slice(0, 500)
          }))
        : [];

      const target = numeric(raw.target);

      return {
        entries,
        ...(root.NutriTraceEnvironment?.isDemo&&Array.isArray(raw.targetHistory)?{targetHistory:raw.targetHistory.filter(x=>validDate(x.date)&&numeric(x.kg)!==null&&x.kg>=20&&x.kg<=500).map(x=>({date:x.date,kg:Number(x.kg),phase:String(x.phase||'').slice(0,100)}))}:{}),
        target: target !== null &&
          target >= 20 && target <= 500
          ? target
          : null
      };
    } catch {
      return { entries: [], target: null };
    }
  }

  function movingAverage(entries, endIndex, windowSize) {
    const start = Math.max(0, endIndex - windowSize + 1);
    const slice = entries.slice(start, endIndex + 1);

    if (slice.length < windowSize) return null;

    return slice.reduce((sum, x) => sum + x.kg, 0) /
      slice.length;
  }

  function WeightChart({ entries, target, showTrend, targetHistory=[] }) {
    const [selected, setSelected] = useState(null);
    const [windowState,setWindowState]=useState({start:0,count:null});
    const full=entries, count=Math.min(full.length,Math.max(2,windowState.count??full.length)), start=Math.min(Math.max(0,windowState.start),Math.max(0,full.length-count));
    const change=(s,c)=>{setWindowState({start:Math.max(0,Math.min(full.length-c,s)),count:c});setSelected(null);};
    const zoom=factor=>{const n=Math.min(full.length,Math.max(2,Math.round(count*factor)));change(Math.round(start+(count-n)/2),n);};
    entries=full.slice(start,start+count);

    if (!entries.length) {
      return h('p', { className: 'muted' },
        'Registra una misurazione per visualizzare il grafico.'
      );
    }

    const width = 900;
    const height = 310;
    const left = 58;
    const right = 24;
    const top = 24;
    const bottom = 48;
    const plotW = width - left - right;
    const plotH = height - top - bottom;

    const dates = entries.map(x =>
      new Date(x.date + 'T12:00:00Z').getTime()
    );

    const minDate = dates.reduce((a,b)=>Math.min(a,b),Infinity);
    const maxDate = dates.reduce((a,b)=>Math.max(a,b),-Infinity);
    const span = Math.max(maxDate - minDate, 86400000);

    const trends = entries.map((_, index) =>
      movingAverage(full, start+index, 7)
    );

    const history=targetHistory.filter(x=>validDate(x.date)).sort((a,b)=>a.date.localeCompare(b.date));const startDay=entries[0].date,endDay=entries.at(-1).date,prior=history.filter(x=>x.date<=startDay).at(-1);const visibleTargets=[...(prior?[{...prior,date:startDay}]:[]),...history.filter(x=>x.date>startDay&&x.date<=endDay)];
    const allWeights = [
      ...entries.map(x => x.kg),
      ...(showTrend ? trends.filter(x => x !== null) : []),
      ...(visibleTargets.length?visibleTargets.map(x=>x.kg):target !== null ? [target] : [])
    ];

    const minValue = allWeights.reduce((a,b)=>Math.min(a,b),Infinity);
    const maxValue = allWeights.reduce((a,b)=>Math.max(a,b),-Infinity);
    const padding = Math.max(0.8, (maxValue - minValue) * .15);
    const yMin = Math.max(0, minValue - padding);
    const yMax = maxValue + padding;

    const xPos = date => left +
      (date - minDate) / span * plotW;

    const yPos = kg => top + plotH -
      (kg - yMin) / (yMax - yMin) * plotH;

    const points = entries.map((entry, index) => ({
      x: xPos(dates[index]),
      y: yPos(entry.kg)
    }));

    const line = points.map((point, index) =>
      `${index ? 'L' : 'M'}${point.x} ${point.y}`
    ).join(' ');

    const trendPath = trends.map((value, index) =>
      value === null
        ? ''
        : `${index === 0 || trends[index-1] === null ? 'M' : 'L'}` +
          `${xPos(dates[index])} ${yPos(value)}`
    ).join(' ');

    const selectedEntry=Number.isInteger(selected)&&selected>=0&&selected<entries.length?entries[selected]:null;
    const targetPath=visibleTargets.map((v,i)=>{const end=visibleTargets[i+1]?.date||endDay;return (i?'L':'M')+xPos(Date.parse(v.date+'T12:00:00Z'))+' '+yPos(v.kg)+' H'+xPos(Date.parse(end+'T12:00:00Z'));}).join(' ');

    return h('div', null,
      h('div',{className:'v733-chart-tools'},h('button',{type:'button',className:'ghost',disabled:count<=2,onClick:()=>zoom(.5)},'+ Zoom'),h('button',{type:'button',className:'ghost',disabled:count>=full.length,onClick:()=>zoom(2)},'− Zoom'),h('button',{type:'button',className:'ghost',disabled:start<=0,onClick:()=>change(start-Math.max(1,Math.floor(count*.7)),count)},'←'),h('button',{type:'button',className:'ghost',disabled:start+count>=full.length,onClick:()=>change(start+Math.max(1,Math.floor(count*.7)),count)},'→'),h('button',{type:'button',className:'ghost',onClick:()=>change(0,full.length)},'Tutto'),h('small',{className:'muted'},entries[0].date+' → '+entries.at(-1).date)),
      h('div', {
        style: { overflowX: 'auto' }
      },
        h('svg', {
          viewBox: `0 0 ${width} ${height}`,
          role: 'img',
          'aria-label': 'Andamento del peso corporeo',
          style: {
            display: 'block',
            width: '100%',
            minWidth: '340px',
            touchAction: 'pan-y'
          },
          onPointerDown: event => {
            const rect = event.currentTarget
              .getBoundingClientRect();

            const coordinate =
              (event.clientX - rect.left) /
              rect.width * width;

            let best = 0;
            let distance = Infinity;

            points.forEach((point, index) => {
              const delta = Math.abs(point.x - coordinate);

              if (delta < distance) {
                distance = delta;
                best = index;
              }
            });

            setSelected(best);
          }
        },

          ...[0, .25, .5, .75, 1].map(fraction => {
            const value = yMin + (yMax - yMin) * fraction;
            const y = yPos(value);

            return h('g', { key: 'y-'+fraction },
              h('line', {
                x1: left, x2: width - right,
                y1: y, y2: y,
                stroke: 'currentColor',
                opacity: .12
              }),
              h('text', {
                x: left - 8,
                y: y + 4,
                fill: 'currentColor',
                textAnchor: 'end',
                fontSize: 12
              }, fmt(value))
            );
          }),

          visibleTargets.length>0&&h('path',{d:targetPath,fill:'none',stroke:'#c34a4a',strokeWidth:2,strokeDasharray:'7 5'}),
          !visibleTargets.length&&target !== null &&
          h('line', {
            x1: left,
            x2: width - right,
            y1: yPos(target),
            y2: yPos(target),
            stroke: '#c34a4a',
            strokeWidth: 2,
            strokeDasharray: '7 5'
          }),

          h('path', {
            d: line,
            fill: 'none',
            stroke: '#178e7b',
            strokeWidth: 2.8,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          }),

          showTrend && trends.some(v=>v!==null) &&
          h('path', {
            d: trendPath,
            fill: 'none',
            stroke: '#d38c2c',
            strokeWidth: 3.2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          }),

          ...points.map((point,index)=>({point,index})).filter(({index})=>points.length<=180||index===0||index===points.length-1||index===selected||index%Math.ceil(points.length/180)===0).map(({point,index})=>
            h('circle', {
              key: entries[index].id,
              cx: point.x,
              cy: point.y,
              r: selected === index ? 6 : 3.5,
              fill: '#178e7b',
              stroke: 'white',
              strokeWidth: 1.5
            })
          ),

          ...[0, .25, .5, .75, 1].map(fraction => {
            const date = new Date(
              minDate + (maxDate - minDate) * fraction
            );

            return h('text', {
              key: 'x-'+fraction,
              x: xPos(date.getTime()),
              y: height - 17,
              textAnchor: 'middle',
              fill: 'currentColor',
              fontSize: 12
            }, date.toLocaleDateString('it-IT', {
              day: '2-digit',
              month: '2-digit'
            }));
          }),

          selectedEntry &&
          h('line', {
            x1: points[selected].x,
            x2: points[selected].x,
            y1: top,
            y2: top + plotH,
            stroke: 'currentColor',
            opacity: .4,
            strokeDasharray: '4 4'
          })
        )
      ),

      h('p', {
        className: 'muted',
        style: { fontSize: '13px' }
      },
        h('span', null, h('span', { 'aria-hidden': true, style: { color: '#178e7b' } }, '● '), 'Peso registrato'),
        showTrend && h('span', null, ' · ', h('span', { 'aria-hidden': true, style: { color: '#d38c2c' } }, '● '), 'Trend ultime 7 misurazioni'),
        (target !== null || visibleTargets.length > 0) && h('span', null, ' · ', h('span', {
          'aria-hidden': true, style: { display: 'inline-block', width: '20px', borderTop: '2px dashed #c34a4a', verticalAlign: 'middle', marginRight: '4px' }
        }), 'Peso da raggiungere')
      ),

      h('div', {
        role: 'status',
        style: {
          fontWeight: 600,
          padding: '8px 0',
          minHeight: '34px'
        }
      },
        selectedEntry
          ? `${selectedEntry.date}${selectedEntry.time
              ? ' ' + selectedEntry.time : ''} · ` +
            `${fmt(selectedEntry.kg)} kg`
          : 'Tocca un punto per visualizzare i dettagli.'
      )
    );
  }

  function WeightTarget({ target: controlledTarget, onSave } = {}) {
    const [targetText, setTargetText] = useState(() => {
      const target = controlledTarget === undefined ? load().target : controlledTarget;
      return target === null ? '' : String(target);
    });
    const [message, setMessage] = useState('');
    useEffect(() => {
      if (controlledTarget !== undefined) setTargetText(controlledTarget === null ? '' : String(controlledTarget));
    }, [controlledTarget]);

    function saveTarget() {
      const empty = targetText.trim() === '';
      const target = empty ? null : numeric(targetText);
      if (!empty && (target === null || target < 20 || target > 500)) {
        setMessage('Peso da raggiungere non valido: inserisci 20–500 kg.');
        return;
      }
      try {
        const storage = root.NutriTraceEnvironment?.storage || root.localStorage;
        const previous = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
        if (!previous || typeof previous !== 'object' || Array.isArray(previous)) throw new Error('Peso non leggibile');
        storage.setItem(STORAGE_KEY, JSON.stringify({ ...previous, target }));
        if (onSave) onSave(target);
        setMessage(target === null ? 'Peso da raggiungere rimosso.' : 'Peso da raggiungere salvato.');
      } catch {
        setMessage('Salvataggio non riuscito: i dati del peso non sono stati modificati.');
      }
    }

    return h('article', { className: 'card', 'data-v732-weight-target': true },
      h('h2', null, 'Peso da raggiungere'),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '12px' } },
        h('label', null, 'Peso da raggiungere (kg)',
          h('input', { type: 'number', min: 20, max: 500, step: .1, inputMode: 'decimal', value: targetText,
            placeholder: 'Es. 72', onChange: event => setTargetText(event.target.value) })
        ),
        h('button', { type: 'button', className: 'cta', onClick: saveTarget }, 'Salva obiettivo')
      ),
      h('p', { className: 'muted tiny' }, 'Lascia vuoto e salva per rimuovere l’obiettivo.'),
      message && h('p', { className: 'muted', role: 'status' }, message)
    );
  }

  function BodyWeight({ children } = {}) {
    const [data, setData] = useState(load);
    const formRef=root.React.useRef(null);
    const [date, setDate] = useState(today);
    const [time, setTime] = useState('');
    const [weight, setWeight] = useState('');
    const [note, setNote] = useState('');
    const [editing, setEditing] = useState(null);
    const [range, setRange] = useState('90');
    const [showTrend, setShowTrend] = useState(true);
    const [message, setMessage] = useState('');
    const [historyPage,setHistoryPage]=useState(0);

    useEffect(() => {
      try {
        (globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        setMessage(
          'Salvataggio non riuscito: spazio locale non disponibile.'
        );
      }
    }, [data]);

    const entries = useMemo(() =>
      [...data.entries].sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time)
      ),
      [data.entries]
    );

    const visible = useMemo(() => {
      const end = today();
      if (range === 'all') return entries.filter(x => x.date <= end);
      const start = new Date(end + 'T12:00:00Z');
      start.setUTCDate(start.getUTCDate() - Number(range) + 1);
      const from = start.toISOString().slice(0, 10);
      return entries.filter(x => x.date >= from && x.date <= end);
    }, [entries, range]);

    const historyPages=Math.max(1,Math.ceil(entries.length/50)),page=Math.min(historyPage,historyPages-1);
    const historyRows=entries.slice().reverse().slice(page*50,(page+1)*50);
    const last = entries[entries.length - 1] || null;
    const firstInRange = visible[0] || null;
    const lastInRange = visible[visible.length - 1] || null;
    const delta = visible.length >= 2 ? lastInRange.kg - firstInRange.kg : null;
    const percentage = delta !== null && firstInRange.kg > 0
      ? delta / firstInRange.kg * 100 : null;
    const periodDates = visible.length >= 2
      ? `${firstInRange.date} → ${lastInRange.date}`
      : visible.length === 1
        ? `${firstInRange.date} · serve una seconda misurazione`
        : 'Nessuna misurazione nel periodo';

    const trend = entries.length >= 7
      ? movingAverage(entries, entries.length - 1, 7)
      : null;

    function resetForm() {
      setEditing(null);
      setDate(today());
      setTime('');
      setWeight('');
      setNote('');
    }

    function saveEntry(event) {
      event.preventDefault();

      const kg = numeric(weight);

      if (!validDate(date)) {
        setMessage('Inserisci una data valida.');
        return;
      }

      if (kg === null || kg < 20 || kg > 500) {
        setMessage('Inserisci un peso compreso tra 20 e 500 kg.');
        return;
      }

      if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        setMessage('Inserisci un orario valido.');
        return;
      }

      const entry = {
        id: editing || (
          Date.now().toString(36) + '-' +
          Math.random().toString(36).slice(2)
        ),
        date,
        time,
        kg,
        note: note.trim().slice(0, 500)
      };

      const next={...data,entries:editing?data.entries.map(x=>x.id===editing?entry:x):[...data.entries,entry]};
      if(editing&&!data.entries.some(x=>x.id===editing)){setMessage('Misurazione non più disponibile.');return;}
      try{(globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage).setItem(STORAGE_KEY,JSON.stringify(next));}catch(e){setMessage('Salvataggio non riuscito: spazio locale non disponibile.');return;}
      setData(next);

      setMessage(
        editing ? 'Misurazione aggiornata.' : 'Peso registrato.'
      );

      resetForm();
    }

    function editEntry(entry) {
      setEditing(entry.id);
      setDate(entry.date);
      setTime(entry.time);
      setWeight(String(entry.kg));
      setNote(entry.note);
      setMessage('Modifica la misurazione selezionata.');
      root.requestAnimationFrame?.(()=>{formRef.current?.scrollIntoView?.({block:'center',behavior:'smooth'});formRef.current?.querySelector('[data-v731-weight]')?.focus();});
    }

    function deleteEntry(id) {
      if (!root.confirm('Eliminare questa misurazione?')) return;

      setData(previous => ({
        ...previous,
        entries: previous.entries.filter(x => x.id !== id)
      }));

      if (editing === id) resetForm();
      setMessage('Misurazione eliminata.');
    }

    const metric = (label, value) =>
      h('div', {
        className: 'metric',
        style: { minWidth: 0 }
      },
        h('span', null, label),
        h('strong', null, value)
      );

    return h('section', null,

      h('div', { className: 'sectionHead' },
        h('div', null,
          h('h2', null, 'Peso corporeo'),
          h('p', null,
            'Misurazioni, obiettivo personale e andamento nel tempo.'
          )
        )
      ),

      h('div', {
        className: 'v732-weight-period',
        style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }
      },
        h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', margin: 0 } },
          'Variazioni e grafico',
          h('select', {
            'aria-label': 'Periodo delle variazioni di peso', value: range,
            style: { width: 'auto', minHeight: '36px', padding: '4px 8px', fontSize: '13px' },
            onChange: event => setRange(event.target.value)
          }, ...[['7', '7 giorni'], ['30', '30 giorni'], ['90', '90 giorni'], ['365', '1 anno'], ['all', 'Tutto']].map(([value, label]) =>
            h('option', { key: value, value }, label)
          ))
        ),
        h('small', { className: 'muted', 'data-v732-period-dates': true }, periodDates)
      ),

      h('div', {
        className: 'reportMetricGrid'
      },
        metric('Ultimo peso', last
          ? `${fmt(last.kg)} kg` : 'N/D'),
        metric('Variazione', delta === null
          ? 'N/D'
          : `${delta > 0 ? '+' : ''}${fmt(delta)} kg`),
        metric('Variazione %', percentage === null
          ? 'N/D'
          : `${percentage > 0 ? '+' : ''}${fmt(percentage, 2)}%`),
        metric('Trend 7 misurazioni', trend === null
          ? 'N/D'
          : `${fmt(trend, 2)} kg`),
        metric('Distanza obiettivo',
          last && data.target !== null
            ? `${fmt(last.kg - data.target)} kg`
            : 'N/D')
      ),

      h('article', { className: 'card' },
        h('h2', null,
          editing ? 'Modifica misurazione' : 'Registra peso'
        ),

        h('form', {
          ref:formRef,onSubmit: saveEntry,
          style: {
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'end'
          }
        },

          h('label', null,
            'Data',
            h('input', {
              type: 'date',
              value: date,
              required: true,
              onChange: e => setDate(e.target.value)
            })
          ),

          h('label', null,
            'Ora (facoltativa)',
            h('input', {
              type: 'time',
              value: time,
              onChange: e => setTime(e.target.value)
            })
          ),

          h('label', null,
            'Peso (kg)',
            h('input', {
              type: 'number',
              'data-v731-weight':true,
              min: 20,
              max: 500,
              step: 'any',
              inputMode: 'decimal',
              placeholder: 'Es. 74,5',
              value: weight,
              required: true,
              onChange: e => setWeight(e.target.value)
            })
          ),

          h('label', null,
            'Note',
            h('input', {
              type: 'text',
              maxLength: 500,
              placeholder: 'Facoltative',
              value: note,
              onChange: e => setNote(e.target.value)
            })
          ),

          h('button', {
            type: 'submit',
            className: 'cta'
          }, editing ? 'Salva modifica' : '+ Registra'),

          editing && h('button', {
            type: 'button',
            className: 'ghost',
            onClick: resetForm
          }, 'Annulla')
        ),

        message && h('p', {
          role: 'status',
          className: 'muted'
        }, message)
      ),

      h(WeightTarget, { target: data.target, onSave: target => setData(previous => ({ ...previous, target })) }),

      h('article', { className: 'card' },

        h('h2', null, 'Andamento del peso'),

        h('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            margin: '12px 0'
          }
        },

          h('small', { className: 'muted', style: { alignSelf: 'center' } }, periodDates),

          h('label', {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }
          },
            h('input', {
              type: 'checkbox',
              checked: showTrend,
              onChange: e => setShowTrend(e.target.checked)
            }),
            'Trend'
          )
        ),

        h(WeightChart, {
          key: range, entries: visible,
          target: data.target,
          showTrend,targetHistory:data.targetHistory||[]
        }),

        h('p', { className: 'muted tiny' },
          'I punti rappresentano le misurazioni reali. ' +
          'Il trend è la media delle ultime 7 misurazioni, ' +
          'non una media di 7 giorni. ' +
          'Le date senza misurazioni non generano valori.'
        )
      ),

      children,

      h('article', { className: 'card', 'data-v732-weight-history': true },

        h('h2', null, `Storico (${entries.length})`),
        entries.length>50&&h('div',{className:'v733-chart-tools'},h('button',{className:'ghost',type:'button',disabled:page===0,onClick:()=>setHistoryPage(page-1)},'← Precedenti'),h('small',null,(page*50+1)+'–'+Math.min(entries.length,(page+1)*50)+' / '+entries.length),h('button',{className:'ghost',type:'button',disabled:page>=historyPages-1,onClick:()=>setHistoryPage(page+1)},'Successive →')),

        !entries.length
          ? h('p', { className: 'muted' },
              'Nessuna misurazione registrata.'
            )
          : h('div', {
              style: { overflowX: 'auto' }
            },
              h('table', {
                style: {
                  width: '100%',
                  borderCollapse: 'collapse'
                }
              },

                h('thead', null,
                  h('tr', null,
                    ...[
                      'Data',
                      'Peso',
                      'Note',
                      'Azioni'
                    ].map(label =>
                      h('th', {
                        key: label,
                        style: {
                          textAlign: 'left',
                          padding: '8px'
                        }
                      }, label)
                    )
                  )
                ),

                h('tbody', null,
                  ...historyRows.map(entry =>
                    h('tr', { key: entry.id },

                      h('td', {
                        style: { padding: '8px' }
                      },
                        entry.date,
                        entry.time ? ` · ${entry.time}` : ''
                      ),

                      h('td', {
                        style: {
                          padding: '8px',
                          whiteSpace: 'nowrap'
                        }
                      }, `${fmt(entry.kg)} kg`),

                      h('td', {
                        style: { padding: '8px' }
                      }, entry.note || '—'),

                      h('td', {
                        style: {
                          padding: '8px',
                          whiteSpace: 'nowrap'
                        }
                      },

                        h('button', {
                          type: 'button',
                          className: 'ghost',
                          onClick: () => editEntry(entry)
                        }, 'Modifica'),

                        ' ',

                        h('button', {
                          type: 'button',
                          className: 'ghost',
                          onClick: () => deleteEntry(entry.id)
                        }, 'Elimina')
                      )
                    )
                  )
                )
              )
            )
      )
    );
  }

  root.NutriTraceBodyWeight = BodyWeight;
  root.NutriTraceWeightTarget = WeightTarget;

})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this
);
