'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../meal-analytics-dashboard.js'),'utf8');
const walk=x=>x&&typeof x==='object'?[x,...(x.children||[]).flatMap(walk)]:[];
const text=x=>x==null||x===false?'':typeof x==='object'?(x.children||[]).map(text).join(''):String(x);
function env(){let i=0,state=[],refs=[],r=0;const c={React:{createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:v=>{const n=i++;if(!(n in state))state[n]=v;return[state[n],x=>{state[n]=typeof x==='function'?x(state[n]):x;}];},useMemo:fn=>fn(),useRef:v=>refs[r++]|| (refs[r-1]={current:v}),useEffect:()=>{}}};vm.createContext(c);vm.runInContext(source,c);const render=fn=>{i=0;r=0;return fn();};return {render,reset(){state=[];refs=[];},dashboard:()=>render(()=>c.NutriTraceMealAnalyticsDashboard({from:'2023-11-27',to:'2026-11-27',today:'2026-11-27',meals:[{id:'b',name:'Colazione'}],foods:[],logs:[]}))};}
const chart=t=>walk(t).find(x=>typeof x.type==='function'&&x.type.name==='InteractiveChart');
test('V733 rolling meal intervals aggregate long histories and retain date range inside chart',()=>{const e=env();let t=e.dashboard();assert.ok(chart(t).props.labels.length<=37);const range=()=>walk(t).find(x=>x.type==='select'&&x.props.value==='custom'||x.type==='select'&&['7','30','365'].includes(x.props.value));range().props.onChange({target:{value:'7'}});t=e.dashboard();assert.equal(chart(t).props.labels.length,7);range().props.onChange({target:{value:'365'}});t=e.dashboard();assert.ok(chart(t).props.labels.length<=54);assert.ok(walk(t).some(x=>x.type==='option'&&text(x)==='Mensile'));});
test('V733 meal chart allows page gestures and a real tap, expands and closes',()=>{const e=env(),p=chart(e.dashboard());e.reset();const render=()=>e.render(()=>p.type(p.props));let t=render(),svg=walk(t).find(x=>x.type==='svg');assert.match(svg.props.style.touchAction,/pan-y/);assert.equal(svg.props.onTouchMove,undefined);const rect={getBoundingClientRect:()=>({left:0,width:720})},ev={clientX:100,clientY:100,pointerId:1,currentTarget:rect};svg.props.onPointerDown(ev);svg.props.onPointerUp({...ev,clientY:200});t=render();assert.match(text(t),/Tocca un punto/);svg=walk(t).find(x=>x.type==='svg');svg.props.onPointerDown(ev);svg.props.onPointerUp(ev);t=render();assert.doesNotMatch(text(t),/Tocca un punto/);const first=text(t);svg=walk(t).find(x=>x.type==='svg');svg.props.onPointerDown(ev);svg.props.onPointerMove({...ev,clientX:600,clientY:102});t=render();assert.notEqual(text(t),first);svg.props.onPointerUp({...ev,clientX:600,clientY:102});t=render();walk(t).find(x=>x.type==='button'&&text(x)==='Espandi grafico').props.onClick();t=render();assert.equal(t.props.role,'dialog');walk(t).find(x=>x.type==='button'&&text(x)==='Chiudi grafico').props.onClick();assert.equal(render().props.role,undefined);});


test('V734 every chart uses direction-locked scrub: tap, horizontal drag, vertical scroll, cancellation',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 for(const name of ['meal-analytics-dashboard.js','body-weight.js','weight-calorie-chart.js','metabolism-v70.js','food-quality-v73.js']){
  const content=fs.readFileSync(path.join(__dirname,'..',name),'utf8'),start=content.indexOf('function v734Gesture('),end=content.indexOf('function v734Expansion(',start);
  assert.ok(start>=0&&end>start,name);
  const build=vm.runInNewContext(content.slice(start,end)+';v734Gesture');
  const selected=[],ref={current:null},handlers=build(ref,e=>selected.push(e.clientX));
  const target={setPointerCapture(){},hasPointerCapture(){return true;}},e={pointerId:1,clientX:10,clientY:10,currentTarget:target};
  handlers.onPointerDown(e);handlers.onPointerUp(e);assert.equal(selected.at(-1),10,name);
  handlers.onPointerDown(e);handlers.onPointerMove({...e,clientX:30,clientY:11});assert.equal(selected.at(-1),30,name);
  handlers.onPointerMove({...e,clientX:60,clientY:13});assert.equal(selected.at(-1),60,name);handlers.onPointerUp({...e,clientX:70,clientY:15});assert.equal(selected.at(-1),70,name);
  const n=selected.length;handlers.onPointerDown(e);handlers.onPointerMove({...e,clientY:50});handlers.onPointerMove({...e,clientX:80,clientY:50});handlers.onPointerUp({...e,clientX:90,clientY:51});assert.equal(selected.length,n,name);
  handlers.onPointerDown(e);handlers.onPointerCancel();handlers.onPointerMove({...e,clientX:90});assert.equal(selected.length,n,name);
  assert.match(content,/Espandi grafico/,name);
 }
});
