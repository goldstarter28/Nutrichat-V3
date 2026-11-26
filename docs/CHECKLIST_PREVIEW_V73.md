# NutriTrace V7.3 — checklist funzionale Preview

## Come compilare

Questa è una checklist da eseguire sull’app distribuita. **Nessuna riga è già marcata PASS.** I test automatici e i controlli DOM hanno report separati e non sostituiscono la prova di fotocamera, browser, layout, provider o Vercel reali.

Per ogni ID annotare `PASS`, `FAIL`, `NON ESEGUITO` oppure `NON APPLICABILE`, ambiente, dispositivo/browser e prova osservata. Usare PASS soltanto se si è riprodotta la procedura e visto l’esito atteso. Se una funzione dipende da API/permessi non disponibili, usare NON ESEGUITO con il motivo.

**Sessione:** deployment __________ · versione __________ · data __________ · browser/dispositivo __________

Eseguire le prove che modificano molti dati nella demo. Il passaggio finale sui dati personali deve verificare la conservazione di dati noti. Seguire l’installer per backup e integrazione; questo documento non impartisce comandi Git né autorizza merge/deploy automatici.

## A. Avvio, navigazione e leggibilità

| ID | Prova | Esito atteso | Esito |
|---|---|---|---|
| A01 | Aprire la Preview con un archivio esistente. | App avviata, nessuna schermata bianca o errore JS bloccante; diario, ricette, target e pesate presenti. | NON ESEGUITO |
| A02 | Provare larghezze 320, 390, 768 e 1440 px, poi un telefono reale. | Nessuno scorrimento orizzontale involontario; testo e pulsanti leggibili; finestra di inserimento usabile con tastiera aperta. | NON ESEGUITO |
| A03 | Aprire Altro da mobile. | Mostra le sezioni non già presenti nella barra; Micro accessibile separatamente; Traguardi immediatamente prima di Dati. | NON ESEGUITO |
| A04 | Aprire Analisi e Obiettivi. | Strategia e metabolismo in Analisi; Obiettivi mantiene l’editor manuale e il pulsante del percorso. | NON ESEGUITO |
| A05 | Navigare con Tab/Invio/Escape e zoom 200%. | Focus visibile; dialoghi raggiungibili e richiudibili; colore accompagnato da lettera/testo. | NON ESEGUITO |
| A06 | Aggiornare una sessione che aveva la versione precedente e poi aprire offline. | Asset coerenti con V7.3, funzioni locali disponibili; le API non vengono presentate come funzionanti offline. | NON ESEGUITO |

## B. Home e inserimento rapido

| ID | Prova | Esito atteso | Esito |
|---|---|---|---|
| B01 | Aprire Oggi. | Riga compatta “Registrazione della giornata” sopra “La giornata in un colpo d’occhio”; calorie totali e rimanenti leggibili. | NON ESEGUITO |
| B02 | Controllare ordine delle schede. | Idratazione sotto i pasti; Alimenti del giorno in una sezione separata; nessuna tendina che duplica l’intero diario. | NON ESEGUITO |
| B03 | Aprire + e osservare le modalità. | Card compatta, tre recenti; Alimento e Lista / ricetta / link accessibili senza una lunga lista iniziale. | NON ESEGUITO |
| B04 | Registrare un cibo a 83 g; usarlo fra gli ultimi tre. | Propone/aggiunge gli 83 g dell’ultima registrazione pertinente, una sola volta nel giorno/pasto scelto. | NON ESEGUITO |
| B05 | Cercare normalmente lo stesso cibo dall’archivio, poi un cibo non più fra i tre recenti. | Quantità da scegliere; nessun riuso silenzioso degli 83 g. I valori dell’alimento in archivio non sono modificati. | NON ESEGUITO |
| B06 | Aggiungere dalla Home senza un pasto selezionato. | Il selettore del pasto si apre; dopo la scelta compare una sola registrazione. Annullarlo non aggiunge nulla. | NON ESEGUITO |
| B07 | Aprire fotocamera dal punto di inserimento; scattare/selezionare una foto e rivedere il risultato. | Resta nel flusso di inserimento; può confermare cibo, quantità e pasto senza passare obbligatoriamente alla pagina Ricerca. | NON ESEGUITO |
| B08 | Ripetere B07 con permesso negato e con API Vision non configurata. | Messaggio chiaro, nessuna registrazione incompleta o falsa conferma. Il test positivo richiede configurazione reale corretta. | NON ESEGUITO |
| B09 | Aprire barcode dal punto di inserimento e leggere un prodotto noto; provare un codice ignoto. | Il prodotto noto si rivede e aggiunge al diario; il codice ignoto non crea un alimento inventato. Chiudere non salva. | NON ESEGUITO |
| B10 | Cercare “yogurt”, scorrere/paginare; provare ricerca AI. | Almeno 20 risultati ove presenti, ordinamento utile e corrispondenze reali; l’interpretazione non sostituisce arbitrariamente il nome con un alimento generico non pertinente. | NON ESEGUITO |
| B11 | Aggiungere acqua, annullare, cambiare data e obiettivo del giorno. | Totale e storico coerenti per data, senza spostare o duplicare registrazioni. | NON ESEGUITO |
| B12 | Aprire la settimana con alcuni giorni vuoti. | Mostra medie giornaliere con unità /giorno e giorni/copertura; i giorni senza dati non diventano consumo zero. | NON ESEGUITO |

## C. Pasti, quantità e ricette

| ID | Prova | Esito atteso | Esito |
|---|---|---|---|
| C01 | Aprire Colazione/Pranzo/Cena con alimenti già registrati. | Kcal, P/C/G/F in grammi, elenco cibi e copia del pasto disponibili direttamente. | NON ESEGUITO |
| C02 | Premere Info su un alimento e poi Modifica. | Info apre i dettagli; Modifica permette di cambiare i grammi del diario, senza alterare la composizione dell’archivio. | NON ESEGUITO |
| C03 | Cambiare 100 g in 80 g, poi annullare; provare quantità vuota/negativa. | Totali ricalcolati correttamente, annullamento coerente, input invalidi non salvati. | NON ESEGUITO |
| C04 | Modificare la quantità di una porzione di ricetta raggruppata. | Tutti gli ingredienti si ridimensionano nella stessa proporzione; non viene modificato un solo ingrediente per errore. | NON ESEGUITO |
| C05 | Copiare colazione di ieri e spostare un cibo o una ricetta in un altro pasto. | Quantità e gruppi conservati, pasto corretto, nessuna duplicazione accidentale o perdita dei nutrienti. | NON ESEGUITO |
| C06 | Inserire una lista nel campo Lista / ricetta / link, usare anche la dettatura. | Interpretazione e revisione funzionanti; il nuovo nome del campo non elimina la voce. | NON ESEGUITO |
| C07 | Inserire “un cucchiaio abbondante di fecola” e un cucchiaino di un ingrediente supportato. | Misura culinaria in grammi stimati, con possibilità di revisione; niente “1 × unità media 173 g”. | NON ESEGUITO |
| C08 | Usare un cucchiaino con ingrediente senza densità/conversione supportata. | Richiede verifica; non inventa un peso universale. | NON ESEGUITO |
| C09 | Incollare direttamente un link ricetta e premere Interpreta. | Recupero nel flusso esistente; ingredienti e resa da verificare prima del salvataggio, senza card Importa obbligatoria. | NON ESEGUITO |
| C10 | Salvare una ricetta senza registrarla, poi aggiungerla e modificarla. | Salva solo e aggiungi al giorno restano distinti; archivio, porzioni e diario coerenti. | NON ESEGUITO |

## D. Percorso e preferenze

| ID | Prova | Esito atteso | Esito |
|---|---|---|---|
| D01 | Aprire il percorso dagli Obiettivi. | Schermata dedicata, una domanda alla volta, numero/progresso, X e Indietro; editor manuale sottostante conservato. | NON ESEGUITO |
| D02 | Cambiare una risposta tornando indietro. | Domande condizionali e conteggio corretti; nessuna risposta visualizzata per il ramo escluso. | NON ESEGUITO |
| D03 | Arrivare alle facoltative, scegliere due allenamenti e compilare la seconda sessione. Premere X → Riprendi percorso. | Ritorna esattamente alla seconda sessione con i dati inseriti, non al bivio delle facoltative. | NON ESEGUITO |
| D04 | Da D03 salvare la bozza e uscire, riaprire; ripetere con ricarica della pagina. | Fase, domanda, campi e progresso ripristinati. Nessun target applicato prima della conferma finale. | NON ESEGUITO |
| D05 | Arrivare al riepilogo, tornare a una facoltativa e cambiare risposta. | Riepilogo essenziale e facoltativo aggiornato, compresa la seconda sessione. | NON ESEGUITO |
| D06 | Passare da due allenamenti a uno; scegliere nessun allenamento nelle essenziali. | Seconda sessione rimossa dal ramo attivo, conteggio aggiornato; nessuna doppia aggiunta di calorie al PAL. | NON ESEGUITO |
| D07 | Provare andamento, peso di riferimento e composizione corporea. | Cinque categorie; vecchi dati senza intensità inventata; riferimento distinto dal vecchio massimo; misurazione/visivo/sconosciuto distinti, otto figure originali e dicitura orientativa. | NON ESEGUITO |
| D08 | Cambiare solo fascia visiva della massa grassa. | Nessuna variazione delle calorie o del TDEE. | NON ESEGUITO |
| D09 | Selezionare allergeni; controllare prima e dopo Applica e dopo annullamento. | Prima invariati; dopo stessi allergeni nelle altre sezioni; annullamento ripristina; gusti “evita” separati. | NON ESEGUITO |
| D10 | Saltare allergeni scegliendo di non indicarli. | Impostazioni attuali conservate, non cancellate. | NON ESEGUITO |
| D11 | Completare tutte le facoltative con alcune risposte “Preferisco non indicarlo”; poi provare riepilogo anticipato. | Traguardo nella prima prova; nessun nuovo completamento nella seconda. Nessun obbligo di condividere risposte sensibili. | NON ESEGUITO |
| D12 | Applicare il percorso, poi modificare manualmente gli obiettivi. | Editor funzionante, valori leggibili fino a due decimali, modifica consentita; nessuna perdita di ricette, pasti registrati o pesate. | NON ESEGUITO |

## E. Calorie, metabolismo e profili protetti

| ID | Prova | Esito atteso | Esito |
|---|---|---|---|
| E01 | Profilo senza percorso completato, target manuali validi. Aprire Cambia obiettivi per oggi. | Editor disponibile con modalità e conseguenze esplicite. | NON ESEGUITO |
| E02 | Con 50 kg, 160 cm, target 1800, giorno prima della domenica: Mantieni media → 1801 e poi 1799. | Nessun errore causato dal BMI; giorni futuri compensati; media 1800 e passato invariato. | NON ESEGUITO |
| E03 | Stesso profilo: Oggi soltanto → 1700. | Solo oggi cambia; domani resta uguale; anteprima della media ridotta di 100/7 kcal rispetto al budget uniforme. | NON ESEGUITO |
| E04 | Di domenica cambiare il totale con Mantieni media, poi con Oggi soltanto. | Prima spiega l’assenza di giorni futuri; seconda funziona senza riscrivere il passato. | NON ESEGUITO |
| E05 | Aggiungere 300 kcal extra attività, poi impostare totale manuale 2000. | Il nuovo totale è 2000, non 2300; l’extra precedente non si somma due volte. | NON ESEGUITO |
| E06 | Personalizzare P/C/G con somma 100%, poi con somma diversa. | Energia dei macro coerente nella prima prova; input respinto nella seconda; fibre/micro separati. | NON ESEGUITO |
| E07 | Gravidanza e allattamento, anche con coefficiente maschile e con consenso sanitario al Coach disattivato. | Nessun piano, TDEE, deficit, menu automatico o proposta personalizzata; organizzazione e inserimenti manuali espliciti restano disponibili. | NON ESEGUITO |
| E08 | Provare minore, piano professionale, contesto non indicato, scelta manuale del coefficiente. | Motivazione del limite automatizzato mostrata; i target manuali non diventano consigli dell’app. | NON ESEGUITO |
| E09 | Demo stabile in Analisi. | TDEE osservazionale circa 2400; storico, grafico e intervallo indicati come sperimentali; pulsante Storico delle revisioni leggibile. | NON ESEGUITO |
| E10 | Demo diminuzione/aumento e scenari mancanti/rumorosi. | Direzione del bilancio coerente; mancanti/rumorosi senza stima utilizzabile né proposta automatica. | NON ESEGUITO |
| E11 | Proposta di revisione con dati adatti: visualizzarla senza confermare, poi confermare. | Prima nessun target mutato; dopo storico coerente; target passati preservati. | NON ESEGUITO |

## F. Qualità e micronutrienti

| ID | Prova | Esito atteso | Esito |
|---|---|---|---|
| F01 | Alimenti A–E noti, alimento senza dati, stima e versione diversa. | Badge colorato con lettera e origine; sconosciuto N/D; stime/versioni non confrontabili riconoscibili. | NON ESEGUITO |
| F02 | Pasto con due alimenti noti e uno sconosciuto. | Media e indice interno 1–100 visibili; copertura incompleta dichiarata, ignoto non trattato come E. | NON ESEGUITO |
| F03 | Grafico settimana/mese/anno e navigazione fra periodi, compreso febbraio bisestile. | Calendario corretto, vuoti non interpolati, tabella accessibile; media del periodo pesata sulle registrazioni. | NON ESEGUITO |
| F04 | Attivare/disattivare inclusione stime. | Cambiamento esplicito dei dati inclusi; nessuna precisione ufficiale attribuita alla stima. | NON ESEGUITO |
| F05 | Registrare sette alimenti distinti A/B documentati; ripetere uno, aggiungere ignoto o stima. | Traguardo “Scopri 7 alimenti A/B” conta distinti confrontabili; duplicati/ignoti/stime non lo completano. Nessun obbligo “settimana solo A”. | NON ESEGUITO |
| F06 | Aprire Micro e i micronutrienti del giorno. | Quantità consumate, obiettivo/scarto, percentuale e barra leggibili quando applicabili. | NON ESEGUITO |
| F07 | Usare dati micro parziali/stimati o con base non confrontabile. | N/D, copertura/incertezza visibili; nessun valore assente considerato zero o diagnosi di carenza. | NON ESEGUITO |
| F08 | Aprire Dati → fonti e note. | Riferimenti e metodo consultabili; limiti superiori distinti dagli obiettivi; copertura reale nell’audit, non promessa per tutto il database. | NON ESEGUITO |

## G. Coach come assistente dell’app

| ID | Prova | Esito atteso | Esito |
|---|---|---|---|
| G01 | Aprire “Cosa puoi fare per me?” senza autorizzare contesto cloud. | Catalogo locale delle funzioni reali; condivisione nutrizionale visibile e facoltativa. | NON ESEGUITO |
| G02 | Ricerca globale nel Coach, poi autorizzare archivio/diario. | Prima nessun dato personale inviato; poi solo gruppi consentiti; risultati reali con ID. | NON ESEGUITO |
| G03 | Chiedere una registrazione esplicita e confermarla, anche con doppio clic. | Anteprima modificabile; un solo salvataggio. Nessuna scrittura senza conferma. | NON ESEGUITO |
| G04 | Cambiare il diario prima di applicare una proposta già pronta. | Proposta obsoleta rifiutata/ricalcolabile, senza sovrascrivere la modifica più recente. | NON ESEGUITO |
| G05 | Revocare un consenso mentre una richiesta è in corso. | Nessun ulteriore invio di quel contesto; messaggi già inviati non dichiarati cancellati dal provider. | NON ESEGUITO |
| G06 | Con consenso ricette, chiedere una ricetta reale dell’archivio e una nuova con due ingredienti. | Legge solo ricette autorizzate; ingredienti risolti, grammi e nutrienti verificabili; salva dopo conferma. | NON ESEGUITO |
| G07 | Sostituire un ingrediente di una ricetta. | Variante separata; originale intatto; differenze nutrizionali e resa stimata visibili. | NON ESEGUITO |
| G08 | Inviare link ricetta al Coach. | Apre revisione con link precompilato; spiega che la ricetta non è ancora salvata; Interpreta e conferma funzionano. | NON ESEGUITO |
| G09 | Inserire in dispensa una quantità nota e una sconosciuta, con scadenza. | Quantità sconosciuta distinta da zero; operazioni locali utilizzabili senza chiamata al modello. | NON ESEGUITO |
| G10 | Preparare spesa da ricetta/menu, con stock noto e scaduto; spuntare/copiare. | Aggregazione e sottrazione corrette; scaduto non utilizzato; dati sconosciuti segnalati; nessun invio Bring! simulato. | NON ESEGUITO |
| G11 | Chiedere menu di un giorno, poi una settimana. | Proposta compatibile con dati e limiti; nutrienti/omissioni controllabili; salvare menu non registra pasti come già mangiati. | NON ESEGUITO |
| G12 | Chiedere abitudini e micronutriente su una settimana con vuoti. | Medie dei dati disponibili e copertura esplicita; nessun digiuno o carenza dedotto dai vuoti. | NON ESEGUITO |
| G13 | Provare profilo protetto, quote esaurite, risposta troncata ed errore del provider. | Nessuna proposta finta applicabile, nessuna promessa di piano personalizzato; errori comprensibili e dati conservati. | NON ESEGUITO |
| G14 | Chat Markdown, storico, modifica messaggio, audio ascolta/pausa/riprendi/stop. | Funzioni precedenti conservate; nessuna chiamata aggiuntiva nascosta necessaria per schede locali. | NON ESEGUITO |
| G15 | Confermare azione e usare Annulla; poi modificare dati e riprovare un vecchio annullamento. | Ripristino disponibile quando coerente; nessuna sovrascrittura di modifiche successive. | NON ESEGUITO |

## H. Demo, isolamento e conservazione

| ID | Prova | Esito atteso | Esito |
|---|---|---|---|
| H01 | Annotare un pasto, una pesata, acqua e un’allergia personali; aprire la demo. | Banner demo evidente; registrazioni sintetiche separate; i dati personali non vengono copiati o sostituiti. | NON ESEGUITO |
| H02 | Cambiare quantità, chat, consensi, preferenze e bozza nella demo; tornare al personale. | Archivio personale identico a quello annotato; nessun badge, chat o consenso trasferito. | NON ESEGUITO |
| H03 | Tornare alla demo dopo un ricaricamento. | Modifiche demo conservate; ambiente corretto e distinguibile. | NON ESEGUITO |
| H04 | Generare 91, 365 e 1096 giorni; provare grafici annuali e cambio anno. | Storico del periodo scelto, dati collegati coerentemente; nessun falso “anno completo” per un periodo più corto. | NON ESEGUITO |
| H05 | Provare tutti i cinque scenari. | Stabile, aumento e diminuzione producono andamenti coerenti; mancanti/rumorosi non forzano il TDEE. | NON ESEGUITO |
| H06 | Generare con spazio disponibile insufficiente. | Messaggio chiaro, dati precedenti ripristinati e personale intatto; possibilità di scegliere 91 giorni. | NON ESEGUITO |
| H07 | Rigenerare la demo ed effettuare operazioni su dataset importati/cache. | Namespace IndexedDB separato; nessuna cancellazione o modifica del database personale. | NON ESEGUITO |
| H08 | Esportare/importare un backup nella demo e controllare acqua, peso, qualità, ricette e target. | Le sezioni previste sono conservate; il test non modifica l’ambiente personale. | NON ESEGUITO |

## Esito finale da compilare

- Versione/report automatico esaminato: __________
- Report DOM esaminato e relativi limiti: __________
- Controlli Preview PASS: __________
- Controlli FAIL e riproduzione: __________
- Controlli NON ESEGUITI, motivo e impatto: __________
- Configurazione API/provider verificata senza riportare chiavi: __________
- Prova sul dispositivo reale completata: __________

Un risultato positivo dei test statici non attribuisce automaticamente PASS a questa checklist. Prima di considerare concluso il collaudo, risolvere i FAIL che impediscono l’uso richiesto e dichiarare i punti rimasti non verificati.
