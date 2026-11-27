# NutriTrace V7.3.2 — perimetro e decisioni

## Base e perimetro

Patch mirata sulla V7.3.1, commit `cc87545f1492e6b36a007e4d52358475c5230ace` del ramo `feature/nutritrace-v73`. I file esistenti della base usata sono stati confrontati con gli oggetti Git del repository. L'installer controlla gli hash dei file interessati e rifiuta versioni incompatibili prima di scrivere.

Le modifiche riguardano le richieste su nomi/quantità, impaginazione dei risultati e dei comandi ingrediente, sezione Peso, modalità demo, distribuzione settimanale e icona. Il manifesto elenca ogni file distribuito. I report storici V7.3 e V7.3.1 non vengono sostituiti da nuovi risultati.

## Conteggio dei cibi

**Cibi conteggiati: X / Y** è il rapporto fra registrazioni con grado confrontabile e calorie note e tutte le registrazioni del periodo. Lo stesso alimento in due pasti conta due volte. La percentuale secondaria mantiene il significato di copertura energetica. Le medie A–E e l'indice interno 1–100 conservano la ponderazione energetica esistente: il nuovo testo non trasforma quelle medie in medie per numero di cibi.

Non sono stati aggiunti alimenti, valori nutrizionali o nuove lettere Nutri-Score al Master. I 38.230 record e il relativo indice di qualità restano byte per byte invariati. In questa patch si correggono la ricerca delle identità richieste e la presentazione dei dati già presenti.

## Quantità e ingredienti

Il problema dei link nasceva dalla rimozione delle quantità solo a inizio riga. Ora nome e quantità vengono separati anche a fine riga; il testo originale resta in `raw`. Farina 00, percentuali e descrittori dell'alimento sono conservati. Grammi espliciti e quantità modificate dall'utente hanno la precedenza.

Le quantità non determinate rimangono tali. `q.b.` non vale zero, una porzione standard o un cucchiaio inventato. Il flusso di revisione chiede la massa usata. La selezione automatica per questi ingredienti richiede identità esatta fra nome/alias, evitando per esempio l'associazione di Sale q.b. a un pesce sotto sale. I candidati restano selezionabili manualmente.

Frazioni miste e il simbolo di divisione Unicode sono gestiti. Zero, valori negativi, frazioni con denominatore zero e intervalli di peso non diventano numeri plausibili ricavati da una parte della stringa. Forme di porzione non supportate non ripiegano sul peso del frutto intero. Un volume privo di una conversione verificata resta da pesare.

La conversione aggiunta per estratto di vaniglia semplice è indicativa e richiede conferma: Health Canada, Canadian Nutrient File, codice alimento 216, riporta 5 ml = 4,3 g e 15 ml = 13,2 g. Fonte primaria consultata il 27/11/2026: https://aliments-nutrition.canada.ca/cnf-fce/serving-portion?id=216 . La regola non è estesa a budini, preparati diversi o cucchiai abbondanti; marca e riempimento possono cambiare la massa.

Per gli spicchi di mandarino non è stata inventata una massa universale. Il motore riconosce nome e misura, propone la selezione corretta e conserva i grammi come da confermare. La quantità effettivamente confermata può essere riutilizzata dal sistema locale già esistente per quell'alimento e quell'unità. Le regole per frutto intero e per spicchio restano separate.

Il confronto prima/dopo sul Master ha confermato due limiti preesistenti: “olio extravergine” senza “di oliva” non restituisce candidati nel percorso ingredienti; la ricerca generica “sale” può ordinare prima prodotti salati. Questa patch non riscrive il ranking generale: protegge l'associazione automatica nel nuovo flusso q.b. La forma esplicita “olio di oliva” continua a funzionare. Questi limiti sono segnalati per una futura modifica approvata separatamente.

## Peso

Il componente Peso da raggiungere usa lo stesso valore esistente `nutritrace_body_weight_v1.target` nelle due sezioni. Non crea un secondo obiettivo né cambia le calorie. Il limite preesistente di 20–500 kg per il campo è conservato; il salvataggio si interrompe se i dati del peso non sono leggibili.

Variazione e Variazione % confrontano la prima e l'ultima misura del periodo scelto, non medie di gruppi. Il periodo filtra anche il primo grafico; il grafico peso/calorie conserva i propri controlli. Il trend conserva la media delle ultime sette misurazioni, che non significa necessariamente sette giorni. Tutto esclude eventuali date future. Le date mostrate descrivono le misurazioni effettivamente confrontate; con meno di due, la variazione è N/D.

## Distribuzione settimanale: cosa cambia e quali limiti restano

Il precedente controllo di idoneità riutilizzava il percorso del calcolo automatico, bloccando anche la semplice distribuzione di un obiettivo manuale già valido. Ora la redistribuzione settimanale a budget invariato ha un controllo separato senza soglie di peso o BMI.

La patch **non calcola un nuovo fabbisogno** quando il calcolo automatico non è idoneo: usa gli obiettivi già impostati. Nel percorso la media corrente è esplicitamente invariata e la conferma si chiama “Salva preferenze e distribuzione”. Le proteine, i grassi e le fibre restano invariati; la differenza energetica è assorbita dai carboidrati, come nel comportamento precedente.

Restano i vincoli già presenti, resi espliciti nell'interfaccia: scostamento giornaliero massimo ±15%, da 1 a 6 giorni selezionati, intervallo 1.200–5.000 kcal/giorno e macro validi con carboidrati positivi. Sono limiti gestiti dal software, non fabbisogni universali. Restano le esclusioni del contesto per minori, gravidanza, allattamento, percorso professionale dichiarato o informazioni insufficienti. Le protezioni sul calcolo automatico e sulle proposte del TDEE non sono rimosse.

La decorrenza conserva il comportamento precedente: il lunedì successivo, oppure lo stesso giorno se è lunedì. La data viene mostrata. Il budget completo settimanale resta esatto; i valori visualizzati possono essere arrotondati.

## Demo e conferma delle revisioni

I nuovi dataset demo partono in modalità Assistita. Una vecchia demo sintetica senza modalità salvata riceve il nuovo valore; una scelta esplicita, anche Manuale, non viene sovrascritta. I dati personali non vengono toccati da questa inizializzazione.

La demo realistica di tre anni già presente è mantenuta. TDEE disponibile non implica una modifica proposta: se l'obiettivo è già nell'intervallo plausibile, “Nessuna revisione proposta” è corretto. La catena Calcola proposta → Rivedi proposta → Conferma nuovi obiettivi conserva l'ultima conferma come unico passaggio di applicazione. I dataset sintetici collaudano il software e non costituiscono una validazione clinica del modello.

## Icona

L'immagine originale fornita dall'utente è conservata byte per byte in `icon-user-original.jpg`, SHA-256 `ecb79913c53dde0fbeee9a477ef88fc040e84fe33fa8e6a545d92790a50499a4`. Le versioni PNG 180, 192 e 512 px sono solo adattamenti tecnici di dimensione, con sfondo/margini bianchi e senza ritaglio o ridisegno. Sono usate da intestazione, favicon, apple-touch-icon e manifest. La scelta è documentata come da preservare fino a istruzione contraria dell'utente.

## Validazione e limiti del collaudo

I risultati effettivi dei test sono in `docs/COLLAUDO_V732.md` nel pacchetto, con log Node, report React e rapporto installer. I test React usano lo stato e gli eventi reali dell'app con dati Master locali; i servizi HTTP e la fotocamera sono simulati dove necessario. Non misurano la geometria disegnata o lo scorrimento tattile.

Il browser disponibile nell'ambiente di lavoro non ha potuto aprire il server locale; il collaudo visivo su telefono/iPad, gli aggiornamenti PWA e le API reali sono quindi lasciati esplicitamente alla checklist Preview. Non vengono descritti come test superati. L'assistente prepara i file: non esegue commit, push, merge o deploy nel repository dell'utente.
