/* Wall Go II browser client — all moves are checked by the authoritative server. */
(() => {
  'use strict';
  const socket = typeof io === 'function' ? io({autoConnect:false,reconnection:true}) : {connected:false,on(){},emit(){},connect(){},disconnect(){}};
  const rules = globalThis.WallGoRules;
  const COLORS = ['#168cfb','#ffe440','#ff3978'];
  const COLOR_NAMES = ['Blue','Yellow','Red'];
  const ICONS = {circle:'●',square:'■'};
  const query = new URLSearchParams(location.search);
  const initialCode = (query.get('room')||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
  const ui = {
    local:false, room:null, id:null, token:null, role:null, code:initialCode,
    name:localStorage.getItem('wallgo-name')||'', joinCode:initialCode,
    format:'tournament',selected:null,kind:'square',breakMode:false,pathChoices:null,
    rules:false,toast:'',chatDraft:'',phaseKey:'',clockOffset:0,connected:false
  };
  const app = document.getElementById('app');
  const escape = s => String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const playerById = id => ui.room?.players.find(p=>p.id===id);
  const me = () => playerById(ui.id);
  const isHost = () => ui.id && ui.room?.hostId===ui.id;
  const myTurn = () => ui.room?.stage==='active' && ui.room.currentId===ui.id;
  const getColor = id => COLORS[playerById(id)?.color??0];
  const cap = () => ui.room?.format==='duel'?2:3;
  const wallChoices = (g,r,c) => {
    if(!g) return [];
    const keys=[r>0?`h:${r}:${c}`:null,r<6?`h:${r+1}:${c}`:null,c>0?`v:${r}:${c}`:null,c<6?`v:${r}:${c+1}`:null];
    return keys.filter(x=>x&&!g.walls[x]);
  };
  const moment = stamp => new Date(stamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  function notify(msg) {
    ui.toast=msg;render();
    clearTimeout(notify.timeout);
    notify.timeout=setTimeout(()=>{ui.toast='';render();},2800);
  }
  function syncLocal() {
    const r=ui.room,g=r.game;
    r.currentId=rules.activePlayer(g);
    r.stage=g.phase==='finished'?'complete':'active';
    r.legal=rules.optionsForTurn(g);r.territory=rules.territories(g);
    ui.id=r.currentId||r.hostId;ui.selected=null;ui.pathChoices=null;ui.breakMode=false;
    ui.clockOffset=0;render();
  }
  function startLocal() {
    socket.disconnect();ui.local=true;ui.code='';ui.role='player';
    const players=[{id:'local-blue',name:'Player 1 · Blue',color:0,connected:true},
      {id:'local-pink',name:'Player 2 · Pink',color:2,connected:true}];
    ui.room={code:'LOCAL',format:'duel',stage:'active',players,hostId:players[0].id,
      game:rules.makeGame(players,'duel'),chat:[],spectatorCount:0};
    history.replaceState({},'','/');syncLocal();
  }
  function send(event,data={},done) {
    if(ui.local) {
      try {
        if(event==='room:rematch'){startLocal();return;}
        if(event!=='room:act')return;
        const g=ui.room.game,owner=rules.activePlayer(g);
        if(data.type==='place')rules.placePiece(g,owner,data.kind,data.r,data.c);
        else if(data.type==='move')rules.movePiece(g,owner,data.pieceId,data.to,data.breakEdge||null);
        else if(data.type==='wall')rules.buildWall(g,owner,data.key);
        syncLocal();if(done)done({ok:true});
      } catch(error){notify(error.message);}
      return;
    }
    if(!socket.connected){if(navigator.onLine===false){notify('Online rooms need a connection. Local Duel is available offline.');return;}socket.once('connect',()=>send(event,data,done));socket.connect();notify('Connecting to online multiplayer…');return;}
    socket.emit(event,data,reply=>{
      if(!reply?.ok){notify(reply?.error||'Request failed');return;}
      if(done)done(reply);
    });
  }
  function onJoined(reply) {
    ui.local=false;ui.role=reply.role;ui.id=reply.id;ui.token=reply.token;ui.code=reply.code;
    ui.room=reply.state;
    if(reply.token)localStorage.setItem(`wallgo-seat-${reply.code}`,JSON.stringify({token:reply.token,name:ui.name}));
    history.replaceState({},'',`/?room=${reply.code}`);
    render();
  }
  function join(code,asReconnect=false) {
    const normalized=String(code||'').trim().toUpperCase();
    const saved = JSON.parse(localStorage.getItem(`wallgo-seat-${normalized}`)||'null');
    send('room:join',{code:normalized,name:ui.name||'Player',token:saved?.token||null},reply=>{
      onJoined(reply);
      if(!asReconnect && reply.role==='spectator')notify('All player seats are taken. You joined as a spectator.');
    });
  }
  socket.on('connect',()=>{
    if(ui.local)return;
    ui.connected=true;
    const resumeCode=ui.code||initialCode;
    if(resumeCode && localStorage.getItem(`wallgo-seat-${resumeCode}`))join(resumeCode,true);
    else render();
  });
  socket.on('disconnect',()=>{ui.connected=false;render();});
  socket.on('room:takeover',()=>{ui.role='spectator';ui.id=null;ui.token=null;notify('Your player seat was opened in another tab.');});
  socket.on('room:state',room=>{
    if(ui.local || !ui.room || ui.room.code!==room.code) return;
    const key=`${room.game?.phase}:${room.game?.placementIndex}:${room.game?.movesPlayed}:${room.currentId}:${room.game?.pendingWall?.pieceId}`;
    if(ui.phaseKey!==key){ui.selected=null;ui.breakMode=false;ui.pathChoices=null;ui.phaseKey=key;}
    ui.clockOffset=room.serverNow-Date.now();
    ui.room=room;render();
  });

  function header() {
    return `<header class="topbar"><div class="container top-inner">
      <a class="logo" href="/" data-action="home" aria-label="Wall Go II home"><span class="logo-korean" lang="ko">벽바둑</span> <em>II</em><span class="logo-divider"></span><span class="logo-english">WALL / GO</span></a>
      <div class="top-right"><span class="tag"><i></i>${ui.local?'LOCAL DUEL · OFFLINE':ui.room?'PRIVATE GAME':'CHOOSE YOUR MODE'}</span>
        <button class="plain-link" data-action="rules">HOW TO PLAY</button></div></div></header>`;
  }
  function footer() {
    return `<footer class="footer"><div class="container footer-inner"><span>WALL / GO II · FAN-MADE UNOFFICIAL RECREATION</span><span>Inspired by The Devil's Plan · Not affiliated with Netflix</span></div></footer>`;
  }
  function home() {
    return `<main class="main-home"><div class="container home-layout">
      <section class="home-copy">
        <div class="eyebrow">THE DEVIL’S PLAN · INSPIRED STRATEGY GAME</div>
        <h1 class="headline">BUILD THE<br/><strong>BOUNDARY.</strong></h1>
        <p class="intro">Every move changes the map. Build walls, cut off your rivals, and claim the largest territory in this deceptively simple strategy game.</p>
        <div class="feature-row"><span class="feature"><span>✦</span> 2–3 Players</span><span class="feature"><span>◈</span> Real-time rooms</span><span class="feature"><span>◷</span> 90s turns</span></div>
        <section class="home-forms" aria-label="Create or join a game">
          <button class="btn primary full" data-action="local">LOCAL DUEL</button><p class="action-desc">2 players · same device · offline · no accounts</p><p class="action-desc" id="offline-status">Load once for local play. Offline reload is available when the app cache is ready.</p><div class="divider-label">Online multiplayer</div>
          <label class="form-label" for="home-name">Your player name</label>
          <input class="text-input" id="home-name" maxlength="24" value="${escape(ui.name)}" placeholder="Enter your name" autocomplete="nickname" />
          <div class="format-picker">
            <button class="format-option ${ui.format==='tournament'?'active':''}" data-action="format" data-format="tournament"><span class="format-dot"></span><span><b>3-Player Match</b><small>Qualifier + final</small></span></button>
            <button class="format-option ${ui.format==='duel'?'active':''}" data-action="format" data-format="duel"><span class="format-dot"></span><span><b>2-Player Duel</b><small>Head-to-head</small></span></button>
          </div>
          <button class="btn primary full" data-action="create">CREATE PRIVATE ROOM <span>→</span></button>
          <div class="divider-label">or join a friend</div>
          <div class="home-join"><input class="text-input" id="join-code" aria-label="6-character room code" maxlength="6" value="${escape(ui.joinCode)}" placeholder="ROOM CODE" /><button class="btn" data-action="join">JOIN ROOM →</button></div>
        </section>
      </section>
      <section class="home-art" aria-label="Wall Go strategy board preview"><div class="preview-card">
        <div class="preview-caption"><span>THE ARENA / 07 × 07</span><span>EST. SEASON III</span></div>
        <div class="preview-art-stage">${boardSvg(previewGame(),true)}</div>
        <div class="preview-bottom"><span>STRATEGY IS EVERYTHING.</span><b>NO TWO GAMES ALIKE.</b></div>
      </div></section>
    </div></main>`;
  }
  function previewGame() {
    const p=['demoBlue','demoYellow','demoRed'];
    return {phase:'move',pieces:[
      {id:'a',owner:p[0],kind:'square',r:2,c:1},
      {id:'b',owner:p[0],kind:'circle',r:4,c:2},
      {id:'c',owner:p[1],kind:'square',r:1,c:4},
      {id:'d',owner:p[1],kind:'circle',r:3,c:5},
      {id:'e',owner:p[2],kind:'square',r:5,c:5},
      {id:'f',owner:p[2],kind:'circle',r:4,c:4}],
      walls:{'v:2:3':{owner:p[0]},'v:3:3':{owner:p[0]},'h:4:2':{owner:p[0]},'h:5:4':{owner:p[2]},'v:4:5':{owner:p[2]},'h:2:4':{owner:p[1]},'v:3:6':{owner:p[1]}},
      activeIds:p};
  }
  // The board is drawn as original SVG artwork with recessed grooves, ceramic
  // counters and neon acrylic walls, inspired by the close-up set reference.
  function boardSvg(game,preview=false) {
    const T=94, M=20, total=698;
    const pieces=game?.pieces||[];
    const ownedCells=new Map();
    if(!preview && ui.room?.territory) for(const area of ui.room.territory.areas){
      if(area.owner)for(const cell of area.cells)ownedCells.set(`${cell.r},${cell.c}`,area.owner);
    }
    const current=ui.room?.currentId;
    const myMove=(!preview && myTurn() && game?.phase==='move');
    const selectedPiece=game?.pieces.find(p=>p.id===ui.selected);
    const selectedOptions=selectedPiece && myMove ? (ui.room.legal[ui.selected]||[]).filter(x=>ui.breakMode?Boolean(x.breakEdge):!x.breakEdge):[];
    const targets=new Map(selectedOptions.map(o=>[`${o.to.r},${o.to.c}`,o]));
    const placing=!preview && myTurn() && game?.phase==='placement';
    const isWall=!preview && myTurn() && game?.phase==='wall';
    const wallOptions=isWall?wallChoices(game,game.pendingWall.to.r,game.pendingWall.to.c):[];
    const colorOf=id => preview ? ({demoBlue:COLORS[0],demoYellow:COLORS[1],demoRed:COLORS[2]}[id]||COLORS[0]) : getColor(id);
    let out=`<svg class="${preview?'preview-board':'board-svg'}" viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="7 by 7 Wall Go board">
      <defs>
        <linearGradient id="tileSurface" x1=".08" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#e5a4a8"/><stop offset=".25" stop-color="#db929c"/><stop offset=".63" stop-color="#d38191"/><stop offset="1" stop-color="#bf7083"/></linearGradient>
        <linearGradient id="tileEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd0b9" stop-opacity=".8"/><stop offset="1" stop-color="#711f38" stop-opacity=".35"/></linearGradient>
        <linearGradient id="boardOuter" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffbdc4"/><stop offset=".45" stop-color="#a84f67"/><stop offset="1" stop-color="#6f334a"/></linearGradient>
        <linearGradient id="groove" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1c2a"/><stop offset=".5" stop-color="#38202b"/><stop offset="1" stop-color="#784152"/></linearGradient>
        <filter id="pieceShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="3" dy="6" stdDeviation="3.5" flood-color="#271522" flood-opacity=".75"/></filter>
        <filter id="wallGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
        <filter id="boardTexture" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".055" numOctaves="3" seed="6" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".16"/></feComponentTransfer></filter>
      </defs>
      <rect x="0" y="0" width="698" height="698" rx="6" fill="#4f2837"/>
      <rect x="3" y="3" width="692" height="692" rx="4" fill="url(#boardOuter)" />
      <path d="M7 689V9H690" fill="none" stroke="#ffcad1" stroke-opacity=".65" stroke-width="6"/>
      <path d="M691 8V690H7" fill="none" stroke="#5d263c" stroke-opacity=".8" stroke-width="7"/>
      <rect x="${M-6}" y="${M-6}" width="${T*7+12}" height="${T*7+12}" rx="2" fill="url(#groove)" stroke="#6e3a49" stroke-width="3"/>
      <g class="board-tiles">`;
    for(let r=0;r<7;r++)for(let c=0;c<7;c++) {
      const x=M+c*T,y=M+r*T,key=`${r},${c}`;
      const isTarget=targets.has(key),isPlace=placing&&!pieces.some(p=>p.r===r&&p.c===c);
      const owner=ownedCells.get(key);
      out+=`<rect class="cell-tile" x="${x+3}" y="${y+3}" width="${T-6}" height="${T-6}" rx="2" fill="url(#tileSurface)" stroke="#b66076" stroke-width="1.5" data-cell="${key}" tabindex="${preview?'-1':'0'}" role="button" aria-label="Row ${r+1}, column ${c+1}" />
        <path d="M${x+5} ${y+T-6}V${y+6}H${x+T-6}" fill="none" stroke="#ffb7aa" stroke-opacity=".28" stroke-width="2" pointer-events="none"/>
        <path d="M${x+T-5} ${y+6}V${y+T-5}H${x+6}" fill="none" stroke="#7d3b51" stroke-opacity=".23" stroke-width="2" pointer-events="none"/>`;
      if(owner)out+=`<rect x="${x+4}" y="${y+4}" width="${T-8}" height="${T-8}" rx="2" fill="${colorOf(owner)}" opacity=".64" pointer-events="none" />`;
      if(isPlace)out+=`<rect x="${x+8}" y="${y+8}" width="${T-16}" height="${T-16}" rx="3" stroke="#fff4c7" stroke-width="2.5" stroke-dasharray="7 5" fill="#fff4c7" fill-opacity=".12" pointer-events="none"/>`;
      if(isTarget)out+=`<rect class="legal-ring" x="${x+7}" y="${y+7}" width="${T-14}" height="${T-14}" rx="3" fill="${ui.breakMode?'#ff377b':'#62f4fc'}" fill-opacity=".20" stroke="${ui.breakMode?'#ff3678':'#6af7ff'}" stroke-width="4" pointer-events="none"/><circle cx="${x+T/2}" cy="${y+T/2}" r="7" fill="${ui.breakMode?'#ff407d':'#b5ffff'}" pointer-events="none" />`;
    }
    out+=`</g><rect x="18" y="18" width="662" height="662" fill="#ffffff" opacity=".11" filter="url(#boardTexture)" pointer-events="none"/>`;
    // Thin luminous acrylic walls sit in recessed channels, with a dark undercut.
    for(const [key,wall] of Object.entries(game?.walls||{})) {
      const [x1,y1,x2,y2]=lineForEdge(key,T,M),col=colorOf(wall.owner);
      out+=`<g pointer-events="none"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3d182c" stroke-width="19" stroke-linecap="round"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="18" stroke-linecap="round" opacity=".42" filter="url(#wallGlow)"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="12" stroke-linecap="round"/>
      <line x1="${x1-1.5}" y1="${y1-1.5}" x2="${x2-1.5}" y2="${y2-1.5}" stroke="#fff6d9" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>
      <line x1="${x1+2}" y1="${y1+2}" x2="${x2+2}" y2="${y2+2}" stroke="#341b32" stroke-opacity=".36" stroke-width="2" stroke-linecap="round"/></g>`;
    }
    // Concentric grooves mirror the physical square and circular counters.
    for(const piece of pieces) {
      const x=M+piece.c*T+T/2,y=M+piece.r*T+T/2;
      const color=colorOf(piece.owner),selected=ui.selected===piece.id&&!preview;
      if(selected)out+=`<rect x="${x-39}" y="${y-39}" width="78" height="78" rx="8" fill="none" stroke="#fff4c9" stroke-width="5" stroke-dasharray="8 5" class="piece-selected" pointer-events="none"/>`;
      out+=`<g pointer-events="none" class="counter-art" filter="url(#pieceShadow)">`;
      if(piece.kind==='square') {
        out+=`<rect x="${x-29}" y="${y-29}" width="58" height="58" rx="3" fill="#361b32" stroke="#ffe6d7" stroke-opacity=".48" stroke-width="2"/>
          <rect x="${x-25}" y="${y-25}" width="50" height="50" rx="2" fill="${color}" stroke="#fff4d9" stroke-opacity=".45" stroke-width="1.5"/>`;
        for(let i=0;i<4;i++) {
          const off=6+i*5.2,side=50-off*2;
          out+=`<rect x="${x-25+off}" y="${y-25+off}" width="${side}" height="${side}" rx="1" fill="none" stroke="${i%2===0?'#fffaf1':'#241d43'}" stroke-opacity="${i%2===0?'.86':'.56'}" stroke-width="${i===0?2.4:1.8}"/>`;
        }
        out+=`<path d="M${x-22} ${y-22}h42" stroke="#ffffff" stroke-opacity=".55" stroke-width="2"/>`;
      } else {
        out+=`<circle cx="${x}" cy="${y}" r="30" fill="#352034" stroke="#ffe6d7" stroke-opacity=".44" stroke-width="2"/>
          <circle cx="${x}" cy="${y-1}" r="27" fill="${color}" stroke="#fff4d8" stroke-opacity=".65" stroke-width="2"/>`;
        for(let radius=22;radius>=6;radius-=5.3) {
          out+=`<circle cx="${x}" cy="${y-1}" r="${radius}" fill="none" stroke="${radius===22?'#fff2dc':'#fffaf2'}" stroke-opacity="${radius===22?'.86':'.74'}" stroke-width="2.6"/>`;
        }
        out+=`<circle cx="${x}" cy="${y-1}" r="3" fill="#fff7e5" fill-opacity=".72"/>`;
      }
      out+=`</g>`;
    }
    if(ui.breakMode && myMove && selectedPiece) {
      const edgeSet=new Set(selectedOptions.map(o=>o.breakEdge).filter(Boolean));
      for(const edge of edgeSet){const [x1,y1,x2,y2]=lineForEdge(edge,T,M);
        out+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="5" stroke-dasharray="9 6" pointer-events="none"/>`;
      }
    }
    for(const key of wallOptions){const [x1,y1,x2,y2]=lineForEdge(key,T,M);
      out+=`<line class="wall-target" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a8ffea" stroke-width="13" stroke-linecap="round" pointer-events="none" />
        <line class="click-wall" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="36" data-wall="${key}" tabindex="0" role="button" aria-label="Build wall at ${key}"/>`;
    }
    out+='</svg>';return out;
  }
  function lineForEdge(key,T=94,M=20) {
    const [axis,r,c]=key.split(':');const row=Number(r),col=Number(c);
    if(axis==='v') {const x=M+col*T,y1=M+row*T+10;return [x,y1,x,y1+T-20];}
    const x1=M+col*T+10,y=M+row*T;return [x1,y,x1+T-20,y];
  }
  function roomHeader() {
    if(ui.local)return `<div class="room-top"><div><div class="overline">LOCAL DUEL · SAME DEVICE · OFFLINE</div><h2>Two players. One arena.</h2><p>No accounts or connection required.</p></div><div class="room-actions"><button class="btn small" data-action="local-restart">NEW GAME / RESTART</button><button class="btn ghost small" data-action="home">MODE SELECTION</button></div></div>`;

    const r=ui.room;
    return `<div class="room-top"><div><div class="eyebrow">${r.stage==='lobby'?'Private match lobby':r.format==='duel'?'Head-to-head showdown':'Three-player elimination'}</div>
      <h2>${r.stage==='lobby'?'Your room is ready.':r.game?.round===2?'The final showdown.':'The arena awaits.'}</h2>
      <p>${r.stage==='lobby'?'Invite your opponents to begin.':`${r.game?.round===2?'FINAL ROUND':r.format==='duel'?'DUEL':'ROUND ONE'} · 7 × 7 ARENA · ${r.players.length} REGISTERED PLAYERS`}</p></div>
      <div class="room-actions"><span class="room-code" title="Room code">${escape(r.code)}</span><button class="btn ghost small" data-action="share">↗ INVITE</button></div></div>`;
  }
  function formatClock() {
    const g=ui.room?.game;
    if(!g?.deadline || ui.room?.stage!=='active')return '--:--';
    const remain=Math.max(0,Math.ceil((g.deadline-(Date.now()+ui.clockOffset))/1000));
    return `${Math.floor(remain/60)}:${String(remain%60).padStart(2,'0')}`;
  }
  function statusPanel() {
    const r=ui.room,g=r.game;
    let label='',head='',desc='',timed=false;
    if(r.stage==='lobby') {label='Waiting for players';head='Gather your opponents';desc='Players take their seats using the invite link.';}
    else if(r.stage==='between') {label='Round 1 finished';head='One player is safe';desc='The remaining two players face off in the final duel.';}
    else if(r.stage==='complete') {label='Match concluded';head='The walls are closed';desc='Final territory has been counted. A rematch is ready.';}
    else if(g.phase==='placement') {
      const player=playerById(r.currentId);label='Opening setup';head=myTurn()?'Place your counter':`${player?.name||'Player'} is placing`;
      desc=`Counter ${g.placementIndex+1} of ${g.placementOrder.length} · Tap an empty square to place.`;
    }else if(g.phase==='move') {
      const player=playerById(r.currentId);label=`Turn ${g.movesPlayed+1} · ${myTurn()?'Your move':'Opponent is thinking'}`;
      head=myTurn()?'Choose your next move':`${player?.name||'Player'}’s turn`;
      desc=myTurn()?'Select a counter, then select a highlighted destination.':'A counter must move before its wall is placed.';
      timed=true;
    }else if(g.phase==='wall'){
      const player=playerById(r.currentId);label='Wall placement';head=myTurn()?'Build one wall':`${player?.name||'Player'} is building`;
      desc=myTurn()?'Tap any glowing edge beside your moved counter.':'Waiting for the turn’s finishing wall.';
      timed=true;
    }else {label='Final result';head='Territory determined';desc='All counters are isolated; the match is complete.';}
    if(ui.local && r.stage==='active'){label=`${playerById(r.currentId)?.name} · ${label}`;head=g.phase==='placement'?'Place a square':g.phase==='wall'?'Build one wall':'Choose your next move';}
    return `<div class="panel status-panel"><div><div class="overline">${escape(label)}</div><div class="status-heading">${escape(head)}</div><p class="status-desc">${escape(desc)}</p></div>
      ${timed?`<div class="clock" id="timer"><strong id="clock-text">${formatClock()}</strong><small>SECONDS LEFT</small><div class="timer-track"><span id="clock-bar" style="width:100%"></span></div></div>`:''}</div>`;
  }
  function tray() {
    const r=ui.room,g=r.game;
    if(r.stage==='lobby')return `<div class="panel action-tray"><div class="action-desc"><b>Ready to play?</b> ${r.players.length} of ${cap()} seats filled.</div>
      ${isHost()?`<button class="btn primary" data-action="start" ${r.players.length!==cap()?'disabled':''}>START MATCH →</button>`:'<span class="action-desc">Waiting for the host to start…</span>'}</div>`;
    if(r.stage==='between')return `<div class="panel action-tray"><div class="action-desc"><b>Round 1 complete.</b> ${escape(playerById(r.firstRound?.safeId)?.name||'Winner')} has secured survival.</div>
      ${isHost()?'<button class="btn primary" data-action="final">BEGIN 2-PLAYER FINAL →</button>':'<span class="action-desc">Waiting for the host…</span>'}</div>`;
    if(r.stage==='complete')return `<div class="panel action-tray"><div class="action-desc"><b>Match complete.</b> Play another game in this room.</div>
      ${(ui.local||isHost())?'<button class="btn primary" data-action="rematch">PLAY AGAIN ↻</button>':''}</div>`;
    if(g.phase==='placement') {
      const two=g.activeIds.length===2;
      const myKinds=g.pieces.filter(p=>p.owner===ui.id).map(p=>p.kind);
      const selected=myKinds.includes(ui.kind)?(myKinds.includes('square')?'circle':'square'):ui.kind;
      return `<div class="panel action-tray"><div class="action-desc"><b>${myTurn()?'Place a counter':'Initial placement'}</b><br/>${two?'Two round counters are already positioned. Place your two squares.':'Place one square and one round counter, in snake order.'}</div>
        ${myTurn()&&!two?`<div class="counter-select"><button data-action="kind" data-kind="square" class="${selected==='square'?'active':''}" ${myKinds.includes('square')?'disabled':''}><i class="mini-counter"></i> SQUARE</button>
        <button data-action="kind" data-kind="circle" class="${selected==='circle'?'active':''}" ${myKinds.includes('circle')?'disabled':''}><i class="mini-counter circle"></i> ROUND</button></div>`:''}</div>`;
    }
    if(g.phase==='move') {
      const canBreak=g.activeIds.length===3 && myTurn() && !g.breakersUsed[ui.id];
      const selected=g.pieces.find(p=>p.id===ui.selected);
      const chosen=selected?.kind==='circle'?'ROUND':'SQUARE';
      return `<div class="panel action-tray"><div class="action-desc"><b>${myTurn()?(selected?`${chosen} COUNTER SELECTED`:'YOUR TURN'):'Watch the board'}</b><br/>
      ${myTurn()?(ui.breakMode?'Choose a red-marked destination to break a wall.':selected?'Choose any glowing destination.':'Tap either of your counters to see available moves.'): 'Every turn consists of moving one counter and building one wall.'}</div>
      <div class="tray-controls">${canBreak?`<button class="breaker-btn ${ui.breakMode?'active':''}" data-action="breaker">${ui.breakMode?'✕ EXIT BREAK MODE':'⚒ USE WALL BREAKER'}</button>`:''}
      ${ui.selected&&myTurn()?'<button class="btn small ghost" data-action="cancel">CLEAR</button>':''}</div></div>`;
    }
    if(g.phase==='wall')return `<div class="panel action-tray"><div class="action-desc"><b>${myTurn()?'YOUR WALL':'WALL IN PROGRESS'}</b><br/>Choose one of the glowing lines next to the moved piece. All walls block every player.</div></div>`;
    return '';
  }
  function playerRows() {
    const r=ui.room,g=r.game;
    const score = r.territory?.score||{};
    return r.players.map((p,i)=>{
      const active=r.currentId===p.id && r.stage==='active';
      const playing=!g || g.activeIds.includes(p.id);
      const waiting=r.stage==='between' && p.id===r.firstRound?.safeId;
      const gameWon=g?.phase==='finished'&&g.result?.winners.includes(p.id);
      const small=ui.local?(active?'CURRENT PLAYER':'PLAYER') :p.id===ui.id?'YOU':waiting?'SAFE':!playing?'SAFE':!p.connected?'OFFLINE':active?'PLAYING':gameWon?'LEADER':'PLAYER';
      return `<div class="player-row ${active?'active':''}"><span class="player-icon" style="background:${COLORS[p.color]};">${i+1}</span>
      <div class="player-meta"><strong>${escape(p.name)} ${p.id===r.hostId?'♛':''}</strong><small><i class="online-dot ${p.connected?'':'off'}"></i>${small}${g && g.activeIds.length===3 ? ` · ${g.breakersUsed[p.id]?'BREAKER USED':'BREAKER READY'}`:''}</small></div>
      <div class="score-number">${playing?(score[p.id]??0):(r.firstRound?.score[p.id]??0)}<span>SECURED</span></div></div>`;
    }).join('');
  }
  function resultPanel() {
    const r=ui.room,g=r.game;if(!g?.result)return '';
    const ranking=g.result.ranking;
    const resultRows=ranking.map((id,i)=>{
      const name=playerById(id)?.name||'Player';
      const winner=g.result.winners.includes(id);
      return `<div class="result-row"><span class="result-rank">${winner?'★':i+1}</span><span class="result-name" style="color:${getColor(id)}">${escape(name)}</span><span class="result-points">${g.result.score[id]} <small>CELLS</small></span></div>`;
    }).join('');
    return `<div class="panel aside-block"><h3 class="aside-title">${r.stage==='between'?'ROUND ONE RESULTS':'FINAL TERRITORY'} <span>${g.result.reason==='stalemate'?'STALEMATE':'COMPLETE'}</span></h3>
      <div class="result-list">${resultRows}</div>
      <div class="notice">${g.result.winners.length>1?'The game ended in a tie under the published tie-break rules. Start a rematch to resolve it.':r.stage==='between'?`<strong>${escape(playerById(r.firstRound.safeId)?.name||'Winner')} advances safely.</strong> The other two players now compete in the final.`:`<strong>${escape(playerById(g.result.winners[0])?.name||'Winner')} wins!</strong> Most enclosed squares wins. Largest single territory breaks score ties.`}</div></div>`;
  }
  function sidebar() {
    const r=ui.room;
    const rows=playerRows();
    const showSeats=r.stage==='lobby';
    const seatRows=showSeats?Array.from({length:cap()},(_,i)=>{
      const p=r.players[i];return `<div class="seat-row"><span class="player-icon" style="width:28px;height:28px;border-radius:8px;background:${p?COLORS[p.color]:'#253147'};">${i+1}</span>
      <span>${p?escape(p.name):'Open seat'}</span><span class="seat-status">${p?(p.connected?'READY':'OFFLINE'):'WAITING'}</span></div>`;
    }).join(''):'';
    const chat=r.chat.map(item=>`<div class="chat-message"><b style="color:${item.owner?getColor(item.owner):'#b9c5d8'}">${escape(item.name)} <span style="font-weight:500;color:#5f6e83">${moment(item.at)}</span></b><p>${escape(item.message)}</p></div>`).join('');
    return `<aside class="game-aside">
      <div class="panel aside-block"><h3 class="aside-title">${showSeats?'PLAYERS IN ROOM':'THE SCOREBOARD'} <span>${r.players.length} / ${cap()}</span></h3>
      ${showSeats?seatRows:rows}
      ${r.stage!=='lobby'?'<p class="board-help" style="text-align:left;margin-top:10px">Scores reflect territories fully enclosed by walls and occupied exclusively by one player.</p>':''}
      </div>
      ${resultPanel()}
      ${showSeats?`<div class="panel aside-block"><div class="room-invite"><b>✦ Bring your rivals.</b><p>Share your private room link. Each friend joins on their own phone or computer.</p><button class="btn primary full small" data-action="share">COPY INVITE LINK ↗</button></div></div>`:''}
      ${ui.local?'':`<div class="panel aside-block chat-panel"><h3 class="aside-title">TABLE TALK <span>${r.spectatorCount?'+'+r.spectatorCount+' WATCHING':'LIVE CHAT'}</span></h3><div class="chat-log" id="chat-log">${chat||'<span class="empty-chat">Start the conversation. Keep your friends guessing.</span>'}</div>
      <form class="chat-form" id="chat-form"><input class="text-input" id="chat-message" maxlength="240" value="${escape(ui.chatDraft)}" placeholder="Say something…" aria-label="Chat message" /><button class="btn small" type="submit">SEND</button></form></div>`}
      <div class="panel aside-block"><h3 class="aside-title">QUICK RULES <span>WALL GO II</span></h3>
      <p class="action-desc">■ Squares travel 1–2 spaces straight.<br/>● Circles travel 1 space, then optionally turn 90° for one more.<br/>◈ Move, then build a wall beside your piece.<br/>✦ Isolate the most territory to win.</p>
      <button class="btn ghost full small" data-action="rules" style="margin-top:14px">VIEW COMPLETE RULES →</button></div>
    </aside>`;
  }
  function roomScreen() {
    const r=ui.room;
    const g=r.game||previewGame();
    return `<main class="game-content"><div class="container">${roomHeader()}
      <div class="game-grid"><div class="game-center">${statusPanel()}
        <div class="board-wrap"><div class="arena-brand"><span>THE STRATEGY ARENA</span><strong lang="ko">벽바둑 <em>II</em></strong><span>07 × 07</span></div>
        <div class="arena-top-rack" aria-hidden="true">${Array.from({length:14},()=>'<i></i>').join('')}</div>
        <div class="arena-layout"><div class="arena-rack arena-rack-blue" aria-hidden="true">${Array.from({length:16},()=>'<i></i>').join('')}</div><div class="board-frame">${boardSvg(g, r.stage==='lobby')}</div><div class="arena-rack arena-rack-red" aria-hidden="true">${Array.from({length:16},()=>'<i></i>').join('')}</div></div>
        <p class="board-help">${r.stage==='lobby'?'The board will unlock when the match begins.':`Tap counters and highlighted squares · Player colors mark built walls · ${r.stage==='active'?'Live turns':'Match over'}`}</p></div>
        ${tray()}
      </div>${sidebar()}</div></div></main>`;
  }
  function rulesModal() {
    if(!ui.rules)return '';
    return `<div class="modal-backdrop" data-action="close-rules"><div class="modal" role="dialog" aria-modal="true" aria-label="Wall Go II game rules">
      <div class="modal-heading"><h2>How to play</h2><button class="close" data-action="close-rules">CLOSE ✕</button></div>
      <div class="overline">WALL GO II / 벽바둑 II</div>
      <h3>01 · The goal</h3><p>Claim the largest area of the 7×7 board. A territory is a group of squares enclosed by walls and the outer board edge, containing counters from exactly one player. Different isolated territories belonging to one player are added together.</p>
      <h3>02 · Counter setup</h3><p>In the three-player qualifier, every player has one square and one circle. Players place one counter in seat order (1–2–3), then their remaining counter in reverse order (3–2–1). In the two-player duel, each player has two squares and two circles: the circles begin at fixed positions, and the squares are placed in 1–2–2–1 order.</p>
      <h3>03 · Moving counters</h3><p>Move one counter each turn. <b>Square:</b> 1 or 2 cells in a straight line up, down, left, or right. <b>Circle:</b> 1 cell orthogonally, optionally followed by a single perpendicular step (left or right). You may not pass through occupied cells, move onto a counter, cross a standing wall, or remain in place.</p>
      <h3>04 · Building walls</h3><p>After moving, build exactly one wall on an unoccupied internal edge of the cell where your counter lands. Walls block everyone, including their builder. You cannot build a second wall over an existing wall.</p>
      <h3>05 · Breaking a wall</h3><p>In the three-player qualifier only, each player can break exactly one wall during a movement. The broken wall must lie on the actual path being traveled. Activate your wall breaker before selecting a legal breaking move. Breakers are <b>not permitted</b> in the two-player final.</p>
      <h3>06 · Ending and scoring</h3><p>The round ends when the areas occupied by different players have become separated by walls. Count every cell in an isolated area containing only one player's counters. Areas with no counters score zero. Highest total wins; a tie is broken by the largest single occupied territory. In a three-player match, the round-one winner is safe and the remaining two face off.</p>
      <h3>07 · Time limit</h3><p>Players have 90 seconds to move and build their wall. On timeout, both local and online modes automatically completes a random legal move and wall (or automatically builds the wall if the piece has already moved). This keeps real-time rooms moving even if somebody disconnects.</p>
      <div class="notice">An independent fan-built implementation of rules shown on <em>The Devil’s Plan</em>, Season 3, Episode 10. The two-player circular starting coordinates are a symmetric default and can be adjusted to match further reference images.</div>
    </div></div>`;
  }
  function pathModal() {
    if(!ui.pathChoices?.length)return '';
    return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-heading"><h2>Choose the wall to break</h2><button class="close" data-action="cancel-path">CLOSE ✕</button></div>
    <p>More than one valid route reaches that square. Pick which blocked edge your breaker removes.</p>
    <div class="result-list">${ui.pathChoices.map((choice,i)=>`<button class="btn full" data-action="choose-path" data-path="${i}">⚒ Break ${escape(choice.breakEdge)} · via ${choice.path.map(c=>`(${c.r+1},${c.c+1})`).join(' → ')}</button>`).join('')}</div></div></div>`;
  }
  function render() {
    const page=ui.room?roomScreen():home();
    app.innerHTML=`<div class="app-shell">${header()}${page}${footer()}</div>${rulesModal()}${pathModal()}${ui.toast?`<div class="toast" role="status">${escape(ui.toast)}</div>`:''}`;
    const log=document.getElementById('chat-log');if(log)log.scrollTop=log.scrollHeight;
    updateTimer();
  }
  function updateTimer() {
    const el=document.getElementById('clock-text');if(!el)return;
    el.textContent=formatClock();
    const remain=Math.max(0,ui.room.game.deadline-(Date.now()+ui.clockOffset));
    const timer=document.getElementById('timer');timer?.classList.toggle('urgent',remain<15_000);
    const bar=document.getElementById('clock-bar');if(bar)bar.style.width=`${Math.min(100,remain/90_000*100)}%`;
  }
  setInterval(()=>{
    if(ui.local && ui.room?.stage==='active' && ui.room.game.deadline && Date.now()>=ui.room.game.deadline){
      rules.autoTurn(ui.room.game);syncLocal();
    }
    updateTimer();
  },160);
  function chooseCell(r,c) {
    const g=ui.room?.game;if(!g||!myTurn())return;
    if(g.phase==='placement'){
      const kind=g.activeIds.length===2?'square':ui.kind;
      const ownKinds=g.pieces.filter(p=>p.owner===ui.id).map(p=>p.kind);
      const resolvedKind=g.activeIds.length===2?'square':ownKinds.includes(kind)?(kind==='circle'?'square':'circle'):kind;
      send('room:act',{type:'place',kind:resolvedKind,r,c});
      return;
    }
    if(g.phase!=='move')return;
    const piece=g.pieces.find(p=>p.r===r&&p.c===c);
    if(piece?.owner===ui.id){ui.selected=piece.id;render();return;}
    if(!ui.selected)return;
    const options=(ui.room.legal[ui.selected]||[]).filter(x=>ui.breakMode?!!x.breakEdge:!x.breakEdge);
    const matches=options.filter(x=>x.to.r===r&&x.to.c===c);
    if(!matches.length)return;
    if(matches.length>1 && matches.some(x=>x.breakEdge!==matches[0].breakEdge)) {ui.pathChoices=matches;render();return;}
    const option=matches[0];
    send('room:act',{type:'move',pieceId:ui.selected,to:option.to,breakEdge:option.breakEdge});
  }
  document.addEventListener('input',e=>{
    if(e.target.id==='home-name')ui.name=e.target.value;
    if(e.target.id==='join-code')ui.joinCode=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'');
    if(e.target.id==='chat-message')ui.chatDraft=e.target.value;
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='chat-form')return;e.preventDefault();
    const msg=ui.chatDraft.trim();if(!msg)return;
    send('room:chat',{message:msg},()=>{ui.chatDraft='';render();});
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&ui.rules){ui.rules=false;render();return;}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-cell],[data-wall]')){e.preventDefault();e.target.click();}
    if(e.key==='Enter'&&e.target.id==='join-code'){e.preventDefault();document.querySelector('[data-action="join"]')?.click();}
  });
  document.addEventListener('click',async e=>{
    const wall=e.target.closest('[data-wall]');
    if(wall){if(myTurn()&&ui.room.game.phase==='wall')send('room:act',{type:'wall',key:wall.dataset.wall});return;}
    const cell=e.target.closest('[data-cell]');
    if(cell){const [r,c]=cell.dataset.cell.split(',').map(Number);chooseCell(r,c);return;}
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action;
    if(action==='close-rules'&&e.target.closest('.modal')&&e.target!==btn)return;
    if(action==='rules'){ui.rules=true;render();return;}
    if(action==='close-rules'){ui.rules=false;render();return;}
    if(action==='format'){ui.format=btn.dataset.format;render();return;}
    if(action==='kind'){ui.kind=btn.dataset.kind;render();return;}
    if(action==='breaker'){ui.breakMode=!ui.breakMode;render();return;}
    if(action==='cancel'){ui.selected=null;ui.breakMode=false;render();return;}
    if(action==='cancel-path'){ui.pathChoices=null;render();return;}
    if(action==='choose-path'){
      const option=ui.pathChoices?.[Number(btn.dataset.path)];if(!option||!ui.selected)return;
      send('room:act',{type:'move',pieceId:ui.selected,to:option.to,breakEdge:option.breakEdge});ui.pathChoices=null;return;
    }
    if(action==='local'){startLocal();return;}
    if(action==='local-restart'){if(window.confirm('Restart this local duel?'))startLocal();return;}
    if(action==='create'){
      ui.name=(document.getElementById('home-name')?.value||ui.name||'Player').trim();localStorage.setItem('wallgo-name',ui.name);
      send('room:create',{name:ui.name,format:ui.format},onJoined);return;
    }
    if(action==='join'){
      ui.name=(document.getElementById('home-name')?.value||ui.name||'Player').trim();localStorage.setItem('wallgo-name',ui.name);
      const entered=document.getElementById('join-code')?.value||ui.joinCode;
      if(!entered.trim()){notify('Enter the 6-character room code');return;}
      join(entered);return;
    }
    if(action==='start'){send('room:start');return;}
    if(action==='final'){send('room:startFinal');return;}
    if(action==='rematch'){send('room:rematch');return;}
    if(action==='share'){
      const link=`${location.origin}/?room=${ui.room.code}`;
      try{await navigator.clipboard.writeText(link);notify('Invite link copied to clipboard');}
      catch(_){window.prompt('Copy your invite link:',link);}
      return;
    }
    if(action==='home') {e.preventDefault();if(ui.local && ui.room?.stage==='active' && !window.confirm('Return to mode selection and end this local game?'))return;ui.local=false;ui.room=null;ui.role=null;ui.id=null;ui.code='';history.replaceState({},'','/');render();}
  });
  if(initialCode)socket.connect();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(async registration=>{
    await navigator.serviceWorker.ready;
    const status=document.getElementById('offline-status');
    if(status)status.textContent='Ready for offline local play and reload.';
  }).catch(()=>{});
  render();
})();
