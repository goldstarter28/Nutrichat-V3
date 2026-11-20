'use strict';
(function () {
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function norm(value) { return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function escape(value) {
    if (window.NutriTraceLabelImportUiState) return window.NutriTraceLabelImportUiState.escapeHtml(value);
    return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
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
  function findExistingFood(parsed) {
    let foods = [];
    try { foods = JSON.parse(localStorage.getItem('nutritrace_foods') || '[]'); } catch { foods = []; }
    const name = parsed.product?.name?.status === 'candidate' ? norm(parsed.product.name.value) : '';
    const brand = parsed.product?.brand?.status === 'candidate' ? norm(parsed.product.brand.value) : '';
    return foods.find(food => name && norm(food.name) === name && (!brand || norm(food.brand || '') === brand)) || null;
  }
  function compatibleEmptyFood() {
    return { id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`), name: '', brand: '', officialName: '', servingGrams: 100, label: { kcal: '', protein: '', carbs: '', sugar: '', fat: '', saturatedFat: '', fiber: '', salt: '' }, ingredients: '', additives: [], nutrients: [], nutrientStatus: {}, sources: [], notes: '', mergeMeta: null, masterId: null, masterVersion: null, aiRequested: [] };
  }
  function mountWhenAlimentiActive() {
    const observer = new MutationObserver(() => {
      const nav = document.querySelector('.tabs');
      if (!nav) return;
      const active = nav.querySelector('button.active');
      if (!active || norm(active.textContent) !== 'alimenti') return;
      const section = document.querySelector('main > section');
      if (!section || section.querySelector('#label-import-v3-card')) return;
      const card = document.createElement('article');
      card.id = 'label-import-v3-card';
      card.className = 'card labelImportCard';
      card.innerHTML = '<div class="cardTitle"><div><h2>Importa da etichetta</h2><p>Incolla testo letto manualmente o da OCR già verificato. Nessuna fotocamera o OCR esterno è richiesto.</p></div></div><textarea id="label-import-v3-text" rows="8" placeholder="Nome prodotto: …&#10;Marca: …&#10;Ingredienti: …&#10;Valori nutrizionali per 100 g&#10;Proteine 8 g"></textarea><div class="labelImportActions"><button type="button" class="ghost" id="label-import-v3-clear">Cancella</button><button type="button" class="cta" id="label-import-v3-analyze">Analizza senza salvare</button></div><div id="label-import-v3-review"></div>';
      section.prepend(card);
      card.querySelector('#label-import-v3-clear').addEventListener('click', () => { card.querySelector('#label-import-v3-text').value = ''; card.querySelector('#label-import-v3-review').innerHTML = ''; });
      card.querySelector('#label-import-v3-analyze').addEventListener('click', () => analyze(card));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function analyze(card) {
    const text = card.querySelector('#label-import-v3-text').value;
    const review = card.querySelector('#label-import-v3-review');
    if (!text.trim()) { review.innerHTML = '<p class="labelImportWarning">Inserisci il testo dell’etichetta prima dell’analisi.</p>'; return; }
    if (!window.NutriTraceLabelImportV3) { review.innerHTML = '<p class="labelImportWarning">Modulo V3 non disponibile.</p>'; return; }
    const parsed = window.NutriTraceLabelImportV3.parseLabel(text);
    const existing = findExistingFood(parsed) || compatibleEmptyFood();
    const proposals = window.NutriTraceLabelImportV3.makeProposal(existing, parsed);
    let html = '';
    if (parsed.warnings?.length) html += `<div class="labelImportWarning">${parsed.warnings.map(escape).join('<br>')}</div>`;
    html += '<div class="labelImportReview">';
    for (const item of proposals) {
      const reviewOnly = item.action !== 'add' && item.action !== 'conflict';
      const conflict = item.action === 'conflict';
      const cls = reviewOnly ? 'review' : conflict ? 'conflict' : 'add';
      const detail = item.reason ? escape(item.reason) : (conflict ? `Valore esistente: ${formatValue({ ...item, value: item.current, unit: item.unit })}` : escape(item.status));
      html += `<label class="labelImportRow ${cls}"><span><b>${escape(labelForProposal(item))}</b><br><small>${detail}</small></span><span>${formatValue(item)}</span><span>${reviewOnly ? '<small>Da verificare</small>' : `<input type="checkbox" name="labelImportField" value="${escape(item.path)}" ${conflict ? '' : 'checked'}>`}</span></label>`;
    }
    html += '</div><div class="labelImportActions"><button type="button" class="ghost" id="label-import-v3-cancel">Annulla</button><button type="button" class="cta" id="label-import-v3-confirm">Applica solo i campi selezionati</button></div><p class="labelImportMeta">Dopo la conferma, i dati selezionati vengono salvati nell’archivio senza sostituire campi esistenti salvo scelta esplicita.</p>';
    review.innerHTML = html;
    review.querySelector('#label-import-v3-cancel').addEventListener('click', () => { review.innerHTML = ''; });
    review.querySelector('#label-import-v3-confirm').addEventListener('click', () => {
      const selected = [...review.querySelectorAll('input[name="labelImportField"]:checked')].map(input => input.value);
      const overwritePaths = [];
      for (const input of review.querySelectorAll('input[name="labelImportField"]:checked')) {
        const item = proposals.find(p => p.path === input.value);
        if (item?.action === 'conflict' && confirm(`Confermi la sostituzione esplicita di “${labelForProposal(item)}”?`)) overwritePaths.push(item.path);
      }
      if (!selected.length) { review.innerHTML = '<p class="labelImportWarning">Nessun campo selezionato. Nessun dato è stato modificato.</p>'; return; }
      const base = findExistingFood(parsed) || existing;
      const plan = window.NutriTraceLabelImportUiState?.buildSavePlan(parsed, selected, overwritePaths, base.name);
      if (!plan?.ok) { review.innerHTML = `<p class="labelImportWarning">${escape(plan?.reason || 'Nessun dato salvato.')}</p>`; return; }
      const next = window.NutriTraceLabelImportV3.applyProposal(base, proposals, { confirmed: true, selectedPaths: plan.selected, overwritePaths: plan.overwrite });
      next.label = { ...(base.label || {}), ...(next.label || {}) };
      next.ingredients = next.ingredients || '';
      next.sources = [...(next.sources || []), { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-source`, name: 'Etichetta locale', reference: 'Importazione testo locale · nessun OCR esterno', quality: 'primaria' }].filter((source, index, arr) => arr.findIndex(x => x.reference === source.reference) === index);
      let foods = [];
      try { foods = JSON.parse(localStorage.getItem('nutritrace_foods') || '[]'); } catch { foods = []; }
      const matchIndex = foods.findIndex(food => food.id === base.id);
      if (matchIndex >= 0) foods[matchIndex] = next;
      else if (!foods.some(food => norm(food.name) === norm(next.name) && norm(food.brand || '') === norm(next.brand || ''))) foods.push(next);
      localStorage.setItem('nutritrace_foods', JSON.stringify(foods));
      review.innerHTML = '<p class="labelImportWarning">Importazione confermata e salvata nell’archivio.</p>';
      location.reload();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountWhenAlimentiActive);
  else mountWhenAlimentiActive();
})();
