
'use strict';

(function (root) {
  const h = root.React.createElement;
  const { useState, useEffect, useRef } = root.React;

  function BarcodeScanner() {
    const videoRef = useRef(null);
    const [scanning, setScanning] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [product, setProduct] = useState(null);

    useEffect(() => {
      if (!scanning) return;

      let cancelled = false;
      let controls = null;

      async function start() {
        try {
          if (!root.isSecureContext) {
            throw new Error(
              'La fotocamera richiede HTTPS.'
            );
          }

          if (!root.ZXingBrowser) {
            throw new Error(
              'Lettore barcode non disponibile. ' +
              'Puoi inserire il codice manualmente.'
            );
          }

          const reader =
            new root.ZXingBrowser.BrowserMultiFormatOneDReader();

          const result = await reader.decodeFromVideoDevice(
            undefined,
            videoRef.current,
            (value) => {
              if (cancelled || !value) return;

              const detected = String(
                value.getText()
              ).trim();

              if (!/^\d{8}$|^\d{12,14}$/.test(detected)) {
                return;
              }

              setCode(detected);
              setProduct(null);
              setError('');
              setScanning(false);
            }
          );

          if (cancelled) {
            result.stop();
          } else {
            controls = result;
          }

        } catch (e) {
          if (!cancelled) {
            setError(
              e.name === 'NotAllowedError'
                ? 'Permesso fotocamera negato.'
                : e.message || 'Fotocamera non disponibile.'
            );
            setScanning(false);
          }
        }
      }

      start();

      return () => {
        cancelled = true;
        if (controls) controls.stop();

        const stream = videoRef.current?.srcObject;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }, [scanning]);

    async function lookup() {
      const barcode = code.trim();

      if (!/^\d{8}$|^\d{12,14}$/.test(barcode)) {
        setError('Inserisci un EAN o UPC valido.');
        return;
      }

      setScanning(false);
      setBusy(true);
      setError('');
      setProduct(null);

      try {
        const response = await fetch(
          '/api/barcode-lookup?barcode=' +
          encodeURIComponent(barcode),
          { cache: 'no-store' }
        );

        const data = await response.json();

        if (!response.ok || !data.found) {
          throw new Error(
            data.error || 'Prodotto non trovato.'
          );
        }

        setProduct(data.product);

      } catch (e) {
        setError(
          e.message || 'Ricerca non riuscita.'
        );
      } finally {
        setBusy(false);
      }
    }

    const values = [
      ['kcal', 'Energia', 'kcal'],
      ['protein', 'Proteine', 'g'],
      ['carbs', 'Carboidrati', 'g'],
      ['sugar', 'Zuccheri', 'g'],
      ['fat', 'Grassi', 'g'],
      ['saturatedFat', 'Saturi', 'g'],
      ['fiber', 'Fibre', 'g'],
      ['salt', 'Sale', 'g']
    ];

    return h('article', {
      className: 'card',
      style: { marginBottom: '16px' }
    },

      h('h2', null, 'Codice a barre'),

      h('p', { className: 'muted tiny' },
        'Scansiona un prodotto confezionato oppure ' +
        'inserisci il codice EAN/UPC.'
      ),

      h('div', {
        className: 'inlineActions',
        style: { marginBottom: '12px' }
      },

        h('button', {
          type: 'button',
          className: 'ghost',
          onClick: () => {
            setError('');
            setProduct(null);
            setScanning(value => !value);
          }
        }, scanning
          ? 'Ferma fotocamera'
          : '📷 Scansiona barcode'
        )
      ),

      scanning && h('video', {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: {
          width: '100%',
          maxHeight: '310px',
          objectFit: 'cover',
          borderRadius: '12px',
          background: '#101010'
        }
      }),

      h('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'end'
        }
      },

        h('label', {
          style: { flex: '1 1 200px' }
        },
          'EAN / UPC',
          h('input', {
            value: code,
            inputMode: 'numeric',
            autoComplete: 'off',
            placeholder: 'Es. 3017624010701',
            onChange: event => {
              setCode(event.target.value.replace(/\D/g, ''));
              setProduct(null);
            }
          })
        ),

        h('button', {
          type: 'button',
          className: 'cta',
          disabled: busy || !code.trim(),
          onClick: lookup,
          style: { marginBottom: '12px' }
        }, busy ? 'Ricerca…' : 'Cerca prodotto')
      ),

      error && h('p', {
        className: 'errorText',
        role: 'alert'
      }, error),

      product && h('div', {
        style: {
          borderTop: '1px solid var(--line)',
          marginTop: '12px',
          paddingTop: '14px'
        }
      },

        h('h3', null, product.name),

        product.brand && h('p', {
          className: 'muted'
        }, product.brand),

        product.image && h('img', {
          src: product.image,
          alt: product.name,
          loading: 'lazy',
          style: {
            maxWidth: '150px',
            maxHeight: '180px',
            objectFit: 'contain'
          }
        }),

        h('p', { className: 'tiny muted' },
          'Dati Open Food Facts per 100 g. ' +
          'Non ancora salvati nel diario.'
        ),

        h('div', { className: 'miniGrid' },
          ...values.map(([key, name, unit]) =>
            h('div', { key },
              h('small', null, name),
              h('strong', null,
                product.label?.[key] == null
                  ? 'N/D'
                  : product.label[key].toLocaleString(
                      'it-IT', { maximumFractionDigits: 2 }
                    ) + ' ' + unit
              )
            )
          )
        ),

        product.source?.url && h('p', null,
          h('a', {
            href: product.source.url,
            target: '_blank',
            rel: 'noopener noreferrer'
          }, 'Verifica la fonte Open Food Facts')
        )
      )
    );
  }

  root.NutriTraceBarcodeScanner = BarcodeScanner;

})(typeof globalThis !== 'undefined'
  ? globalThis
  : this);
