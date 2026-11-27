# Origine delle risorse grafiche

## Nuove risorse

`icon-v73.svg` è il disegno vettoriale sorgente del simbolo V7.3: rettangolo arrotondato verde, tratto N chiaro e punto verde chiaro. `icon-v73-192.png` e `icon-v73-512.png` sono rasterizzazioni geometriche dello stesso disegno, create per questo pacchetto. Questo simbolo è stato sostituito nella V7.3.2 dall’immagine indicata dal proprietario del progetto; i file V7.3 restano soltanto risorse storiche. Il componente Logo, il manifest e le icone browser/installazione usano adesso `icon-user-*`.

Le silhouette della composizione corporea sono tracciati SVG originali nel modulo del percorso. Non sono ritagli, ricalchi o modifiche dello screenshot fornito. Le fasce sono orientative: i disegni non sono validati come strumento di misurazione della massa grassa.

I badge di qualità sono elementi HTML/CSS con lettera e colore; non incorporano il logo ufficiale multicolore Nutri-Score. Grafici e barre sono elementi DOM/SVG generati dal codice.

Il codice e queste nuove risorse sono consegnati per integrazione, modifica e distribuzione con il progetto. Questo documento descrive la loro creazione e non promette un’esclusività di marchio o una registrabilità del simbolo.

## Risorse precedenti

Le icone inline già presenti in `aurora-components.js` non avevano un registro di attribuzione in questa copia del progetto. Non è possibile attribuirle con certezza a una libreria né certificare retroattivamente l’origine di tutte le immagini storiche. Non vengono dichiarate “Lucide” o “senza copyright” senza evidenza.

Emoji e simboli Unicode vengono resi dal sistema operativo/browser e possono cambiare aspetto. La patch non distribuisce file grafici delle emoji di Apple, Google o altri produttori.

React, ReactDOM, ZXing e SheetJS sono le librerie già richiamate dall’app, con le rispettive licenze. Una distribuzione che ne incorpori copie locali deve conservare gli avvisi delle versioni effettivamente incluse.

## Dati

L’indice qualità deriva dal Master già presente: non contiene nuovi dati acquisiti da database esterni. `MASTER-DB-SOURCES.md` e il manifest originale rimangono invariati. Le voci marcate `terms_review` o `attribution_review` restano da verificare; la disponibilità pubblica non stabilisce da sola il diritto a ridistribuire una banca dati.

Riferimenti primari e limiti del calcolo sono in `quality-v73.md`. Prima di ampliare i dati esterni vanno verificati licenza della versione specifica, attribuzione e condizioni sulle banche dati derivate.

## Icona scelta dal proprietario · V7.3.2

L’originale `icon-user-original.jpg` è la copia byte per byte dell’allegato ricevuto. SHA-256: `ecb79913c53dde0fbeee9a477ef88fc040e84fe33fa8e6a545d92790a50499a4`.

Le copie PNG a 180, 192 e 512 pixel mantengono l’immagine intera, le proporzioni e i colori; lo spazio necessario per il formato quadrato è bianco. Nessun ridisegno, ritaglio o rimozione del testo. Questa icona va conservata nelle prossime versioni: modificarla solo su richiesta esplicita dell’utente. Il file è fornito dal proprietario del progetto; questa patch non ne certifica la titolarità dei diritti.
