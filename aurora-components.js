/* NutriTrace Aurora V5 — presentation-only React primitives.
 * All records, events, API and AI calls remain in the original app.js.
 * No persistence and no network calls are introduced by this file.
 */
(function (root) {
  'use strict';
  const React = root.React;
  if (!React || !React.createElement) throw new Error('React must load before NutriTraceAurora');
  const h = React.createElement;
  const NAV = [
    { id: 'oggi', title: 'Oggi', icon: 'home' },
    { id: 'ricerca', title: 'Ricerca', icon: 'search' },
    { id: 'alimenti', title: 'Alimenti', icon: 'food' },
    { id: 'ricette', title: 'Ricette', icon: 'food' },
    { id: 'obiettivi', title: 'Obiettivi', icon: 'target' },
    { id: 'peso', title: 'Peso', icon: 'scale' },
    { id: 'micro', title: 'Micronutrienti', icon: 'leaf' },
    { id: 'analisi', title: 'Analisi', icon: 'chart' },
    { id: 'coach', title: 'Coach AI', icon: 'sparkles' },
    { id: 'dati', title: 'Dati', icon: 'grid' }
  ];
  const PRIMARY = ['oggi','ricerca','obiettivi','coach','analisi'];
  const PATHS = {
    home: ['M3 10.5 12 3l9 7.5V21h-7v-7h-4v7H3z'],
    search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','m17 17 5 5'],
    food: ['M6 3v7','M3 3v7','M9 3v7','M3 10h6','M6 10v11','M17 3c-3.1 0-4 4-4 8v3h4v7','M17 3v11'],
    target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z','M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z','m12 12 7-7'],
    scale: ['M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z','M8 10a4 4 0 0 1 8 0','M12 10l2-2'],
    chart: ['M3 20h18','M6 17v-6','M11 17V6','M16 17v-9','M21 17V3'],
    sparkles: ['m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7z','m19 16 .75 2.25L22 19l-2.25.75L19 22l-.75-2.25L16 19l2.25-.75z','m4 2 .65 1.35L6 4l-1.35.65L4 6l-.65-1.35L2 4l1.35-.65z'],
    grid: ['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z'],
    more: ['M4 7h16','M4 12h16','M4 17h16'],
    camera: ['M4 6h3l2-3h6l2 3h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    barcode: ['M2 5v14','M5 5v14','M9 5v14','M12 5v14','M16 5v14','M19 5v14','M22 5v14'],
    plus: ['M12 5v14','M5 12h14'],
    arrow: ['M5 12h14','m13 6 6 6-6 6'],
    moon: ['M20.5 16.5A8.5 8.5 0 0 1 7.5 3.5 8.5 8.5 0 1 0 20.5 16.5z'],
    sun: ['M12 4v-2','M12 22v-2','M4 12H2','M22 12h-2','m5 5-2-2','m18 18 3 3','m19 5 2-2','m5 19-2 2','M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'],
    leaf: ['M20 4C7 4 3 10 4 18c8 2 15-2 16-14z','M4 19c4-5 9-9 15-12'],
    check: ['M4 12l5 5L20 6'],
    chevron: ['m9 18 6-6-6-6'],
    droplet: ['M12 2c-3 5-8 9-8 13a8 8 0 0 0 16 0c0-4-5-8-8-13z'],
    flame: ['M12 22c5 0 8-3.6 8-8 0-3.1-2.6-5.4-3.6-8.4-.6 2.3-2.4 3.2-3.5 3.7C12.5 6.5 11 4.4 9 3c.2 4-5 6.8-5 11a8 8 0 0 0 8 8z'],
    muscle: ['M3 14v5h5l2-3 5 .4c3 0 6-2 6-5v-3a2 2 0 0 0-4 0v2h-3l-3-7H8l-1 8-4 3z'],
    wheat: ['M12 21V3','m12 8-4-4','m12 12 4-4','m12 16-4-4','m12 20 4-4'],
    info: ['M12 17v-5','M12 8h.01','M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z']
  };
  function Icon({ name, size=21, className='', title }) {
    return h('svg', {
      className:'a-icon '+className,
      width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.85,
      strokeLinecap:'round',strokeLinejoin:'round',focusable:'false',
      'aria-hidden':title?undefined:'true', role:title?'img':undefined
    },title?h('title',null,title):null,(PATHS[name]||PATHS.info).map((d,i)=>h('path',{key:i,d})));
  }
  function Logo() {
    return h('span',{className:'a-logo', 'aria-label':'NutriTrace'},
      h('svg',{className:'a-logo-mark',viewBox:'0 0 46 46',width:38,height:38,'aria-hidden':'true',focusable:'false'},
        h('path',{d:'M23 39C8 37 5 28 5 9c11-1 19 6 19 20z',fill:'#075A40'}),
        h('path',{d:'M22 36C20 18 27 9 42 6c3 17-3 28-20 30z',fill:'#8CD632'})
      ), h('span',null,'NutriTrace'));
  }
  function Header({darkMode,onToggleTheme,onQuickAdd}) {
    return h('header',{className:'a-header'},
      h('div',{className:'a-brand-block'},
        h(Logo),
        h('div',{className:'a-brand-tagline'},'La tua nutrizione, sotto controllo.')),
      h('div',{className:'a-header-actions'},
        h('span',{className:'a-local-badge'},h('span',{className:'a-status-dot'}),'Diario locale'),
        h('button',{type:'button',className:'a-theme-toggle',title:darkMode?'Attiva tema chiaro':'Attiva tema scuro','aria-label':darkMode?'Attiva tema chiaro':'Attiva tema scuro','aria-pressed':!!darkMode,onClick:onToggleTheme},
          h(Icon,{name:darkMode?'sun':'moon',size:20})),
        onQuickAdd && h('span',{className:'v58-global-add-slot'},h('button',{type:'button',className:'v58-global-add',onClick:onQuickAdd,'aria-label':'Aggiungi alimento rapidamente',title:'Aggiungi alimento'},'+'))));
  }
  function Navigation({tab,onChange,onQuickAdd}) {
    const [more,setMore]=React.useState(false);
    const panelRef=React.useRef(null), triggerRef=React.useRef(null);
    React.useEffect(()=>{
      if(!more)return;
      const previousFocus=document.activeElement, oldOverflow=document.body.style.overflow;
      document.body.style.overflow='hidden';
      const frame=requestAnimationFrame(()=>panelRef.current?.querySelector('button')?.focus());
      function keydown(event){
        if(event.key==='Escape'){event.preventDefault();setMore(false);return;}
        if(event.key!=='Tab')return;
        const nodes=[...(panelRef.current?.querySelectorAll('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[])];
        if(!nodes.length)return;
        const first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey&&(document.activeElement===first||!panelRef.current.contains(document.activeElement))){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!panelRef.current.contains(document.activeElement))){event.preventDefault();first.focus();}
      }
      document.addEventListener('keydown',keydown);
      return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keydown);document.body.style.overflow=oldOverflow;
        (previousFocus?.isConnected?previousFocus:triggerRef.current)?.focus?.();};
    },[more]);
    function go(id) { setMore(false);onChange(id);window.scrollTo(0,0); }
    function button(item,kind) {return h('button',{
      key:item.id,type:'button',className:'a-nav-item'+(tab===item.id?' is-active':''),
      'aria-current':tab===item.id?'page':undefined,
      onClick:()=>go(item.id)
    },h(Icon,{name:item.icon,size:kind==='desktop'?19:21}),h('span',null,item.title));}
    return h(React.Fragment,null,
      h('nav',{className:'a-nav-desktop','aria-label':'Sezioni NutriTrace'},NAV.map(item=>button(item,'desktop')),onQuickAdd&&h('button',{type:'button',className:'v58-nav-add',onClick:onQuickAdd,'aria-label':'Aggiungi alimento rapidamente',title:'Aggiungi alimento'},'+')),
      h('nav',{className:'a-nav-mobile','aria-label':'Navigazione principale'},
        PRIMARY.map(id=>button(NAV.find(item=>item.id===id),'mobile')),
        h('button',{ref:triggerRef,type:'button',className:'a-nav-item a-nav-more'+(more||!PRIMARY.includes(tab)?' is-active':''),'aria-expanded':more,'aria-haspopup':'dialog','aria-controls':'a-more-menu',onClick:()=>setMore(v=>!v)},
          h(Icon,{name:'more',size:21}),h('span',null,'Altro'))),
      more&&h('div',{className:'a-more-overlay v5-more-overlay',onClick:()=>setMore(false)},
        h('div',{ref:panelRef,id:'a-more-menu',className:'a-more-panel',role:'dialog','aria-modal':true,'aria-labelledby':'v5-more-title',onClick:e=>e.stopPropagation()},
          h('div',{className:'a-more-title'},h('strong',{id:'v5-more-title'},'Altre sezioni'),h('button',{type:'button',onClick:()=>setMore(false),'aria-label':'Chiudi menu'},'✕')),
          h('div',{className:'a-more-grid'},NAV.filter(item=>!PRIMARY.includes(item.id)).map(item=>button(item,'mobile'))))));
  }
  function format(value,digits=0){
    if (value===null||value===undefined||value===''||!Number.isFinite(Number(value))) return 'N/D';
    return new Intl.NumberFormat('it-IT',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(Number(value));
  }
  function percent(value,target){
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value),t=Number(target);
    if(!Number.isFinite(n)||!Number.isFinite(t)||t<=0)return null;
    return Math.max(0,Math.round(n/t*100));
  }
  function MetricTile({metric}) {
    const icons={protein:'muscle',carbs:'wheat',fat:'droplet',fiber:'leaf'};
    const pct=percent(metric.value,metric.target);
    const short={protein:'Proteine',carbs:'Carboidrati',fat:'Grassi',fiber:'Fibre'};
    return h('div',{className:'a-macro a-macro-'+metric.id},
      h('div',{className:'a-macro-heading'},h('span',{className:'a-macro-icon'},h(Icon,{name:icons[metric.id],size:21})),
        h('span',null,short[metric.id]||metric.label)),
      h('div',{className:'a-macro-amount'},h('strong',null,format(metric.value,1)),h('span',null,metric.target>0?` / ${format(metric.target,1)} g`:' g')),
      h('div',{className:'a-bar','role':'progressbar','aria-label':short[metric.id],
        'aria-valuenow':Math.max(0,Number(metric.value)||0),'aria-valuemin':0,
        'aria-valuemax':metric.target>0?Number(metric.target):undefined},
        h('span',{style:{width:(pct===null?0:Math.min(pct,100))+'%'}})),
      h('div',{className:'a-macro-bottom'},
        pct===null?'Target non impostato':`${pct}% del target`,
        metric.coverage!==undefined&&metric.coverage<.999?h('small',null,`Dati parziali (${Math.round(metric.coverage*100)}%)`):null));
  }
  function DailyOverview({metrics,onAdd,onSearch,onCoach,hydration}) {
    const energy=metrics.find(item=>item.id==='kcal')||{};
    const goal=Number(energy.target)||0;
    const kcal=Number(energy.value)||0;
    const pct=percent(kcal,goal);
    const remaining=goal>0?Math.max(0,goal-kcal):null;
    return h('section',{className:'a-overview','aria-label':'Riepilogo nutrizionale'},
      h('div',{className:'a-section-head'},
        h('div',null,h('span',{className:'a-kicker'},'IL TUO PERCORSO'),h('h2',null,'La giornata in un colpo d’occhio')),
        h('span',{className:'a-quiet-tag'},h(Icon,{name:'check',size:14}),'Dati del tuo diario')),
      h('div',{className:'a-overview-body'},
        h('div',{className:'a-energy-card'},
          h('div',{className:'a-energy-ring','role':'progressbar','aria-label':'Calorie assunte rispetto al target',
            'aria-valuenow':kcal,'aria-valuemin':0,'aria-valuemax':goal>0?goal:undefined,
            style:{'--a-pct':(pct===null?0:Math.min(pct,100))+'%'}},
            h('div',{className:'a-ring-inner'},h(Icon,{name:'flame',size:21}),
              h('strong',null,format(kcal,0)),h('span',null,'kcal'),
              h('small',null,goal>0?`di ${format(goal,0)}`:'Target da impostare'))),
          h('div',{className:'a-energy-status'},
            h('p',null,'Energia giornaliera'),
            h('strong',null,remaining===null?'—':format(remaining,0)),
            h('span',null,remaining===null?'Imposta il tuo target':kcal>goal?'Target superato':'kcal rimanenti'),
            h('div',{className:'a-energy-percent'},h(Icon,{name:'target',size:16}),
              pct===null?'Nessun target':`${pct}% del tuo obiettivo`),
            energy.coverage!==undefined&&energy.coverage<.999?h('small',{className:'a-warning'},`Dati nutrizionali parziali: copertura ${Math.round(energy.coverage*100)}%`):null)),
        h('div',{className:'a-macros'},metrics.filter(m=>m.id!=='kcal').map(m=>h(MetricTile,{key:m.id,metric:m})))),
      hydration,
      h('div',{className:'a-overview-actions'},
        h('button',{type:'button',className:'a-button-primary',onClick:onAdd},h(Icon,{name:'plus',size:20}),'Aggiungi un alimento'),
        h('button',{type:'button',className:'a-button-outline',onClick:onSearch},h(Icon,{name:'search',size:19}),'Cerca nel database'),
        h('button',{type:'button',className:'a-button-outline a-coach-link',onClick:onCoach},h(Icon,{name:'sparkles',size:18}),'Chiedi al Coach')));
  }
  /* One live diary: meal actions and foods stay inside their meal card. */
  function MealDiaryPanel(props) {
    return h('div',{className:'a-meal-panel v5-meal-panel'},h(root.NutriTraceMealDiary,props));
  }
  function PageIntro({kicker,title,description,icon}) {
    return h('div',{className:'a-page-intro'},
      h('div',null,kicker?h('span',{className:'a-kicker'},kicker):null,h('h1',null,title),
        description?h('p',null,description):null),
      icon?h('span',{className:'a-page-symbol'},h(Icon,{name:icon,size:26})):null);
  }
  function SearchHero({query,onQuery,onSearch,onAISearch,searching,aiBusy,camera,scanner}) {
    return h('div',{className:'a-search-hero'},
      h(PageIntro,{kicker:'TROVA, SCOPRI, REGISTRA',title:'Aggiungi un alimento',
        description:'Cerca nel database, interpreta una ricetta o riconosci un prodotto.',icon:'search'}),
      h('div',{className:'a-search-field'},
        h(Icon,{name:'search',size:22}),
        h('input',{type:'search','aria-label':'Cerca alimenti nel database',autoComplete:'off',
          placeholder:'Cerca un alimento, per esempio yogurt greco…',value:query,
          onChange:e=>onQuery(e.target.value),onKeyDown:e=>e.key==='Enter'&&onSearch()}),
        h('button',{type:'button',className:'a-button-primary',disabled:searching,onClick:onSearch},searching?'Cerco…':'Cerca')),
      h('div',{className:'a-action-grid'},
        h('button',{type:'button',className:'a-action-tile a-action-ai',
          disabled:aiBusy||!query.trim(),onClick:onAISearch,
          title:query.trim()?'Interpreta la ricerca con AI':'Digita prima un alimento'},
          h('span',{className:'a-action-icon'},h(Icon,{name:'sparkles',size:27})),
          h('strong',null,'Ricerca AI'),h('small',null,query.trim()?'Interpreta le parole, verifica i risultati':'Scrivi un alimento per iniziare'),
          h('span',{className:'a-tile-link'},aiBusy?'Ricerca…':'Avvia ricerca',h(Icon,{name:'arrow',size:15}))),
        h('details',{className:'a-action-tile a-action-expand'},
          h('summary',null,h('span',{className:'a-action-icon'},h(Icon,{name:'camera',size:27})),
            h('strong',null,'Foto alimento'),h('small',null,'Scatta o scegli una foto per riconoscerlo'),
            h('span',{className:'a-tile-link'},'Apri fotocamera',h(Icon,{name:'chevron',size:15}))),
          h('div',{className:'a-action-expanded'},camera)),
        h('details',{className:'a-action-tile a-action-expand'},
          h('summary',null,h('span',{className:'a-action-icon'},h(Icon,{name:'barcode',size:27})),
            h('strong',null,'Scansiona barcode'),h('small',null,'Trova i dati di un prodotto confezionato'),
            h('span',{className:'a-tile-link'},'Apri scanner',h(Icon,{name:'chevron',size:15}))),
          h('div',{className:'a-action-expanded'},scanner))));
  }
  function GoalsHero({metrics,micros}) {
    return h('div',{className:'a-goals-hero'},
      h(PageIntro,{kicker:'I TUOI TRAGUARDI',title:'Obiettivi nutrizionali',
        description:'Controlla i progressi di oggi e personalizza i tuoi target più sotto.',icon:'target'}),
      h('div',{className:'a-goals-layout'},
        h('article',{className:'a-goals-progress'},
          h('h2',null,'Progressi della giornata'),
          metrics.map(m=>{
            const pct=m.comparisonAvailable===false?null:percent(m.value,m.target);
            return h('div',{className:'a-goal-row',key:m.id},
              h('span',{className:'a-goal-identity'},h(Icon,{name:({kcal:'flame',protein:'muscle',carbs:'wheat',fat:'droplet',fiber:'leaf'})[m.id],size:21}),m.label),
              h('span',{className:'a-goal-value'},format(m.value,1),' / ',m.target>0?format(m.target,1):'—',` ${m.unit}`),
              h('strong',null,pct===null?'—':`${pct}%`),
              h('div',{className:'a-goal-track'},h('span',{style:{width:Math.min(pct||0,100)+'%'}})),
              m.coverage!==undefined&&m.coverage<.999?h('small',{className:'a-warning'},`Copertura dati ${Math.round(m.coverage*100)}%`):null);
          })),
        h('aside',{className:'a-goals-micros'},
          h('h2',null,'Micronutrienti in evidenza'),
          micros.length?h('div',{className:'a-micros-grid'},micros.slice(0,6).map(m=>{
            const reviewOnly=m.noOfficialTarget===true||['special-review','not-established','combined-reference'].includes(m.referenceType);
            const reduction=m.referenceType==='reduction-goal',upper=m.kind==='upper'||reduction;
            const comparable=!reviewOnly&&m.comparisonAvailable!==false;
            const pct=comparable?percent(m.value,m.target):null;
            return h('div',{className:'a-micro-card',key:m.id},
              h('span',{className:'a-micro-icon'},h(Icon,{name:'leaf',size:20})),
              h('b',null,m.name),
              h('small',null,`${format(m.value,2)} ${m.unit} registrati`),
              h('small',null,`${reviewOnly?'Impostazione salvata':upper?'Soglia personale':'Obiettivo'}: ${m.target>0?format(m.target,2):'—'} ${m.unit}`),
              h('strong',null,reviewOnly?'Da verificare':pct===null?'—':upper?`${pct}% della soglia`:`${pct}%`),
              comparable?h('div',{className:'a-bar','aria-label':upper?'Rapporto con la soglia di contenimento':'Rapporto con l’obiettivo'},h('span',{style:{width:Math.min(pct||0,100)+'%',background:upper&&m.value>m.target?'#b86a30':undefined}})):null,
              reviewOnly?h('small',{className:'a-warning'},m.referenceNote||'Consulta Fonti scientifiche: nessuna quota da completare.'):reduction?h('small',{className:'a-warning'},'Soglia di contenimento, non quota da raggiungere.'):null,
              m.qualityNote?h('small',{className:'a-warning'},m.qualityNote):m.coverage<.999?h('small',{className:'a-warning'},'Dati parziali'):null);
          })):
          h('div',{className:'a-soft-empty'},'Personalizza i micronutrienti da evidenziare nella sezione sottostante.'))));
  }
  function AnalysisHero({average,previous,days,formatPeriod}) {
    const a=Number(average)||0,p=Number(previous)||0;
    const change=p>0?((a-p)/p*100):null;
    return h('div',{className:'a-analysis-hero'},
      h(PageIntro,{kicker:'IL TUO ANDAMENTO',title:'Analisi e progressi',
        description:'Un quadro completo basato sulle registrazioni reali del diario.',icon:'chart'}),
      h('div',{className:'a-analysis-summary'},
        h('span',{className:'a-analysis-symbol'},h(Icon,{name:'chart',size:28})),
        h('div',null,h('span',{className:'a-kicker'},formatPeriod||'PERIODO SELEZIONATO'),
          h('strong',null,days>0?format(a,0):'—',h('small',null,' kcal/giorno')),
          h('span',{className:'a-analysis-sub'},`${days||0} giorni con registrazioni`)),
        h('div',{className:'a-analysis-change'},
          change!==null&&days>0?h('strong',null,(change>0?'+':'')+format(change,1)+'%'):'—',
          h('span',null,p>0?'rispetto al periodo precedente':'Nessun confronto disponibile'))));
  }
  root.NutriTraceAurora=Object.freeze({Icon,Logo,Header,Navigation,DailyOverview,MealDiaryPanel,PageIntro,SearchHero,GoalsHero,AnalysisHero});
})(window);
