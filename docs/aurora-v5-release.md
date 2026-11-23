# NutriTrace V5 — verifica dei requisiti 5.1–5.7

Versione del pacchetto: **5.7.0**, 23 novembre 2026. Base verificata: Aurora V4, commit `c11dc15685e1751b3f64dfbe1c3f8dffeacef2e2` di `goldstarter28/Nutrichat-V3`.

Questo documento distingue le funzioni implementate dalle prove che richiedono una preview e un dispositivo. La numerazione 5.1–5.7 raggruppa i requisiti della conversazione in un unico rilascio; non richiede sette installazioni.

## Checklist completa

| Richiesta | Implementazione nel pacchetto | Evidenza e limiti |
| --- | --- | --- |
| Ridurre l’ingombro di “Cosa hai mangiato oggi” | Compositore compatto, tre suggerimenti e righe ridotte; comandi Alimento, Voce / ricetta e Ricette salvate in alto. | DOM: una sola istanza del compositore. CSS adattivo; layout fisico da verificare in preview. |
| Mostrare gli ultimi tre alimenti realmente mangiati | Tre alimenti distinti ricavati dalle registrazioni del diario, ordinati per data e timestamp quando disponibile; per i record precedenti, ordine d’inserimento. | Test unitari e flusso DOM con dati sintetici. Non vengono usate tre voci casuali dell’archivio. |
| Riutilizzare l’ultima quantità solo nei recenti | Il suggerimento mostra e riprende grammi e unità dell’ultima registrazione; mantiene la provenienza della porzione stimata. Una modifica esplicita del peso rimuove i vecchi metadati della quantità. | Verificati riuso di 123 g e unità in pezzi, senza aggiungere grammi alla definizione dell’alimento. |
| Non precompilare il peso nelle ricerche normali | Ricerca ordinaria e riuso di una ricetta chiedono una nuova quantità; nessun peso precedente viene scritto nella scheda dell’alimento. | DOM: ricerca dello stesso alimento, campo vuoto, inserimento esplicito di 77 g. |
| Tasti foto e barcode direttamente nel diario | Tasti accanto al titolo e nel dialogo aperto dal pasto. Aprono i componenti esistenti nello stesso flusso. | Verificato che la scheda Oggi resta attiva. Decodifica ottica e fotocamera reale non simulate come risultati validati. |
| Inserire foto/barcode senza passare da Cerca e Archivio | Revisione del risultato e della porzione, poi registrazione diretta. Se serve, la scheda viene creata internamente; prodotti esistenti vengono riutilizzati. | DOM con API simulate: nessuna registrazione prima della conferma, data storica e pasto conservati. |
| Accesso immediato ad Alimento e Voce / ricetta dal “+” | Dialogo dedicato con modalità subito disponibili; sui dispositivi piccoli occupa lo schermo. | Verificati dialogo singolo, data/pasto, chiusura dopo inserimento. Altezza con tastiera mobile da controllare sul dispositivo. |
| Pasti completi senza tendina duplicata | Un solo diario reale: ogni pasto mostra calorie, P/C/G/F in grammi, alimenti, copia di ieri, aggiunta e preferiti; righe con spostamento ed eliminazione. | Test sui totali, sulle unità, sui callback e sulla visibilità delle righe fuori dai `details`. |
| “Alimenti del giorno” in una sezione separata | Elenco dedicato distinto dai pasti e dal compositore. | Componente `DayFoods` separato; nessuna seconda lista nascosta dei pasti. |
| Idratazione sotto i pasti | Ordine effettivo del documento: compositore, pasti, idratazione, alimenti del giorno, riepilogo settimana. | Verifica DOM dell’ordine; nessun riordino solo visivo che alteri la navigazione da tastiera. |
| Settimana con medie anziché somme | Energia in kcal/giorno; P/C/G/F in g/giorno. Denominatore basato sui giorni con un valore disponibile per ciascun nutriente. | Test su giorni assenti, zero esplicito e copertura; denominatore visibile. Non divide sempre per sette. |
| Micro in una sezione autonoma | Destinazione Micro, accessibile da Altro e dai riepiloghi; ricerca nutriente, preferiti, giorno e media della settimana. | Flusso DOM e test di navigazione. I micro preferiti possono restare anche nel riepilogo di Oggi/Obiettivi. |
| Altro senza sezioni già nella barra | Altro contiene Archivio alimenti, Peso, Micro e Dati, assenti dalla barra mobile principale. | Test del filtro delle destinazioni; la navigazione desktop può mostrare tutte le sezioni. |
| Micro con quantità, quanto manca, percentuale e barra | Card leggibili con quantità registrata, obiettivo giornaliero, scarto, percentuale e barra. Stesso criterio nei riepiloghi dei micro preferiti. | Quantità non disponibili = N/D. Barre di completamento disattivate per basi non comparabili e voci senza riferimento applicabile; sodio mostrato come contenimento. |
| Statistiche sui micro senza falsa precisione | Medie e grafico degli ultimi 30 giorni, copertura pesata per grammi, tabella giornaliera, etichette per stime e qualità limitata. | Test su dati mancanti, grade C/D, stime AI/porzioni e forme RE/RAE, NE, DFE ecc. La copertura non è una probabilità di accuratezza. |
| Numeri degli obiettivi più leggibili | Risultati calcolati formattati fino a due decimali. La precisione interna dei calcoli resta conservata. | Le quantità manuali molto piccole non vengono forzate a zero soltanto per nascondere decimali. |
| Coach più curato | Messaggi, apertura della conversazione, domande iniziali, cronologia e controlli vocali riorganizzati nello stile Aurora. | Regole e API backend conservate; test su consensi e contesto. Aspetto su dispositivi reali da verificare. |
| “Condividi informazioni nutrizionali” più evidente | Riquadro dedicato con stato Attivo/Spento, sopra la conversazione. | Parte spento a ogni apertura della sezione; consenso ai messaggi, statistiche, peso e preferenze sono scelte distinte. |
| Wizard approfondito, massimo 20 domande | Percorso condizionale di 17–20 domande su dati necessari al calcolo e abitudini; una domanda per schermata, progresso, risposte date/rimanenti, indietro, X, bozza e ripresa. | Test di tutte le rotte sul limite di 20, bozza e flusso DOM completo. Nessun elenco di 20 domande espanso sotto la pagina. |
| Wizard dentro Obiettivi | Riquadro “Personalizza i miei obiettivi”, pulsante “Inizia il percorso” / “Rivedi il percorso”. | La pagina e gli editor manuali restano disponibili. |
| Applicare gli obiettivi automaticamente e poterli cambiare | Riepilogo prima di applicare. Energia e macro vengono proposti dal calcolo documentato; aggiornamento dei riferimenti micro con opzione esplicita. Ripristino dell’ultima configurazione precedente. | DOM: Calcio manuale 1234 conservato con opzione micro spenta, applicazione e ripristino esatto di profilo/obiettivi. |
| Condividere il contesto del wizard solo se scelto | Risposte locali; il Coach può ricevere un riepilogo limitato di preferenze/abitudini solo con condivisione nutrizionale più opzione specifica. | Nessun invio automatico al completamento del wizard; risposte cliniche e misure anagrafiche escluse dall’allowlist. |
| Verificare i valori micro e citare le fonti in Dati | Audit delle 47 voci del catalogo; riferimenti EFSA, confronto dichiarato con LARN SINU, limiti con unità e ambito corretti, fonti consultabili nella sezione Dati. | Vedi `nutrition-audit-v5.md`. Non viene attribuita un’approvazione del Ministero o di un medico all’app. |
| Migliorare anche Ricette | Nome, ingredienti e candidati modificabili, resa finale, porzione consumata, numero di porzioni, salvataggio senza registrazione, riuso e modifica. | DOM: ingredienti 200+100 g, resa 300 g, consumo 150 g → 100+50 g; riuso 75 g → 50+25 g; provenienza e intervalli della stima conservati. |
| Un solo ZIP, pochi passaggi | Installer con verifica hash, branch dedicato da main, backup, test automatici, idempotenza e ripristino. | Nessuna chiave nel pacchetto. Non richiede modifiche manuali a blocchi di JavaScript. |

## Decisioni di calcolo e interpretazione

Il percorso usa una stima iniziale Mifflin–St Jeor × PAL. Il PAL include già l’allenamento. La ripartizione iniziale 20/50/30 e le variazioni −10%/+5% sono scelte modificabili dell’app, dichiarate nel riepilogo. Non sono una dieta clinica, sportiva o una prescrizione delle fonti citate.

La generazione automatica è limitata ai profili per i quali il percorso implementato è applicabile. Per minori, età esterne all’intervallo studiato dell’equazione, gravidanza/allattamento, piano individuale indicato o altri dati fuori dall’ambito gestito, vengono salvate le preferenze e mantenuti gli obiettivi presenti. L’utente può sempre usare gli editor manuali.

I valori dei micronutrienti salvati in precedenza non vengono sostituiti al caricamento. Vengono aggiornati i metadati delle fonti e gli UL confrontabili; le quantità personali cambiano soltanto con l’azione esplicita dell’utente. Nei nuovi profili i micro senza contesto non ricevono un valore arbitrario: si possono impostare manualmente o applicare dal riepilogo del percorso, quando disponibili. Zinco, ferro, forme vitaminiche e riferimenti combinati hanno regole specifiche documentate nell’audit.

Le statistiche descrivono i dati inseriti. Non diagnosticano carenze, tossicità o adeguatezza individuale. Un valore presente ma stimato non diventa preciso perché è scritto con due decimali. Quando il database usa una base chimica diversa da quella del riferimento, si leggono le quantità registrate con una nota e si disabilita il confronto; una somma di basi non omogenee non è un apporto equivalente validato.

## Privacy, dati e compatibilità

Il provider del Coach resta quello configurato nel progetto: l’integrazione attuale usa **GroqCloud**. Il pacchetto non sostituisce il provider con Grok e non tocca chiavi, modelli o variabili Vercel. Il problema Vision `NOT_CONFIGURED`, già risolto nelle impostazioni, non viene reintrodotto da una configurazione inclusa nello ZIP.

Il wizard non effettua chiamate di rete. Il Coach invia domande e messaggi precedenti con il consenso già previsto; le statistiche richiedono l’opzione visibile. Spegnere la condivisione interrompe i nuovi riepiloghi, ma non cancella dati eventualmente scritti nei messaggi precedenti. Peso e preferenze richiedono scelte ulteriori. L’esportazione di un backup completo include il profilo locale.

La dettatura usa il servizio disponibile nel browser: il browser può elaborare l’audio tramite i propri servizi. Se non è supportata resta disponibile l’inserimento testuale o il microfono della tastiera. Foto e interpretazione AI continuano a usare le API esistenti e richiedono connessione/configurazione funzionanti.

Ricette e risposte del percorso usano nuovi dati locali versionati. L’esportazione completa viene aggiornata alla versione 7 e comprende le ricette. Il database alimentare, il dizionario, gli endpoint backend e gli archivi già presenti restano conservati. Il ripristino del codice non annulla ciò che l’utente ha registrato successivamente nel browser.

## Verifiche incluse

- Suite Node del repository, estesa con diario, porzioni, riferimenti, wizard, menu/Coach e service worker.
- 17 flussi DOM con **React 18.3.1 reale** e jsdom 26.1.0: vengono caricati gli script dell’app nell’ordine di `index.html` e verificati eventi e `localStorage` isolato.
- Test dell’installer in repository temporanei, più prova di installazione del payload completo, seconda installazione e ripristino.
- Sintassi dei file JavaScript e integrità SHA-256 di payload, base e file preservati.

Le risposte HTTP della suite DOM sono fixture sintetiche. Fotocamera, decoder ottico, microfono, provider AI, Redis, quote/configurazione Vercel, layout su telefoni e service worker in un browser reale richiedono la preview. I test del service worker eseguono i suoi handler in una VM con rete e cache controllate; non sono una prova PWA su iOS o Android.

Il report della build è incluso nel pacchetto, insieme al runner opzionale ripetibile. Per i comandi vedere `README.md` nella cartella `NutriTrace_V5`.
