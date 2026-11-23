'use strict';

const SIZE = 7;
const TURN_MS = 90_000;
const FORMATS = Object.freeze({
  duel: {players:2, wallBreakers:false},
  'breaker-duel': {players:2, wallBreakers:true},
  tournament: {players:3, wallBreakers:true},
  'four-player': {players:4, wallBreakers:true},
});
const formatConfig = mode => Object.hasOwn(FORMATS,mode) ? FORMATS[mode] : null;
const undoStack = new WeakMap();
const VECTORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const same = (a, b) => a.r === b.r && a.c === b.c;

function edgeKey(a, b) {
  if (!inside(a.r, a.c) || !inside(b.r, b.c) || Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return null;
  if (a.r !== b.r) return `h:${Math.max(a.r, b.r)}:${a.c}`;
  return `v:${a.r}:${Math.max(a.c, b.c)}`;
}

function wallChoices(game, r, c) {
  return VECTORS.map(([dr, dc]) => edgeKey({r, c}, {r:r+dr,c:c+dc}))
    .filter(key => key && !game.walls[key]);
}

function makeGame(players, mode, round = 1) {
  mode ??= Object.keys(FORMATS).find(key=>FORMATS[key].players===players.length);
  const format = formatConfig(mode==='three' ? 'tournament' : mode);
  if (!format || players.length!==format.players) throw new Error('Player count does not match the game format');
  const activeIds = players.map(p => p.id);
  const game = {
    size: SIZE, mode, round, phase: 'placement', activeIds, wallBreakers: format.wallBreakers,
    pieces: [], walls: {}, breakersUsed: {},
    placementOrder: [...activeIds,...activeIds.slice().reverse()],
    placementIndex: 0, turnIndex: 0, pendingWall: null, deadline: null,
    movesPlayed: 0, history: [], result: null,
  };
  for (const id of activeIds) game.breakersUsed[id] = false;
  if (players.length === 2) {
    // Symmetric prescribed opening, kept in one place for adjustment to future reference photos.
    // Circular counters are placed automatically; each side then places two square counters.
    const opening = [[{r:2,c:1},{r:4,c:1}], [{r:2,c:5},{r:4,c:5}]];
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 2; k++) {
        game.pieces.push({id:`${activeIds[i]}-circle-${k}`,owner:activeIds[i],kind:'circle',...opening[i][k]});
      }
    }
  }
  undoStack.set(game,[]);
  return game;
}

function rememberAction(game) {
  undoStack.get(game).push({
    historyLength: game.history.length,
    phase: game.phase,
    pieces: game.pieces.map(piece=>({...piece})),
    walls: {...game.walls},
    breakersUsed: {...game.breakersUsed},
    placementIndex: game.placementIndex,
    turnIndex: game.turnIndex,
    pendingWall: game.pendingWall,
    movesPlayed: game.movesPlayed,
    result: game.result,
  });
}

function canUndo(game) {
  return Boolean(undoStack.get(game)?.length);
}

function undoAction(game) {
  const previous = undoStack.get(game)?.pop();
  if (!previous) return false;
  const {historyLength,...state} = previous;
  Object.assign(game,state);
  game.history.length = historyLength;
  game.deadline = game.phase==='move' || game.phase==='wall' ? Date.now()+TURN_MS : null;
  return true;
}

function canUseBreaker(game, owner) {
  return game.wallBreakers && Object.hasOwn(game.breakersUsed,owner) && !game.breakersUsed[owner];
}

function activePlayer(game) {
  if (game.phase === 'placement') return game.placementOrder[game.placementIndex] || null;
  if (game.phase === 'finished') return null;
  return game.activeIds[game.turnIndex];
}

function hasPiece(game, r, c, excludingId = null) {
  return game.pieces.some(p => p.id !== excludingId && p.r === r && p.c === c);
}

function placePiece(game, owner, kind, r, c) {
  if (game.phase !== 'placement' || activePlayer(game) !== owner) throw new Error('Not your placement turn');
  if (!Number.isInteger(r) || !Number.isInteger(c) || !inside(r,c) || hasPiece(game,r,c)) throw new Error('Choose an empty square');
  const two = game.activeIds.length === 2;
  if (two && kind !== 'square') throw new Error('Place a square counter in the duel');
  if (!['circle','square'].includes(kind)) throw new Error('Select a counter type');
  const owned = game.pieces.filter(p => p.owner === owner && p.kind === kind);
  if (owned.length >= (two ? (kind === 'square' ? 2 : 0) : 1)) throw new Error('That counter type has already been placed');
  const id = `${owner}-${kind}-${owned.length}`;
  rememberAction(game);
  game.pieces.push({id,owner,kind,r,c});
  game.history.push({kind:'place',owner,pieceId:id,pieceKind:kind,r,c});
  game.placementIndex++;
  if (game.placementIndex >= game.placementOrder.length) {
    game.phase = 'move';
    game.deadline = Date.now() + TURN_MS;
  }
  return game;
}

function pathOptions(game, piece) {
  const [r,c] = [piece.r,piece.c];
  const paths = [];
  for (const [dr,dc] of VECTORS) {
    const first = {r:r+dr,c:c+dc};
    paths.push([first]);
    if (piece.kind === 'square') paths.push([first,{r:r+dr*2,c:c+dc*2}]);
    else {
      for (const [tr,tc] of VECTORS) {
        if (dr*tr+dc*tc !== 0) continue; // perpendicular turn only
        paths.push([first,{r:first.r+tr,c:first.c+tc}]);
      }
    }
  }
  return paths;
}

function legalMoves(game, piece, canBreak = false) {
  if (!piece) return [];
  const options = [];
  const seen = new Set();
  for (const path of pathOptions(game, piece)) {
    let prev = {r:piece.r,c:piece.c};
    let blocked = null;
    let valid = true;
    for (const point of path) {
      if (!inside(point.r,point.c) || hasPiece(game,point.r,point.c,piece.id)) { valid=false; break; }
      const edge = edgeKey(prev,point);
      if (game.walls[edge]) {
        if (!canBreak || blocked) { valid = false; break; }
        blocked = edge;
      }
      prev = point;
    }
    if (!valid) continue;
    const to = path[path.length - 1];
    if (!wallChoices(game,to.r,to.c).length && !blocked) continue;
    // Breaking a wall leaves that same edge available for placement if next to the destination.
    if (!wallChoices(game,to.r,to.c).length && !VECTORS.some(([dr,dc]) => edgeKey(to,{r:to.r+dr,c:to.c+dc}) === blocked)) continue;
    const dedupe = `${to.r},${to.c}:${blocked || ''}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    options.push({to,breakEdge:blocked,path});
  }
  return options;
}

function optionsForTurn(game) {
  if (game.phase !== 'move') return {};
  const id = activePlayer(game);
  const out = {};
  for (const p of game.pieces.filter(x => x.owner === id)) {
    out[p.id] = legalMoves(game,p,canUseBreaker(game,id));
  }
  return out;
}

function movePiece(game, owner, pieceId, to, breakEdge = null) {
  if (game.phase !== 'move' || activePlayer(game) !== owner) throw new Error('Not your move');
  const piece = game.pieces.find(p => p.id === pieceId && p.owner === owner);
  if (!piece) throw new Error('Select one of your counters');
  if (!to || !Number.isInteger(to.r) || !Number.isInteger(to.c)) throw new Error('Invalid destination');
  const canBreak = canUseBreaker(game,owner);
  const option = legalMoves(game,piece,canBreak).find(opt => same(opt.to,to) && opt.breakEdge === (breakEdge || null));
  if (!option) throw new Error('Illegal move: blocked, occupied, or wrong counter movement');
  rememberAction(game);
  const from = {r:piece.r,c:piece.c};
  if (option.breakEdge) {
    delete game.walls[option.breakEdge];
    game.breakersUsed[owner] = true;
  }
  piece.r = to.r; piece.c = to.c;
  game.pendingWall = {owner,pieceId,from,to:{r:to.r,c:to.c},broken:option.breakEdge,path:option.path};
  game.phase = 'wall';
  game.history.push({kind:'move',owner,pieceId,from,to:option.to,broken:option.breakEdge});
  return game;
}

function territories(game) {
  const visited = new Set(), areas = [], score = Object.fromEntries(game.activeIds.map(id=>[id,0]));
  const largest = Object.fromEntries(game.activeIds.map(id=>[id,0]));
  for (let r=0; r<SIZE; r++) for (let c=0; c<SIZE; c++) {
    const start = r*SIZE+c;
    if (visited.has(start)) continue;
    visited.add(start);
    const queue = [{r,c}], cells = [];
    for (let cursor=0; cursor<queue.length; cursor++) {
      const current = queue[cursor]; cells.push(current);
      for (const [dr,dc] of VECTORS) {
        const other = {r:current.r+dr,c:current.c+dc};
        if (!inside(other.r,other.c) || game.walls[edgeKey(current,other)]) continue;
        const index = other.r*SIZE+other.c;
        if (!visited.has(index)) {visited.add(index);queue.push(other);}
      }
    }
    const memberIds = [...new Set(game.pieces.filter(p => cells.some(cell=>same(p,cell))).map(p=>p.owner))];
    const owner = memberIds.length===1 ? memberIds[0] : null;
    if (owner) { score[owner]+=cells.length; largest[owner]=Math.max(largest[owner],cells.length); }
    areas.push({cells,memberIds,owner,size:cells.length});
  }
  return {score,largest,areas,separated:areas.every(a=>a.memberIds.length<=1)};
}

function anyLegalMove(game, owner) {
  const canBreak = canUseBreaker(game,owner);
  return game.pieces.some(p=>p.owner===owner && legalMoves(game,p,canBreak).length>0);
}

function resolveResult(game, forced = false) {
  const info = territories(game);
  if (forced) {
    // Rare stalemate: in a shared component with all pieces immobilized, award only their occupied cells.
    for (const area of info.areas.filter(a=>a.memberIds.length>1)) {
      for (const p of game.pieces.filter(p=>area.cells.some(cell=>same(p,cell)))) {
        info.score[p.owner]++;
        info.largest[p.owner]=Math.max(info.largest[p.owner],1);
      }
    }
  }
  const ranking = [...game.activeIds].sort((a,b)=>info.score[b]-info.score[a] || info.largest[b]-info.largest[a]);
  const tied = (a,b)=>info.score[a]===info.score[b] && info.largest[a]===info.largest[b];
  const winners = ranking.filter(id=>tied(id,ranking[0]));
  game.result = {score:info.score,largest:info.largest,ranking,winners,reason:forced?'stalemate':'separated'};
  game.phase='finished';game.deadline=null;game.pendingWall=null;
  game.history.push({kind:'finish',result:game.result});
  return game.result;
}

function advance(game) {
  const info = territories(game);
  if (info.separated) return resolveResult(game);
  const total = game.activeIds.length;
  for (let step=0; step<total; step++) {
    game.turnIndex = (game.turnIndex + 1) % total;
    const next = activePlayer(game);
    if (anyLegalMove(game,next)) {
      game.deadline = Date.now() + TURN_MS;
      return;
    }
    game.history.push({kind:'skip',owner:next,reason:'No legal movement'});
  }
  return resolveResult(game,true);
}

function buildWall(game, owner, key) {
  if (game.phase!=='wall' || activePlayer(game)!==owner || game.pendingWall?.owner!==owner) throw new Error('You must move before building');
  const {r,c} = game.pendingWall.to;
  if (!wallChoices(game,r,c).includes(key)) throw new Error('Choose an empty internal edge beside your moved counter');
  rememberAction(game);
  game.walls[key] = {owner,turn:game.movesPlayed+1};
  game.history.push({kind:'wall',owner,key});
  game.movesPlayed++;
  game.pendingWall = null;
  game.phase='move';
  advance(game);
  return game;
}

function autoTurn(game) {
  if (game.phase==='placement' || game.phase==='finished') return;
  const owner = activePlayer(game);
  if (game.phase==='move') {
    const possibilities = game.pieces.filter(p=>p.owner===owner).flatMap(p=>legalMoves(game,p,false).map(opt=>({piece:p,opt})));
    // Avoid spending a wall breaker automatically when running out of time.
    if (!possibilities.length) {
      const breakMoves = game.pieces.filter(p=>p.owner===owner).flatMap(p=>legalMoves(game,p,canUseBreaker(game,owner)).map(opt=>({piece:p,opt})));
      if (!breakMoves.length) {
        rememberAction(game);
        game.history.push({kind:'skip',owner,reason:'Timer expired; no legal move'});
        advance(game);return;
      }
      possibilities.push(...breakMoves);
    }
    const selected = possibilities[Math.floor(Math.random()*possibilities.length)];
    movePiece(game,owner,selected.piece.id,selected.opt.to,selected.opt.breakEdge);
  }
  if (game.phase==='wall') {
    const {r,c}=game.pendingWall.to;
    const choices=wallChoices(game,r,c);
    if (!choices.length) {
      rememberAction(game);
      return resolveResult(game,true);
    }
    buildWall(game,owner,choices[Math.floor(Math.random()*choices.length)]);
    game.history.push({kind:'timeout',owner});
  }
}

const WallGoRules = {SIZE,TURN_MS,formatConfig,edgeKey,wallChoices,makeGame,canUndo,undoAction,canUseBreaker,activePlayer,hasPiece,placePiece,legalMoves,optionsForTurn,movePiece,territories,anyLegalMove,buildWall,autoTurn,resolveResult};

if (typeof module !== 'undefined' && module.exports) module.exports = WallGoRules;
else globalThis.WallGoRules = WallGoRules;
