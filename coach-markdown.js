/* NutriTrace Coach renderer v2.1 — safe React elements, GFM-style tables, no HTML execution.
   Self-contained offline subset; raw HTML and Markdown links are rendered as plain text. */
(function(root){
'use strict';
const h=root.React.createElement;
const escapeRaw=x=>String(x??'');
function inline(raw){
 const s=escapeRaw(raw),out=[];
 const rx=/(\*\*[^*\n]+\*\*|__[^_\n]+__|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)|~~[^~\n]+~~|`[^`\n]+`)/g;
 let last=0,m;
 while((m=rx.exec(s))){
  if(m.index>last)out.push(s.slice(last,m.index));
  const v=m[0],strong=v.startsWith('**')||v.startsWith('__'),strike=v.startsWith('~~'),code=v.startsWith('`');
  out.push(h(strong?'strong':strike?'s':code?'code':'em',{key:m.index},v.slice(strong||strike?2:1,strong||strike?-2:-1)));
  last=rx.lastIndex;
 }
 if(last<s.length)out.push(s.slice(last));
 return out;
}
function cells(line){
 let text=line.trim();
 if(text.startsWith('|'))text=text.slice(1);
 if(text.endsWith('|')&&!text.endsWith('\\|'))text=text.slice(0,-1);
 return text.split(/(?<!\\)\|/).map(s=>s.replace(/\\\|/g,'|').trim());
}
const sep=s=>/^:?-{3,}:?$/.test(s.trim());
function tableAt(lines,i){
 if(i+1>=lines.length||!lines[i].includes('|'))return false;
 const headers=cells(lines[i]),dividers=cells(lines[i+1]);
 return headers.length>1&&headers.length===dividers.length&&dividers.every(sep);
}
function blockStart(lines,i){
 const s=lines[i]||'';
 return /^#{1,6}\s+/.test(s)||/^\s*[-*+]\s+/.test(s)||/^\s*\d+[.)]\s+/.test(s)||/^>\s?/.test(s)||/^```/.test(s)||tableAt(lines,i)||/^(\s*---+\s*|\s*\*\s*\*\s*\*\s*)$/.test(s);
}
function render(raw){
 const lines=escapeRaw(raw).replace(/\r\n?/g,'\n').split('\n');
 const nodes=[];let i=0;
 while(i<lines.length){
  if(!lines[i].trim()){i++;continue;}
  const start=i,s=lines[i];
  if(/^```/.test(s)){
   const lang=s.slice(3).trim().replace(/[^a-z0-9+-]/gi,'').slice(0,30),code=[];
   i++;while(i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i++]);
   if(i<lines.length)i++;
   nodes.push(h('pre',{key:start,className:'coach-code',tabIndex:0},h('code',{'data-language':lang},code.join('\n'))));continue;
  }
  if(tableAt(lines,i)){
   const headers=cells(lines[i]),align=cells(lines[i+1]).map(x=>x.startsWith(':')&&x.endsWith(':')?'center':x.endsWith(':')?'right':'left');
   i+=2;const rows=[];
   while(i<lines.length&&lines[i].trim()&&lines[i].includes('|')&&!blockStart(lines,i)){
    const values=cells(lines[i]);
    rows.push(h('tr',{key:i},...headers.map((_,j)=>h('td',{key:j,style:{textAlign:align[j]}},...inline(values[j]||'')))));i++;
   }
   nodes.push(h('div',{key:start,className:'coach-table-scroll',role:'region','aria-label':'Tabella della risposta',tabIndex:0},
    h('table',{className:'coach-table'},h('thead',null,h('tr',null,...headers.map((v,j)=>h('th',{key:j,scope:'col',style:{textAlign:align[j]}},...inline(v))))),h('tbody',null,...rows))));continue;
  }
  const heading=/^(#{1,6})\s+(.+)$/.exec(s);
  if(heading){const level=Math.min(6,heading[1].length+1);nodes.push(h('h'+level,{key:start},...inline(heading[2])));i++;continue;}
  if(/^(\s*---+\s*|\s*\*\s*\*\s*\*\s*)$/.test(s)){nodes.push(h('hr',{key:start}));i++;continue;}
  const bullet=/^\s*[-*+]\s+(.+)$/.exec(s),ordered=/^\s*(\d+)[.)]\s+(.+)$/.exec(s);
  if(bullet||ordered){
   const list=[],isOrdered=Boolean(ordered);
   while(i<lines.length){
    const m=isOrdered?/^\s*\d+[.)]\s+(.+)$/.exec(lines[i]):/^\s*[-*+]\s+(.+)$/.exec(lines[i]);
    if(!m)break;
    list.push(h('li',{key:i},...inline(m[isOrdered?1:1])));i++;
   }
   nodes.push(h(isOrdered?'ol':'ul',{key:start},...list));continue;
  }
  if(/^>\s?/.test(s)){
   const quote=[];while(i<lines.length&&/^>\s?/.test(lines[i]))quote.push(lines[i++].replace(/^>\s?/,''));
   nodes.push(h('blockquote',{key:start},...inline(quote.join(' '))));continue;
  }
  const paragraph=[];
  while(i<lines.length&&lines[i].trim()&&(i===start||!blockStart(lines,i))){
   paragraph.push(lines[i].trim());i++;
  }
  if(!paragraph.length){i++;continue;}
  // Preserve author line breaks without turning every soft wrap into a new paragraph.
  const content=[];
  paragraph.forEach((line,j)=>{if(j)content.push(h('br',{key:'br'+j}));content.push(...inline(line));});
  nodes.push(h('p',{key:start},...content));
 }
 return h('div',{className:'coach-markdown'},...nodes);
}
root.NutriTraceCoachMarkdown=Object.freeze({render,version:'2.1.0'});
})(window);
