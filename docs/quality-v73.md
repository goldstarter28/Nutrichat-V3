# Qualità alimentare V7.3 — specifiche, evidenza e limiti

## Risultato effettivo del controllo

L’audit legge l’indice e tutti i **64 chunk**, per **38.230 alimenti** del Master `2.3.1-db5c`, build `2026-08-23`. I file originali sono stati recuperati dal commit `296233b6602abd1d97f86b06dc21fa7aa45c0e44` e verificati contro gli hash Git. Non sono stati sostituiti o corretti valori del database.

| Esito | Alimenti |
| --- | ---: |
| Calcolo con tutti gli input necessari | 357 |
| Lettera invariata nonostante input parziali | 196 |
| Totale lettere confrontabili 2023 | **553 (1,45%)** |
| Grado non determinabile automaticamente | 37.677 |
| Record con tutti i sei nutrienti generali numerici, prima dei vincoli di provenienza | 19.196 |

Questo risultato **non significa** che solo 553 cibi possano avere un Nutri-Score. Significa che la pipeline può dimostrare quella lettera, con le regole implementate e i dati attualmente disponibili. Molti record completi di macro non documentano la categoria specifica o la quota di frutta, verdura e legumi. Una categoria nazionale come “Mixed Dishes” non basta a determinarle.

Il rapporto completo è `docs/quality-v73-audit.json`. L’indice derivato pronto per la ricerca è `data/master/quality-v73.json`, circa 2,3 MB. L’audit conta separatamente calcoli completi e parziali. I prodotti acquisiti da codice a barre con versione 2023 documentata possono aggiungere copertura nell’archivio personale: non fanno parte di questo conteggio del Master.

### Dati che mancano realmente

Nel Master sorgente: fibre assenti in **14.957** record, zuccheri in **9.879**, saturi in **5.134**, proteine in **1.325**, sale/sodio utilizzabile in **1.602**, energia kJ in **621**. Queste assenze possono sovrapporsi. Il motore conta inoltre le indisponibilità dovute a quarantena/provenienza: non sono lo stesso denominatore della semplice presenza di numeri.

Per ampliare la copertura serve un arricchimento di **tassonomia e composizione verificabile**, oltre ai nutrienti mancanti, con provenienza e licenze compatibili. Questa patch non introduce un nuovo dataset esterno e non dichiara una fusione di 38.230 alimenti con un secondo database. La funzione di unione conserva identità, unità e fonti; non inventa corrispondenze tra record dal nome simile.

## Algoritmo

Implementazione dell’algoritmo aggiornato **2023**, secondo [Santé publique France, FAQ v11 del 17 marzo 2025](https://www.santepubliquefrance.fr/sites/default/files/rdd/document/FAQ-updatedAlgo-V11.pdf), tabelle 5–10. Le soglie di attribuzione delle lettere sono confermate anche dal [decreto francese del 14 marzo 2025, allegato §2](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051329233).

Sono gestiti alimenti generali, formaggi, carne rossa, grassi/frutta a guscio/semi e bevande. I casi specifici applicano tabelle distinte; le mandorle semplici non possono essere calcolate come alimento generale. Nelle bevande la presenza di edulcoranti non nutritivi è distinta dai polioli esclusi. Solo l’acqua semplice verificata beneficia dell’eccezione A. Le bevande richiedono base per volume o densità documentata: non si assume `1 g = 1 ml`.

Il codice mantiene `confirmed` per gli input dichiarati manualmente. L’automazione usa identità semplici documentate e un vocabolario limitato di descrizioni di preparazione. Un ingrediente contenuto nel nome di una ricetta non determina la categoria dell’intera ricetta.

### Calcolo con dati parziali: cosa dimostra

Il dato mancante resta mancante. Il sistema costruisce un estremo favorevole e uno sfavorevole usando l’intero intervallo dei punti possibili per le componenti ignote. Categoria e unità devono già essere note. Non applica questa procedura a categorie ambigue, conflitti o valori in quarantena.

Il punteggio aumenta con le componenti negative e diminuisce con quelle positive. Il passaggio della soglia che esclude le proteine produce un salto verso un punteggio meno favorevole, quindi non introduce un minimo nascosto all’interno dell’intervallo. Per i grassi si considerano anche i limiti del rapporto saturi/grassi. Gli estremi possono descrivere combinazioni fisicamente più ampie del prodotto reale: questo rende il criterio prudente.

Si pubblica la lettera solo quando **entrambi gli estremi appartengono alla stessa classe**. Il punteggio numerico resta `null`; vengono conservati `bounds.minimumScore`, `bounds.maximumScore`, `missing` e il metodo `calculated-partial`. Non viene calcolata la media degli estremi. Il badge e i dettagli indicano **“Calcolo con dati parziali · grado invariato nell’intervallo”**.

Esempio di verifica nei test: per un prodotto con classe E invariata, si enumerano 1.344 combinazioni di zuccheri, fibre e quota FVL, comprese tutte le transizioni di classe delle componenti; ciascuna produce la stessa lettera e un punteggio dentro gli estremi. Un prodotto con intervallo A–B resta N/D.

### Provenienza

| Metodo | Significato | Default nelle medie |
| --- | --- | --- |
| `reported` | Lettera riportata da una fonte, con versione identificata | Sì, solo 2023 e categoria ammissibile |
| `calculated` | Calcolo deterministico da input disponibili | Sì |
| `calculated-partial` | Lettera dimostrata invariata, input incompleti | Sì, kcal conteggiate separatamente |
| `estimated` | Calcolo dipendente da dati stimati o stima AI | **No**, interruttore esplicito |
| N/D | Input, categoria, versione o unità insufficienti | Nessuna lettera inventata |

La conversione da kcal a kJ è annotata: l’arrotondamento della dichiarazione originale può influire sui confini. L’energia kJ della fonte ha precedenza. I record AI più vecchi che dichiarano una “stima integrativa” senza distinguere la provenienza dei macro vengono trattati come stime, anziché promossi a dati documentati.

Gli `A/B/C/D` del Master descrivono l’affidabilità delle fonti. Non vengono mai usati come lettere Nutri-Score. Zero numerico, N/D, traccia, conflitto e quarantena restano distinti.

## Medie, grafici e indice 1–100

Il Nutri-Score classifica alimenti; la media del pasto o del periodo qui visualizzata è un **indicatore interno NutriTrace**. Non è il Nutri-Score ufficiale della dieta e non rappresenta un giudizio sulla persona.

Per ogni registrazione con grammi, energia e classe confrontabile:

1. Calorie della registrazione = calorie della porzione dichiarata × grammi / grammi della porzione.
2. Valore della lettera: A=5, B=4, C=3, D=2, E=1.
3. Media = somma dei valori di lettera × kcal / somma delle kcal classificate.
4. Indice = `1 + 99 × (media − 1) / 4`.

Gli ancoraggi sono A=100, B=75,25, C=50,5, D=25,75, E=1. Questa scala esplicita una convenzione; non aggiunge precisione clinica alle lettere. La lettera riassuntiva arrotonda la media alla classe più vicina. Il numero usa un decimale. La media dell’anno ricalcola i pesi dalle registrazioni originali, non dalla media dei mesi.

La copertura è `kcal classificate / kcal note`. Le calorie con grado ignoto, le registrazioni con energia mancante e gli alimenti rimossi sono riportati separatamente. A/B% usa come denominatore l’energia classificata; la distribuzione A–E include anche la parte non classificata sul totale delle kcal note. Non esiste una soglia minima nascosta che blocchi il grafico.

Settimane lunedì–domenica, mesi e anni di calendario, con anni bisestili e scelta degli anni passati. Giorni e mesi vuoti sono `null`, con interruzione della linea. L’acqua a zero kcal può avere A ma non altera una media ponderata energeticamente. La tabella associata al grafico è accessibile anche senza percepire colori o punti del grafico SVG.

## Unione di dati compatibili

`complementFields(target,candidate)` richiede master ID, codice prodotto o identificativo di fonte comune. Il solo nome non basta. Rifiuta contraddizioni note crudo/cotto, tipo di latte, marca e barcode. Non sovrascrive valori già presenti, compresi gli zero. Converte la base quantitativa della porzione, conserva l’unità dei micronutrienti e non confonde forme chimiche differenti. AI, tracce e valori in quarantena non vengono usati per completare dati documentati.

La risposta contiene `food`, `changed`, `filled`, `conflicts`, `reason`. Gli originali non sono mutati. `mergeMeta.qualityV73Complements` e la provenienza dei campi consentono di verificare cosa è stato completato e da quale fonte.

## Contratto di integrazione

Caricare `food-quality-v73.js` dopo React e `nutrition-intelligence-v61.js`, prima dell’app, e aggiungere `food-quality-v73.css` dopo i fogli esistenti.

```js
const F = window.NutriTraceFoodQualityV73;
h(F.GradeBadge, {food});
h(F.MealBadge, {logs: mealLogs, foods});
h(F.QualityHistoryPanel, {logs, foods, today: '2026-11-26'});
const result = F.indexResult(qualityIndex, masterRow.id, masterManifest);
h(F.GradeBadge, {result});
```

L’indice derivato verifica la revisione del manifest. La struttura `byId` usa tuple descritte in `columns`; l’app deve usare `indexResult` invece di interpretare le posizioni. `sourceFiles` contiene SHA-256 dei file originali e `sourceFingerprint` identifica l’insieme dei dati utilizzati. Dopo una modifica del DB occorre rigenerare l’indice; un controllo di revisione non sostituisce il confronto degli hash durante la costruzione.

```bash
node --test tests/quality-v73.test.js
node scripts/audit-food-quality-v73.js --master data/master \
  --index-out data/master/quality-v73.json \
  --report-out docs/quality-v73-audit.json
node scripts/audit-food-quality-v73.js --master data/master \
  --verify-index data/master/quality-v73.json
```

Senza le opzioni di output l’audit non scrive nulla. `--verify-index` è una verifica in sola lettura: confronta gli hash di tutti i file sorgente e ogni lettera/metodo derivato con il calcolo corrente; ignora solo la data di generazione. Non fa chiamate di rete. Per analizzare un backup locale: `--foods backup.json`. Il codice di uscita è 2 se indice/chunk mancano, 1 per errore o indice obsoleto, 0 per audit completo/verifica riuscita.

## Fonti, grafica e licenze

I badge quadrati V7.3 e il grafico SVG sono disegnati in CSS/codice per questa patch. Non riutilizzano illustrazioni di app concorrenti e non riproducono il marchio ufficiale a cinque pannelli. La documentazione tecnica del calcolo non concede automaticamente diritti d’uso del marchio: [SPF pubblica la procedura e le condizioni d’uso](https://www.santepubliquefrance.fr/nutrition-et-activite-physique/nutri-score).

Le licenze delle fonti alimentari restano quelle dei dati originali. Il manifest esistente contiene anche categorie `terms_review` e `attribution_review`: questa patch **non certifica** tali autorizzazioni e non rende automaticamente ridistribuibile ogni database nazionale. Il calcolo locale e l’indice derivato non sanano eventuali problemi di licenza della fonte. Non vengono acquistati dati, usati servizi a pagamento o aggiunte API AI per calcolare automaticamente le lettere.
