# Audit dei riferimenti nutrizionali — NutriTrace V5

Verifica: **23 novembre 2026**. Ambito: 47 voci del `MICRO_CATALOG` presente in Aurora V4, relative unità, periodicità, natura del riferimento e limiti di sicurezza. Le fonti sono pubblicazioni ufficiali EFSA, SINU e OMS oppure gli articoli originali degli autori. Non è una validazione clinica dell’app, delle stime AI o della completezza di ogni alimento.

## Esito

Il catalogo precedente combinava valori non riconducibili a un unico insieme italiano/europeo: alcuni erano compatibili con riferimenti statunitensi, altri erano personalizzazioni o quantità fissate su un peso di 72 kg. Senza popolazione, fonte e tipo di valore non si può presentarli come fabbisogni consigliati a tutti. In particolare, diverse vecchie soglie `ul` non coincidevano con i limiti EFSA aggiornati.

V5 introduce un catalogo di riferimento esplicito, principalmente **EFSA**, con selezione per contesto adulto e collegamenti alle singole pubblicazioni. Le tabelle **LARN SINU V revisione** sono citate separatamente come riferimento italiano. EFSA e LARN non vanno mescolati scegliendo di volta in volta il numero più alto; eventuali differenze non implicano che uno sia universalmente sbagliato.

La selezione dei riferimenti e la modifica di un obiettivo sono operazioni diverse. `referenceForGoal` non scrive dati; restituisce un valore e il relativo contesto, oppure nessun suggerimento applicabile. L’app deve applicare nuovi valori soltanto nel riepilogo esplicito del percorso guidato. Gli obiettivi manuali esistenti rimangono tali.

## Distinzioni da mantenere nell’interfaccia

- **PRI**: riferimento di assunzione per una popolazione; non è la misura del fabbisogno del singolo utente.
- **AI**: assunzione adeguata derivata quando la base per un PRI non è disponibile. Essere sotto AI non dimostra un’inadeguatezza individuale.
- **AR**: fabbisogno medio; non è intercambiabile con PRI. Gli aminoacidi presenti nel catalogo sono riferimenti medi, non obiettivi per l’ipertrofia.
- **UL**: limite dell’assunzione cronica, riferito a una specifica popolazione e forma/esposizione. Non deve essere mostrato come quota da raggiungere.
- **Safe level / ADI**: limiti con significati diversi da UL. Il superamento di un safe level non equivale automaticamente a una diagnosi di tossicità.

Fonte concettuale: [EFSA, valori di riferimento](https://www.efsa.europa.eu/en/topics/topic/dietary-reference-values). Aggiornamento limiti: [EFSA, sintesi versione 11, agosto 2025](https://www.efsa.europa.eu/sites/default/files/2024-05/ul-summary-report.pdf).

## Correzioni prioritarie delle soglie

| Voce | Vecchia soglia | Riferimento verificato | Trattamento software |
| --- | ---: | --- | --- |
| B6 | 100 mg/die | UL 12 mg/die | Aggiornare la soglia per adulti sani, conservando l’obiettivo manuale. |
| Selenio | 400 µg/die | UL 255 µg/die | Aggiornare la soglia. |
| Zinco | 40 mg/die | UL 25 mg/die | Aggiornare la soglia. |
| Vitamina E | 1.000 mg/die | UL 300 mg/die di α-tocoferolo | Visualizzare con ambito e limitazioni; niente confronto automatico se la forma non è verificata. |
| Iodio | 1.100 µg/die | UL 600 µg/die | Aggiornare la soglia per il contesto adulto pertinente. |
| Molibdeno | 2.000 µg/die | UL 600 µg/die | Aggiornare la soglia. |
| Magnesio | 350 mg/die | UL 250 mg/die per specifiche forme aggiunte | Non confrontare con tutto il magnesio alimentare. |
| Ferro | 45 mg/die, chiamato UL | Safe level 40 mg/die | Togliere la falsa etichetta UL. |
| Manganese | 11 mg/die, chiamato UL | Safe level 8 mg/die | Togliere la falsa etichetta UL. |
| Rame | 10.000 µg/die | ADI 0,07 mg/kg/die | Mantenere separato dall’obiettivo nutrizionale e dal vecchio limite fisso. |
| Fluoro | 10 mg/die | Safe level 3,3 mg/die, EFSA 2025 | Nessun obiettivo automatico; includere che l’esposizione comprende fonti orali non alimentari. |

Fonti decisive: [B6, parere finale 2023](https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2023.8006), [selenio 2023](https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2023.7704), [vitamina E 2024](https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2024.8953), [rame 2023](https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2023.7728), [manganese 2023](https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2023.8413), [fluoruro 2025](https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2025.9478). Gli altri valori della tabella sono nella sintesi EFSA versione 11.

La pagina divulgativa generale EFSA riporta 12,5 mg per la B6; il **parere definitivo** stabilisce **12 mg** dopo arrotondamento. Per l’implementazione prevale il parere. Il vecchio indirizzo `assets/UL_Summary_tables.pdf` reindirizza a una sintesi più recente: leggere versione interna, non dedurla dal nome del file.

Vitamina A: il limite riguarda il **retinolo preformato**, non la somma indiscriminata di carotenoidi e retinolo. Folati: il limite delle forme aggiunte non va confrontato con DFE totali. Niacina: le forme aggiunte hanno limiti distinti, non un unico UL di 35 mg per la niacina alimentare totale. L’assenza di un UL EFSA applicabile non significa che dosi illimitate siano sicure.

## Selezione e mancata selezione automatica

Il modulo richiede un’età adulta valida. Non genera obiettivi automatici per minori, gravidanza/allattamento, stato fisiologico dichiarato non definito o contesto clinico indicato. Per questi profili conserva la possibilità di utilizzare valori concordati con un professionista.

Per ferro nelle donne richiede uno stato fisiologico esplicito: non deduce la menopausa dall’età. Per zinco richiede un’ipotesi quantitativa sui fitati prima di scegliere uno dei valori EFSA; non deriva i fitati dalla sola dichiarazione vegetariana/onnivora. Per tiamina e niacina usa l’energia espressa in MJ; per ALA e LA usa la quota energetica prevista dal riferimento. Per calcio seleziona la fascia di età.

EPA e DHA non ricevono due nuovi minimi separati: il riferimento adulto impiegato è **250 mg/die combinati**. La visualizzazione settimanale è un’equivalenza aritmetica di 1.750 mg, non una raccomandazione di assunzione in dose unica. Fonte: [EFSA grassi, 2010](https://www.efsa.europa.eu/en/efsajournal/pub/1461).

Il sodio ha un obiettivo di contenimento `<2.000 mg/die`, coerente con [OMS](https://www.who.int/tools/elena/interventions/sodium-cvd-adults), e non deve mostrare “mancano X mg” come invito a completare una quota. Il corrispondente valore EFSA è classificato come assunzione sicura e adeguata, non UL. Il cloruro rimane consultabile ma non viene applicato automaticamente come quota da colmare aggiungendo sale.

Per cromo EFSA non stabilisce AI/PRI. Fluoro viene escluso dall’automatismo alla luce dell’aggiornamento di sicurezza 2025. Nickel, zolfo, DPA e AA non ricevono un target automatico in questa versione. L’esclusione software non equivale a una nuova affermazione biologica sull’essenzialità.

## Confronto con i riferimenti italiani

La [SINU](https://sinu.it/Larn/) presenta i LARN V revisione come riferimento nazionale. Le [tabelle online ufficiali](https://sinu.it/wp-content/uploads/2025/07/Tabelle-riassuntive_online.pdf) sono state consultate; non sono riprodotte integralmente nel pacchetto.

Esempi selezionati: LARN adulti indica magnesio 350 mg, ferro 10 mg negli uomini e 18 mg nelle donne in premenopausa, zinco 12/9 mg. Il calcio varia con età e stato menopausale. Sono differenze da dichiarare rispetto alla scelta EFSA dell’app. Non presentare una combinazione di entrambi i sistemi come un unico “valore ministeriale”.

## Stime, dati mancanti e statistiche

I valori del diario dipendono da grammi registrati, cottura, ricetta, composizione del prodotto e fonti. Una foto non misura la massa. Un riconoscimento convincente del nome non valida i nutrienti dell’alimento né la porzione.

Regole progettuali V5, da trattare come decisioni software:

1. **Mancante non è zero**: senza una quantità numerica o uno zero esplicitamente dichiarato, la cella è N/D.
2. **Copertura non è precisione**: la percentuale del diario con dati disponibili non è un intervallo di confidenza e non può diventare un badge “accurato al 90%”.
3. **Media con denominatore esplicito**: distinguere giorni registrati, giorni con informazione per quel nutriente e giorni non registrati; non diluire i dati disponibili dividendo sempre per sette.
4. **Sotto obiettivo non è carenza clinica**: formulare “scostamento dai valori registrati”, senza diagnosi. Non ricavare probabilità di carenza da un diario parziale o da un semplice confronto con AI/PRI.
5. **Nessuna falsa precisione**: mostrare quantità leggibili, mantenendo le unità corrette. I due decimali migliorano la lettura ma non significano precisione analitica.
6. **Non sommare quantità assorbite e ingerite**: i DRV sono riferimenti di assunzione; stime di biodisponibilità non diventano automaticamente un nuovo apporto equivalente.
7. **Forme equivalenti**: RE/RAE, DFE/folati/acido folico e NE/niacina richiedono metadati; senza di essi esplicitare la comparabilità limitata.

### Basi chimiche presenti nel database e confronto V5

Il Master attuale conserva `canonicalId` utili a evitare confronti impropri. `vitamin_a_rae` non è il RE del riferimento EFSA; `niacin_b3` non certifica un valore NE; `folate_total_b9` non certifica DFE; `vitamin_e_alpha_te` non coincide necessariamente con α-tocoferolo; `vitamin_k` totale non certifica fillochinone/K1. La conversione g/mg/µg non risolve queste differenze.

`diary-v5.js` mantiene le quantità registrate e restituisce `comparisonAvailable:false` se un valore numerico non documenta la base del riferimento. Accetta metadati chimici espliciti coerenti o identificatori canonici corrispondenti; non inventa conversioni e non ignora un identificatore canonico in conflitto con il testo libero. La UI deve rendere indisponibili percentuale di raggiungimento e quantità “mancante” in questo caso, presentando `basisReason`. Le somme di basi non omogenee rimangono dati del registro non interpretabili come apporto equivalente validato.

La copertura indica disponibilità quantitativa, pesata per grammi registrati. Le segnalazioni di qualità (`limitedQualityCount`: grade C/D, avvisi del database), di stima del nutriente (`nutrientEstimateCount`) e di stima della porzione (`portionEstimateCount`) restano separate. `estimatedCount` conta le voci che includono almeno uno dei due tipi di stima. Nessuno di questi indicatori è una probabilità di accuratezza. `referenceCoverage` esclude anche basi non verificate e qualità limitata: è un indicatore operativo, non una certificazione analitica.

Le medie sono calcolate sui giorni con almeno un valore disponibile per il nutriente. Un giorno parzialmente noto rimane parziale e la copertura lo segnala; un giorno senza alcun valore non viene trattato come zero. Uno zero dichiarato entra invece nella media. Un alimento eliminato dall’archivio continua a contribuire alla massa priva di informazioni nel denominatore della copertura. Per aggregati come EPA + DHA, una quantità totale esplicita ha precedenza sui componenti, che non vengono sommati di nuovo.

Le ricette scalano gli ingredienti per il rapporto tra porzione consumata e peso finale della ricetta. Scalano anche quantità esplicite e intervalli della porzione. Il metodo non calcola automaticamente perdite vitaminiche, biodisponibilità o ritenzione dovute alla cottura: questi aspetti dipendono dai dati dell’ingrediente scelto e rimangono una fonte di incertezza.

### Risposte del percorso e contesto facoltativo del Coach

Il percorso salva localmente le risposte, incluse le scelte necessarie a capire se applicare il calcolo automatico. Le risposte grezze, età, sesso, altezza, stato fisiologico, stato mestruale e contesto di cura non sono inseriti nel riepilogo facoltativo `contextForCoach`. Quest’ultimo comprende esclusivamente obiettivo generale, movimento, allenamento, preferenze, organizzazione dei pasti, tempo di preparazione e priorità.

Il Coach applica una seconda lista di campi consentiti. Per inviare quel riepilogo servono sia la condivisione delle statistiche sia l’opzione separata relativa alle preferenze del percorso; entrambe partono disattivate. Il peso usa un’opzione distinta. L’autorizzazione all’invio della domanda al provider resta separata. L’esportazione completa del backup, richiesta dall’utente, può contenere il profilo locale e deve quindi essere trattata come un suo archivio personale.

Disattivare la condivisione evita di allegare nuovi dati di contesto. Non cancella automaticamente le informazioni già presenti nei messaggi precedenti della conversazione; questi messaggi seguono la gestione della cronologia esistente.

## Contratto tecnico del modulo

`window.NutriTraceNutritionReferences` (anche alias singolare) e export CommonJS per i test.

- `referenceForGoal(name, profile)`: oggetto `{value, unit, type, kind, period:'day', autoApplicable, reason, sourceIds, note, basis, upperLimit}`. Valore null quando non selezionabile; non muta l’argomento.
- `limitForGoal(name, profile)`: distingue tipo, ambito, unità e confrontabilità col totale. Non rende automaticamente un safe level equivalente a UL.
- `catalogMetadataPatch(name, unit)`: corregge soltanto metadati e soglie UL confrontabili, convertendole nell’unità specificata. **Non contiene `target`, `perKg`, `period`, `targetMode`, `kind`, `pinned`**. Un limite non applicabile diventa `ul:null`, così non sopravvive una vecchia soglia impropria. `ulPopulation`, `ulScope` e `ulNote` mantengono popolazione, ambito e limitazioni del confronto: le soglie adulte non diventano limiti pediatrici.
- `SourcesView`: componente React per Dati con spiegazione breve, ricerca dei nutrienti e collegamenti alle fonti.

L’integrazione deve applicare `catalogMetadataPatch(g.name, g.unit)` **dopo** l’eventuale fusione con gli obiettivi salvati; altrimenti il vecchio `ul` salvato sovrascriverebbe il metadato corretto. Gli obiettivi del gruppo personalizzato restano fuori da una migrazione automatica basata sul solo nome. Per nuovi utenti i riferimenti dipendenti dal profilo non devono assumere di nascosto sesso, età o peso standard; il percorso guidato consente la configurazione esplicita.

Le formule del wizard hanno fonti proprie: [Mifflin et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/) per il dispendio a riposo, [EFSA energia](https://www.efsa.europa.eu/en/efsajournal/pub/3005), [proteine](https://www.efsa.europa.eu/en/efsajournal/pub/2557), [carboidrati e fibre](https://www.efsa.europa.eu/en/efsajournal/pub/1462). La mappatura delle risposte su attività e le eventuali variazioni energetiche sono scelte applicative da esplicitare nel riepilogo, non prescrizioni emesse da EFSA.

## Matrice completa

Valori giornalieri. La colonna V4 descrive il catalogo sorgente, non gli obiettivi effettivamente scelti dall’utente. I collegamenti rimandano alle pubblicazioni; la selezione dipende dalle condizioni illustrate sopra.

| Nutriente | V4/die | Riferimento V5 | Tipo | Fonte |
| --- | ---: | --- | --- | --- |
| Vitamina A | 900 µg | 750 M / 650 F µg RE/die | PRI | [efsa-a](https://www.efsa.europa.eu/en/efsajournal/pub/4028) |
| Tiamina B1 | 1.2 mg | 0,1 mg/MJ | PRI | [efsa-b1](https://www.efsa.europa.eu/en/efsajournal/pub/4653) |
| Riboflavina B2 | 1.3 mg | 1,6 mg/die | PRI | [efsa-b2](https://www.efsa.europa.eu/en/efsajournal/pub/4919) |
| Niacina B3 | 16 mg | 1,6 mg NE/MJ | PRI | [efsa-b3](https://www.efsa.europa.eu/en/efsajournal/pub/3759) |
| Acido pantotenico B5 | 5 mg | 5 mg/die | AI | [efsa-b5](https://www.efsa.europa.eu/en/efsajournal/pub/3581) |
| Vitamina B6 | 1.3 mg | 1,7 M / 1,6 F mg/die | PRI | [efsa-b6](https://www.efsa.europa.eu/en/efsajournal/pub/4485) |
| Biotina B7 | 30 µg | 40 µg/die | AI | [efsa-b7](https://www.efsa.europa.eu/en/efsajournal/pub/3580) |
| Folati | 400 µg | 330 µg DFE/die | PRI | [efsa-folate](https://www.efsa.europa.eu/en/efsajournal/pub/3893) |
| Vitamina B12 | 2.4 µg | 4 µg/die | AI | [efsa-b12](https://www.efsa.europa.eu/en/efsajournal/pub/4150) |
| Vitamina C | 90 mg | 110 M / 95 F mg/die | PRI | [efsa-c](https://www.efsa.europa.eu/en/efsajournal/pub/3418) |
| Vitamina D | 15 µg | 15 µg/die | AI | [efsa-d](https://www.efsa.europa.eu/en/efsajournal/pub/4547) |
| Vitamina E | 15 mg | 13 M / 11 F mg di α-tocoferolo/die | AI | [efsa-e](https://www.efsa.europa.eu/en/efsajournal/pub/4149) |
| Vitamina K | 120 µg | 70 µg di fillochinone/die | AI | [efsa-k](https://www.efsa.europa.eu/en/efsajournal/pub/4780) |
| Colina | 550 mg | 400 mg/die | AI | [efsa-choline](https://www.efsa.europa.eu/en/efsajournal/pub/4484) |
| Calcio | 1000 mg | 1.000 mg (18–24 anni); 950 mg (≥25 anni)/die | PRI | [efsa-calcium](https://www.efsa.europa.eu/en/efsajournal/pub/4101) |
| Fosforo | 700 mg | 550 mg/die | AI | [efsa-phosphorus](https://www.efsa.europa.eu/en/efsajournal/pub/4185) |
| Magnesio | 410 mg | 350 M / 300 F mg/die | AI | [efsa-magnesium](https://www.efsa.europa.eu/en/efsajournal/pub/4186) |
| Sodio | 1500 mg | <2.000 mg/die (riduzione OMS) | reduction-goal | [who-sodium](https://www.who.int/tools/elena/interventions/sodium-cvd-adults), [efsa-sodium](https://www.efsa.europa.eu/en/efsajournal/pub/5778) |
| Cloruro | 2300 mg | 3.100 mg/die | safe-adequate | [efsa-chloride](https://www.efsa.europa.eu/en/efsajournal/pub/5779) |
| Potassio | 3400 mg | 3.500 mg/die | AI | [efsa-potassium](https://www.efsa.europa.eu/en/efsajournal/pub/4592) |
| Ferro | 8 mg | 11 mg M / postmenopausa; 16 mg F premenopausa | PRI | [efsa-iron](https://www.efsa.europa.eu/en/efsajournal/pub/4254) |
| Zinco | 11 mg | 9,4–16,3 M / 7,5–12,7 F mg/die secondo fitati | PRI | [efsa-zinc](https://www.efsa.europa.eu/en/efsajournal/pub/3844) |
| Rame | 900 µg | 1.600 M / 1.300 F µg/die | AI | [efsa-copper](https://www.efsa.europa.eu/en/efsajournal/pub/4253) |
| Manganese | 2.3 mg | 3 mg/die | AI | [efsa-manganese](https://www.efsa.europa.eu/en/efsajournal/pub/3419) |
| Iodio | 150 µg | 150 µg/die | AI | [efsa-iodine](https://www.efsa.europa.eu/en/efsajournal/pub/3660) |
| Selenio | 55 µg | 70 µg/die | AI | [efsa-selenium](https://www.efsa.europa.eu/en/efsajournal/pub/3846) |
| Molibdeno | 45 µg | 65 µg/die | AI | [efsa-molybdenum](https://www.efsa.europa.eu/en/efsajournal/pub/3333) |
| Cromo | 35 µg | Nessun AI/PRI EFSA | not-established | [efsa-chromium](https://www.efsa.europa.eu/en/efsajournal/pub/3845) |
| Nickel | 0 µg | Nessun obiettivo nutrizionale automatico | not-established | [efsa-ul](https://www.efsa.europa.eu/sites/default/files/2024-05/ul-summary-report.pdf) |
| Fluoro | 4 mg | Nessun obiettivo automatico; sicurezza aggiornata nel 2025 | special-review | [efsa-fluoride-safety](https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2025.9478) |
| Zolfo | 0 mg | Nessun obiettivo isolato in questo catalogo | not-established | [efsa-protein](https://www.efsa.europa.eu/en/efsajournal/pub/2557) |
| ALA | 1.6 g | 0,5% dell’energia | AI | [efsa-fats](https://www.efsa.europa.eu/en/efsajournal/pub/1461) |
| EPA | 250 mg | Riferimento nel totale EPA + DHA | combined-reference | [efsa-fats](https://www.efsa.europa.eu/en/efsajournal/pub/1461) |
| DHA | 250 mg | Riferimento nel totale EPA + DHA per adulti | combined-reference | [efsa-fats](https://www.efsa.europa.eu/en/efsajournal/pub/1461) |
| EPA + DHA | 500 mg | 250 mg/die combinati | AI | [efsa-fats](https://www.efsa.europa.eu/en/efsajournal/pub/1461) |
| DPA | 0 mg | Nessun obiettivo automatico | not-established | [efsa-fats](https://www.efsa.europa.eu/en/efsajournal/pub/1461) |
| Acido linoleico (LA) | 17 g | 4% dell’energia | AI | [efsa-fats](https://www.efsa.europa.eu/en/efsajournal/pub/1461) |
| Acido arachidonico (AA) | 0 mg | Nessun DRV definito per adulti | not-established | [efsa-fats](https://www.efsa.europa.eu/en/efsajournal/pub/1461) |
| Leucina | 2.81 g | 39 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
| Isoleucina | 1.44 g | 20 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
| Valina | 1.87 g | 26 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
| Lisina | 2.16 g | 30 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
| Metionina + cisteina | 1.08 g | 15 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
| Treonina | 1.08 g | 15 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
| Triptofano | 0.29 g | 4 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
| Istidina | 0.72 g | 10 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
| Fenilalanina + tirosina | 1.8 g | 25 mg/kg/die (fabbisogno medio) | AR | [who-amino](https://iris.who.int/handle/10665/43411) |
