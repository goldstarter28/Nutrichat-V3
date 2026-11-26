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

  function WeightChart({ entries, target, showTrend }) {
    const [selected, setSelected] = useState(null);

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

    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const span = Math.max(maxDate - minDate, 86400000);

    const trends = entries.map((_, index) =>
      movingAverage(entries, index, 7)
    );

    const allWeights = [
      ...entries.map(x => x.kg),
      ...(showTrend ? trends.filter(x => x !== null) : []),
      ...(target !== null ? [target] : [])
    ];

    const minValue = Math.min(...allWeights);
    const maxValue = Math.max(...allWeights);
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
        : `${index === 6 ? 'M' : 'L'}` +
          `${xPos(dates[index])} ${yPos(value)}`
    ).join(' ');

    const selectedEntry = selected === null
      ? null
      : entries[selected];

    return h('div', null,
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

          target !== null &&
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

          showTrend && trends.length >= 7 &&
          h('path', {
            d: trendPath,
            fill: 'none',
            stroke: '#d38c2c',
            strokeWidth: 3.2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          }),

          ...points.map((point, index) =>
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

          selected !== null &&
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
        '● Peso registrato',
        showTrend ? ' · ● Trend ultime 7 misurazioni' : '',
        target !== null ? ' · - - Obiettivo' : ''
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

  function BodyWeight() {
    const [data, setData] = useState(load);
    const [date, setDate] = useState(today);
    const [time, setTime] = useState('');
    const [weight, setWeight] = useState('');
    const [note, setNote] = useState('');
    const [targetText, setTargetText] = useState(
      data.target === null ? '' : String(data.target)
    );
    const [editing, setEditing] = useState(null);
    const [range, setRange] = useState('90');
    const [showTrend, setShowTrend] = useState(true);
    const [message, setMessage] = useState('');

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
      if (range === 'all') return entries;

      const days = Number(range);
      const last = new Date(today() + 'T12:00:00Z');
      last.setUTCDate(last.getUTCDate() - days + 1);
      const from = last.toISOString().slice(0, 10);

      return entries.filter(x => x.date >= from);
    }, [entries, range]);

    const first = entries[0] || null;
    const last = entries[entries.length - 1] || null;

    const delta = first && last
      ? last.kg - first.kg
      : null;

    const percentage = delta !== null && first.kg > 0
      ? delta / first.kg * 100
      : null;

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

      setData(previous => ({
        ...previous,
        entries: editing
          ? previous.entries.map(x =>
              x.id === editing ? entry : x
            )
          : [...previous.entries, entry]
      }));

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

    function saveTarget() {
      const target = targetText.trim() === ''
        ? null
        : numeric(targetText);

      if (target !== null && (target < 20 || target > 500)) {
        setMessage('Obiettivo non valido: inserisci 20–500 kg.');
        return;
      }

      setData(previous => ({ ...previous, target }));
      setMessage(
        target === null
          ? 'Obiettivo rimosso.'
          : 'Obiettivo salvato.'
      );
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
          onSubmit: saveEntry,
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
              min: 20,
              max: 500,
              step: .1,
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

      h('article', { className: 'card' },

        h('h2', null, 'Obiettivo peso'),

        h('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'end',
            gap: '12px'
          }
        },
          h('label', null,
            'Obiettivo in kg',
            h('input', {
              type: 'number',
              min: 20,
              max: 500,
              step: .1,
              value: targetText,
              placeholder: 'Es. 72',
              onChange: e => setTargetText(e.target.value)
            })
          ),

          h('button', {
            type: 'button',
            className: 'cta',
            onClick: saveTarget
          }, 'Salva obiettivo')
        ),

        h('p', { className: 'muted tiny' },
          'Lascia vuoto e salva per rimuovere l’obiettivo.'
        )
      ),

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

          ...[
            ['30', '30 giorni'],
            ['90', '90 giorni'],
            ['365', '1 anno'],
            ['all', 'Tutto']
          ].map(([id, label]) =>
            h('button', {
              key: id,
              type: 'button',
              className: range === id ? 'cta' : 'ghost',
              onClick: () => setRange(id)
            }, label)
          ),

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
          entries: visible,
          target: data.target,
          showTrend
        }),

        h('p', { className: 'muted tiny' },
          'I punti rappresentano le misurazioni reali. ' +
          'Il trend è la media delle ultime 7 misurazioni, ' +
          'non una media di 7 giorni. ' +
          'Le date senza misurazioni non generano valori.'
        )
      ),

      h('article', { className: 'card' },

        h('h2', null, `Storico (${entries.length})`),

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
                  ...[...entries].reverse().map(entry =>
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

})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this
);
