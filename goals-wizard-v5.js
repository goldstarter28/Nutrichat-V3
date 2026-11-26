(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NutriTraceGoalsWizard = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const VERSION = 1;
  const DRAFT_KEY = 'nutritrace_goal_wizard_draft_v5';
  const MAX_QUESTIONS = 20;
  const choice = (value, label, detail) => ({ value, label, detail: detail || '' });
  const QUESTIONS = [
    { id: 'goal', title: 'Da dove vuoi partire?', description: 'Scegli una direzione. Potrai sempre rivederla negli Obiettivi.', type: 'choice', options: [choice('maintain', 'Mantenere il mio equilibrio', 'Una base per le abitudini di ogni giorno'), choice('lose', 'Ridurre gradualmente il peso', 'Una stima iniziale prudente, da rivalutare nel tempo'), choice('gain', 'Aumentare gradualmente il peso', 'Energia e regolarità, senza obiettivi rapidi'), choice('habits', 'Conoscere meglio le mie abitudini', 'Un riferimento di mantenimento, senza variazioni di peso richieste')] },
    { id: 'age', title: 'Quanti anni hai?', description: 'L’età serve per capire se la stima automatica è adatta. Per i minori gli obiettivi restano manuali.', type: 'number', min: 5, max: 100, step: 1, unit: 'anni', placeholder: 'La tua età' },
    { id: 'sex', title: 'Quale coefficiente usare nella stima?', description: 'L’equazione energetica utilizza un coefficiente femminile o maschile. Questa scelta non descrive la tua identità; se non è adatta a te, puoi mantenere gli obiettivi manuali.', type: 'choice', options: [choice('female', 'Coefficiente femminile'), choice('male', 'Coefficiente maschile'), choice('manual', 'Preferisco gli obiettivi manuali')] },
    { id: 'height', title: 'Quanto sei alto/a?', description: 'Serve insieme a età e peso per la stima di energia a riposo.', type: 'number', min: 70, max: 250, step: 0.1, unit: 'cm', placeholder: 'La tua altezza' },
    { id: 'weight', title: 'Qual è il tuo peso attuale?', description: 'Puoi modificare il valore proposto. Nessuna misurazione viene aggiunta al diario Peso.', type: 'number', min: 15, max: 500, step: 0.1, unit: 'kg', placeholder: 'Il tuo peso' },
    { id: 'physiologicalState', title: 'C’è una fase particolare da considerare?', description: 'Gravidanza e allattamento richiedono riferimenti specifici: il percorso manterrà i tuoi obiettivi attuali.', type: 'choice', when: a => a.sex === 'female', options: [choice('none', 'Nessuna di queste'), choice('pregnant', 'Gravidanza'), choice('lactating', 'Allattamento'), choice('unknown', 'Preferisco non indicarlo')] },
    { id: 'menstrualStatus', title: 'Quale riferimento usare per il ferro?', description: 'Serve solo se, nel riepilogo, sceglierai di aggiornare i riferimenti dei micronutrienti. Non viene dedotto dalla tua età.', type: 'choice', when: a => a.sex === 'female' && a.physiologicalState === 'none', options: [choice('menstruating', 'Ho le mestruazioni'), choice('postmenopause', 'Sono in postmenopausa'), choice('unknown', 'Altro / preferisco non indicarlo', 'Il riferimento per il ferro resterà invariato')] },
    { id: 'careContext', title: 'Devi seguire indicazioni personalizzate?', description: 'Per esempio un piano prescritto, condizioni che influenzano la nutrizione o un rapporto difficile con il cibo. Non ti chiediamo diagnosi o dettagli.', type: 'choice', options: [choice('none', 'No, non ho indicazioni di questo tipo'), choice('professional', 'Sì, voglio mantenere il mio piano', 'Salviamo le preferenze senza calcolare nuovi obiettivi'), choice('unknown', 'Preferisco non indicarlo', 'Gli obiettivi restano manuali')] },
    { id: 'activity', title: 'Quanto movimento c’è nella tua giornata?', description: 'Considera tutta la giornata, incluso l’allenamento: non lo aggiungeremo una seconda volta alle calorie.', type: 'choice', options: [choice('low', 'Prevalentemente sedentaria', 'Molte ore seduto/a, poco movimento complessivo · PAL 1,4'), choice('deskTraining', 'Giornata soprattutto seduta, con allenamenti regolari', 'Lavoro o studio seduto/a, pochi passi e allenamenti moderati 3–4 volte a settimana · PAL iniziale 1,5'), choice('light', 'Un po’ di movimento', 'Cammino o mi muovo regolarmente anche fuori dagli allenamenti · PAL 1,6'), choice('active', 'Attiva', 'Molto movimento anche fuori dalla palestra: lavoro fisico o molti passi ogni giorno · PAL 1,8'), choice('veryActive', 'Molto attiva', 'Attività fisica intensa nel complesso della giornata · PAL 2,0')] },
    { id: 'trainingDays', title: 'Quante volte ti alleni in una settimana tipica?', description: 'Aiuta a descrivere le tue abitudini. Non raddoppia l’energia già considerata nel movimento quotidiano.', type: 'choice', options: [choice('0', 'Per ora non mi alleno'), choice('1-2', '1–2 volte'), choice('3-4', '3–4 volte'), choice('5+', '5 o più volte')] },
    { id: 'trainingType', title: 'Che tipo di attività preferisci?', description: 'Questa risposta aggiunge contesto alle tue preferenze. Non genera una dieta sportiva.', type: 'choice', when: a => a.trainingDays !== '0', options: [choice('strength', 'Forza e palestra'), choice('endurance', 'Corsa, bici e resistenza'), choice('mixed', 'Un po’ di entrambe'), choice('gentle', 'Mobilità e attività leggera'), choice('other', 'Altra attività')] },
    { id: 'dietaryPattern', title: 'Come descriveresti la tua alimentazione?', description: 'Nessun alimento verrà escluso automaticamente. Le preferenze resteranno modificabili.', type: 'choice', options: [choice('omnivore', 'Varia, senza esclusioni particolari'), choice('vegetarian', 'Vegetariana'), choice('vegan', 'Vegana'), choice('pescatarian', 'Pescetariana'), choice('other', 'Diversa / preferisco non definirla')] },
    { id: 'mealsPerDay', title: 'Quanti momenti per mangiare ti sono comodi?', description: 'Con la conferma finale aggiorneremo anche i pasti del diario. Le registrazioni già effettuate non vengono cancellate.', type: 'choice', options: [choice('3', 'Tre pasti'), choice('4', 'Tre pasti e uno spuntino al pomeriggio'), choice('4-morning', 'Tre pasti e uno spuntino al mattino'), choice('5', 'Tre pasti e due spuntini'), choice('flexible', 'Preferisco decidere giorno per giorno', 'Mantieni i pasti già configurati')] },
    { id: 'schedule', title: 'Quanto sono regolari i tuoi orari?', description: 'Per suggerimenti compatibili con la vita reale, se deciderai di condividere il contesto con il Coach.', type: 'choice', options: [choice('regular', 'Abbastanza regolari'), choice('variable', 'Cambiano spesso'), choice('shifts', 'Lavoro o studio su turni'), choice('unspecified', 'Preferisco non indicarlo')] },
    { id: 'cookingTime', title: 'Quanto tempo vuoi dedicare a preparare un pasto?', description: 'Non modifica i fabbisogni: aiuta a rendere pratici eventuali suggerimenti.', type: 'choice', options: [choice('quick', 'Fino a 15 minuti'), choice('medium', '15–30 minuti'), choice('relaxed', 'Anche più di 30 minuti'), choice('ready', 'Preferisco pasti pronti o fuori casa')] },
    { id: 'foodPriorities', title: 'Che cosa conta di più nella scelta dei cibi?', description: 'Puoi scegliere più risposte.', type: 'multi', options: [choice('simple', 'Pochi ingredienti e semplicità'), choice('budget', 'Spesa contenuta'), choice('variety', 'Varietà'), choice('family', 'Pasti adatti a tutta la famiglia'), choice('portable', 'Facili da portare con me'), choice('none', 'Nessuna preferenza particolare')] },
    { id: 'hydrationHabits', title: 'Come va con l’acqua durante il giorno?', description: 'Solo un punto di partenza personale. Non modifica il tuo obiettivo di idratazione.', type: 'choice', options: [choice('regular', 'Bevo con regolarità'), choice('forget', 'Me ne dimentico spesso'), choice('variable', 'Dipende dalla giornata'), choice('unspecified', 'Preferisco non indicarlo')] },
    { id: 'sleep', title: 'Come descriveresti il tuo riposo?', description: 'Questa risposta rimane nel tuo profilo locale e non cambia la stima delle calorie.', type: 'choice', options: [choice('regular', 'Abbastanza regolare'), choice('variable', 'Variabile'), choice('difficult', 'Faccio fatica a riposare bene'), choice('unspecified', 'Preferisco non indicarlo')] },
    { id: 'focus', title: 'Quale piccolo miglioramento vorresti per primo?', description: 'Una priorità concreta rende più facile partire.', type: 'choice', options: [choice('logging', 'Registrare i pasti senza perdere tempo'), choice('regularity', 'Essere più regolare'), choice('variety', 'Variare di più i cibi'), choice('awareness', 'Capire meglio energia e nutrienti'), choice('planning', 'Organizzare i pasti con meno fatica')] },
    { id: 'confidence', title: 'Come preferisci iniziare?', description: 'Hai quasi finito: nella prossima schermata vedrai il riepilogo prima di applicare qualsiasi modifica.', type: 'choice', options: [choice('small', 'Un piccolo passo alla volta'), choice('structured', 'Con riferimenti più strutturati'), choice('explore', 'Esplorando, senza pressione')] }
  ];

  function number(value) {
    if (value === null || value === undefined || value === '') return null;
    const result = Number(String(value).replace(',', '.'));
    return Number.isFinite(result) ? result : null;
  }
  function displayNumber(value, digits) {
    const n = number(value);
    return n === null ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: digits === undefined ? 2 : digits });
  }
  function getQuestions(answers) { return QUESTIONS.filter(q => !q.when || q.when(answers || {})); }
  function validateAnswer(question, value) {
    if (!question) return false;
    if (question.type === 'number') {
      const n = number(value);
      return n !== null && n >= question.min && n <= question.max && (question.step !== 1 || Number.isInteger(n));
    }
    if (question.type === 'multi') return Array.isArray(value) && value.length > 0 && value.length <= question.options.length && value.every(v => question.options.some(o => o.value === v));
    return question.options.some(o => o.value === value);
  }
  function sanitizeAnswers(input) {
    const out = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
    for (const q of QUESTIONS) {
      const value = input[q.id];
      if (validateAnswer(q, value)) out[q.id] = q.type === 'multi' ? [...new Set(value)] : q.type === 'number' ? number(value) : value;
    }
    return out;
  }
  function initialAnswers(profile) {
    const answers = sanitizeAnswers(profile && profile.wizardV5 && profile.wizardV5.answers);
    const weight = number(profile && profile.weight);
    if (weight !== null && weight >= 15 && weight <= 500) answers.weight = weight;
    return answers;
  }
  // Read-only view of the last applied questionnaire, never a draft.
  function completedAnswers(profile) {
    const saved = profile && profile.wizardV5;
    if (!saved || !saved.completedAt || !saved.answers) return [];
    const answers = sanitizeAnswers(saved.answers);
    return getQuestions(answers).filter(q => validateAnswer(q, answers[q.id])).map(q => ({
      id: q.id, question: q.title,
      answer: q.type === 'number' ? displayNumber(answers[q.id]) + ' ' + q.unit :
        q.type === 'multi' ? answers[q.id].map(v => labelFor(q.id, v)).join(' · ') : labelFor(q.id, answers[q.id])
    }));
  }
  function answerWith(answers, questionId, value) {
    const next = { ...answers, [questionId]: value };
    if (questionId === 'sex' && value !== 'female') { delete next.physiologicalState; delete next.menstrualStatus; }
    if (questionId === 'physiologicalState' && value !== 'none') delete next.menstrualStatus;
    if (questionId === 'trainingDays' && value === '0') delete next.trainingType;
    return next;
  }
  function nextStep(answers, questionId) {
    const questions = getQuestions(answers);
    const index = questions.findIndex(q => q.id === questionId);
    if (index >= 0 && index < questions.length - 1) return { questionId: questions[index + 1].id, review: false };
    const missing = questions.find(q => !validateAnswer(q, answers[q.id]));
    return missing ? { questionId: missing.id, review: false, missing: true } : { review: true };
  }
  function safeStorage() {
    try { return root.localStorage || null; } catch (_) { return null; }
  }
  function readDraft(storage) {
    try {
      const s = storage || safeStorage();
      if (!s) return null;
      const raw = s.getItem(DRAFT_KEY);
      if (!raw || raw.length > 20000) return null;
      const value = JSON.parse(raw);
      if (!value || value.version !== VERSION) return null;
      const answers = sanitizeAnswers(value.answers);
      const questions = getQuestions(answers);
      const index = questions.findIndex(q => q.id === value.questionId);
      return { answers, questionId: questions[Math.max(0, index)].id, savedAt: typeof value.savedAt === 'string' ? value.savedAt.slice(0, 40) : '' };
    } catch (_) { return null; }
  }
  function saveDraft(answers, questionId, storage) {
    try {
      const s = storage || safeStorage();
      if (!s) return false;
      s.setItem(DRAFT_KEY, JSON.stringify({ version: VERSION, answers: sanitizeAnswers(answers), questionId, savedAt: new Date().toISOString() }));
      return true;
    } catch (_) { return false; }
  }
  function clearDraft(storage) {
    try { const s = storage || safeStorage(); if (s) s.removeItem(DRAFT_KEY); return true; } catch (_) { return false; }
  }
  function labelFor(id, value) {
    const q = QUESTIONS.find(x => x.id === id);
    if (!q || !q.options) return '';
    return (q.options.find(o => o.value === value) || {}).label || '';
  }
  function contextForCoach(input) {
    const a = sanitizeAnswers(input);
    return {
      goal: labelFor('goal', a.goal),
      activity: labelFor('activity', a.activity),
      training: a.trainingDays === '0' ? 'Nessun allenamento regolare' : [labelFor('trainingDays', a.trainingDays), labelFor('trainingType', a.trainingType)].filter(Boolean).join(' · '),
      preferences: [labelFor('dietaryPattern', a.dietaryPattern), ...(a.foodPriorities || []).map(x => labelFor('foodPriorities', x))].filter(Boolean).join(' · '),
      mealPattern: [labelFor('mealsPerDay', a.mealsPerDay), labelFor('schedule', a.schedule)].filter(Boolean).join(' · '),
      cookingTime: labelFor('cookingTime', a.cookingTime),
      focus: [labelFor('focus', a.focus), labelFor('confidence', a.confidence)].filter(Boolean).join(' · ')
    };
  }
  function calculatePlan(input) {
    const a = sanitizeAnswers(input);
    const required = ['goal', 'age', 'sex', 'height', 'weight', 'careContext', 'activity'];
    if (required.some(id => !Object.prototype.hasOwnProperty.call(a, id))) return { eligible: false, reason: 'Completa i dati necessari prima del riepilogo.', code: 'INCOMPLETE' };
    const blocked = reason => ({ eligible: false, reason, code: 'MANUAL_PLAN', sourceIds: ['energy-mifflin', 'efsa-energy'] });
    if (a.age < 18) return blocked('Per chi ha meno di 18 anni il percorso salva solo le preferenze. Gli obiettivi nutrizionali richiedono riferimenti adatti alla crescita.');
    if (a.age > 78) return blocked('Fuori dall’intervallo di età studiato per questa equazione, manteniamo gli obiettivi attuali.');
    if (!['female', 'male'].includes(a.sex)) return blocked('Hai scelto gli obiettivi manuali. Le tue preferenze possono comunque essere salvate.');
    if (a.sex === 'female' && a.physiologicalState !== 'none') return blocked('Questa fase richiede riferimenti specifici. Manteniamo i tuoi obiettivi e non calcoliamo una variazione di energia.');
    if (a.careContext !== 'none') return blocked('Il tuo piano personale ha la precedenza. Salviamo le preferenze e manteniamo gli obiettivi già presenti.');
    const bmi = a.weight / Math.pow(a.height / 100, 2);
    if (bmi < 18.5 || bmi >= 40) return blocked('I dati inseriti richiedono una valutazione più individuale di quella disponibile in questo percorso. Gli obiettivi restano invariati.');
    if (a.goal === 'lose' && (bmi < 20 || a.age >= 65)) {
      const reasons = [];
      if (bmi < 20) reasons.push('il BMI calcolato è inferiore a 20');
      if (a.age >= 65) reasons.push('l’età inserita è di almeno 65 anni');
      // Keep the existing deficit guard. A maintenance alternative is offered
      // only if that plan independently passes all the original checks.
      const alternative = calculatePlan({ ...a, goal: 'maintain' });
      return { ...blocked('Non applichiamo automaticamente una riduzione dell’energia perché ' + reasons.join(' e ') + '. Puoi concordare un obiettivo personale con un professionista.'), restriction: 'DEFICIT_GUARD', maintenanceAvailable: alternative.eligible };
    }
    if (a.goal === 'gain' && bmi >= 30) return blocked('Per il profilo indicato non applichiamo automaticamente un aumento dell’energia. Manteniamo i tuoi obiettivi.');
    const henry = a.age === 18;
    const method = henry ? 'Henry 2005 (18–30 anni) × PAL' : 'Mifflin–St Jeor × PAL';
    const bmr = henry ? (a.sex === 'male' ? 14.4 * a.weight + 313 * a.height / 100 + 113 : 10.4 * a.weight + 615 * a.height / 100 - 282) : 10 * a.weight + 6.25 * a.height - 5 * a.age + (a.sex === 'male' ? 5 : -161);
    const pal = { low: 1.4, deskTraining: 1.5, light: 1.6, active: 1.8, veryActive: 2.0 }[a.activity];
    const maintenance = bmr * pal;
    const adjustment = a.goal === 'lose' ? -0.10 : a.goal === 'gain' ? 0.05 : 0;
    const kcal = Math.round(maintenance * (1 + adjustment));
    if (!Number.isFinite(kcal) || kcal < 1200 || kcal > 5000) return blocked('La stima cade fuori dall’intervallo gestito automaticamente dall’app. Verifica i dati oppure mantieni un obiettivo personale.');
    const protein = Math.max(kcal * 0.20 / 4, a.weight * 0.83);
    const fat = kcal * 0.30 / 9;
    const carbs = (kcal - protein * 4 - fat * 9) / 4;
    return {
      eligible: true, reason: '', method, bmr, pal, maintenance, adjustment, kcal,
      grams: { protein, carbs, fat, fiber: 25 },
      sourceIds: [henry ? 'energy-henry-2005' : 'energy-mifflin', 'efsa-energy', 'efsa-protein', 'efsa-carbohydrate', 'efsa-fats'],
      notes: [
        'La stima non misura il metabolismo: valuta nel tempo quanto è adatta a te.',
        'Il movimento comprende già l’allenamento; non vengono aggiunte calorie per le sessioni. Il PAL 1,5 per giornate sedentarie con allenamento è una stima iniziale dell’app, non una misurazione: rivaluta il fabbisogno in base all’andamento e al benessere.',
        'La ripartizione iniziale è 20% proteine, 50% carboidrati e 30% grassi, con almeno 0,83 g/kg di proteine. È una scelta modificabile dell’app.',
        'La variazione del −10% per ridurre il peso o del +5% per aumentarlo è una scelta prudente dell’app, non una prescrizione EFSA.',
        'Il limite degli zuccheri totali già impostato rimane distinto dalle raccomandazioni sugli zuccheri liberi.'
      ]
    };
  }
  function unitFactor(unit) {
    return { g: 1, mg: 0.001, 'µg': 0.000001, 'μg': 0.000001, ug: 0.000001, mcg: 0.000001 }[unit];
  }
  function numericGoal(g, weight) {
    if (!g) return null;
    const amount = number(g.targetMode === 'perKg' ? g.perKg : g.target);
    const kg = number(weight);
    if (amount === null || (g.targetMode === 'perKg' && kg === null)) return null;
    const result = g.targetMode === 'perKg' ? amount * kg : amount;
    return Number.isFinite(result) ? result : null;
  }
  function referenceChanges(goals, answers, plan, references) {
    if (!plan.eligible || !references || typeof references.referenceForGoal !== 'function') return [];
    const out = [];
    for (const g of goals || []) {
      if (!g || g.group === 'Energia e macro' || g.group === 'Personalizzati' || g.id !== g.name) continue;
      const ref = references.referenceForGoal(g.name || g.id, { ...answers, kcal: plan.kcal, clinical: answers.careContext !== 'none' });
      const from = ref && unitFactor(ref.unit), to = unitFactor(g.unit);
      if (!ref || !ref.autoApplicable || number(ref.value) === null || ref.value <= 0 || !from || !to) continue;
      const daily = ref.value * from / to;
      out.push({ id: g.id, name: g.name, unit: g.unit, daily, target: daily * (g.period === 'week' ? 7 : 1), kind: ref.kind || g.kind, reference: ref });
    }
    return out;
  }
  // Organizational change only: keep existing IDs and names for matching meals.
  // Logs and favorites are never mutated; removing a slot only changes the active list.
  function mealPlan(input, current) {
    const a = sanitizeAnswers(input);
    const ids = { '3': ['breakfast','lunch','dinner'], '4': ['breakfast','lunch','afternoon-snack','dinner'], '4-morning': ['breakfast','morning-snack','lunch','dinner'], '5': ['breakfast','morning-snack','lunch','afternoon-snack','dinner'] }[a.mealsPerDay];
    if (!ids || !Array.isArray(current)) return null;
    const names = { breakfast:'Colazione', 'morning-snack':'Spuntino mattina', lunch:'Pranzo', 'afternoon-snack':'Spuntino pomeriggio', dinner:'Cena' };
    const used = new Set();
    return ids.map(id => {
      const existing = current.find(m => m && m.id === id && !used.has(m.id)) || current.find(m => m && typeof m.id === 'string' && typeof m.name === 'string' && !Object.prototype.hasOwnProperty.call(names,m.id) && m.name.trim().toLowerCase() === names[id].toLowerCase() && !used.has(m.id));
      const next = existing ? { id: existing.id, name: existing.name } : { id, name:names[id] };
      used.add(next.id); return next;
    });
  }
  function applyPlan(profile, goals, input, options) {
    const answers = sanitizeAnswers(input);
    const plan = calculatePlan(answers);
    const opts = options || {};
    const references = opts.references || root.NutriTraceNutritionReferences;
    let nextGoals = (goals || []).map(g => ({ ...g }));
    let nextProfile = { ...(profile || {}) };
    if (plan.eligible) {
      const oldPerKg = { ...((profile || {}).macroPlan || {}).perKg };
      const oldSugar = (goals || []).find(g => g.id === 'sugar');
      const sugarGrams = numericGoal(oldSugar, profile && profile.weight);
      const perKg = { ...oldPerKg, ...Object.fromEntries(Object.entries(plan.grams).map(([id, grams]) => [id, grams / answers.weight])) };
      if (sugarGrams !== null) perKg.sugar = sugarGrams / (oldSugar.period === 'week' ? 7 : 1) / answers.weight;
      nextProfile = { ...nextProfile, weight: answers.weight, macroPlan: { ...((profile || {}).macroPlan || {}), calorieMode: 'fixed', autoMacro: 'carbs', kcal: plan.kcal, perKg } };
      nextGoals = nextGoals.map(g => {
        if (g.id === 'kcal') return { ...g, target: plan.kcal, targetMode: 'absolute', period: 'day' };
        if (Object.prototype.hasOwnProperty.call(plan.grams, g.id)) return { ...g, target: plan.grams[g.id], targetMode: 'perKg', perKg: plan.grams[g.id] / answers.weight, period: 'day' };
        if (g.id === 'sugar' && g.targetMode === 'perKg' && sugarGrams !== null) return { ...g, perKg: sugarGrams / answers.weight };
        return g;
      });
    }
    const changes = opts.updateMicros ? referenceChanges(nextGoals, answers, plan, references) : [];
    const byId = new Map(changes.map(x => [x.id, x]));
    nextGoals = nextGoals.map(g => {
      const change = byId.get(g.id);
      return change ? { ...g, target: change.target, targetMode: 'absolute', perKg: 0, kind: change.kind, referencePending: false, noOfficialTarget: false, referenceV5: { sourceIds: change.reference.sourceIds || [], type: change.reference.type, note: change.reference.note || '', appliedAt: opts.now || new Date().toISOString() } } : g;
    });
    const context = contextForCoach(answers);
    nextProfile.wizardV5 = {
      version: VERSION, completedAt: opts.now || new Date().toISOString(), answers, context,
      calculation: { eligible: plan.eligible, reason: plan.reason, method: plan.method || null, kcal: plan.kcal || null, bmr: plan.bmr || null, pal: plan.pal || null, adjustment: plan.adjustment || 0 },
      nutritionReferencesVersion: references && (references.version || references.VERSION) || null
    };
    return { profile: nextProfile, goals: nextGoals, context, summary: plan, updatedMicronutrients: changes.map(x => x.id), meals: mealPlan(answers, opts.meals) };
  }

  function View(props) {
    const R = root.React;
    if (!R) return null;
    const h = R.createElement;
    const [draft] = R.useState(() => readDraft());
    const [answers, setAnswers] = R.useState(() => initialAnswers(props.profile));
    const [questionId, setQuestionId] = R.useState('goal');
    const [stage, setStage] = R.useState(draft ? 'resume' : 'questions');
    const [exitOpen, setExitOpen] = R.useState(false);
    const [error, setError] = R.useState('');
    const [applying, setApplying] = R.useState(false);
    const [updateMicros, setUpdateMicros] = R.useState(false);
    const [extra,setExtra]=R.useState(()=>({distribution:props.profile?.weeklyStrategyV64?.enabled?'variable':'uniform',days:props.profile?.weeklyStrategyV64?.days||[5,6],percent:props.profile?.weeklyStrategyV64?.percent??5,average:'',preferences:props.profile?.advancedV64||{}}));
    const backdropRef = R.useRef(null);
    const dialogRef = R.useRef(null);
    const headingRef = R.useRef(null);
    const contentRef = R.useRef(null);
    const applyingRef = R.useRef(false);
    const exitRef = R.useRef(false);
    const choiceAdvanceRef = R.useRef(null);
    const questions = getQuestions(answers);
    const index = Math.max(0, questions.findIndex(q => q.id === questionId));
    const question = questions[index];
    const answered = questions.filter(q => validateAnswer(q, answers[q.id])).length;
    const plan = calculatePlan(answers);
    const references = root.NutriTraceNutritionReferences;
    const microChanges = referenceChanges(props.goals, answers, plan, references);
    const currentValue = answers[question.id];
    exitRef.current = exitOpen;
    applyingRef.current = applying;

    R.useEffect(() => {
      const previousFocus = root.document.activeElement;
      const body = root.document.body;
      const previousOverflow = body.style.overflow;
      const inerted = [];
      body.style.overflow = 'hidden';
      for (const child of body.children) {
        if (child === backdropRef.current || child.contains(backdropRef.current)) continue;
        inerted.push({ element: child, inert: child.inert, aria: child.getAttribute('aria-hidden') });
        child.inert = true;
        child.setAttribute('aria-hidden', 'true');
      }
      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!applyingRef.current) { setError(''); setExitOpen(!exitRef.current); }
          return;
        }
        if (event.key !== 'Tab') return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        const targets = Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')).filter(x => x.getClientRects().length && x.getAttribute('aria-hidden') !== 'true');
        const first = targets[0], last = targets[targets.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && (root.document.activeElement === first || !dialog.contains(root.document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (root.document.activeElement === last || !dialog.contains(root.document.activeElement))) { event.preventDefault(); first.focus(); }
      }
      root.document.addEventListener('keydown', onKey, true);
      return () => {
        body.style.overflow = previousOverflow;
        for (const item of inerted) {
          item.element.inert = item.inert;
          if (item.aria === null) item.element.removeAttribute('aria-hidden'); else item.element.setAttribute('aria-hidden', item.aria);
        }
        root.document.removeEventListener('keydown', onKey, true);
        if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus();
      };
    }, []);
    R.useEffect(() => {
      choiceAdvanceRef.current = null;
      if (headingRef.current) headingRef.current.focus();
      if (contentRef.current) contentRef.current.scrollTop = 0;
    }, [question.id, stage, exitOpen]);

    function close() { if (typeof props.onClose === 'function') props.onClose(); }
    function setAnswer(value) {
      setError('');
      setAnswers(a => answerWith(a, question.id, value));
    }
    function forward(event) {
      if (event) event.preventDefault();
      if (!validateAnswer(question, currentValue)) { setError(question.type === 'number' ? `Inserisci un valore tra ${question.min} e ${question.max} ${question.unit}.` : 'Scegli una risposta per continuare.'); return; }
      advance(answers);
    }
    function advance(nextAnswers) {
      const next = nextStep(nextAnswers, question.id);
      if (next.review) setStage(root.NutriTraceStrategy?.WizardExtras?'extras':'review');
      else { setQuestionId(next.questionId); if (next.missing) setError('Completa questa risposta prima del riepilogo.'); }
    }
    function chooseAnswer(value) {
      if (question.type !== 'choice' || !validateAnswer(question, value) || choiceAdvanceRef.current === question.id) return;
      choiceAdvanceRef.current = question.id;
      const next = answerWith(answers, question.id, value);
      setError(''); setAnswers(next); advance(next);
    }
    async function apply() {
      if (applyingRef.current) return;
      const missing = questions.find(q => !validateAnswer(q, answers[q.id]));
      if (missing) { setStage('questions'); setQuestionId(missing.id); return; }
      applyingRef.current = true;
      setApplying(true); setError('');
      try {
        const payload = applyPlan(props.profile, props.goals, answers, { updateMicros, meals: props.meals });
        if(root.NutriTraceStrategy?.applyExtras)root.NutriTraceStrategy.applyExtras(payload,extra);
        if (typeof props.onApply !== 'function') throw new Error('Applicazione degli obiettivi non disponibile.');
        const result = await props.onApply(payload);
        if (result === false) throw new Error('Gli obiettivi non sono stati salvati. Riprova.');
        clearDraft();
        close();
      } catch (cause) {
        setError(cause && cause.message || 'Non è stato possibile applicare gli obiettivi. Riprova.');
        setApplying(false); applyingRef.current = false;
      }
    }
    function renderQuestion() {
      return h('form', { id: 'v58-wizard-question-form', className: 'v5-wizard-question', onSubmit: forward },
        h('p', { className: 'v5-wizard-kicker' }, index < 8 ? 'UNA BASE ADATTA A TE' : index < 13 ? 'LA TUA GIORNATA' : 'PICCOLE SCELTE, OGNI GIORNO'),
        h('h2', { id: 'v5-wizard-question-title', ref: headingRef, tabIndex: -1 }, question.title),
        h('p', { className: 'v5-wizard-description', id: 'v5-wizard-question-description' }, question.description),
        question.type === 'multi' && h('p', { className: 'v58-multi-label' }, 'Risposta multipla · scegli tutte le opzioni pertinenti'),
        question.type === 'number' ? h('label', { className: 'v5-wizard-number', htmlFor: 'v5-wizard-answer' },
          h('span', { className: 'v5-wizard-sr' }, question.title),
          h('input', { id: 'v5-wizard-answer', type: 'number', inputMode: question.step === 1 ? 'numeric' : 'decimal', min: question.min, max: question.max, step: question.step, value: currentValue === undefined ? '' : currentValue, placeholder: question.placeholder, onChange: event => setAnswer(event.target.value), 'aria-describedby': 'v5-wizard-question-description', autoComplete: 'off' }),
          h('span', { className: 'v5-wizard-unit' }, question.unit)
        ) : h('fieldset', { className: 'v5-wizard-options', 'aria-labelledby': 'v5-wizard-question-title' },
          h('legend', { className: 'v5-wizard-sr' }, question.title),
          question.options.map(option => {
            const checked = question.type === 'multi' ? (currentValue || []).includes(option.value) : currentValue === option.value;
            if (question.type === 'choice') return h('button', { type: 'button', key: option.value, className: 'v5-wizard-option v58-choice' + (checked ? ' is-selected' : ''), 'aria-pressed': checked, onClick: () => chooseAnswer(option.value) },
              h('span', { className: 'v58-choice-dot', 'aria-hidden': true }),
              h('span', { className: 'v5-wizard-option-text' }, h('strong', null, option.label), option.detail ? h('small', null, option.detail) : null));
            return h('label', { className: 'v5-wizard-option' + (checked ? ' is-selected' : ''), key: option.value },
              h('input', { type: question.type === 'multi' ? 'checkbox' : 'radio', name: question.id, value: option.value, checked, onChange: () => {
                if (question.type !== 'multi') return setAnswer(option.value);
                const current = Array.isArray(currentValue) ? currentValue : [];
                let next = checked ? current.filter(x => x !== option.value) : [...current, option.value];
                if (!checked && option.value === 'none') next = ['none'];
                else if (option.value !== 'none') next = next.filter(x => x !== 'none');
                setAnswer(next);
              } }),
              h('span', { className: 'v5-wizard-option-text' }, h('strong', null, option.label), option.detail ? h('small', null, option.detail) : null)
            );
          })
        )
      );
    }
    function renderReview() {
      const plannedMeals = mealPlan(answers, props.meals);
      let weeklyPreview=null, weeklySchedule=null, weeklyError='';
      if(plan.eligible&&extra.distribution==='variable'&&root.NutriTraceStrategy){try{weeklyPreview=root.NutriTraceStrategy.adjustedBase({...plan,allowReduction:answers.age<65&&answers.weight/((answers.height/100)**2)>=20},extra.average);weeklySchedule=root.NutriTraceStrategy.buildSchedule(weeklyPreview,extra.days,extra.percent);}catch(e){weeklyError=e.message;}}
      const names = { kcal: ['Energia', 'kcal'], protein: ['Proteine', 'g'], carbs: ['Carboidrati', 'g'], fat: ['Grassi', 'g'], fiber: ['Fibre', 'g'] };
      return h('div', { className: 'v5-wizard-review' },
        h('p', { className: 'v5-wizard-kicker' }, 'PRONTO/A A PARTIRE'),
        h('h2', { ref: headingRef, tabIndex: -1 }, plan.eligible ? 'I tuoi riferimenti iniziali' : 'Le tue preferenze, il tuo piano'),
        h('p', { className: 'v5-wizard-description' }, plan.eligible ? 'Controlla il riepilogo. Puoi tornare alle risposte oppure applicare gli obiettivi e modificarli in qualsiasi momento.' : plan.reason),
        plan.eligible ? h('div', { className: 'v5-wizard-energy' }, h('span', null, 'Energia stimata al giorno'), h('strong', null, displayNumber(plan.kcal, 0), h('small', null, ' kcal')), h('p', null, labelFor('goal', answers.goal))) : h('div', { className: 'v5-wizard-notice' }, h('strong', null, 'Gli obiettivi attuali restano invariati'), h('p', null, 'Salviamo le risposte e le preferenze del percorso; puoi anche aggiornare l’organizzazione dei pasti. Puoi continuare a modificare i tuoi obiettivi dalla schermata abituale.')),
        !plan.eligible && plan.maintenanceAvailable ? h('div', { className: 'v5-wizard-notice' },
          h('strong', null, 'Vuoi calcolare invece gli obiettivi di mantenimento?'),
          h('p', null, 'Non prevede una riduzione dell’energia. Ti mostreremo la stima di calorie e macro prima di applicarla. Le altre risposte rimangono uguali.'),
          h('button', { type: 'button', className: 'v5-wizard-secondary', disabled: applying, onClick: () => { setAnswers(a => ({ ...a, goal: 'maintain' })); setUpdateMicros(false); setError(''); } }, 'Calcola mantenimento')
        ) : null,
        weeklyError&&h('p',{role:'alert'},weeklyError), weeklySchedule&&h('div',{className:'v5-wizard-notice'},h('strong',null,'Obiettivo medio scelto: '+displayNumber(weeklyPreview.kcal,0)+' kcal/giorno'),h('p',null,'Budget: '+displayNumber(weeklyPreview.kcal*7,0)+' kcal/settimana'),h('div',{className:'v64-week-grid'},...weeklySchedule.map((d,i)=>h('div',{key:i},root.NutriTraceStrategy.days[i],h('b',null,displayNumber(d.kcal,0)+' kcal'))))),
        plan.eligible ? h('div', { className: 'v5-wizard-targets' }, Object.entries(names).map(([id, meta]) => {
          const old = (props.goals || []).find(g => g.id === id);
          let oldValue = numericGoal(old, props.profile && props.profile.weight);
          if (old && old.period === 'week' && oldValue !== null) oldValue /= 7;
          const value = weeklyPreview ? weeklyPreview[id] : id === 'kcal' ? plan.kcal : plan.grams[id];
          return h('div', { className: 'v5-wizard-target', key: id }, h('span', null, meta[0]), h('strong', null, displayNumber(value, id === 'kcal' ? 0 : 2), ' ', meta[1]), h('small', null, 'Prima: ', displayNumber(oldValue), ' ', meta[1], '/giorno'));
        })) : null,
        plan.eligible ? h('details', { className: 'v5-wizard-explanation' }, h('summary', null, 'Come sono stati calcolati?'),
          h('p', null, plan.method + ': ', displayNumber(plan.bmr, 0), ' kcal a riposo × PAL ', displayNumber(plan.pal), ' = ', displayNumber(plan.maintenance, 0), ' kcal di mantenimento stimate. ', plan.adjustment ? 'Variazione scelta dall’app: ' + displayNumber(plan.adjustment * 100) + '%.' : 'Nessuna variazione per il peso.'),
          h('ul', null, plan.notes.map((note, i) => h('li', { key: i }, note))),
          h('p', null, 'Fonti: ', h('a', { href: 'https://pubmed.ncbi.nlm.nih.gov/2305711/', target: '_blank', rel: 'noopener noreferrer' }, 'Mifflin 1990'), plan.method.startsWith('Henry') && h('a', { href: 'https://www.healthcouncil.nl/site/binaries/site-content/collections/documents/2022/08/16/dietary-reference-values-for-energy/Background-document_%2BDRVs-for-energy.pdf', target: '_blank', rel: 'noopener noreferrer' }, ' · Henry 2005 (tabella A1)'), ' · ', h('a', { href: 'https://www.efsa.europa.eu/en/efsajournal/pub/3005', target: '_blank', rel: 'noopener noreferrer' }, 'EFSA energia'), ' · ', h('a', { href: 'https://www.efsa.europa.eu/en/press/news/nda100326', target: '_blank', rel: 'noopener noreferrer' }, 'EFSA carboidrati, grassi e fibre'), '. I dettagli sono anche in Dati → Fonti scientifiche.')
        ) : null,
        plan.eligible && microChanges.length ? h('section', { className: 'v5-wizard-micros' },
          h('label', { className: 'v5-wizard-toggle' }, h('input', { type: 'checkbox', checked: updateMicros, onChange: event => setUpdateMicros(event.target.checked) }), h('span', null, h('strong', null, 'Aggiorna anche i riferimenti dei micronutrienti'), h('small', null, 'Facoltativo: sostituisce ', microChanges.length, ' obiettivi standard compatibili con il profilo. Le voci personalizzate e i dati senza riferimento applicabile restano invariati.'))),
          updateMicros ? h('details', { open: true, className: 'v5-wizard-explanation' }, h('summary', null, 'Valori che verranno applicati'), h('ul', { className: 'v5-wizard-micro-list' }, microChanges.map(change => h('li', { key: change.id }, h('span', null, change.name), h('strong', null, displayNumber(change.daily), ' ', change.unit, '/giorno')))), h('p', { className: 'v5-wizard-footnote' }, 'I riferimenti EFSA descrivono popolazioni sane, non una prescrizione individuale. I target settimanali vengono convertiti in 7 giorni; i limiti superiori non diventano obiettivi.')) : null
        ) : null,
        plannedMeals ? h('div', { className: 'v5-wizard-notice' },
          h('strong', null, 'Configurazione dei pasti dopo la conferma'),
          h('p', null, plannedMeals.map(m => m.name).join(' · ')),
          h('p', null, 'Orari: ' + (labelFor('schedule', answers.schedule) || 'Non indicati') + '. Nessun orario obbligatorio.'),
          h('p', null, 'I pasti non inclusi verranno rimossi dalla configurazione attiva. Le loro registrazioni restano nel diario come Senza pasto; i preferiti restano salvati. Puoi ripristinare la configurazione precedente insieme agli obiettivi.')) : null,
        h('div', { className: 'v5-wizard-privacy' }, h('strong', null, 'Le risposte restano in questo browser'), h('p', null, 'Il percorso non invia risposte al Coach. Nella chat puoi scegliere separatamente se condividere le preferenze e le informazioni nutrizionali.')),
        h('div', { className: 'v5-wizard-question-actions' }, h('button', { type: 'button', className: 'v5-wizard-secondary', disabled: applying, onClick: () => { setStage(root.NutriTraceStrategy?.WizardExtras?'extras':'questions'); setQuestionId(questions[questions.length - 1].id); setError(''); } }, '← Rivedi le risposte'), h('button', { type: 'button', className: 'v5-wizard-primary', disabled: applying||!!weeklyError, onClick: apply }, applying ? 'Salvataggio…' : plan.eligible ? 'Applica obiettivi' : 'Salva le preferenze'))
      );
    }
    function renderExit() {
      return h('div', { className: 'v5-wizard-exit' }, h('span', { className: 'v5-wizard-hero-mark', 'aria-hidden': true }, '↗'), h('h2', { ref: headingRef, tabIndex: -1 }, 'Riprendi quando vuoi'), h('p', { className: 'v5-wizard-description' }, 'I tuoi obiettivi non sono stati modificati. Puoi tenere una bozza in questo browser e completarla più avanti.'), h('div', { className: 'v5-wizard-stack' }, h('button', { type: 'button', className: 'v5-wizard-primary', onClick: () => { if (saveDraft(stage === 'resume' && draft ? draft.answers : answers, stage === 'resume' && draft ? draft.questionId : question.id)) close(); else setError('Non è stato possibile salvare la bozza nel browser. Puoi continuare o uscire senza salvarla.'); } }, 'Salva bozza ed esci'), h('button', { type: 'button', className: 'v5-wizard-secondary', onClick: () => { clearDraft(); close(); } }, 'Esci senza salvare'), h('button', { type: 'button', className: 'v5-wizard-text-button', onClick: () => { setError(''); setExitOpen(false); } }, 'Continua il percorso')));
    }
    function renderResume() {
      return h('div', { className: 'v5-wizard-resume' }, h('span', { className: 'v5-wizard-hero-mark', 'aria-hidden': true }, '↗'), h('p', { className: 'v5-wizard-kicker' }, 'BENTORNATO/A'), h('h2', { ref: headingRef, tabIndex: -1 }, 'Ripartiamo dalla tua bozza?'), h('p', { className: 'v5-wizard-description' }, 'Hai un percorso salvato in questo browser. Nessun obiettivo è stato cambiato.'), h('div', { className: 'v5-wizard-stack' }, h('button', { type: 'button', className: 'v5-wizard-primary', onClick: () => { setAnswers(draft.answers); setQuestionId(draft.questionId); setStage('questions'); } }, 'Riprendi il percorso'), h('button', { type: 'button', className: 'v5-wizard-secondary', onClick: () => { clearDraft(); setAnswers(initialAnswers(props.profile)); setQuestionId('goal'); setStage('questions'); } }, 'Ricomincia dall’inizio')));
    }
    const content = h('div', { className: 'v5-wizard-backdrop', ref: backdropRef }, h('section', { className: 'v5-wizard-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Personalizza i miei obiettivi', ref: dialogRef, tabIndex: -1 },
      h('header', { className: 'v5-wizard-header' }, h('div', { className: 'v5-wizard-brand' }, h('span', { 'aria-hidden': true }, '◒'), h('div', null, h('strong', null, 'NutriTrace'), h('small', null, 'Personalizza i miei obiettivi'))), h('button', { type: 'button', className: 'v5-wizard-close', 'aria-label': exitOpen ? 'Torna al percorso' : 'Esci dal percorso', disabled: applying, onClick: () => { setError(''); setExitOpen(!exitOpen); } }, '×')),
      !exitOpen && stage !== 'resume' ? h('div', { className: 'v5-wizard-progress-area' }, h('div', { className: 'v5-wizard-progress-label', 'aria-live': 'polite' }, h('strong', null, stage === 'review' ? 'Riepilogo finale' : 'Domanda ' + (index + 1) + ' di ' + questions.length), h('span', null, answered + ' risposte · ' + (questions.length - answered) + ' da completare')), h('div', { className: 'v5-wizard-progress', role: 'progressbar', 'aria-label': 'Risposte completate', 'aria-valuemin': 0, 'aria-valuemax': questions.length, 'aria-valuenow': answered }, h('span', { style: { width: (100 * answered / questions.length) + '%' } }))) : null,
      h('div', { className: 'v5-wizard-content', ref: contentRef }, exitOpen ? renderExit() : stage === 'resume' ? renderResume() : stage === 'review' ? renderReview() : stage === 'extras' ? h(root.NutriTraceStrategy.WizardExtras,{value:extra,onChange:setExtra,plan:{...plan,allowReduction:answers.age<65&&answers.weight/((answers.height/100)**2)>=20},onBack:()=>{setStage('questions');setQuestionId(questions[questions.length-1].id);},onNext:()=>setStage('review')}) : renderQuestion(), error ? h('p', { className: 'v5-wizard-error', role: 'alert' }, error) : null),
      !exitOpen && stage === 'questions' ? h('footer', { className: 'v5-wizard-footer v58-wizard-footer' },
        h('div', { className: 'v58-wizard-actions' },
          h('button', { type: 'button', className: 'v5-wizard-secondary v58-back', disabled: index === 0, onClick: () => { setError(''); setQuestionId(questions[index - 1].id); } }, '← Indietro'),
          question.type !== 'choice' && h('button', { type: 'submit', form: 'v58-wizard-question-form', className: 'v5-wizard-primary v58-next', disabled: !validateAnswer(question, currentValue) }, index === questions.length - 1 ? 'Riepilogo →' : 'Continua →')),
        h('small', null, 'Solo sul tuo dispositivo · Puoi uscire e riprendere quando vuoi')) : null
    ));
    return root.ReactDOM && root.ReactDOM.createPortal ? root.ReactDOM.createPortal(content, root.document.body) : content;
  }
  return Object.freeze({ View, VERSION, DRAFT_KEY, MAX_QUESTIONS, QUESTIONS, getQuestions, validateAnswer, sanitizeAnswers, initialAnswers, calculatePlan, mealPlan, referenceChanges, applyPlan, contextForCoach, readDraft, saveDraft, clearDraft, displayNumber, completedAnswers, answerWith, nextStep });
});
