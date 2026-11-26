'use strict';
(function () {
  const stateApi = () => window.NutriTraceLabelImportUiState;
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function norm(value) { return stateApi()?.normalize(value) || clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function escape(value) { return stateApi()?.escapeHtml(value) || clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function labelForProposal(item) {
    if (item.path === 'name') return 'Nome prodotto';
    if (item.path === 'brand') return 'Marca';
    if (item.path === 'ingredients') return 'Ingredienti';
    const labels = { kcal: 'Calorie', protein: 'Proteine', carbs: 'Carboidrati', sugar: 'Zuccheri', fat: 'Grassi', saturatedFat: 'Saturi', fiber: 'Fibre', salt: 'Sale' };
    if (item.path.startsWith('label.')) return labels[item.path.slice(6)] || item.path;
    return item.nutrientKey || item.path;
  }
  function formatValue(item) {
    if (item.path === 'name' || item.path === 'brand' || item.path === 'ingredients') return escape(item.value);
    if (item.status !== 'candidate' && item.status !== 'review') return escape(item.reason || item.status);
    return escape(`${item.value ?? ''}${item.unit ? ` ${item.unit}` : ''}`);
  }
  function renderError(review, reason) {
    review.insertAdjacentHTML('afterbegin', `<p class="labelImportWarning">${escape(reason)}</p>`);
  }
  function mountWhenAlimentiActive() {
    const observer = new MutationObserver(() => {
      const active = document.querySelector('.tabs button.active');
      if (!active || norm(active.textContent) !== 'alimenti') return;
      const section = document.querySelector('main > section');
      if (!section || section.querySelector('#label-import-v3-card')) return;
      const card = document.createElement('article');
      card.id = 'label-import-v3-card';
      card.className = 'card labelImportCard';
      card.innerHTML = '<div class="cardTitle"><div><h2>Importa da etichetta</h2><p>Incolla testo letto manualmente. Nessuna fotocamera o OCR esterno è richiesto.</p></div></div><textarea id="label-import-v3-text" rows="8" placeholder="Nome prodotto: …&#10;Marca: …&#10;Ingredienti: …&#10;Valori nutrizionali per 100 g&#10;Proteine 8 g"></textarea><div class="labelImportActions"><button type="button" class="ghost" id="label-import-v3-clear">Cancella</button><button type="button" class="cta" id="label-import-v3-analyze">Analizza senza salvare</button></div><div id="label-import-v3-review"></div>';
      section.prepend(card);
      card.querySelector('#label-import-v3-clear').addEventListener('click', () => { card.querySelector('#label-import-v3-text').value = ''; card.querySelector('#label-import-v3-review').replaceChildren(); });
      card.querySelector('#label-import-v3-analyze').addEventListener('click', () => analyze(card));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function targetOptions(parsed, foods) {
    const matches = stateApi().findTargetCandidates(foods, parsed);
    const name = parsed.product?.name?.status === 'candidate' ? parsed.product.name.value : '';
    let html = '<label class="labelImportTarget">Destinazione importazione<select id="label-import-v3-target"><option value="">Seleziona destinazione…</option>';
    if (name) html += '<option value="new">Crea nuovo alimento</option>';
    for (const { food, brandMatches } of matches) {
      const brand = food.brand ? ` · ${food.brand}` : ' · marca non specificata';
      html += `<option value="${escape(food.id)}">Aggiorna: ${escape(food.name)}${escape(brand)}${brandMatches ? ' · marca corrispondente' : ''}</option>`;
    }
    html += '</select></label>';
    if (matches.length > 1) html += '<p class="labelImportWarning">Più schede hanno lo stesso nome. Seleziona quella corretta; nessuna viene scelta automaticamente.</p>';
    if (!name) html += '<p class="labelImportWarning">Nome prodotto non riconosciuto con certezza: non è possibile creare una nuova scheda. Puoi selezionare esplicitamente una scheda esistente.</p>';
    return { html, matches };
  }
  function renderReview(card, parsed, archive, targetId) {
    const review = card.querySelector('#label-import-v3-review');
    if (!archive.ok) { review.innerHTML = `<p class="labelImportWarning">${escape(archive.reason)}</p>`; return; }
    const target = targetId === 'new' ? null : archive.foods.find(food => food.id === targetId);
    if (targetId !== 'new' && !target) { review.innerHTML = '<p class="labelImportWarning">Destinazione non disponibile. Rianalizza l’etichetta.</p>'; return; }
    const proposals = window.NutriTraceLabelImportV3.makeProposal(target || {}, parsed);
    const snapshot = stateApi().proposalSnapshot(archive.raw, target, proposals);
    let html = targetOptions(parsed, archive.foods).html + '<div class="labelImportReview">';
    if (parsed.warnings?.length) html = targetOptions(parsed, archive.foods).html + `<div class="labelImportWarning">${parsed.warnings.map(escape).join('<br>')}</div><div class="labelImportReview">`;
    for (const item of proposals) {
      const reviewOnly = item.action !== 'add' && item.action !== 'conflict';
      const conflict = item.action === 'conflict';
      const cls = reviewOnly ? 'review' : conflict ? 'conflict' : 'add';
      const current = Array.isArray(item.current) ? item.current.map(escape).join(', ') : escape(item.current);
      const detail = item.reason ? escape(item.reason) : conflict ? `Valore esistente: ${current}` : escape(item.status);
      const prechecked = item.path === 'name' ? targetId === 'new' : item.action === 'add';
      html += `<label class="labelImportRow ${cls}"><span><b>${escape(labelForProposal(item))}</b><br><small>${detail}</small></span><span>${formatValue(item)}</span><span>${reviewOnly ? '<small>Da verificare</small>' : `<input type="checkbox" name="labelImportField" value="${escape(item.path)}" ${prechecked ? 'checked' : ''}>`}</span></label>`;
    }
    html += '</div><div class="labelImportActions"><button type="button" class="ghost" id="label-import-v3-cancel">Annulla</button><button type="button" class="cta" id="label-import-v3-confirm">Conferma e salva i campi selezionati</button></div><p class="labelImportMeta">La revisione non salva dati. Ogni sovrascrittura richiede conferma individuale; i campi rifiutati restano invariati.</p>';
    review.innerHTML = html;
    review.querySelector('#label-import-v3-target').value = targetId;
    review.querySelector('#label-import-v3-target').addEventListener('change', event => renderReview(card, parsed, stateApi().readFoods((globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage)), event.target.value));
    review.querySelector('#label-import-v3-cancel').addEventListener('click', () => review.replaceChildren());
    review.querySelector('#label-import-v3-confirm').addEventListener('click', () => {
      const selected = [...review.querySelectorAll('input[name="labelImportField"]:checked')].map(input => input.value);
      const overwritePaths = [];
      for (const path of selected) {
        const item = proposals.find(proposal => proposal.path === path);
        if (item?.action === 'conflict' && confirm(`Confermi la sostituzione esplicita di “${labelForProposal(item)}”?`)) overwritePaths.push(path);
      }
      const result = stateApi().commitImport({ storage: (globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage), parsed, target: targetId, proposals, selectedPaths: selected, overwritePaths, snapshot, confirmed: true });
      if (!result.ok) { renderError(review, result.reason); return; }
      review.innerHTML = '<p class="labelImportWarning">Importazione confermata e salvata nell’archivio.</p>';
      location.reload();
    });
  }
  function analyze(card) {
    const text = card.querySelector('#label-import-v3-text').value;
    const review = card.querySelector('#label-import-v3-review');
    if (!text.trim()) { review.innerHTML = '<p class="labelImportWarning">Inserisci il testo dell’etichetta prima dell’analisi.</p>'; return; }
    if (!window.NutriTraceLabelImportV3 || !stateApi()) { review.innerHTML = '<p class="labelImportWarning">Moduli V3 non disponibili.</p>'; return; }
    let parsed;
    try { parsed = window.NutriTraceLabelImportV3.parseLabel(text); }
    catch (error) { review.innerHTML = `<p class="labelImportWarning">${escape(error.message || 'Testo non analizzabile.')}</p>`; return; }
    const archive = stateApi().readFoods((globalThis.NutriTraceEnvironment?.storage || globalThis.localStorage));
    if (!archive.ok) { review.innerHTML = `<p class="labelImportWarning">${escape(archive.reason)}</p>`; return; }
    const options = targetOptions(parsed, archive.foods);
    review.innerHTML = `${options.html}<p class="labelImportMeta">Scegli una destinazione per vedere le proposte confrontate con i dati effettivi della scheda.</p>`;
    review.querySelector('#label-import-v3-target').addEventListener('change', event => renderReview(card, parsed, archive, event.target.value));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountWhenAlimentiActive);
  else mountWhenAlimentiActive();
})();
