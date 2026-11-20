'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NutriTraceLabelImportUiState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function buildSavePlan(parsed, selectedPaths, overwritePaths, existingName = '') {
    const explicitName = clean(parsed?.product?.name?.status === 'candidate' ? parsed.product.name.value : '');
    const selected = new Set(selectedPaths || []);
    const overwrite = new Set(overwritePaths || []);
    if (!selected.size) return { ok: false, reason: 'Nessun campo selezionato.', selected: [], overwrite: [] };
    if (!explicitName && !clean(existingName)) return { ok: false, reason: 'Nome prodotto mancante: l’importazione non può creare una scheda senza nome.', selected: [...selected], overwrite: [...overwrite] };
    if (selected.has('name') && !explicitName) return { ok: false, reason: 'Il nome prodotto estratto non è disponibile o non è candidato certo.', selected: [...selected], overwrite: [...overwrite] };
    return { ok: true, reason: '', selected: [...selected], overwrite: [...overwrite] };
  }
  function mergeReviewConfirmed(existingFood, proposals, parsed, selectedPaths, overwritePaths) {
    const plan = buildSavePlan(parsed, selectedPaths, overwritePaths, existingFood?.name);
    if (!plan.ok) return { ok: false, reason: plan.reason, food: structuredClone(existingFood || {}) };
    const v3 = typeof globalThis !== 'undefined' && globalThis.NutriTraceLabelImportV3;
    if (!v3 || typeof v3.applyProposal !== 'function') return { ok: false, reason: 'Modulo V3 non disponibile.', food: structuredClone(existingFood || {}) };
    const food = v3.applyProposal(existingFood, proposals, { confirmed: true, selectedPaths: plan.selected, overwritePaths: plan.overwrite });
    return { ok: true, reason: '', food };
  }
  return { escapeHtml, buildSavePlan, mergeReviewConfirmed };
});
