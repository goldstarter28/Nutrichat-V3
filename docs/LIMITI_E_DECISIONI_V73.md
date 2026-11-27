# NutriTrace V7.3 — limiti, decisioni e funzionalità effettive

Questo documento accompagna la patch e rende esplicite le scelte che possono cambiare l’esperienza d’uso. Descrive il codice consegnato; non è una certificazione medica, una classifica dei modelli AI o una verifica della configurazione Vercel dell’utente. Le procedure di installazione sono nei documenti dell’installer. I risultati definitivi dei test sono nei report del pacchetto; la checklist Preview rimane una lista di verifiche da eseguire sul deployment reale.

## 1. Obiettivo del lavoro e continuità con le versioni precedenti

Il filo conduttore è registrare un pasto con pochi passaggi, avere quantità e informazioni leggibili nella stessa schermata e usare il Coach come assistente dell’app. Il percorso resta facoltativo e la scheda di modifica manuale degli obiettivi rimane disponibile.

La revisione comprende Home compatta, ultimi tre alimenti con quantità dell’ultima registrazione, strumenti foto/barcode nel flusso di inserimento, pasti con P/C/G/F e dettagli accessibili, modifica delle quantità, media settimanale, micronutrienti separati, organizzazione di Altro, percorso, grafici di qualità, strumenti del Coach e ambiente demo separato. Le funzioni già presenti — ricerca, ricette, importazione link, fotocamera, barcode, voce, acqua, peso, esportazione e chat — sono anche oggetto dei controlli di regressione.

La dicitura “Lista / ricetta / link” cambia il nome del campo; non elimina la dettatura già disponibile. La normale ricerca non riutilizza silenziosamente il peso dell’ultima volta. Soltanto gli elementi presentati come recenti fanno quella proposta esplicita.

## 2. Obiettivi manuali, distribuzione e automatismi

### Tre azioni distinte per oggi

| Modalità | Effetto effettivo |
|---|---|
| **Oggi soltanto** | Salva il totale scelto per questa giornata. Gli altri giorni restano uguali e cambia la media della settimana. Un extra attività già presente è compreso nel nuovo totale, non aggiunto di nuovo. |
| **Mantieni la media settimanale** | Distribuisce la differenza sui giorni futuri della stessa settimana. Il budget bilanciato resta uguale; il passato non cambia. L’anteprima mostra i nuovi valori. |
| **Attività extra** | Aggiunge il consumo dichiarato oltre l’attività abituale. Non riduce i giorni successivi. Non rappresenta una misura automatica di un dispositivo. |

Queste azioni manuali non richiedono il completamento del percorso. Sono necessari target numerici validi da cui partire. Le proporzioni dei macro sono quelle già impostate, oppure percentuali esplicitamente inserite; fibre e micronutrienti restano separati.

Il TDEE descrive il dispendio totale: riposo, movimento quotidiano, allenamenti abituali e digestione. Il livello di attività del percorso comprende già l’allenamento abituale. Indicare una seconda sessione serve a descrivere orari e abitudini; non aggiunge nuovamente le sue calorie.

### Bug della variazione di una sola kcal

Il vecchio codice imponeva, con BMI sotto 20 oppure età da 65 anni, un minimo giornaliero uguale al programma corrente. Per aumentare oggi di una kcal serviva ridurre un giorno futuro, ma quel pavimento impediva la compensazione. La condizione è stata rimossa dalla redistribuzione manuale. Il caso 50 kg / 160 cm è coperto da test, sia +1 sia −1 kcal, mantenendo esatta la somma.

### Limiti numerici visibili

| Funzione | Intervallo/condizione | Interpretazione |
|---|---|---|
| Totale manuale per oggi | Maggiore di 0, fino a 7000 kcal | Intervallo numerico gestito; non una raccomandazione di consumo. |
| Redistribuzione della settimana | ±15% del programma, fra 1200 e 5000 kcal per giorno | Limiti software già presenti. Nessun pavimento aggiuntivo pari al programma per BMI <20 o età ≥65. |
| Compensazione | Solo giorni futuri della settimana, con margine sufficiente | Di domenica una modifica indipendente si effettua con “Oggi soltanto”. |
| Giorno futuro già impostato indipendentemente | Non sovrascritto dalla compensazione | Evita di cambiare un altro inserimento manuale senza una revisione. |
| Extra attività | 0–2500 kcal; totale massimo 7000 kcal | Intervallo gestito, non una stima effettuata dall’app. |
| Percentuali manuali P/C/G | Ciascuna 0–100; somma 100% | Verifica aritmetica. Non impone intervalli nutrizionali raccomandati ai target manuali. |

I valori sono formattati in modo leggibile, senza esporre lunghe code decimali. I calcoli conservano precisione interna: arrotondare ogni giorno prima di compensare introdurrebbe errori nella somma.

### Gravidanza, allattamento e contesti specifici

Una policy condivisa dal percorso, dal metabolismo e dagli strumenti del Coach separa capacità organizzative e indicazioni nutrizionali automatiche. La dichiarazione di gravidanza/allattamento viene considerata anche scegliendo il coefficiente maschile o manuale; cambiare coefficiente non la cancella.

In gravidanza, allattamento, per minori, con un piano professionale o quando il contesto protetto non viene specificato, l’app mantiene diario, ricette, organizzazione e inserimento manuale delle indicazioni ricevute. Non genera nuovi piani nutrizionali, deficit, TDEE o revisioni automatiche. Nell’editor giornaliero resta disponibile il totale manuale per oggi, senza redistribuzione automatica o extra da interpretare come fabbisogno suggerito.

La policy si applica anche se il motivo sanitario non viene condiviso con il Coach. In quel caso il server riceve il limite di capacità, non il motivo personale. L’architettura conserva il profilo nel browser: non equivale a una verifica server di un profilo autenticato e non può attestare informazioni mai ricevute.

### Automatismi conservati e dichiarati

Il programma automatico mantiene i limiti precedenti: età 18–78, BMI 18,5–<40, nessun deficit automatico con BMI <20 o età ≥65, nessun surplus automatico con BMI ≥30, energia proposta 1200–5000 kcal. Le variazioni iniziali −10% per riduzione e +5% per aumento sono scelte del software, non prescrizioni universali EFSA o ministeriali.

La media proposta dal percorso è personalizzabile entro ±15%, senza un’ulteriore riduzione di una stima già in deficit o di un profilo per cui quella riduzione non è prevista. Questi controlli del programma automatico non rendono obbligatorio il percorso per usare i target manuali.

## 3. Percorso e dati facoltativi

Il blocco essenziale arriva a 20 domande. Le preferenze aggiuntive sono un blocco facoltativo separato, fino a 19 schermate nel caso con due allenamenti: il totale e la barra si adattano al percorso effettivo. Il riepilogo include le risposte aggiuntive e permette di rivederle.

La bozza conserva fase, domanda, preferenze, seconda sessione, impostazione dei micronutrienti e allergeni temporanei. “Riprendi percorso” torna alla domanda lasciata; “Esci senza salvare” elimina la bozza senza applicare obiettivi.

L’andamento recente ha cinque categorie principali, più la possibilità di non sapere/non rispondere. Le vecchie indicazioni “in aumento”/“in diminuzione” rimangono prive di un’intensità inventata. Il vecchio peso massimo resta storico con il significato originale; il nuovo peso di riferimento è facoltativo e distinto.

Le otto figure corporee per riferimento sono SVG originali del progetto. Le fasce sono un aiuto orientativo dell’interfaccia, non una scala visiva clinicamente calibrata. Il dato misurato è separato dalla stima visiva; nessuno dei due modifica automaticamente calorie o TDEE.

Gli allergeni usano le stesse impostazioni della sezione qualità. Si salvano solo alla conferma finale; saltare la domanda lascia invariati quelli esistenti. I gusti del campo “alimenti da evitare” non vengono trasformati in allergie.

Limiti dei campi facoltativi: passi 0–50000; durata 0–360 minuti per sessione; pesi annotati 20–500 kg; percentuale inserita di massa grassa 0–65%; apporto/TDEE noti 0–6000; testi 180 caratteri; orari HH:MM. Sono verifiche dei campi, che possono restare vuoti.

## 4. Lettere, indice 1–100 e qualità del database

### Significato delle medie

La lettera di un alimento viene accompagnata da origine, versione, categoria e disponibilità dei dati. L’app distingue dato riportato, calcolo locale, calcolo con dati parziali ma grado invariato nell’intervallo, stima e assenza di informazioni.

Le medie di pasto, settimana, mese e anno e l’indice 1–100 sono **indicatori interni NutriTrace**, non un Nutri-Score ufficiale del pasto e non una percentuale di salute. Si pesano per le calorie registrate con grado confrontabile. La codifica interna è A=5 … E=1; l’indice è `1 + 99 × (media − 1) / 4`. Conserva più dettaglio della lettera arrotondata.

Un alimento senza grado non diventa E. Un dato mancante non diventa zero. Le versioni diverse dal 2023 o non indicate non vengono mescolate alle medie confrontabili. Le stime sono distinguibili e non entrano silenziosamente nella serie documentata. Il grafico mostra copertura e periodi vuoti; non interpola giorni mai registrati. La media complessiva usa le registrazioni, non una media non pesata delle medie mensili.

Il Nutri-Score non garantisce la completezza dei micronutrienti, la compatibilità con allergie o l’adeguatezza di tutte le porzioni. La domanda del Coach per un menu salutare rimane una proposta da verificare, non una garanzia automatica di soddisfare ogni target.

### Copertura reale e fusione dei dati

L’audit allegato `quality-v73-audit.json` riporta quanti record del database consegnato possono essere classificati, con quali metodi e che cosa manca. Quel report, rigenerato sul dataset del pacchetto, è il riferimento per i numeri: non si presume che decine di migliaia di record abbiano tutti un grado affidabile.

Le lettere A–D di affidabilità del Master hanno un significato diverso dalle lettere nutrizionali A–E. Identità generica, preparazione, marca, base per 100 g/100 ml, unità e provenienza devono essere compatibili prima di completare campi. Non è implementata una fusione indiscriminata di due database per aumentare artificialmente la copertura. La patch non scarica automaticamente nuovi dataset a pagamento e non certifica l’assenza di obblighi di licenza per ogni fonte storica.

### Traguardi

La richiesta “una settimana solo grado A” è stata sostituita esplicitamente con **“Scopri 7 alimenti A/B”**: sette alimenti distinti realmente registrati, con grado 2023 confrontabile e documentato/calcolato, non stimato. Non richiede una settimana perfetta, non penalizza lettere D/E e non attribuisce punti per calorie basse o BMI.

“Il percorso racconta di me” premia il completamento delle schermate facoltative. Anche “Preferisco non indicarlo” vale: il premio non richiede divulgazione di dati sensibili. Saltare direttamente al riepilogo prima della fine non conta come completamento.

## 5. Micronutrienti e riferimenti

Le sezioni del giorno e le statistiche mostrano quantità registrate, riferimento, scarto, percentuale e barra quando il confronto è applicabile. Le medie non trasformano un dato stimato in una misurazione precisa. Copertura, base e incertezza rimangono parte dell’informazione.

I riferimenti e i collegamenti scientifici già presenti sono nel catalogo `nutrition-reference-v5.js` e nella sezione Dati. Non tutti i nutrienti hanno un obiettivo ufficiale; un limite superiore non è una quantità da raggiungere. Il confronto del diario con un riferimento non dimostra una carenza clinica. Questa patch non costituisce una nuova validazione clinica individuale né un’approvazione del Ministero della Salute.

## 6. Coach operativo, ricette, spesa e consensi

La pianificazione viene portata nelle funzioni del Coach: ricerca nel database, lettura del diario, spiegazione dell’app, ricette, quantità, dispensa, menu e spesa. “Cosa puoi fare per me?” descrive le capacità effettive e i consensi necessari. Le schede organizzative locali possono essere usate senza una chiamata al modello.

Le scritture producono una proposta verificabile. Il pulsante di applicazione salva; il modello non esegue da solo una registrazione, una nuova ricetta o un cambiamento della dispensa. Le proposte sono associate a ID operazione e revisione dei dati, per impedire doppie applicazioni e applicazioni su uno stato cambiato.

I consensi per nutrizione, profilo, salute, peso, ricette e dispensa sono separati. Revocare un consenso impedisce nuove letture/invii di quel gruppo. Il testo già inviato e presente nella conversazione non viene ritirato: per una conversazione senza quel contesto occorre una nuova chat. Le schede locali non vengono inviate automaticamente come cronologia.

### Link e quantità culinarie

Nel campo **Lista / ricetta / link**, un link viene riconosciuto e instradato al recupero ricetta esistente con Interpreta. Dal Coach, l’azione link apre la revisione con il link precompilato: l’utente avvia l’interpretazione e controlla gli ingredienti. Non viene dichiarato un salvataggio inline già effettuato.

Cucchiai e cucchiaini seguono conversioni culinarie per ingrediente, distinte dalle “unità medie” dell’alimento. Le quantità risultanti sono stime da confermare; un ingrediente senza conversione supportata richiede verifica, non un peso arbitrario. Il confronto macro non certifica resa, consistenza o equivalenza culinaria di una sostituzione.

### Provider e quota

La patch conserva il provider/modello configurato e non abilita automaticamente un modello a pagamento o un nuovo servizio. Le schede operative possono richiedere fino a **tre chiamate al modello per turno**; ciascuna consuma la quota ordinaria, non una quota gratuita aggiuntiva.

Restano i budget del backend: 7500 token stimati/minuto, 180000/giorno, limite richieste per IP/ora configurabile con `COACH_IP_HOURLY_LIMIT`, più il limite locale esistente. Le risposte iniziali/successive hanno massimo 800/1600 token. Questi limiti interni non sono una garanzia di disponibilità del piano gratuito del provider: la configurazione effettiva e gli errori di quota si verificano in Preview.

Limiti degli strumenti: 20 risultati per pagina, 40 ingredienti per ricetta preparata dal Coach, 56 voci di menu su sette giorni per proposta, spesa su massimo 31 giorni e 20 ricette esplicite, lettura storica fino a tre anni; il riepilogo peso riusa il limite esistente di 52 settimane. Le omissioni per budget devono essere dichiarate. Non è promesso che un unico messaggio generi correttamente una settimana completa dentro le quote.

Le suite con provider simulato verificano i contratti, non stabiliscono il “miglior modello AI” secondo benchmark indipendenti. Nessun vincitore viene dedotto dai test di questa patch.

**Bring! rimane un’integrazione futura.** Sono disponibili organizzazione locale, checklist e copia del testo; non ci sono sincronizzazione Bring!, acquisti online o invii automatici a terzi.

## 7. Demo, dati personali e test di lungo periodo

Il selettore cambia fra ambiente personale e demo tramite un nuovo caricamento. Le chiavi locali e il database IndexedDB sono separati. Anche bozza, qualità, peso, chat e consensi devono rimanere nell’ambiente attivo.

La demo offre **91, 365 o 1096 giorni**, cioè circa tre mesi, un anno o tre anni. Include profilo, alimenti sintetici, ricette, pasti, acqua, pesate, dispensa, una lista e dati di qualità mancanti intenzionali. Gli scenari sono stabile, leggero aumento, leggera diminuzione, giornate mancanti e peso molto variabile. Oggi è parziale; lo scenario regolare offre 56 giorni precedenti completi per esercitare il motore osservazionale.

Il modello TDEE resta sperimentale: richiede 28–56 giorni completi consecutivi e pesate sufficientemente distribuite, esclude dati insufficienti/instabili, non modifica obiettivi senza conferma. I dati sintetici verificano che software e grafici reagiscano come previsto; **non validano clinicamente l’equazione o le proiezioni**.

Le registrazioni di tre anni occupano circa 4 MB UTF-16 prima dell’ulteriore spazio del browser; la quota è condivisa con i dati personali dello stesso sito. Se non basta, la generazione fallisce e ripristina i valori precedenti; si può scegliere 91 giorni. Il rollback è verificato anche per cancellazioni e ingrandimenti precedenti al fallimento. Un errore persistente dello storage o un’interruzione del processo non equivale a una garanzia transazionale di un database server: mantenere il normale backup dell’app.

Le richieste AI in demo usano le API configurate e consumano la stessa quota del servizio. La demo non contiene credenziali, un backend AI finto spacciato per reale o dati di altre persone.

## 8. Grafica e provenienza

Le nuove silhouette sono disegni vettoriali originali nel codice, senza utilizzare le immagini di riferimento dell’utente. Le icone Unicode possono cambiare fra sistemi. La patch non certifica retroattivamente copyright e licenze delle risorse storiche del logo o di terzi; fare riferimento all’inventario risorse del pacchetto. Nuove risorse originali e dipendenze esterne devono restare distinguibili.

## 9. Che cosa resta da verificare sul deployment

Il report dei test automatici e l’eventuale report DOM dichiarano il loro ambiente. Un’esecuzione in jsdom non verifica layout fisico, fotocamera/barcode, ciclo di aggiornamento del service worker, qualità delle risposte del provider reale o variabili Vercel. Questi punti sono raccolti in `CHECKLIST_PREVIEW_V73.md`, con esiti inizialmente non compilati.

Per dettagli implementativi: `percorso-v73.md`, `coach-v73.md`, codice e suite del pacchetto. Per l’algoritmo nutrizionale e i riferimenti già utilizzati: i collegamenti mostrati in Dati e nei moduli, senza attribuire a queste fonti soglie che sono invece scelte dell’app.
