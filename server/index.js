'use strict';

const express = require('express');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const {Server} = require('socket.io');
const rules = require('./rules');

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname,'../public'), {maxAge:'1h',setHeaders(res,file){if(file.endsWith('/sw.js')||file.endsWith('/index.html'))res.setHeader('Cache-Control','no-cache');}}));
app.get('/health', (_req,res)=>res.json({ok:true,uptime:Math.round(process.uptime())}));
const server = http.createServer(app);
const io = new Server(server, {maxHttpBufferSize:20_000, pingTimeout:30_000});
const rooms = new Map();
const MAX_CHAT = 40;

function token() { return crypto.randomBytes(24).toString('base64url'); }
function code() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let i=0;i<100;i++) {
    const candidate=Array.from(crypto.randomBytes(6),b=>alphabet[b%alphabet.length]).join('');
    if (!rooms.has(candidate)) return candidate;
  }
  throw new Error('Could not create room');
}
function plainName(s) {
  if(typeof s!=='string') return 'Player';
  const trimmed=s.replace(/[<>\x00-\x1F]/g,'').trim().slice(0,24);
  return trimmed || 'Player';
}
function capacity(room) { return room.format==='duel'?2:3; }
function publicState(room) {
  const game=room.game;
  return {
    code:room.code,format:room.format,stage:room.stage,
    hostId:room.hostId,
    players:room.players.map(p=>({id:p.id,name:p.name,color:p.color,connected:p.connected})),
    spectatorCount:room.spectators.size,
    game, currentId:game?rules.activePlayer(game):null,
    legal:game?rules.optionsForTurn(game):{},
    territory:game?rules.territories(game):null,
    firstRound:room.firstRound,
    chat:room.chat.slice(-MAX_CHAT),
    serverNow:Date.now(),
  };
}
function sendState(room) {
  room.lastActive=Date.now();
  io.to(room.code).emit('room:state',publicState(room));
}
function resultState(room) {
  const game=room.game;
  if(!game || game.phase!=='finished' || room.stage!=='active') return;
  if(room.format==='tournament' && game.round===1 && game.result.winners.length===1) {
    const safeId=game.result.winners[0];
    const remainder=game.result.ranking.filter(x=>x!==safeId);
    room.firstRound={safeId,finalIds:remainder,score:game.result.score,largest:game.result.largest};
    room.stage='between';
  } else room.stage='complete';
}
function requireRoom(socket) {
  const room=rooms.get(socket.data.roomCode);
  if(!room) throw new Error('Room no longer exists');
  return room;
}
function requireSeat(socket,room) {
  const player=room.players.find(p=>p.id===socket.data.playerId);
  if(!player || player.socketId!==socket.id) throw new Error('You are spectating this game');
  return player;
}
function requireHost(socket,room) {
  const player=requireSeat(socket,room);
  if(player.id===room.hostId)return;
  const host=room.players.find(p=>p.id===room.hostId);
  if(host?.connected)throw new Error('Only the host can do that');
  room.hostId=player.id; // claim hosting if the previous host has disconnected
}
function useAck(callback,result) { if(typeof callback==='function') callback(result); }
function event(socket,name,handler) {
  socket.on(name,(payload,callback)=>{
    try { const result=handler(payload||{});useAck(callback,{ok:true,...(result||{})}); }
    catch(error){useAck(callback,{ok:false,error:error.message||'Unexpected error'});}
  });
}
function attach(socket,room,player=null,spectatorName='Spectator') {
  if(socket.data.roomCode) {
    const old=rooms.get(socket.data.roomCode);
    if(old) {
      old.spectators.delete(socket.id);
      const previousPlayer=old.players.find(p=>p.id===socket.data.playerId && p.socketId===socket.id);
      if(previousPlayer){previousPlayer.socketId=null;previousPlayer.connected=false;}
      sendState(old);
    }
    socket.leave(socket.data.roomCode);
  }
  socket.data.roomCode=room.code;
  socket.data.playerId=player?.id||null;
  socket.join(room.code);
  if(player) {
    if(player.socketId && player.socketId!==socket.id) {
      const previous=io.sockets.sockets.get(player.socketId);
      if(previous) { previous.data.playerId=null;oldSpectate(previous,room);previous.emit('room:takeover'); }
    }
    player.socketId=socket.id;
    player.connected=true;
  } else room.spectators.set(socket.id,plainName(spectatorName));
  sendState(room);
}
function oldSpectate(socket,room) {room.spectators.set(socket.id,'Spectator');}
function startGame(room) {
  if(room.players.length!==capacity(room)) throw new Error(`You need ${capacity(room)} players to start`);
  const players=room.players;
  room.game=rules.makeGame(players,room.format,1);
  room.stage='active';room.firstRound=null;
  sendState(room);
}
function startFinal(room) {
  if(room.stage!=='between'||!room.firstRound||!room.game) throw new Error('The final is not ready yet');
  const order=room.firstRound.finalIds;
  const players=order.map(id=>room.players.find(p=>p.id===id));
  room.game=rules.makeGame(players,'duel',2);
  room.stage='active';
  sendState(room);
}

io.on('connection',socket=>{
  event(socket,'room:create',({name,format})=>{
    if(format!=='duel'&&format!=='tournament') format='tournament';
    const room={code:code(),format,stage:'lobby',players:[],spectators:new Map(),
      hostId:null,game:null,firstRound:null,chat:[],lastActive:Date.now()};
    const player={id:crypto.randomUUID(),secret:token(),name:plainName(name),
      color:0,connected:true,socketId:socket.id};
    room.players.push(player);room.hostId=player.id;rooms.set(room.code,room);
    attach(socket,room,player);
    return {code:room.code,id:player.id,token:player.secret,role:'player',state:publicState(room)};
  });

  event(socket,'room:join',({code:roomCode,name,token:resumeToken})=>{
    const room=rooms.get(String(roomCode||'').trim().toUpperCase());
    if(!room) throw new Error('Room not found. Check the invite code.');
    let player=room.players.find(p=>resumeToken&&p.secret===resumeToken);
    if(player) {
      attach(socket,room,player);
      return {code:room.code,id:player.id,token:player.secret,role:'player',state:publicState(room)};
    }
    if(room.stage==='lobby' && room.players.length<capacity(room)) {
      const index=room.players.length;
      player={id:crypto.randomUUID(),secret:token(),name:plainName(name),
        color:room.format==='duel'?(index===0?0:2):index,connected:true,socketId:socket.id};
      room.players.push(player);attach(socket,room,player);
      return {code:room.code,id:player.id,token:player.secret,role:'player',state:publicState(room)};
    }
    attach(socket,room,null,name);
    return {code:room.code,id:null,token:null,role:'spectator',state:publicState(room)};
  });

  event(socket,'room:format',({format})=>{
    const room=requireRoom(socket);requireHost(socket,room);
    if(room.stage!=='lobby') throw new Error('Format can only be changed in the lobby');
    if(!['duel','tournament'].includes(format)) throw new Error('Invalid format');
    if(room.players.length>(format==='duel'?2:3)) throw new Error('Too many players for this format');
    room.format=format;
    room.players.forEach((p,i)=>p.color=format==='duel'?(i===0?0:2):i);
    sendState(room);
  });
  event(socket,'room:start',()=>{const room=requireRoom(socket);requireHost(socket,room);if(room.stage!=='lobby')throw new Error('Already started');startGame(room);});
  event(socket,'room:startFinal',()=>{const room=requireRoom(socket);requireHost(socket,room);startFinal(room);});
  event(socket,'room:rematch',()=>{const room=requireRoom(socket);requireHost(socket,room);
    if(!['between','complete'].includes(room.stage))throw new Error('Finish this match before restarting');
    startGame(room);
  });
  event(socket,'room:act',action=>{
    const room=requireRoom(socket);const player=requireSeat(socket,room);
    if(room.stage!=='active'||!room.game)throw new Error('Match is not active');
    const game=room.game;
    if(rules.activePlayer(game)!==player.id)throw new Error('It is not your turn');
    switch(action.type) {
      case 'place':rules.placePiece(game,player.id,action.kind,action.r,action.c);break;
      case 'move':rules.movePiece(game,player.id,action.pieceId,action.to,action.breakEdge||null);break;
      case 'wall':rules.buildWall(game,player.id,action.key);break;
      default:throw new Error('Unknown move');
    }
    resultState(room);sendState(room);
  });
  event(socket,'room:chat',({message})=>{
    const room=requireRoom(socket);
    const clean=String(message||'').replace(/[\x00-\x1F]/g,' ').trim().slice(0,240);
    if(!clean)throw new Error('Enter a message');
    const player=room.players.find(p=>p.id===socket.data.playerId);
    const name=player?.name||room.spectators.get(socket.id)||'Spectator';
    room.chat.push({id:crypto.randomUUID(),name,owner:player?.id||null,message:clean,at:Date.now()});
    room.chat=room.chat.slice(-MAX_CHAT);
    sendState(room);
  });
  socket.on('disconnect',()=>{
    const room=rooms.get(socket.data.roomCode);if(!room)return;
    room.spectators.delete(socket.id);
    const player=room.players.find(p=>p.id===socket.data.playerId && p.socketId===socket.id);
    if(player){player.connected=false;player.socketId=null;}
    sendState(room);
  });
});

setInterval(()=>{
  const now=Date.now();
  for(const [roomCode,room] of rooms) {
    if(now-room.lastActive>4*60*60*1000 && !room.players.some(p=>p.connected)) {
      rooms.delete(roomCode);continue;
    }
    if(room.stage!=='active'||!room.game||!room.game.deadline||now<room.game.deadline)continue;
    try { rules.autoTurn(room.game);resultState(room);sendState(room); }
    catch(err) {console.error('Auto-turn error',roomCode,err);room.game.deadline=Date.now()+rules.TURN_MS;sendState(room);}
  }
},350).unref();

const PORT=Number(process.env.PORT||3000);
server.listen(PORT,'0.0.0.0',()=>console.log(`Wall Go II is running on http://localhost:${PORT}`));
