# Percorso, obiettivi giornalieri e metabolismo — V7.3

## Integrazione

Caricare `percorso-v73.css` dopo i CSS Aurora e includerlo fra gli asset offline del service worker.

- Il componente `NutriTraceGoalsWizard.View` accetta `allergens: qualityState.allergens`. Le allergie sono lette dal solo stato qualità. Il risultato finale contiene `payload.allergens` **solo** se l’utente ha confermato una selezione o “nessun allergene”; l’assenza del campo significa lasciare invariato. Salvare questa proprietà insieme agli altri cambiamenti, nella transazione di applicazione del percorso, non al click di una casella. Ripristinare anche gli allergeni nell’annullamento dell’ultima applicazione. Non salvarli in `advancedV64.avoid` né inferirli dai gusti.
- `NutriTraceStrategy.optionalAnswerSummaryV73(profile)` restituisce `{id, question, answer}[]` per il riepilogo delle preferenze. Include entrambe le sessioni, le scelte di non rispondere e la semantica originale del vecchio peso massimo. Il riepilogo settimanale già presente può essere aggiunto separatamente.
- Mostrare “Cambia obiettivi per oggi” quando `NutriTraceMetabolism.canEditDay(profile,goals)` restituisce `true`. Non collegare questo pulsante a `Strategy.eligibility`, che serve solo per gli automatismi.
- `NutriTraceMetabolism.dayCapabilities(profile,goals)` contiene `manualTodayAllowed`, `redistributionAllowed`, `extraActivityAllowed`, `policy`, `reason`, `limits`. Il valore restituito da `canEditDay` è un booleano.
- `NutriTraceGoalsWizard.policy(profile)` è la policy condivisa con il Coach. Leggere `organizationalOnly` per il blocco della consulenza nutrizionale personalizzata, e `automaticNutritionAllowed` per la generazione dei programmi. Il solo profilo incompleto non implica `organizationalOnly`.
- Nuovo marcatore `profile.optionalCompletedV73={version:1,completedAt,questionIds}` e traguardo `optional`. Una risposta “Preferisco non indicarlo” vale come domanda affrontata. Saltare direttamente al riepilogo prima della fine non completa il traguardo. Una successiva revisione parziale non rimuove un traguardo già guadagnato.

## Cosa cambia e perché

### Bozza e ripresa

Il bug originale era causato da `WizardExtras` che conservava il passo in uno stato React locale: la schermata di uscita smontava il componente; “continua” lo rimontava sul bivio delle domande facoltative. Ora il passo è controllato dal componente padre in `extra.navigation={phase,questionId}`. La bozza conserva risposte essenziali, preferenze, navigazione, schermata (domande/extra/riepilogo), allergeni temporanei e scelta sui micronutrienti. Il salvataggio automatico rimane locale; “Esci senza salvare” elimina la bozza. “Riprendi percorso” ritorna anche alla seconda sessione di allenamento o al riepilogo, senza applicare obiettivi.

La chiave di archivio e `version:1` restano compatibili con V5. I nuovi campi sono aggiuntivi. Una vecchia bozza senza fase riparte dalla domanda essenziale salvata. La bozza è sanificata, limitata a 40 KB; i campi sconosciuti vengono eliminati.

### Domande e progressi

Il percorso essenziale ha al massimo 20 domande. La fase fisiologica è indipendente dal coefficiente dell’equazione; scegliere un altro coefficiente non cancella una gravidanza/allattamento dichiarata. Il caso maschile tipico passa da 18 a 19 domande; il caso senza allenamento da 17 a 18.

Le preferenze facoltative sono un blocco separato, fino a 19 schermate nel percorso con due sessioni. Ciascun allenamento ha una schermata con durata, orario, intensità e rapporto con i pasti. La barra mostra il totale effettivo dopo la scelta di una o due sessioni, le risposte affrontate e le rimanenti. Non sommiamo energia degli allenamenti al PAL.

L’andamento offre cinque categorie principali più “Non lo so” e la possibilità di non rispondere. Il vecchio “In aumento” diventa `up_unspecified`, “In diminuzione” `down_unspecified`: non si inventa l’entità. I nuovi valori sono `slight_up`, `marked_up`, `stable`, `slight_down`, `marked_down`.

`referenceWeightV73` è un nuovo peso di riferimento, facoltativo. `recentWeightMax` viene conservato soltanto come dato storico con l’etichetta originale, senza trasformarlo in un altro tipo di misurazione.

La composizione corporea distingue una misurazione inserita dall’utente, una fascia visiva orientativa e un dato non conosciuto. Le otto illustrazioni per riferimento sono SVG originali parametrizzati nel file `metabolism-v70.js`, senza immagini copiate, ricalcate o scaricate. Le fasce sono suddivisioni dell’interfaccia, **non soglie diagnostiche o una scala visiva validata**. Non entrano nelle equazioni di calorie o metabolismo. Le percentuali precedenti senza metodo restano indicate come stime precedenti.

### Obiettivi per oggi e causa del blocco ±1 kcal

Il vecchio `personalBounds` imponeva `min = programma odierno` se il BMI era sotto 20 o l’età da 65 anni. Aumentare oggi anche di 1 kcal richiedeva di ridurre i giorni successivi, ma tutti avevano lo stesso pavimento: il budget non poteva essere compensato. Diminuire oggi falliva subito. Questa condizione è stata rimossa **dalla redistribuzione manuale dello stesso budget**.

Tre modalità esplicite:

1. **Oggi soltanto**: il numero è il totale della giornata. Nessun altro giorno cambia; l’anteprima mostra la variazione della media. Un extra attività precedentemente salvato viene assorbito nel totale, non aggiunto una seconda volta.
2. **Mantieni la media settimanale**: cambia oggi e distribuisce la differenza solo sui giorni futuri della stessa settimana. Il budget bilanciato non cambia, i giorni passati non si toccano. Le calorie extra per attività sono contabilizzate separatamente.
3. **Attività extra**: aggiunge soltanto il consumo dichiarato oltre l’attività abituale, senza ridurre altri giorni. Non è una stima o una lettura automatica da dispositivo.

Il percorso non è richiesto per gli inserimenti manuali: servono obiettivi numerici validi. Le proporzioni dei macro sono quelle già impostate, oppure percentuali inserite dall’utente con somma 100%. Fibre e micronutrienti non vengono moltiplicati con le calorie. Il vecchio archivio dei target viene rispettato.

## Limiti espliciti, senza equivalenza a prescrizioni mediche

### Inserimento e redistribuzione manuale

| Operazione | Limiti effettivi | Natura |
|---|---|---|
| Totale per oggi soltanto | maggiore di 0, massimo 7000 kcal | Validazione del formato e intervallo numerico supportato; nessun minimo universale suggerito |
| Redistribuzione della settimana | ±15% del programma per giorno, tra 1200 e 5000 kcal | Limiti software già presenti; rimosso il pavimento BMI/età sul programma |
| Compensazione | solo giorni futuri della stessa settimana, margine disponibile sufficiente | Conservazione matematica del budget; domenica scegliere oggi soltanto se si cambia il totale |
| Extra attività | 0–2500 kcal, totale non oltre 7000 kcal | Intervallo gestito già presente; consumo inserito dall’utente |
| Percentuali manuali dei macro | ciascuna 0–100%, somma 100% | Coerenza aritmetica, non intervalli raccomandati |
| Gravidanza/allattamento, minori, piano professionale o contesto protetto non indicato | solo totale manuale per oggi; niente distribuzione/extra automatici | Conservare le indicazioni del professionista senza crearne di nuove |
| Giorni futuri già impostati indipendentemente | nessuna compensazione automatica sopra quei valori | Evita di sostituire un altro inserimento manuale |

L’anteprima espone i limiti applicabili e il motivo concreto del rifiuto. Non ci sono più soglie di peso minimo o BMI 20 per l’aritmetica della redistribuzione.

### Automatismi conservati dalla versione precedente

L’app non propone automaticamente calorie/target/TDEE per gravidanza, allattamento, età inferiore a 18, contesto di cura professionale o dichiarato non specificato. La rilevazione fisiologica è indipendente dal coefficiente maschile/femminile. Per gravidanza e allattamento rimangono possibili registrazione, ricette, organizzazione della spesa e inserimento manuale delle indicazioni ricevute. L’app non le interpreta come proprie raccomandazioni.

Restano i limiti preesistenti dell’equazione e del programma: età 18–78, BMI 18,5–<40, nessun deficit automatico con BMI <20 o età ≥65, nessun surplus automatico con BMI ≥30, energia proposta tra 1200 e 5000. Il deficit iniziale dell’app è −10%, il surplus +5%; la scelta del PAL include gli allenamenti abituali. Queste percentuali e soglie sono scelte prudenziali del software, non prescrizioni universali e non nuove raccomandazioni ministeriali.

La modifica della media suggerita dal percorso è limitata a ±15%, senza ridurre ancora una stima già in deficit o quando il profilo non è idoneo a un’ulteriore riduzione. Questa regola riguarda la generazione automatica del programma; gli obiettivi manuali rimangono separati.

Il modello osservazionale mantiene i filtri esistenti: 28–56 giorni consecutivi confermati completi, almeno 12 date di pesata su almeno 21 giorni, estremi vicini, nessun intervallo di pesata oltre 7 giorni; esclusione di dati energetici incompleti, porzioni stimate, forte variabilità o variazioni rapide. Il coefficiente 6000–9500 kcal/kg e l’intervallo calcolato sono analisi di sensibilità euristiche, non un modello clinico validato. Le proposte non si applicano mai da sole; passo massimo min(150 kcal, 5%), almeno 7 giorni tra revisioni, storico dei target preservato. Proiezione non oltre 12 settimane e soltanto in direzione compatibile col trend osservato.

### Campi facoltativi

Limiti già esistenti: passi 0–50000, durata per sessione 0–360 minuti, pesi annotati 20–500 kg, massa grassa inserita 0–65%, calorie/TDEE noti 0–6000, testi 180 caratteri, orari HH:MM. Il nuovo peso di riferimento e le due sessioni riusano gli stessi limiti. I campi si possono lasciare vuoti. Nessuna di queste preferenze ricalcola energia o macro.

## Test e regressioni da verificare

`node --test tests/percorso-v73.test.js` copre budget esatto ±1 kcal con 50 kg/160 cm, percorsi incompleti, giorno singolo/domenica, somma macro, blocco delle proposte protette anche col coefficiente maschile, migrazioni e percorso facoltativo con bozza e due sessioni.

Nel browser: aprire percorso, raggiungere secondo allenamento, X → Riprendi percorso; salvare e riaprire; ricaricare sulla stessa domanda; entrare e uscire dal riepilogo; verificare i campi facoltativi. Confermare allergeni e annullare l’applicazione. Provare 1799/1801 kcal con 50 kg e 160 cm, verificando media invariata in redistribuzione; provare oggi soltanto e verificare media variata e giorno successivo invariato. Testare la domenica. Provare un profilo di gravidanza con coefficiente maschile e verificare che Coach, percorso e metabolismo restino organizzativi, con soli inserimenti manuali.

Le aspettative legacy da aggiornare intenzionalmente riguardano il conteggio della domanda fisiologica, la sua conservazione cambiando coefficiente, la sua visibilità nel riepilogo e le tre nuove etichette/modalità dell’editor giornaliero.
