'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const R=require('../server/rules');

test('client renders a landing page and game board with 49 interactive cells',()=>{
  const callbacks={};
  const root={innerHTML:''};
  const storage=new Map();
  const socket={connected:true,on(name,cb){callbacks[name]=cb;},emit(){}};
  const document={getElementById(id){return id==='app'?root:null;},addEventListener(){},querySelector(){return null;}};
  const sandbox={document,io:()=>socket,URLSearchParams,location:{search:'',origin:'http://localhost:3000'},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)},
    history:{replaceState(){}},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},
    navigator:{clipboard:{}},Date,Math,console};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8'),sandbox);
  assert.match(root.innerHTML,/BUILD THE/);
  assert.match(root.innerHTML,/CREATE PRIVATE ROOM/);
  assert.equal((root.innerHTML.match(/class="cell-tile"/g)||[]).length,49);
});


test('offline local duel supports setup, full turns, scoring, rematch and mode selection without sockets',async()=>{
  const root={innerHTML:''},handlers={},intervals=[];
  let now=Date.now();
  class Clock extends Date { static now(){return now;} }
  const sandbox={document:{getElementById:id=>id==='app'?root:null,
    addEventListener:(name,fn)=>{handlers[name]=fn;},querySelector:()=>null},
    URLSearchParams,location:{search:'',origin:'http://localhost'},
    localStorage:{getItem:()=>null,setItem(){}},history:{replaceState(){}},
    setTimeout(){return 1;},clearTimeout(){},setInterval:fn=>intervals.push(fn),
    navigator:{onLine:false},window:{confirm:()=>true},Date:Clock,Math,console};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../public/rules.js'),'utf8'),sandbox);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8'),sandbox);
  const click=async(selector,dataset)=>handlers.click({preventDefault(){},target:{closest:s=>s===selector?{dataset}:null}});
  await click('[data-action]',{action:'local'});
  assert.match(root.innerHTML,/Player 1 · Blue · Opening setup/);
  await click('[data-action]',{action:'board-focus'});
  assert.match(root.innerHTML,/class="focus-screen"/);
  assert.match(root.innerHTML,/EXIT FULLSCREEN/);
  // Invalid occupied opening square does not advance setup.
  await click('[data-cell]',{cell:'2,1'});
  assert.match(root.innerHTML,/Counter 1 of 4/);
  for(const cell of ['0,0','0,6','6,6','6,0'])await click('[data-cell]',{cell});
  assert.match(root.innerHTML,/Player 1 · Blue · Turn 1/);
  await click('[data-cell]',{cell:'0,0'});
  await click('[data-cell]',{cell:'0,1'});
  assert.match(root.innerHTML,/Build one wall/);
  assert.match(root.innerHTML,/Bottom wall/);
  assert.match(root.innerHTML,/id="clock-text"/);
  await click('[data-wall]',{wall:'h:1:1'});
  assert.match(root.innerHTML,/Player 2 · Pink · Turn 2/);
  await click('[data-action]',{action:'board-focus'});
  assert.match(root.innerHTML,/FULLSCREEN BOARD/);
  // Exercise timeout completion through a finished game and its result UI.
  for(let i=0;i<200 && !root.innerHTML.includes('FINAL TERRITORY');i++){
    now+=91000;intervals.forEach(fn=>fn());
  }
  assert.match(root.innerHTML,/FINAL TERRITORY/);
  assert.match(root.innerHTML,/wins!|ended in a tie/);
  await click('[data-action]',{action:'rematch'});
  assert.match(root.innerHTML,/Counter 1 of 4/);
  await click('[data-cell]',{cell:'0,0'});
  await click('[data-action]',{action:'local-restart'});
  assert.match(root.innerHTML,/Counter 1 of 4/);
  await click('[data-action]',{action:'home'});
  assert.match(root.innerHTML,/CREATE PRIVATE ROOM/);
});
