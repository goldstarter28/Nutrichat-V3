/* Safe Markdown subset for NutriTrace Coach. React text nodes only: no HTML injection. */
(function(root){
'use strict';
const h=root.React.createElement;
function inline(text){
 const re=/(\*\*[^*\n]+\*\*|__[^_\n]+__|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)|`[^`\n]+`)/g;
 const out=[];let last=0,m;
 while((m=re.exec(text))!==null){
  if(m.index>last)out.push(text.slice(last,m.index));
  const s=m[0],val=s.startsWith('**')||s.startsWith('__')?s.slice(2,-2):s.slice(1,-1);
  const tag=s.startsWith('**')||s.startsWith('__')?'strong':s.startsWith('`')?'code':'em';
  out.push(h(tag,{key:m.index},val));last=re.lastIndex;
 }
 if(last<text.length)out.push(text.slice(last));
 return out;
}
function render(raw){
 const lines=String(raw||'').replace(/\r\n?/g,'\n').split('\n');
 const nodes=[];let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  const heading=/^(#{1,4})\s+(.+)$/.exec(line);
  if(heading){const level=Math.min(4,heading[1].length+1);nodes.push(h('h'+level,{key:i},...inline(heading[2])));i++;continue;}
  const bullet=/^\s*[-*+]\s+(.+)$/.exec(line);
  const ordered=/^\s*\d+[.)]\s+(.+)$/.exec(line);
  if(bullet||ordered){
   const start=i,orderedList=Boolean(ordered),items=[];
   while(i<lines.length){
    const m=orderedList?/^\s*\d+[.)]\s+(.+)$/.exec(lines[i]):/^\s*[-*+]\s+(.+)$/.exec(lines[i]);
    if(!m)break;
    items.push(h('li',{key:i},...inline(m[1])));i++;
   }
   nodes.push(h(orderedList?'ol':'ul',{key:start},...items));continue;
  }
  if(/^>\s?/.test(line)){nodes.push(h('blockquote',{key:i},...inline(line.replace(/^>\s?/,''))));i++;continue;}
  const start=i,para=[];
  while(i<lines.length&&lines[i].trim()&&!/^(#{1,4}\s+|\s*[-*+]\s+|\s*\d+[.)]\s+|>\s?)/.test(lines[i])){para.push(lines[i].trim());i++;}
  if(para.length)nodes.push(h('p',{key:start},...inline(para.join(' '))));
  else i++;
 }
 return h('div',{className:'coach-markdown'},...nodes);
}
root.NutriTraceCoachMarkdown=Object.freeze({render});
})(window);
