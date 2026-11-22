
'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {reconstruct}=require('../ingredient-reconstruction.js');

const catalog={
  protein:{unit:'g'},
  fat_total:{unit:'g'},
  energy_kcal:{unit:'kcal'},
  magnesium:{unit:'mg'},
  sodium:{unit:'mg'}
};

const detail={n:{
  protein:[10,'B',null,['it'],[9,11],'','B'],
  fat_total:[20,'B',null,['it'],[18,22],'','B'],
  energy_kcal:[220,'B',null,['it'],[200,240],'','B'],
  magnesium:[120,'B',null,['it'],[110,130],'','B'],
  sodium:[100,'B',null,['it'],[90,110],'','B']
}};

const microSpecs={
  Magnesio:{ids:['magnesium'],unit:'mg'}
};

const fixtures={
  items:[
    {name:'ingrediente A',percent:60},
    {name:'ingrediente B',percent:40}
  ],
  matches:{
    0:{confirmed:true,id:'A',name:'A',detail},
    1:{confirmed:true,id:'B',name:'B',detail}
  },
  catalog,
  microSpecs
};

test('full, confirmed and measured recipe reconstructs with ranges',()=>{
  const x=reconstruct({...fixtures,yieldFactor:1});
  assert.equal(x.values.protein.amount,10);
  assert.equal(x.values['micro:Magnesio'].amount,120);
  assert.deepEqual(x.values['micro:Magnesio'].range,[110,130]);
  assert.equal(x.values.salt.amount,.25);
});

test('unknown percent never produces a final value',()=>{
  const x=reconstruct({
    ...fixtures,
    items:[
      {name:'A',percent:60},
      {name:'B',percent:null}
    ],
    yieldFactor:1
  });
  assert.deepEqual(x.values,{});
  assert.equal(x.contributions.protein.amount,6);
});

test('no measured yield never produces a final value',()=>{
  const x=reconstruct(fixtures);
  assert.deepEqual(x.values,{});
  assert.equal(x.status,'partial');
});

test('unconfirmed mapping never produces final values',()=>{
  const x=reconstruct({
    ...fixtures,
    matches:{0:fixtures.matches[0]},
    yieldFactor:1
  });
  assert.deepEqual(x.values,{});
  assert.equal(x.contributions.protein.coveragePercent,60);
});

test('quality D and warnings are excluded',()=>{
  const bad={n:{
    protein:[10,'x',null,[],null,'outlier','D']
  }};
  const x=reconstruct({
    ...fixtures,
    matches:{
      0:{confirmed:true,id:'A',detail:bad},
      1:fixtures.matches[1]
    },
    yieldFactor:1
  });
  assert.equal(x.values.protein,undefined);
  assert.equal(x.contributions.protein.amount,4);
});

test('rejects percentage sum over 100',()=>{
  const x=reconstruct({
    ...fixtures,
    items:[
      {name:'A',percent:80},
      {name:'B',percent:40}
    ],
    yieldFactor:1
  });
  assert.equal(x.status,'invalid');
});

test('unit conversion is sourced from catalog, not guessed',()=>{
  const unknown={n:{
    protein:[10,'B',null,[],null,'','B']
  }};
  const x=reconstruct({
    ...fixtures,
    catalog:{},
    matches:{
      0:{confirmed:true,id:'A',detail:unknown},
      1:{confirmed:true,id:'B',detail:unknown}
    },
    yieldFactor:1
  });
  assert.equal(x.values.protein,undefined);
});
