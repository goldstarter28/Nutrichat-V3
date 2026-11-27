# Checklist Preview — NutriTrace V7.3.2

Base prevista: V7.3.1, commit `cc87545f1492e6b36a007e4d52358475c5230ace`.
Questa checklist serve dopo installazione, commit, push e apertura della Preview del nuovo commit.
Prima del merge eseguire le prove su telefono e almeno un dispositivo più ampio. I test locali non misurano il rendering del browser e non chiamano i servizi AI reali.

## Interfaccia e peso

- [ ] Aprire Analisi → qualità: il riquadro mostra **Cibi conteggiati**, per esempio `12 / 15 registrazioni`. La percentuale secondaria si riferisce alle kcal note, non al numero di alimenti. La formula delle medie non è stata cambiata.
- [ ] In Obiettivi impostare **Peso da raggiungere**, salvare e passare a Peso. Il valore deve coincidere. Modificarlo da Peso e riaprire Obiettivi; calorie e macro devono restare invariati.
- [ ] Nel primo grafico del peso controllare i marcatori della legenda: verde per il peso, arancione per il trend, tratteggio rosso per il peso da raggiungere. Nel grafico peso/calorie i colori della legenda devono coincidere con le serie.
- [ ] Cambiare **Variazioni e grafico** tra 7, 30, 90 giorni, 1 anno e Tutto. Variazione e Variazione % devono riferirsi alla prima e ultima misurazione del periodo selezionato; le date compaiono accanto al selettore. Con meno di due misurazioni deve apparire N/D.
- [ ] Scorrere tutta la sezione Peso: la tabella **Storico** deve essere dopo entrambi i grafici.
- [ ] In Aggiungi alimento cercare yogurt: la lettera A–E deve stare sulla riga del nome. Su telefono verificare i nomi lunghi e i badge delle stime.
- [ ] Scorrere i 20 risultati tenendo il dito sopra l'elenco: si deve raggiungere **Mostra altri risultati** e l'aiuto, senza dover spostare il dito sul bordo. Ripetere dopo aver caricato altri risultati.
- [ ] In una ricetta verificare la stessa riga di comandi: **Corrispondenze · Aiuto AI · barcode · foto**. Provare apertura, annullamento e selezione del singolo ingrediente; la quantità e gli altri ingredienti devono restare coerenti.

## Quantità, ricette e correzioni locali

- [ ] Importare un vero link con ingredienti nella forma `cioccolato 20g`, `farina 200 g`, `zucchero 50g`: nei nomi non devono restare i grammi; i campi quantità devono riportare 20, 200 e 50. Il risultato del sito/servizio va controllato nella revisione.
- [ ] Provare anche `20 g cioccolato`, `farina 00 0,2 kg`, `farina g 200`, `Cioccolato 20 g (fondente)` e `cacao 70% 20 g`. Il tipo 00, il descrittore e la percentuale del cacao non devono sparire.
- [ ] `Sale q.b.` deve diventare nome Sale e quantità vuota, con richiesta dei grammi effettivi. Non deve scegliere automaticamente un alimento differente solo perché contiene la parola sale. Se non esiste una corrispondenza esatta, selezionare quella corretta dalla revisione.
- [ ] `1 1/2 g farina` deve dare 1,5 g; `farina 1⁄2 g` deve dare 0,5 g. Quantità negative, zero, frazioni impossibili e intervalli `2–3 g` devono restare da completare, senza registrazioni automatiche.
- [ ] `un cucchiaio di di estratto di vaniglia` deve trovare l'estratto e proporre una conversione indicativa con conferma. Un cucchiaino standard ha riferimento 4,3 g; un cucchiaio standard 13,2 g. Un cucchiaio abbondante non riceve automaticamente questo valore.
- [ ] `4spicchio di arancia`, `arancia 4 spicchi`, `4 spicchi di mandarino` e `mandarino 4 spicchi` non devono diventare quattro frutti interi. Per il mandarino i grammi vanno confermati perché non è aggiunto un peso universale dello spicchio.
- [ ] Confermare manualmente un peso per quattro spicchi di mandarino nel proprio ambiente di prova. Ripetere la stessa unità con due spicchi: la correzione locale deve proporre metà del peso confermato. Controllarla ed eliminarla dalla gestione delle correzioni già presente. Una misura per spicchi non deve essere applicata a mandarini interi.

## Demo e distribuzione settimanale

- [ ] Passare alla demo. In Analisi il profilo generato deve partire in **Assistita**. Una vecchia demo senza modalità viene aggiornata; una modalità scelta esplicitamente rimane tale. Per ricominciare con il nuovo predefinito rigenerare i soli dati demo.
- [ ] Nella demo realistica di tre anni verificare la stima TDEE e l'intervallo d'incertezza. **Nessuna revisione proposta** può essere il risultato corretto quando l'obiettivo corrente è già compatibile con l'intervallo.
- [ ] Per esercitare la conferma con lo scenario verificato al 27/11/2026, solo in demo: impostare 1.800 kcal in Obiettivi, applicare ai target e aprire Analisi → Calcola proposta → Rivedi proposta. Gli obiettivi devono restare invariati fino a **Conferma nuovi obiettivi**; nel dataset verificato la proposta passa a 1.890 kcal. Il risultato può variare se cambiano data o dati.
- [ ] Verificare un profilo adulto di prova 50 kg / 170 cm con obiettivi manuali validi, senza gravidanza/allattamento o altri contesti esclusi. Nella Strategia settimanale scegliere sabato e domenica e un incremento entro 15%: peso/BMI non devono bloccare la redistribuzione a media invariata.
- [ ] Esempio aritmetico di collaudo: media 1.800, sabato/domenica +15% → 2.070 nei due giorni e 1.692 negli altri cinque; totale 12.600 kcal. Non è una raccomandazione nutrizionale. Verificare anche il riepilogo del percorso e la data di decorrenza mostrata, normalmente il lunedì successivo.
- [ ] Tornare all'ambiente personale: diario, peso, obiettivi e modalità personale devono essere quelli precedenti alle prove demo.

## Icona, aggiornamento e regressione essenziale

- [ ] Verificare l'immagine fornita dall'utente nell'intestazione, favicon e manifest/PWA. Le versioni 180/192/512 px mantengono tutto il disegno con margini bianchi, senza ritaglio. La cache dell'icona sulla schermata Home può aggiornarsi in un momento diverso dal codice dell'app.
- [ ] Dopo il deploy ricaricare e chiudere/riaprire l'app; controllare che sia la Preview del nuovo commit. Non cancellare i dati del sito per aggiornare l'icona: sono anche il luogo dove risiede il diario locale.
- [ ] Provare una normale registrazione, modifica dei grammi di un pasto, salvataggio di una ricetta e una risposta del Coach. Il tasto “Aiuto AI” e i dispositivi foto/barcode reali richiedono ancora questa prova con le API della Preview.

Gli elementi della checklist non vengono marcati come superati solo perché passano i test Node/React: fotocamera, permessi, gesti tattili, rendering e provider reali richiedono osservazione nella Preview.
