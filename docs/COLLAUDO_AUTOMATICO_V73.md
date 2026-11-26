# Collaudo automatico V7.3

## Esiti eseguiti

- **368 test di regressione**, tutti superati, nessuno saltato, con Node.js 24.22.3. Rapporto `qa-node-v73.txt`.
- **16 prove dell’app completa con React 18.3.1 e jsdom 26.1.0**, tutte superate, zero errori runtime e zero warning React. Rapporto `qa-dom-v73.json`.
- Audit di **38.230 record**, indice originale e 64 chunk. Verifica in sola lettura degli hash e dei risultati derivati superata. Rapporto `quality-v73-audit.json`.

Le prove DOM usano lo storico demo di 91 giorni, i file reali del Master e API simulate. Verificano stati, eventi React, scritture, consensi, revisione e annullamento. Non dichiarano verifiche visive o chiamate a provider reali.

## Ripetere le regressioni

```bash
node --test tests/*.test.js
node scripts/audit-food-quality-v73.js --master data/master --verify-index data/master/quality-v73.json
```

L’installatore esegue automaticamente questi controlli e la verifica sintattica dei file inclusi.

## Ripetere facoltativamente le prove DOM

Queste dipendenze servono al collaudo, non al funzionamento dell’app. Installarle separatamente mantiene il progetto applicativo invariato.

```bash
npm install --prefix .nutritrace-qa jsdom@26.1.0 react@18.3.1 react-dom@18.3.1
NUTRITRACE_JSDOM="$PWD/.nutritrace-qa/node_modules/jsdom" NUTRITRACE_REACT_VENDOR="$PWD/.nutritrace-qa/node_modules" node tests/dom-v73.cjs
```

Lo script aggiorna `docs/qa-dom-v73.json`. Non contatta servizi AI. Non aggiungere `.nutritrace-qa` al commit.

## Scenari sintetici

| Scenario | Esito verificato con 91 giorni |
|---|---|
| Stabile | TDEE osservazionale circa 2400 kcal |
| Leggera diminuzione | TDEE circa 2492 kcal, superiore alle 2400 kcal registrate |
| Leggero aumento | TDEE circa 2307 kcal, inferiore alle 2400 kcal registrate |
| Dati mancanti | Dati insufficienti, nessuna proposta |
| Peso molto variabile | Dati insufficienti, nessuna falsa precisione |

Piccole variazioni dovute alla data degli scenari e all’arrotondamento sono ammesse nei test. Sono verifiche del comportamento software, non una validazione clinica.

## Preview

Il browser collegato non era disponibile; il browser cloud non ha potuto aprire il server locale. Nessuna verifica visiva su dispositivi è dichiarata eseguita. Usare `CHECKLIST_PREVIEW_V73.md` per 320/390/768/1440, tastiera, tema scuro, PWA, aggiornamento cache, fotocamera/barcode/microfono e API reali.

I mock verificano contratti ed errori, non l’accuratezza nutrizionale del modello. La patch conserva i provider configurati e non deduce una classifica di modelli dai test applicativi.
