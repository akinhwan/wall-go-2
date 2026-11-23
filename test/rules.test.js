'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R=require('../server/rules');
const ids=['blue','yellow','red'];
const people=ids.map(id=>({id}));
function placements(game) {
  for(let i=0;i<game.placementOrder.length;i++) {
    const id=game.placementOrder[i];
    const used=game.pieces.filter(p=>p.owner===id).map(p=>p.kind);
    const kind=game.activeIds.length===2?'square':(used.includes('square')?'circle':'square');
    let c=i%7, r=Math.floor(i/7);
    while(R.hasPiece(game,r,c)) c++;
    R.placePiece(game,id,kind,r,c);
  }
}
test('3-player snake placement, correct counter inventory, and game transition',()=>{
  const g=R.makeGame(people,'tournament');
  assert.deepEqual(g.placementOrder,['blue','yellow','red','red','yellow','blue']);
  placements(g);
  assert.equal(g.pieces.length,6);
  for(const id of ids)assert.deepEqual(g.pieces.filter(p=>p.owner===id).map(p=>p.kind).sort(),['circle','square']);
  assert.equal(g.phase,'move');assert.equal(R.activePlayer(g),'blue');assert.ok(g.deadline>Date.now());
});
test('2-player opening has four fixed circles and snake squares',()=>{
  const g=R.makeGame(people.slice(0,2),'duel');
  assert.deepEqual(g.placementOrder,['blue','yellow','yellow','blue']);
  assert.equal(g.pieces.filter(x=>x.kind==='circle').length,4);
  placements(g);
  assert.equal(g.pieces.length,8);
  for(const id of ids.slice(0,2)) {
    assert.equal(g.pieces.filter(p=>p.owner===id&&p.kind==='square').length,2);
    assert.equal(g.pieces.filter(p=>p.owner===id&&p.kind==='circle').length,2);
  }
});
test('square moves only straight 1 or 2; cannot pass occupied cells or walls',()=>{
  const g=R.makeGame(people,'tournament');g.phase='move';
  const p={id:'sq',owner:'blue',kind:'square',r:3,c:3};g.pieces=[p];
  let moves=R.legalMoves(g,p);
  assert.equal(moves.length,8);
  assert.ok(moves.some(x=>x.to.r===3&&x.to.c===5));
  assert.ok(!moves.some(x=>x.to.r===4&&x.to.c===4));
  g.pieces.push({id:'blocking',owner:'yellow',kind:'circle',r:3,c:4});
  moves=R.legalMoves(g,p);
  assert.ok(!moves.some(x=>x.to.r===3&&x.to.c===5));
  g.pieces.pop();g.walls['v:3:4']={owner:'red'};
  moves=R.legalMoves(g,p);
  assert.ok(!moves.some(x=>x.to.r===3&&x.to.c===4));
  assert.ok(R.legalMoves(g,p,true).some(x=>x.to.r===3&&x.to.c===4&&x.breakEdge==='v:3:4'));
});
test('round counter steps orthogonally and may turn to a diagonal; cannot continue straight two',()=>{
  const g=R.makeGame(people,'tournament');g.phase='move';
  const p={id:'ci',owner:'blue',kind:'circle',r:3,c:3};g.pieces=[p];
  const moves=R.legalMoves(g,p);
  assert.equal(new Set(moves.map(x=>x.to.r+','+x.to.c)).size,8);
  assert.ok(moves.some(x=>x.to.r===4&&x.to.c===4));
  assert.ok(moves.some(x=>x.to.r===3&&x.to.c===4));
  assert.ok(!moves.some(x=>x.to.r===3&&x.to.c===5));
});
test('breaker removes exactly a wall in the chosen travel path and can be used once',()=>{
  const g=R.makeGame(people,'tournament');
  g.phase='move';g.pieces=[{id:'sq',owner:'blue',kind:'square',r:3,c:3}];
  g.walls['v:3:4']={owner:'red'};
  const option=R.legalMoves(g,g.pieces[0],true).find(o=>o.to.r===3&&o.to.c===4&&o.breakEdge==='v:3:4');
  assert.ok(option);
  assert.throws(()=>R.movePiece(g,'blue','sq',{r:3,c:4},null),/Illegal/);
  R.movePiece(g,'blue','sq',option.to,option.breakEdge);
  assert.equal(g.walls['v:3:4'],undefined);
  assert.equal(g.breakersUsed.blue,true);
  assert.equal(g.phase,'wall');
  assert.throws(()=>R.movePiece(g,'blue','sq',{r:3,c:5},null),/Not your move/);
  R.buildWall(g,'blue','v:3:4');
  assert.ok(g.walls['v:3:4']);
});
test('flood-fill scores isolated territories and tracks largest area',()=>{
  const g=R.makeGame(people.slice(0,2),'duel');
  g.pieces=[{id:'b1',owner:'blue',kind:'square',r:0,c:1},{id:'b2',owner:'blue',kind:'circle',r:5,c:2},
    {id:'y1',owner:'yellow',kind:'square',r:0,c:6},{id:'y2',owner:'yellow',kind:'circle',r:6,c:4}];
  for(let r=0;r<7;r++)g.walls[`v:${r}:3`]={owner:'blue'};
  const info=R.territories(g);
  assert.equal(info.separated,true);
  assert.equal(info.score.blue,21);assert.equal(info.score.yellow,28);
  R.resolveResult(g);
  assert.equal(g.result.winners[0],'yellow');
  assert.equal(g.result.largest.yellow,28);
});
test('regions with players of different colors score zero; empty areas score zero',()=>{
  const g=R.makeGame(people.slice(0,2),'duel');
  g.pieces=[{id:'b1',owner:'blue',kind:'circle',r:2,c:1},{id:'y1',owner:'yellow',kind:'circle',r:3,c:4}];
  assert.deepEqual(R.territories(g).score,{blue:0,yellow:0});
  g.pieces=g.pieces.filter(p=>p.owner==='yellow');
  for(let r=0;r<7;r++)g.walls[`v:${r}:1`]={owner:'blue'};
  assert.deepEqual(R.territories(g).score,{blue:0,yellow:42});
});
test('wall must adjoin moved piece and cannot duplicate an existing wall',()=>{
  const g=R.makeGame(people,'tournament');g.phase='move';
  g.pieces=[{id:'sq',owner:'blue',kind:'square',r:3,c:3}];
  R.movePiece(g,'blue','sq',{r:3,c:4},null);
  assert.throws(()=>R.buildWall(g,'blue','h:1:1'),/empty internal edge/);
  R.buildWall(g,'blue','h:3:4');
  assert.ok(g.walls['h:3:4']);
});
test('timeout auto-completes a legal turn',()=>{
  const g=R.makeGame(people,'tournament');placements(g);
  const before=g.movesPlayed;
  R.autoTurn(g);
  assert.equal(g.movesPlayed,before+1);
  assert.equal(g.history.filter(x=>x.kind==='wall').length,1);
});
