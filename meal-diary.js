'use strict';

(function (root) {
  const h = root.React.createElement;

  const ICONS = {
    breakfast: '☕',
    'morning-snack': '🍎',
    lunch: '🍽️',
    'afternoon-snack': '🥜',
    dinner: '🌙',
    extras: '🍪'
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
      foods.map(food => [food.id, food])
    );

    const result = {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      knownKcal: 0,
      count: 0
    };

    for (const log of logs) {
      const food = byId.get(log.foodId);
      const grams = number(log.grams);

      if (!food || grams === null) continue;

      const serving = number(food.servingGrams) || 100;
      const ratio = grams / serving;

      result.count++;

      for (const key of ['kcal', 'protein', 'carbs', 'fat']) {
        const value = number(food.label?.[key]);
        if (value === null) continue;

        result[key] += value * ratio;

        if (key === 'kcal') result.knownKcal++;
      }
    }

    return result;
  }

  function MealCard({
    meal,
    logs,
    foods,
    meals,
    favorites,
    onAdd,
    onAssign,
    onRemove,
    onAddFavorite,
    onRemoveFavorite,
    onQuickFavorite,
    onCopyYesterday
  }) {
    const data = totals(logs, foods);
    const isUnassigned = meal.id === '__unassigned__';

    const mealFavorites = favorites.filter(
      item => item.mealId === meal.id
    );

    const complete = data.count > 0 &&
      data.knownKcal === data.count;

    return h('article', {
      className: 'card',
      style: {
        padding: '16px',
        marginBottom: '12px'
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
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'rgba(40,145,110,.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0
          }
        }, ICONS[meal.id] || '🥗'),

        h('div', {
          style: { flex: 1, minWidth: 0 }
        },
          h('h3', {
            style: { margin: '0 0 4px' }
          }, meal.name),

          h('small', { className: 'muted' },
            logs.length
              ? `${logs.length} alimenti · ` +
                `${fmt(data.kcal, 0)} kcal` +
                (complete ? '' : ' · dati parziali')
              : 'Nessun alimento registrato'
          )
        ),

        !isUnassigned && h('button', {
          type: 'button',
          className: 'cta',
          title: `Aggiungi a ${meal.name}`,
          'aria-label': `Aggiungi a ${meal.name}`,
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

      !isUnassigned && h('div', {
        style: { marginTop: '14px' }
      },

        mealFavorites.length > 0 && h('div', null,
          h('small', {
            className: 'muted',
            style: { display: 'block', marginBottom: '8px' }
          }, 'Preferiti di questo pasto'),

          h('div', {
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }
          },

            ...mealFavorites.map(favorite => {
              const food = foods.find(
                f => f.id === favorite.foodId
              );

              if (!food) return null;

              const name = favorite.label ||
                food.name;

              return h('div', {
                key: favorite.id,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '12px',
                  background: 'rgba(40,145,110,.08)',
                  padding: '4px'
                }
              },

                h('button', {
                  type: 'button',
                  className: 'ghost',
                  title: `Aggiungi ${name}`,
                  onClick: () => onQuickFavorite(favorite)
               }, `+ ${fmt(favorite.quantity ?? favorite.grams)} ${favorite.unit || 'g'} ${name}`),

                h('button', {
                  type: 'button',
                  className: 'ghost danger',
                  title: `Rimuovi ${name} dai preferiti`,
                  'aria-label': 'Rimuovi preferito',
                  onClick: () => onRemoveFavorite(favorite.id)
                }, '×')
              );
            })
          )
        ),

        h('button', {
          type: 'button',
          className: 'ghost',
          style: { marginTop: '10px' },
          onClick: () => onCopyYesterday(meal.id)
        }, '📋 Copia ' + meal.name.toLowerCase() + ' di ieri')
      ),

      logs.length > 0 && h('details', {
        style: { marginTop: '14px' }
      },

        h('summary', null, 'Mostra alimenti e nutrienti'),

        h('div', {
          style: {
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            margin: '12px 0'
          }
        },

          ...[
            ['Proteine', data.protein],
            ['Carboidrati', data.carbs],
            ['Grassi', data.fat]
          ].map(([label, value]) =>
            h('div', { key: label },
              h('small', {
                className: 'muted',
                style: { display: 'block' }
              }, label),

              h('strong', null, `${fmt(value)} g`)
            )
          )
        ),

        ...logs.map(log => {
          const food = foods.find(
            f => f.id === log.foodId
          );

          const grams = number(log.grams);
          const serving = number(food?.servingGrams) || 100;
          const kcal = number(food?.label?.kcal);

          const energy = kcal !== null && grams !== null
            ? `${fmt(kcal * grams / serving, 0)} kcal`
            : 'N/D kcal';

          return h('div', {
            key: log.id,
            style: {
              padding: '12px 0',
              borderTop: '1px solid rgba(128,128,128,.18)'
            }
          },

            h('div', {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                alignItems: 'center'
              }
            },

              h('div', {
                style: { flex: 1 }
              },
                h('strong', null,
                  food?.name || 'Alimento non trovato'
                ),

                h('small', {
                  className: 'muted',
                  style: { display: 'block' }
                },
                  `${grams === null ? 'N/D' : fmt(grams)} g · ${energy}`
                )
              ),

              h('button', {
                type: 'button',
                className: 'ghost danger',
                onClick: () => onRemove(log.id)
              }, 'Rimuovi')
            ),

            h('div', {
              style: {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                marginTop: '10px'
              }
            },

              !isUnassigned && food && h('button', {
                type: 'button',
                className: 'ghost',
                onClick: () =>
                  onAddFavorite(meal.id, log.id)
              }, '☆ Salva come preferito'),

              h('label', {
                style: { flex: '1 1 160px' }
              },
                h('small', {
                  className: 'muted',
                  style: { display: 'block' }
                }, 'Sposta nel pasto'),

                h('select', {
                  value: log.mealId || '',
                  onChange: event =>
                    onAssign(
                      log.id,
                      event.target.value || null
                    ),
                  style: { width: '100%' }
                },

                  h('option', { value: '' }, 'Senza pasto'),

                  ...meals.map(target =>
                    h('option', {
                      key: target.id,
                      value: target.id
                    }, target.name)
                  )
                )
              )
            )
          );
        })
      )
    );
  }

  function MealDiary({
    meals = [],
    logs = [],
    foods = [],
    favorites = [],
    onAdd = () => {},
    onAssign = () => {},
    onRemove = () => {},
    onConfigure = () => {},
    onAddFavorite = () => {},
    onRemoveFavorite = () => {},
    onQuickFavorite = () => {},
    onCopyYesterday = () => {}
  }) {
    const validIds = new Set(
      meals.map(meal => meal.id)
    );

    const unassigned = logs.filter(
      log => !log.mealId || !validIds.has(log.mealId)
    );

    const groups = meals.map(meal => ({
      meal,
      logs: logs.filter(log => log.mealId === meal.id)
    }));

    if (unassigned.length) {
      groups.push({
        meal: {
          id: '__unassigned__',
          name: 'Senza pasto'
        },
        logs: unassigned
      });
    }

    const dayTotals = totals(logs, foods);

    return h('section', {
      className: 'nutritraceMealDiary'
    },

      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: '14px'
        }
      },

        h('div', null,
          h('h2', {
            style: { margin: 0 }
          }, 'I tuoi pasti'),

          h('small', {
            className: 'muted'
          }, 'Preferiti, copia pasto e diario')
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
          favorites,
          onAdd,
          onAssign,
          onRemove,
          onAddFavorite,
          onRemoveFavorite,
          onQuickFavorite,
          onCopyYesterday
        })
      ),


      h('article', {
        className: 'card',
        style: { padding: '12px 16px', marginTop: '12px' }
      },
        h('h3', { style: { marginBottom: '6px' } },
          `Alimenti del giorno (${logs.length})`
        ),

        logs.length === 0
          ? h('p', {
              className: 'muted tiny',
              style: { margin: 0 }
            }, 'Nessun alimento registrato.')

          : h('div', null,
              ...logs.map(log => {
                const food = foods.find(f => f.id === log.foodId);
                const meal = meals.find(m => m.id === log.mealId);
                const grams = number(log.grams);
                const serving = number(food?.servingGrams) || 100;
                const ratio = grams === null ? null : grams / serving;

                const values = [
                  ['kcal', 'kcal', 0],
                  ['P', 'protein', 1],
                  ['C', 'carbs', 1],
                  ['G', 'fat', 1],
                  ['F', 'fiber', 1]
                ];

                return h('div', {
                  key: log.id,
                  style: {
                    padding: '7px 0',
                    borderBottom: '1px solid var(--line)'
                  }
                },

                  h('div', {
                    style: {
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '2px 10px'
                    }
                  },

                    h('strong', {
                      style: { fontSize: '13px' }
                    }, food?.name || 'Alimento non trovato'),

                    h('small', {
                      className: 'muted'
                    },
                      `${grams === null ? 'N/D' : fmt(grams)} g · ` +
                      (meal?.name || 'Senza pasto')
                    )
                  ),

                  h('div', {
                    className: 'muted',
                    style: {
                      fontSize: '11px',
                      lineHeight: 1.45,
                      marginTop: '2px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      columnGap: '12px',
                      rowGap: '2px'
                    }
                  },

                    ...values.map(([name, key, digits]) => {
                      const base = number(food?.label?.[key]);

                      const value = ratio === null || base === null
                        ? null
                        : base * ratio;

                      return h('span', { key },
                        `${name}: ${
                          value === null
                            ? 'N/D'
                            : fmt(value, digits) +
                              (key === 'kcal' ? ' kcal' : ' g')
                        }`
                      );
                    })
                  )
                );
              })
            )
      ),


      !groups.length && h('p', {
        className: 'muted'
      }, 'Configura almeno un pasto per iniziare.')
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
