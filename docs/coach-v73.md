# NutriTrace Coach V7.3: funzioni operative, integrazione e verifica

## Comportamento implementato

Il Coach dispone di strumenti locali tipizzati, richiamati tramite le vere `tools`/`tool_calls` dell’API Groq. I risultati sono letti sul dispositivo solo con i consensi correnti. I comandi di scrittura producono schede: il modello non può salvare una ricetta, registrare un pasto o modificare la dispensa da solo. La persona controlla la proposta, può cambiare quantità/date e applicarla con un pulsante. Il salvataggio usa lo stesso archivio dell’app, con revisione e identificativo operazione.

| Funzione | Risultato verificabile |
|---|---|
| Cerca alimento | Database globale, oltre all’archivio se autorizzato; 20 risultati per pagina, altre pagine con pulsante. |
| Registra alimento | Scheda alimento reale + grammi, data e pasto; conferma crea una registrazione. |
| Modifica quantità | Aggiorna una registrazione; per una ricetta raggruppata ridimensiona l’intera porzione e gli ingredienti. |
| Leggi diario | Righe paginabili con ID e quantità, limitate alle date richieste. |
| Riepilogo storico | Media dei giorni registrati; giorni mancanti esclusi; copertura e valori sconosciuti dichiarati. Massimo tre anni per singola richiesta. |
| Micronutriente specifico | `history` con `query` corrispondente al nome: media dei giorni con il dato, copertura e incertezza della base. Nessuna diagnosi di carenza. |
| Peso | Strumento separato `weights`, autorizzazione peso obbligatoria; riepilogo fino a 52 settimane del motore esistente. |
| Preferenze | Campi consentiti del percorso, preferenze e una/due sessioni di allenamento. Informazioni fisiologiche/allergeni personali richiedono il consenso sanitario separato. |
| Crea ricetta | Ingredienti risolti nel database, pesi e nutrienti calcolati; resa stimata dichiarata se non misurata. |
| Sostituisci ingrediente | Crea una variante reale mantenendo la ricetta originale; calcolo dei nutrienti, verifica culinaria ancora necessaria. |
| Link ricetta | Scheda “Apri revisione ricetta dal link”: apre l’importatore esistente con il link. L’utente avvia Interpreta e rivede il risultato; non è un salvataggio completo inline. |
| Dispensa | Inserimento/modifica/rimozione, quantità sconosciuta distinta da zero, scadenza. Scheda locale utilizzabile senza chiamate AI. |
| Menu | Proposta del modello con ID di alimenti/ricette reali; verifica locale delle quantità e dei nutrienti per giorno. Salva un menu, senza registrare pasti come consumati. |
| Spesa | Da menu o ricette reali; somma ingredienti, sottrae le quantità note non scadute, mostra scorte sconosciute; checklist e copia testo. |
| Cosa puoi fare per me? | Catalogo basato sulle capacità effettive e sui consensi. Apribile localmente senza API. |
| Annulla | Annulla il salvataggio finché il record di annullamento è disponibile e non sono intervenute modifiche successive. |

La route separata della pianificazione può essere rimossa dall’app: i dati `profile.plannerV72` rimangono utilizzati per dispensa/menu. La lista salvata vive in `profile.shoppingV73`, perché la normalizzazione V7.2 scarterebbe un campo nuovo inserito al suo interno.

## Integrazione nel client

Caricare `coach-actions-v73.js` prima di `ai-coach-chat.js`, dopo i moduli diario, qualità, percorso e pianificazione usati nei calcoli. Il CSS `coach-actions-v73.css` va dopo il tema dell’app. Aggiungere entrambi agli asset offline e aggiornare la versione del service worker con la procedura dell’app.

Passare a `NutriTraceAICoach.View` la prop `actions`:

```js
{
  snapshot: () => ({
    foods, recipes, logs, goals, profile, qualityState, meals,
    today: 'YYYY-MM-DD',
    revision // cambia quando cambiano i dati rilevanti
  }),
  searchFoods: async (query, {offset, limit, includeArchive}) => ({
    items: [{id: 'db:master-id', name, food, personal: false}],
    total, hasMore
  }),
  resolveFood: async lookupId => normalizedFood,
  commit: async ({operation, payload}, {operationId, expectedRevision}) => ({
    message, undoToken, operationId
  }),
  undo: async undoToken => ({message}),
  openEntry: async recipeUrl => { /* apre revisione importazione esistente */ }
}
```

Il contratto di ricerca distingue `db:<masterId>` e `archive:<foodId>`. Gli ID di ricerca restano nelle richieste del modello; i payload di salvataggio usano invece `food.id` normalizzato. L’adapter dell’app può ricondurre un alimento del master a un alimento già presente senza sovrascriverne i dati.

`NutriTraceCoachActions.createSession(adapter, getScopes, getPolicy)` riceve funzioni che restituiscono consensi e policy **attuali**. Non passare una copia dei consensi acquisita al montaggio. La sessione invalida la cache quando i consensi cambiano e li verifica dopo le letture asincrone, prima del nuovo invio e prima di applicare una proposta.

Componenti esportati:

```js
Workspace({session, initial: 'help'|'foods'|'recipes'|'pantry'|'shopping'|'menu', onClose})
ReadCard({card, session, onProposal, onRefresh})
ActionCard({action, session, onChange, disabled})
```

Le schede locali usano `{local:true}` nelle letture/preparazioni: questa opzione è una scelta del codice dell’interfaccia e non compare nello schema dei tool AI. Il loro contenuto resta sul dispositivo. Le richieste del modello passano sempre dal percorso con scope obbligatorio.

## Operazioni dell’adapter

| `operation` | Payload |
|---|---|
| `log_food` | `{foodId, food, grams, date, mealId}` |
| `edit_quantity` | `{logId, grams, recipeGroupId?}`; grammi intera porzione se raggruppata. |
| `create_recipe` | `{recipe, foods}`; `recipe.ingredients=[{foodId,grams,name}]`, `yieldGrams`, `yieldEstimated`, `servings`. |
| `upsert_pantry` | `{foodId, food, grams:null|number, expiry}` |
| `remove_pantry` | `{foodId}` |
| `create_menu` | `{entries:[{id,date,mealId,kind,ref,name,amount,unit}],foods}` |
| `create_shopping` | `{shopping:{id,createdAt,from,to,items,issues}}` |
| `update_shopping_item` | `{shoppingId,foodId,checked}`; azione locale esplicita, senza chiamata AI. |

`import_recipe_url` non passa a `commit`: usa `openEntry()` dopo la conferma e restituisce esplicitamente “La ricetta non è ancora salvata”. `substitute_recipe` diventa una normale `create_recipe` di variante dopo la validazione.

L’adapter deve persistere l’idempotenza: un secondo invio dello stesso `operationId` restituisce la ricevuta iniziale. Il blocco in memoria del motore impedisce anche due clic simultanei; la difesa persistente è nell’adapter. Le revisioni impediscono di applicare una proposta sui dati cambiati senza ricalcolarla.

## Consensi e policy

- `nutrition`: diario, obiettivi, storico e archivio personale.
- `profile`: preferenze del percorso; richiede `nutrition`.
- `health`: informazioni fisiologiche e allergeni personali; richiede `nutrition` e `profile`.
- `weight`: riepiloghi delle pesate; richiede `nutrition`.
- `recipes`: ricette salvate; richiede `nutrition`.
- `pantry`: dispensa, menu, lista della spesa; richiede `nutrition`.

I risultati del database pubblico restano cercabili senza inviare il diario. Il motore mantiene una allowlist dei campi personali: massa grassa, metodo visivo, peso di riferimento e risposte sanitarie non vengono inseriti nelle preferenze ordinarie.

`NutriTraceGoalsWizard.policy(profile)` determina le capacità locali indipendentemente dal consenso sanitario. Vengono inviati soltanto i booleani `automaticNutritionAllowed` e `organizationalOnly`, non la causa se non condivisa. Un profilo con `organizationalOnly` non riceve testo nutrizionale libero generato dal modello: il server lo sostituisce con un messaggio organizzativo e rifiuta gli strumenti di creazione di menu automatico. Diario, gestione ricette/dispensa/spesa e inserimento esplicito rimangono possibili.

La policy arriva dal client perché l’architettura attuale conserva il profilo nel browser: non equivale a un controllo server di un profilo autenticato. Un client modificato manualmente può inviare booleani diversi. Il client distribuito applica i controlli; l’endpoint mantiene comunque limiti e allowlist, ma non può ricostruire una condizione personale mai ricevuta.

Revocare un consenso interrompe nuove letture/invii di quel contesto. I messaggi già spediti e contenuti nella cronologia restano parte della conversazione: per partire senza quel testo, aprire una nuova chat. Le schede locali archiviate non vengono inviate automaticamente con la cronologia; si invia il solo testo dei messaggi.

## Quote, provider e limiti espliciti

Nessun cambio a provider a pagamento o a variabili Vercel. Il modello predefinito rimane `openai/gpt-oss-20b` su Groq; l’allowlist resta `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `llama-3.1-8b-instant`. Restano i controlli di origine, configurazione di produzione, Redis atomico e HMAC degli IP.

I tool vengono eseguiti localmente e in sequenza; `parallel_tool_calls:false`. Ogni turno contiene **al massimo tre richieste al modello**. Tutte consumano il budget ordinario, una per una; non sono “tre gratuite aggiuntive”. Quando c’è una proposta pronta, il client si ferma e la mostra senza chiedere un’ulteriore parafrasi al modello.

Il primo passaggio ha massimo 800 token di risposta, i successivi 1.600. La prenotazione preventiva include schema degli strumenti, messaggi e massimo output. Rimangono il tetto di 7.500 token stimati per minuto e di 180.000 al giorno; il numero di richieste per IP/ora rimane la variabile già configurata (`COACH_IP_HOURLY_LIMIT`, default storico 10, configurazione utente 20). Il limite locale di cinque richieste/minuto rimane. Le proposte articolate possono quindi fermarsi per quota prima del terzo passaggio; eventuali schede già ottenute restano visibili.

Limiti tecnici delle nuove schede, dichiarati per evitare sorprese:

- 20 risultati per pagina e quattro query raggruppate in una lettura `workspace`.
- Massimo 40 ingredienti per ricetta preparata dal Coach; archivio generale invariato.
- Menu massimo 56 voci su sette giorni consecutivi per proposta. Non garantisce automaticamente una giornata completa o tutti i micronutrienti.
- Lista spesa: massimo 31 giorni per calcolo e 20 ricette esplicite per proposta.
- Singola lettura storica: massimo tre anni. Il lettore peso riusa il riepilogo esistente di 52 settimane.
- JSON corpo 32.000 caratteri e risultati tool ridotti per budget con omissioni dichiarate; nessun JSON troncato a metà.
- Quantità da diario e ingredienti fino a 10.000 g, scorte fino a 100.000 g, coerenti con i normalizzatori esistenti.
- Non c’è integrazione Bring!, acquisto online, invio automatico a terzi o modifica automatica degli obiettivi.
- Un testo o link ricetta non risolve magicamente tutti gli ingredienti. Il modello deve cercare i riferimenti; la revisione mostra dati mancanti e rese stimate.
- L’equivalenza culinaria di una sostituzione non è certificata dal confronto macro. Allergeni e contaminazioni non sono garantiti da un database incompleto.

## Sicurezza degli strumenti

I soli nomi accettati sono `nutritrace_read` e `nutritrace_prepare`. Le risorse e operazioni sono enum, non codice. Non esistono `eval`, shell, accesso HTTP arbitrario o invio esterno nella sessione. Stringhe di cibi, procedimenti e risultati sono trattate come dati. Un loro eventuale comando non può diventare un’operazione non presente nell’allowlist, e nessuna proposta viene applicata senza clic dell’utente.

Il server rifiuta ruoli `system` nella traccia dei tool, ID duplicati, risultati senza chiamata corrispondente, argomenti JSON malformati, richieste oltre il terzo passaggio e chiamate incompatibili con gli scope dichiarati. Una risposta del modello tagliata durante una funzione non viene presentata come operazione valida.

## Test eseguiti

Comando mirato:

```bash
node --test tests/coach-actions-v73.test.js
```

La suite verifica motore, adapter reale e handler API con provider/Redis simulati: nessuna chiave reale o richiesta AI a pagamento. Copre ricerca globale separata dall’archivio, scopi assenti/revocati durante letture, profili protetti, idempotenza, annullamento, revisione obsoleta, ID inesistenti, quantità invalide, ricette, ridimensionamento porzione, menu, spesa, medie con giorni mancanti, dati sanitari esclusi, tool injection, quota esaurita e risposta troncata.

La verifica non certifica il comportamento semantico di ogni risposta del modello reale. In Preview eseguire anche:

1. Senza consenso cloud, aprire “Cosa puoi fare per me?”, cercare un alimento globale, metterlo in dispensa, confermare e annullare.
2. Con consenso ai messaggi, chiedere “Cerca yogurt nel database”; controllare risultati, senza testo inglese inventato sostitutivo della ricerca.
3. Con scope nutrizione, chiedere una registrazione esplicita in grammi e pasto; verificare una sola riga dopo doppio clic.
4. Modificare un diario da un’altra sezione prima di applicare una proposta: deve richiedere ricalcolo.
5. Revocare la condivisione mentre si attende una risposta: nessun nuovo tool deve inviare il contesto.
6. Creare una ricetta semplice con due ingredienti, modificare un peso nella scheda, salvare; controllare archivio e nutrienti.
7. Creare spesa dalla ricetta con uno stock noto e uno sconosciuto; verificare sottrazione e messaggio, spunta e copia.
8. Verificare un link ricetta: apre la revisione con testo precompilato, senza fingere di aver creato la ricetta.
9. Con profilo ammesso, chiedere una proposta di menu piccola prima di una settimana intera; controllare ID, date, nutrienti e copertura. Il salvataggio non deve aumentare i consumi del diario.
10. Profilo gravidanza/allattamento anche con condivisione sanitaria spenta: niente menu personale o testo di dieta, strumenti organizzativi funzionanti.
11. TTS: ascolta, pausa, riprendi e ferma. Cronologia, modifica messaggio e lettura Markdown devono restare funzionanti.
12. Ripetere azioni e cambio demo/personale: dati, chat, consensi e ricevute devono restare nell’ambiente selezionato.

## Fonte tecnica

Groq documenta il local tool calling e la compatibilità dei modelli GPT-OSS; GPT-OSS non supporta tool paralleli. Riferimenti consultati per questa implementazione:

- https://console.groq.com/docs/tool-use/overview
- https://console.groq.com/docs/tool-use/local-tool-calling

La compatibilità documentata non sostituisce la verifica con il modello e le quote effettivamente configurati su Vercel.
