'use strict';

(function (root) {
  const h = root.React.createElement;
  const { useState, useMemo } = root.React;

  const DAY = 86400000;

  function timestamp(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
    const t = Date.parse(date + 'T12:00:00Z');
    return Number.isFinite(t) &&
      new Date(t).toISOString().slice(0, 10) === date
      ? t : null;
  }

  function value(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function fmt(v, digits = 1) {
    return v === null || v === undefined
      ? 'N/D'
      : v.toLocaleString('it-IT', {
          maximumFractionDigits: digits
        });
  }

  function readWeights() {
    try {
      const data = JSON.parse(
        localStorage.getItem('nutritrace_body_weight_v1') || '{}'
      );

      return (Array.isArray(data.entries) ? data.entries : [])
        .filter(e =>
          timestamp(e?.date) !== null &&
          value(e.kg) !== null &&
          Number(e.kg) >= 20 &&
          Number(e.kg) <= 500
        )
        .map(e => ({
          ...e,
          kg: Number(e.kg),
          time: e.time || ''
        }))
        .sort((a, b) =>
          (a.date + a.time).localeCompare(b.date + b.time)
        );
    } catch {
      return [];
    }
  }

  function WeightCalorieChart({ logs = [], foods = [] }) {
    const [period, setPeriod] = useState('90');
    const [revision, refresh] = useState(0);
    const [selected, setSelected] = useState(null);

    const weights = useMemo(
      () => readWeights(),
      [revision]
    );

    const today = new Date();
    const localToday = new Date(
      today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);

    const end = timestamp(localToday);

    const start = period === 'all'
      ? Math.min(
          end,
          ...weights.map(e => timestamp(e.date)),
          ...logs.map(e => timestamp(e.date))
            .filter(t => t !== null)
        )
      : end - (Number(period) - 1) * DAY;

    const visibleWeights = weights.filter(e => {
      const t = timestamp(e.date);
      return t >= start && t <= end;
    });

    const foodMap = new Map(foods.map(f => [f.id, f]));
    const calories = new Map();

    for (const log of logs) {
      const t = timestamp(log.date);
      if (t === null || t < start || t > end) continue;

      const grams = value(log.grams);
      if (grams === null || grams <= 0) continue;

      if (!calories.has(log.date)) {
        calories.set(log.date, {
          date: log.date,
          kcal: 0,
          totalGrams: 0,
          knownGrams: 0
        });
      }

      const row = calories.get(log.date);
      row.totalGrams += grams;

      const food = foodMap.get(log.foodId);
      const basis = value(food?.servingGrams);
      const kcal = value(food?.label?.kcal);

      if (basis !== null && basis > 0 && kcal !== null) {
        row.kcal += kcal * grams / basis;
        row.knownGrams += grams;
      }
    }

    const days = [...calories.values()].sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    const W = 900, H = 340;
    const L = 55, R = 64, T = 22, B = 52;
    const plotW = W - L - R, plotH = H - T - B;
    const span = Math.max(DAY, end - start);

    const x = date => L +
      (timestamp(date) - start) / span * plotW;

    const kgValues = visibleWeights.map(e => e.kg);
    const kgMin = kgValues.length
      ? Math.max(0, Math.min(...kgValues) - 1)
      : 0;
    const kgMax = kgValues.length
      ? Math.max(...kgValues) + 1
      : 100;

    const kcalMax = Math.max(
      100,
      ...days.map(d => d.kcal)
    ) * 1.1;

    const weightY = kg => T + plotH -
      (kg - kgMin) / Math.max(1, kgMax - kgMin) * plotH;

    const calorieY = kcal => T + plotH -
      kcal / kcalMax * plotH;

    const weightPath = visibleWeights.map((e, i) =>
      (i ? 'L' : 'M') + x(e.date) + ' ' + weightY(e.kg)
    ).join(' ');

    const selectedCalories = selected
      ? calories.get(selected)
      : null;

    const selectedWeights = selected
      ? visibleWeights.filter(e => e.date === selected)
      : [];

    function selectNearest(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const pos = (event.clientX - rect.left) / rect.width * W;

      const dates = [
        ...days.map(d => d.date),
        ...visibleWeights.map(e => e.date)
      ];

      if (!dates.length) return;

      const nearest = dates.reduce((a, b) =>
        Math.abs(x(a) - pos) <= Math.abs(x(b) - pos) ? a : b
      );

      setSelected(nearest);
    }

    return h('article', {
      className: 'card',
      style: { marginTop: '16px' }
    },

      h('h2', null, 'Confronto peso ed alimentazione'),

      h('p', { className: 'muted tiny' },
        'Confronto delle misurazioni corporee con le calorie ' +
        'registrate nel diario. I due assi hanno unità diverse.'
      ),

      h('div', {
        style: {
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
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
            className: period === id ? 'cta' : 'ghost',
            onClick: () => {
              setPeriod(id);
              setSelected(null);
            }
          }, label)
        ),

        h('button', {
          type: 'button',
          className: 'ghost',
          onClick: () => {
            refresh(n => n + 1);
            setSelected(null);
          }
        }, 'Aggiorna dati')
      ),

      !visibleWeights.length && !days.length
        ? h('p', { className: 'empty' },
            'Nessuna registrazione nel periodo selezionato.'
          )
        : h('div', null,

            h('div', { style: { overflowX: 'auto' } },
              h('svg', {
                viewBox: `0 0 ${W} ${H}`,
                role: 'img',
                'aria-label': 'Confronto peso e calorie',
                style: {
                  display: 'block',
                  width: '100%',
                  minWidth: '350px',
                  touchAction: 'pan-y'
                },
                onPointerDown: selectNearest
              },

                ...[0, .25, .5, .75, 1].map(f => {
                  const y = T + plotH * (1 - f);

                  return h('g', { key: f },
                    h('line', {
                      x1: L, x2: W - R,
                      y1: y, y2: y,
                      stroke: 'currentColor',
                      opacity: .12
                    }),

                    h('text', {
                      x: L - 7, y: y + 4,
                      fontSize: 12,
                      textAnchor: 'end',
                      fill: '#168b78'
                    }, fmt(kgMin + (kgMax - kgMin) * f)),

                    h('text', {
                      x: W - R + 7, y: y + 4,
                      fontSize: 12,
                      fill: '#b67a2a'
                    }, fmt(kcalMax * f, 0))
                  );
                }),

                ...days.map(row => {
                  const barW = Math.max(
                    1.5,
                    Math.min(13, plotW / Math.max(1, span / DAY) * .7)
                  );

                  return h('rect', {
                    key: row.date,
                    x: x(row.date) - barW / 2,
                    y: calorieY(row.kcal),
                    width: barW,
                    height: T + plotH - calorieY(row.kcal),
                    rx: 1,
                    fill: row.knownGrams === row.totalGrams
                      ? '#b67a2a'
                      : '#e2ac6a',
                    opacity: .8
                  });
                }),

                h('path', {
                  d: weightPath,
                  fill: 'none',
                  stroke: '#168b78',
                  strokeWidth: 3,
                  strokeLinejoin: 'round',
                  strokeLinecap: 'round'
                }),

                ...visibleWeights.map((e, i) =>
                  h('circle', {
                    key: e.id || i,
                    cx: x(e.date),
                    cy: weightY(e.kg),
                    r: selected === e.date ? 6 : 3.5,
                    fill: '#168b78',
                    stroke: 'white',
                    strokeWidth: 1.5
                  })
                ),

                ...[0, .25, .5, .75, 1].map(f => {
                  const date = new Date(start + span * f);

                  return h('text', {
                    key: 'date-' + f,
                    x: L + plotW * f,
                    y: H - 19,
                    fill: 'currentColor',
                    fontSize: 12,
                    textAnchor: 'middle'
                  }, date.toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: '2-digit'
                  }));
                }),

                selected && h('line', {
                  x1: x(selected), x2: x(selected),
                  y1: T, y2: T + plotH,
                  stroke: 'currentColor',
                  opacity: .45,
                  strokeDasharray: '4 4'
                })
              )
            ),

            h('p', {
              className: 'muted tiny'
            }, '● Verde: peso (kg, asse sinistro) · ' +
               '■ Arancione: calorie (kcal, asse destro). ' +
               'Arancione chiaro: copertura nutrizionale incompleta.'),

            h('div', {
              role: 'status',
              style: { minHeight: '35px', fontSize: '14px' }
            },
              selected
                ? [
                    selected,
                    'Peso: ' + (
                      selectedWeights.length
                        ? selectedWeights.map(e =>
                            fmt(e.kg) + ' kg'
                          ).join(', ')
                        : 'N/D'
                    ),
                    'Calorie: ' + (
                      selectedCalories?.knownGrams
                        ? fmt(selectedCalories.kcal, 0) + ' kcal'
                        : 'N/D'
                    ),
                    selectedCalories &&
                      selectedCalories.knownGrams <
                      selectedCalories.totalGrams
                      ? 'Dati calorici incompleti'
                      : ''
                  ].filter(Boolean).join(' · ')
                : 'Tocca il grafico per consultare una data.'
            )
          ),

      h('p', { className: 'muted tiny' },
        'Il grafico mostra associazioni temporali, ' +
        'non dimostra un rapporto causale tra calorie e peso. ' +
        'Le date senza registrazioni non vengono inventate.'
      )
    );
  }

  root.NutriTraceWeightCalorieChart = WeightCalorieChart;
})(typeof globalThis !== 'undefined' ? globalThis : this);
