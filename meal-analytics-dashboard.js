'use strict';

(function (root) {
  const React = root.React;
  const h = React.createElement;

  const CORE = [
    ['kcal', 'Energia', 'kcal'],
    ['protein', 'Proteine', 'g'],
    ['carbs', 'Carboidrati', 'g'],
    ['fat', 'Grassi', 'g'],
    ['sugar', 'Zuccheri', 'g'],
    ['saturatedFat', 'Grassi saturi', 'g'],
    ['fiber', 'Fibre', 'g'],
    ['salt', 'Sale', 'g']
  ];

  const COLORS = [
    '#158a78', '#456dcc', '#b66d26', '#895bc7',
    '#d35c75', '#498caa', '#85872a', '#666666'
  ];

  function number(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function fmt(value, digits = 1) {
    return value === null || value === undefined
      ? 'N/D'
      : Number(value).toLocaleString('it-IT', {
          maximumFractionDigits: digits
        });
  }

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value;
  }

  function addDays(value, amount) {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  function countDays(from, to) {
    return Math.round(
      (
        new Date(`${to}T12:00:00Z`) -
        new Date(`${from}T12:00:00Z`)
      ) / 86400000
    ) + 1;
  }

  function weekKey(value) {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(
      date.getUTCDate() - (date.getUTCDay() + 6) % 7
    );
    return date.toISOString().slice(0, 10);
  }

  function bucketKey(value, grouping) {
    if (grouping === 'month') return value.slice(0, 7);
    if (grouping === 'week') return weekKey(value);
    return value;
  }

  function shortDate(value) {
    if (/^\d{4}-\d{2}$/.test(value)) {
      return value.slice(5) + '/' + value.slice(0, 4);
    }
    return value.slice(8) + '/' + value.slice(5, 7);
  }

  function metricCatalog(foods, goals) {
    const output = CORE.map(([id, name, unit]) => ({
      id, name, unit, macro: true
    }));

    const micros = new Map();

    for (const goal of goals || []) {
      if (
        goal.name &&
        goal.unit &&
        !CORE.some(item => item[0] === goal.id)
      ) {
        micros.set(goal.name, {
          id: goal.name,
          name: goal.name,
          unit: goal.unit
        });
      }
    }

    for (const food of foods || []) {
      for (const nutrient of food.nutrients || []) {
        if (!nutrient.name || micros.has(nutrient.name)) continue;

        micros.set(nutrient.name, {
          id: nutrient.name,
          name: nutrient.name,
          unit: nutrient.unit || 'mg'
        });
      }
    }

    return [
      ...output,
      ...[...micros.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'it')
      )
    ];
  }

  function convert(value, from, to) {
    const factors = {
      g: 1000,
      mg: 1,
      'µg': 0.001,
      ug: 0.001,
      mcg: 0.001
    };

    if (!(from in factors) || !(to in factors)) return null;

    return value * factors[from] / factors[to];
  }

  function foodValue(food, metric) {
    if (metric.macro) {
      return number(food.label?.[metric.id]);
    }

    let total = 0;
    let found = false;

    for (const nutrient of food.nutrients || []) {
      if (nutrient.name !== metric.id) continue;

      const amount = number(nutrient.amount);
      if (amount === null) continue;

      const converted = convert(
        amount,
        nutrient.unit,
        metric.unit
      );

      if (converted === null) continue;

      total += converted;
      found = true;
    }

    return found ? total : null;
  }

  function calculateDays(
    logs, foods, mealId, metric, from, to, validMealIds
  ) {
    const foodMap = new Map(
      foods.map(food => [food.id, food])
    );
    const results = new Map();

    for (const log of logs) {
      if (log.date < from || log.date > to) continue;

      const resolvedMealId = validMealIds.has(log.mealId)
        ? log.mealId
        : '__unassigned__';

      if (
        mealId !== '__all__' &&
        resolvedMealId !== mealId
      ) continue;

      const grams = number(log.grams);
      if (grams === null || grams === 0) continue;

      if (!results.has(log.date)) {
        results.set(log.date, {
          date: log.date,
          value: 0,
          totalWeight: 0,
          knownWeight: 0,
          entries: 0
        });
      }

      const row = results.get(log.date);
      row.totalWeight += grams;
      row.entries++;

      const food = foodMap.get(log.foodId);
      if (!food) continue;

      const base = number(food.servingGrams) || 100;
      const value = foodValue(food, metric);

      if (value !== null) {
        row.value += value * grams / base;
        row.knownWeight += grams;
      }
    }

    return results;
  }

  function buckets(from, to, grouping) {
    const keys = new Set();
    let date = from;

    for (let i = 0; i < countDays(from, to); i++) {
      keys.add(bucketKey(date, grouping));
      date = addDays(date, 1);
    }

    return [...keys];
  }

  function buildSeries(
    logs, foods, mealId, metric,
    from, to, grouping, validMealIds
  ) {
    const days = calculateDays(
      logs, foods, mealId, metric,
      from, to, validMealIds
    );

    return buckets(from, to, grouping).map(key => {
      const rows = [...days.values()].filter(
        row => bucketKey(row.date, grouping) === key
      );

      const knownDays = rows.filter(
        row => row.knownWeight > 0
      );

      const totalWeight = rows.reduce(
        (sum, row) => sum + row.totalWeight, 0
      );

      const knownWeight = rows.reduce(
        (sum, row) => sum + row.knownWeight, 0
      );

      return {
        key,
        value: knownDays.length
          ? rows.reduce((sum, row) => sum + row.value, 0) /
            knownDays.length
          : null,
        coverage: totalWeight
          ? knownWeight / totalWeight
          : null,
        recordedDays: rows.length,
        knownDays: knownDays.length
      };
    });
  }

  function InteractiveChart({
    labels, series, chartType, comparisonMode, limit
  }) {
    const [active, setActive] = React.useState(null);

    const W = 880;
    const H = 326;
    const L = 56;
    const R = comparisonMode === 'metrics' ? 60 : 18;
    const T = 22;
    const B = 57;
    const plotWidth = W - L - R;
    const plotHeight = H - T - B;

    const allValues = series.flatMap(item =>
      item.data.map(point => point.value)
        .filter(value => value !== null)
    );

    const axisMax = (values, target) =>
      Math.max(1, target || 0, ...values) * 1.12;

    const maximums = comparisonMode === 'metrics'
      ? series.map(item => axisMax(
          item.data.map(point => point.value)
            .filter(value => value !== null),
          null
        ))
      : [axisMax(allValues, limit)];

    const y = (value, index = 0) =>
      T + plotHeight -
      value / maximums[
        comparisonMode === 'metrics' ? index : 0
      ] * plotHeight;

    const step = plotWidth / Math.max(labels.length, 1);
    const x = index => L + (index + 0.5) * step;

    function pickPoint(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const pos = (event.clientX - rect.left) /
        rect.width * W;

      setActive(Math.max(
        0,
        Math.min(
          labels.length - 1,
          Math.floor((pos - L) / step)
        )
      ));
    }

    return h('div', null,

      h('div', {
        style: { overflowX: 'auto', touchAction: 'pan-y' }
      },

        h('svg', {
          viewBox: `0 0 ${W} ${H}`,
          role: 'img',
          'aria-label': chartType === 'line'
            ? 'Grafico a linee interattivo'
            : 'Grafico a barre verticali interattivo',
          style: {
            width: '100%',
            minWidth: '360px',
            display: 'block',
            touchAction: 'pan-y'
          },
          onPointerDown: pickPoint,
          onPointerMove: event => {
            if (event.pointerType === 'mouse') {
              pickPoint(event);
            }
          },
          onPointerLeave: () => setActive(null)
        },

          ...[0, .25, .5, .75, 1].map(fraction =>
            h('g', { key: fraction },
              h('line', {
                x1: L, x2: W - R,
                y1: T + plotHeight * (1 - fraction),
                y2: T + plotHeight * (1 - fraction),
                stroke: 'currentColor',
                opacity: .12
              }),
              h('text', {
                x: L - 8,
                y: T + plotHeight * (1 - fraction) + 5,
                fill: 'currentColor',
                opacity: .7,
                fontSize: 12,
                textAnchor: 'end'
              }, fmt(maximums[0] * fraction, 0))
            )
          ),

          ...(comparisonMode === 'metrics'
            ? [0, .5, 1].map(fraction =>
                h('text', {
                  key: 'right-' + fraction,
                  x: W - R + 9,
                  y: T + plotHeight * (1 - fraction) + 5,
                  fill: 'currentColor',
                  opacity: .7,
                  fontSize: 12
                }, fmt(maximums[1] * fraction, 0))
              )
            : []),

          limit !== null &&
          comparisonMode !== 'metrics' &&
          h('g', null,
            h('line', {
              x1: L, x2: W - R,
              y1: y(limit), y2: y(limit),
              stroke: '#c44343',
              strokeWidth: 2,
              strokeDasharray: '7 5'
            }),
            h('text', {
              x: W - R - 3,
              y: y(limit) - 7,
              fill: '#c44343',
              fontSize: 12,
              textAnchor: 'end'
            }, `Limite ${fmt(limit)}`)
          ),

          ...labels.map((label, index) => {
            const every = Math.max(
              1,
              Math.ceil(labels.length / 11)
            );

            if (
              index % every !== 0 &&
              index !== labels.length - 1
            ) return null;

            return h('text', {
              key: label + index,
              x: x(index),
              y: H - 26,
              textAnchor: 'middle',
              fill: 'currentColor',
              opacity: .75,
              fontSize: 12
            }, shortDate(label));
          }),

          ...series.flatMap((item, seriesIndex) => {
            const elements = [];

            if (chartType === 'bar') {
              item.data.forEach((point, index) => {
                if (point.value === null) return;

                const width = Math.min(
                  38,
                  step * .76 / series.length
                );

                const start = x(index) -
                  Math.min(step * .76, 38 * series.length) / 2 +
                  seriesIndex * width;

                const exceeded = limit !== null &&
                  comparisonMode !== 'metrics' &&
                  point.value > limit;

                elements.push(h('rect', {
                  key: `${seriesIndex}-${index}`,
                  x: start,
                  y: y(point.value, seriesIndex),
                  width: Math.max(2, width - 2),
                  height: Math.max(
                    0,
                    T + plotHeight - y(point.value, seriesIndex)
                  ),
                  rx: 3,
                  fill: exceeded ? '#c44343' : item.color
                }));
              });

            } else {
              let path = '';
              let connected = false;

              item.data.forEach((point, index) => {
                if (point.value === null) {
                  connected = false;
                  return;
                }

                path += (
                  connected ? 'L' : 'M'
                ) + x(index) + ' ' +
                  y(point.value, seriesIndex) + ' ';

                connected = true;
              });

              elements.push(h('path', {
                key: 'line-' + seriesIndex,
                d: path,
                fill: 'none',
                stroke: item.color,
                strokeWidth: 2.8,
                strokeLinejoin: 'round',
                strokeLinecap: 'round'
              }));

              item.data.forEach((point, index) => {
                if (point.value === null) return;

                const exceeded = limit !== null &&
                  comparisonMode !== 'metrics' &&
                  point.value > limit;

                elements.push(h('circle', {
                  key: `point-${seriesIndex}-${index}`,
                  cx: x(index),
                  cy: y(point.value, seriesIndex),
                  r: active === index ? 6 : 3.4,
                  fill: exceeded
                    ? '#c44343'
                    : item.color,
                  stroke: 'white',
                  strokeWidth: 1
                }));
              });
            }

            return elements;
          }),

          active !== null && h('line', {
            x1: x(active),
            x2: x(active),
            y1: T,
            y2: T + plotHeight,
            stroke: 'currentColor',
            opacity: .4,
            strokeDasharray: '3 4'
          })
        )
      ),

      h('div', {
        style: {
          display: 'flex',
          gap: '14px',
          flexWrap: 'wrap',
          margin: '6px 0 10px'
        }
      },
        ...series.map((item, index) =>
          h('span', {
            key: index,
            style: {
              color: item.color,
              fontWeight: 600,
              fontSize: '13px'
            }
          }, `● ${item.name} (${item.unit})`)
        )
      ),

      h('div', {
        className: 'muted',
        role: 'status',
        style: {
          minHeight: '38px',
          fontSize: '13px'
        }
      },

        active === null
          ? 'Tocca un punto o una barra per vedere i dettagli.'
          : `${labels[active]} · ` +
            series.map(item => {
              const point = item.data[active];

              return `${item.name}: ` +
                `${fmt(point?.value, 2)} ${item.unit}` +
                (
                  point?.coverage !== null &&
                  point?.coverage < 1
                    ? ` (copertura ${
                        fmt(point.coverage * 100, 0)
                      }%)`
                    : ''
                );
            }).join(' · ')
      )
    );
  }

  function Dashboard({
    logs = [],
    foods = [],
    meals = [],
    goals = [],
    from,
    to
  }) {
    const [chartType, setChartType] = React.useState('line');
    const [mode, setMode] = React.useState('meals');
    const [metricId, setMetricId] = React.useState('kcal');
    const [secondId, setSecondId] = React.useState('protein');
    const [grouping, setGrouping] = React.useState('day');
    const [chosen, setChosen] = React.useState([]);
    const [limitText, setLimitText] = React.useState('');
    const [showTable, setShowTable] = React.useState(false);

    const catalog = React.useMemo(
      () => metricCatalog(foods, goals),
      [foods, goals]
    );

    const byId = new Map(
      catalog.map(item => [item.id, item])
    );

    const metric = byId.get(metricId) || catalog[0];
    const secondMetric = byId.get(secondId) || catalog[1];

    const validIds = new Set(
      meals.map(meal => meal.id)
    );

    const hasUnassigned = logs.some(
      log => !validIds.has(log.mealId)
    );

    const availableMeals = [
      { id: '__all__', name: 'Totale giornata' },
      ...meals,
      ...(hasUnassigned
        ? [{ id: '__unassigned__', name: 'Senza pasto' }]
        : [])
    ];

    const availableIds = availableMeals.map(
      meal => meal.id
    );

    const selectedIds = chosen.length
      ? chosen.filter(id => availableIds.includes(id))
      : availableIds.filter(id => id !== '__all__');

    const validRange =
      validDate(from) && validDate(to) && from <= to;

    const previousEnd = validRange
      ? addDays(from, -1)
      : '';

    const previousStart = validRange
      ? addDays(
          previousEnd,
          -countDays(from, to) + 1
        )
      : '';

    const limit = limitText.trim() === ''
      ? null
      : number(limitText);

    const data = React.useMemo(() => {
      if (!validRange) return null;
      if (countDays(from, to) > 3660) return null;

      const labels = buckets(from, to, grouping);
      const series = [];

      if (mode === 'metrics') {
        const id = selectedIds[0];

        if (id) {
          [metric, secondMetric].forEach((item, index) => {
            series.push({
              name: (
                availableMeals.find(meal => meal.id === id)
                  ?.name || id
              ) + ' · ' + item.name,
              unit: item.unit,
              color: COLORS[index],
              data: buildSeries(
                logs, foods, id, item,
                from, to, grouping, validIds
              )
            });
          });
        }

      } else if (mode === 'periods') {
        const id = selectedIds[0];

        if (id) {
          series.push({
            name: 'Periodo selezionato',
            unit: metric.unit,
            color: COLORS[0],
            data: buildSeries(
              logs, foods, id, metric,
              from, to, grouping, validIds
            )
          });

          const previous = buildSeries(
            logs, foods, id, metric,
            previousStart, previousEnd,
            grouping, validIds
          );

          series.push({
            name: 'Periodo precedente',
            unit: metric.unit,
            color: COLORS[1],
            data: labels.map((_, index) =>
              previous[index] || {
                value: null,
                coverage: null
              }
            )
          });
        }

      } else {
        selectedIds.forEach((id, index) => {
          series.push({
            name: availableMeals.find(
              meal => meal.id === id
            )?.name || id,
            unit: metric.unit,
            color: COLORS[index % COLORS.length],
            data: buildSeries(
              logs, foods, id, metric,
              from, to, grouping, validIds
            )
          });
        });
      }

      return { labels, series };

    }, [
      logs, foods, meals,
      selectedIds.join('|'),
      mode, metricId, secondId,
      from, to, grouping, validRange
    ]);

    const option = (id, name) =>
      h('option', { key: id, value: id }, name);

    function selectControl(label, value, onChange, options) {
      return h('label', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          minWidth: '145px',
          flex: '1 1 160px'
        }
      },
        h('small', { style: { fontWeight: 600 } }, label),
        h('select', {
          value,
          onChange: event => onChange(event.target.value),
          style: { width: '100%' }
        }, ...options)
      );
    }

    const rows = data
      ? data.labels.map((label, index) => ({
          label,
          cells: data.series.map(
            item => item.data[index] || {
              value: null,
              coverage: null
            }
          )
        }))
      : [];

    return h('article', {
      className: 'card',
      style: {
        padding: '16px',
        marginBottom: '18px'
      }
    },

      h('h2', null, 'Esplora i pasti'),

      h('p', { className: 'muted tiny' },
        'Seleziona dati, pasti, grafico e intervallo. ' +
        'Le medie utilizzano i giorni con dati disponibili. ' +
        'N/D non equivale a zero.'
      ),

      h('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          margin: '15px 0'
        }
      },

        selectControl(
          'Visualizzazione',
          chartType,
          setChartType,
          [
            option('line', 'Linee interattive'),
            option('bar', 'Barre verticali')
          ]
        ),

        selectControl(
          'Tipo di analisi',
          mode,
          value => {
            setMode(value);

            if (
              value !== 'meals' &&
              selectedIds.length !== 1
            ) {
              setChosen([
                selectedIds[0] || availableIds[0]
              ]);
            }
          },
          [
            option('meals', 'Confronto fra pasti'),
            option('periods', 'Stessa metrica, due periodi'),
            option('metrics', 'Due metriche, stesso periodo')
          ]
        ),

        selectControl(
          'Metrica',
          metricId,
          setMetricId,
          catalog.map(item =>
            option(
              item.id,
              `${item.name} (${item.unit})`
            )
          )
        ),

        mode === 'metrics' && selectControl(
          'Seconda metrica',
          secondId,
          setSecondId,
          catalog.filter(item => item.id !== metricId)
            .map(item =>
              option(item.id, `${item.name} (${item.unit})`)
            )
        ),

        selectControl(
          'Raggruppamento',
          grouping,
          setGrouping,
          [
            option('day', 'Giornaliero'),
            option('week', 'Settimanale'),
            option('month', 'Mensile')
          ]
        )
      ),

      h('div', { style: { margin: '12px 0' } },

        h('strong', null,
          mode === 'meals'
            ? 'Pasti da confrontare'
            : 'Pasto da analizzare'
        ),

        h('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '9px'
          }
        },

          ...availableMeals.map(meal =>
            h('label', {
              key: meal.id,
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '13px'
              }
            },

              h('input', {
                type: mode === 'meals'
                  ? 'checkbox'
                  : 'radio',
                name: 'meal-analysis-choice',
                checked: selectedIds.includes(meal.id),

                onChange: () => {
                  if (mode !== 'meals') {
                    setChosen([meal.id]);
                    return;
                  }

                  setChosen(previous => {
                    const current = previous.length
                      ? previous
                      : availableIds.filter(
                          id => id !== '__all__'
                        );

                    const next = current.includes(meal.id)
                      ? current.filter(id => id !== meal.id)
                      : [...current, meal.id];

                    return next.length ? next : current;
                  });
                }
              }),

              meal.name
            )
          )
        )
      ),

      mode !== 'metrics' &&
      selectedIds.length === 1 &&
      h('label', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          margin: '12px 0'
        }
      },

        'Limite massimo personalizzato',

        h('input', {
          type: 'number',
          min: 0,
          step: 'any',
          value: limitText,
          placeholder: 'Nessun limite',
          onChange: event =>
            setLimitText(event.target.value),
          style: { maxWidth: '160px' }
        }),

        h('small', {
          className: 'muted'
        }, `${metric.unit} per giorno con dati. ` +
           'Superamenti evidenziati in rosso.')
      ),

      mode === 'metrics' &&
      h('p', { className: 'muted tiny' },
        'Le due metriche utilizzano scale indipendenti: ' +
        'asse sinistro e asse destro.'
      ),

      !data
        ? h('p', { className: 'errorText' },
            'Intervallo date non valido o troppo lungo.'
          )
        : !data.series.length
          ? h('p', { className: 'empty' },
              'Seleziona almeno un pasto.'
            )
          : h(InteractiveChart, {
              labels: data.labels,
              series: data.series,
              chartType,
              comparisonMode: mode,
              limit: (
                mode === 'metrics' ||
                selectedIds.length !== 1
              ) ? null : limit
            }),
data && data.series.length > 0 && h('div', {
  style: { margin: '18px 0', overflowX: 'auto' }
},
  h('h3', null, 'Statistiche delle serie selezionate'),

  h('p', { className: 'muted tiny' },
    'Totali rilevati e medie dei soli giorni registrati ' +
    'con il nutriente disponibile. Se la copertura è ' +
    'inferiore al 100%, il totale è parziale. ' +
    'Il raggruppamento del grafico non altera questi calcoli.'
  ),

  h('table', {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '13px'
    }
  },

    h('thead', null,
      h('tr', null,
        ...[
          'Serie',
          'Totale rilevato',
          'Media/giorno',
          'Min/giorno',
          'Max/giorno',
          'Giorni con dati',
          'Copertura'
        ].map(label =>
          h('th', {
            key: label,
            style: {
              padding: '8px',
              textAlign: 'right',
              whiteSpace: 'nowrap'
            }
          }, label)
        )
      )
    ),

    h('tbody', null,
      ...data.series.map((item, index) => {
        const activeMetric = mode === 'metrics'
          ? (index === 0 ? metric : secondMetric)
          : metric;

        const activeMeal = mode === 'meals'
          ? selectedIds[index]
          : selectedIds[0];

        const startDate = mode === 'periods' && index === 1
          ? previousStart
          : from;

        const endDate = mode === 'periods' && index === 1
          ? previousEnd
          : to;

        const daily = [...calculateDays(
          logs,
          foods,
          activeMeal,
          activeMetric,
          startDate,
          endDate,
          validIds
        ).values()];

        const known = daily.filter(
          row => row.knownWeight > 0
        );

        const total = known.reduce(
          (sum, row) => sum + row.value,
          0
        );

        const totalWeight = daily.reduce(
          (sum, row) => sum + row.totalWeight,
          0
        );

        const knownWeight = daily.reduce(
          (sum, row) => sum + row.knownWeight,
          0
        );

        const coverage = totalWeight > 0
          ? knownWeight / totalWeight * 100
          : null;

        const values = [
          item.name,

          known.length
            ? fmt(total, 2) + ' ' + item.unit
            : 'N/D',

          known.length
            ? fmt(total / known.length, 2) + ' ' + item.unit
            : 'N/D',

          known.length
            ? fmt(
                Math.min(...known.map(row => row.value)),
                2
              ) + ' ' + item.unit
            : 'N/D',

          known.length
            ? fmt(
                Math.max(...known.map(row => row.value)),
                2
              ) + ' ' + item.unit
            : 'N/D',

          known.length + ' / ' + daily.length,

          coverage === null
            ? 'N/D'
            : fmt(coverage, 0) + '%'
        ];

        return h('tr', { key: index },
          ...values.map((value, column) =>
            h('td', {
              key: column,
              style: {
                padding: '9px 8px',
                textAlign: 'right',
                borderTop: '1px solid #ddd',
                whiteSpace: 'nowrap'
              }
            }, value)
          )
        );
      })
    )
  )
),
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          margin: '12px 0'
        }
      },

        h('button', {
          type: 'button',
          className: 'ghost',
          onClick: () =>
            setShowTable(value => !value)
        },
          showTable
            ? 'Nascondi tabella'
            : 'Mostra tabella dettagliata'
        ),

        h('small', { className: 'muted' },
          `${from} → ${to}`
        )
      ),

      showTable && data &&
      h('div', { style: { overflowX: 'auto' } },

        h('table', {
          style: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }
        },

          h('thead', null,
            h('tr', null,

              h('th', {
                style: {
                  textAlign: 'left',
                  padding: '8px'
                }
              }, 'Periodo'),

              ...data.series.map((item, index) =>
                h('th', {
                  key: index,
                  style: {
                    textAlign: 'right',
                    padding: '8px'
                  }
                }, `${item.name} (${item.unit})`)
              )
            )
          ),

          h('tbody', null,
            ...rows.map((row, index) =>
              h('tr', { key: index },

                h('td', {
                  style: {
                    padding: '8px',
                    borderTop: '1px solid #ddd'
                  }
                }, row.label),

                ...row.cells.map((cell, j) =>
                  h('td', {
                    key: j,
                    style: {
                      padding: '8px',
                      textAlign: 'right',
                      borderTop: '1px solid #ddd'
                    }
                  },
                    fmt(cell.value, 2) +
                    (
                      cell.coverage !== null &&
                      cell.coverage < 1
                        ? ` · ${
                            fmt(cell.coverage * 100, 0)
                          }% dati`
                        : ''
                    )
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  root.NutriTraceMealAnalyticsDashboard = Dashboard;

})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this
);
