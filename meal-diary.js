
'use strict';

(function (root) {
  const h = root.React.createElement;

  const ICONS = {
    breakfast: '☕',
    'morning-snack': '🍎',
    lunch: '🍽️',
    'afternoon-snack': '🥜',
    dinner: '🌙'
  };

  function number(value) {
    if (value === null || value === undefined ||
        value === '') return null;

    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function fmt(value, digits = 1) {
    return Number(value).toLocaleString('it-IT', {
      maximumFractionDigits: digits
    });
  }

  function totals(logs, foods) {
    const byId = new Map(
      (foods || []).map(food => [food.id, food])
    );

    const result = {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      knownKcal: 0,
      count: 0
    };

    for (const log of logs || []) {
      const food = byId.get(log.foodId);
      const grams = number(log.grams);

      if (!food || grams === null) continue;

      const serving = number(food.servingGrams) || 100;
      const ratio = grams / serving;

      result.count++;

      for (const key of [
        'kcal', 'protein', 'carbs', 'fat'
      ]) {
        const value = number(food.label?.[key]);

        if (value === null) continue;

        result[key] += value * ratio;

        if (key === 'kcal') {
          result.knownKcal++;
        }
      }
    }

    return result;
  }

  function MealCard({
    meal,
    logs,
    foods,
    meals,
    onAdd,
    onAssign,
    onRemove
  }) {
    const data = totals(logs, foods);
    const complete =
      data.count > 0 &&
      data.knownKcal === data.count;

    const icon = ICONS[meal.id] || '🥗';

    return h('article', {
      className: 'card',
      style: {
        marginBottom: '12px',
        padding: '16px'
      }
    },

      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }
      },

        h('div', {
          style: {
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(40,145,110,.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '25px',
            flexShrink: 0
          }
        }, icon),

        h('div', {
          style: { flex: 1, minWidth: 0 }
        },
          h('h3', {
            style: { margin: '0 0 4px' }
          }, meal.name),

          h('small', {
            className: 'muted'
          },
            logs.length
              ? `${logs.length} alimenti · ` +
                `${fmt(data.kcal, 0)} kcal` +
                (complete ? '' : ' · dati parziali')
              : 'Nessun alimento registrato'
          )
        ),

        h('button', {
          type: 'button',
          className: 'cta',
          title: `Aggiungi alimento a ${meal.name}`,
          'aria-label':
            `Aggiungi alimento a ${meal.name}`,
          onClick: () => onAdd(meal.id),
          style: {
            borderRadius: '50%',
            width: '42px',
            height: '42px',
            padding: 0,
            fontSize: '24px',
            flexShrink: 0
          }
        }, '+')
      ),

      logs.length > 0
        ? h('details', {
            style: { marginTop: '14px' }
          },

            h('summary', null,
              'Mostra alimenti e nutrienti'
            ),

            h('div', {
              style: {
                display: 'flex',
                gap: '14px',
                flexWrap: 'wrap',
                marginTop: '12px',
                marginBottom: '12px'
              }
            },
              ...[
                ['Proteine', data.protein],
                ['Carboidrati', data.carbs],
                ['Grassi', data.fat]
              ].map(([label, value]) =>
                h('div', { key: label },
                  h('small', {
                    className: 'muted'
                  }, label),
                  h('strong', {
                    style: {
                      display: 'block',
                      marginTop: '4px'
                    }
                  }, `${fmt(value)} g`)
                )
              )
            ),

            ...logs.map(log => {
              const food = foods.find(
                item => item.id === log.foodId
              );

              const amount = number(log.grams);
              const base = number(
                food?.servingGrams
              ) || 100;

              const kcal = number(
                food?.label?.kcal
              );

              const energy =
                kcal !== null && amount !== null
                  ? fmt(kcal * amount / base, 0)
                  : 'N/D';

              return h('div', {
                key: log.id,
                style: {
                  padding: '12px 0',
                  borderTop:
                    '1px solid rgba(128,128,128,.18)'
                }
              },

                h('div', {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px'
                  }
                },
                  h('div', null,
                    h('strong', null,
                      food?.name || 'Alimento non trovato'
                    ),

                    h('small', {
                      className: 'muted',
                      style: { display: 'block' }
                    },
                      `${amount === null
                        ? 'Peso N/D'
                        : `${fmt(amount)} g`} · ` +
                      `${energy} kcal`
                    )
                  ),

                  h('button', {
                    type: 'button',
                    className: 'ghost danger',
                    onClick: () => onRemove(log.id)
                  }, 'Rimuovi')
                ),

                h('label', {
                  style: {
                    display: 'block',
                    marginTop: '10px'
                  }
                },
                  h('small', {
                    className: 'muted'
                  }, 'Sposta in un altro pasto'),

                  h('select', {
                    value: log.mealId || '',
                    onChange: event =>
                      onAssign(
                        log.id,
                        event.target.value || null
                      ),
                    style: {
                      display: 'block',
                      width: '100%',
                      marginTop: '5px'
                    }
                  },

                    h('option', {
                      value: ''
                    }, 'Non assegnato'),

                    ...meals.map(target =>
                      h('option', {
                        key: target.id,
                        value: target.id
                      }, target.name)
                    )
                  )
                )
              );
            })
          )
        : null
    );
  }

  function MealDiary({
    meals = [],
    logs = [],
    foods = [],
    onAdd = () => {},
    onAssign = () => {},
    onRemove = () => {},
    onConfigure = () => {}
  }) {
    const validIds = new Set(
      meals.map(meal => meal.id)
    );

    const unassigned = logs.filter(log =>
      !log.mealId || !validIds.has(log.mealId)
    );

    const groups = [
      ...meals.map(meal => ({
        meal,
        logs: logs.filter(log =>
          log.mealId === meal.id
        )
      }))
    ];

    if (unassigned.length) {
      groups.push({
        meal: {
          id: '__unassigned__',
          name: 'Senza pasto'
        },
        logs: unassigned
      });
    }

    return h('section', {
      className: 'nutritraceMealDiary'
    },

      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '14px'
        }
      },

        h('div', null,
          h('h2', {
            style: { margin: 0 }
          }, 'I tuoi pasti'),

          h('small', {
            className: 'muted'
          }, 'Diario organizzato per pasto')
        ),

        h('button', {
          type: 'button',
          className: 'ghost',
          onClick: onConfigure
        }, '⚙️ Gestisci')
      ),

      ...groups.map(group =>
        h(MealCard, {
          key: group.meal.id,
          meal: group.meal,
          logs: group.logs,
          foods,
          meals,
          onAdd,
          onAssign,
          onRemove
        })
      ),

      !groups.length
        ? h('p', {
            className: 'muted'
          }, 'Aggiungi un pasto per iniziare.')
        : null
    );
  }

  root.NutriTraceMealDiary = MealDiary;

  if (typeof module !== 'undefined' &&
      module.exports) {
    module.exports = MealDiary;
  }

})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this
);
