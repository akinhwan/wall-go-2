/* UI translation leaves player names, room codes and chat untouched. */
(() => {
const pairs = {
'BUILD THE':'경계를','BOUNDARY.':'세워라.',
'Every move changes the map. Build walls, cut off your rivals, and claim the largest territory in this deceptively simple strategy game.':'한 수마다 판도가 바뀝니다. 벽을 세우고 상대를 분리하여 가장 넓은 영토를 차지하세요.',
'LOCAL DUEL':'로컬 대결','2 players · same device · offline · no accounts':'2인 · 같은 기기 · 오프라인 · 계정 불필요',
'Online multiplayer':'온라인 멀티플레이','Your player name':'플레이어 이름','Enter your name':'이름 입력','3-Player Match':'3인 경기','Qualifier + final':'예선 + 결승','2-Player Duel':'2인 대결','Head-to-head':'일대일',
'CREATE PRIVATE ROOM':'비공개 방 만들기','or join a friend':'또는 친구의 방에 참가','ROOM CODE':'방 코드','JOIN ROOM':'방 참가','HOW TO PLAY':'게임 방법','CHOOSE YOUR MODE':'모드 선택','PRIVATE GAME':'비공개 경기','LOCAL DUEL · OFFLINE':'로컬 대결 · 오프라인','THE DEVIL’S PLAN · INSPIRED STRATEGY GAME':'데블스 플랜에서 영감을 받은 전략 게임','2–3 Players':'2~3인','Real-time rooms':'실시간 대전','90s turns':'턴당 90초','STRATEGY IS EVERYTHING.':'전략이 모든 것을 결정한다.','NO TWO GAMES ALIKE.':'매번 새로운 승부.',
'NEW GAME / RESTART':'새 게임 / 다시 시작','MODE SELECTION':'모드 선택','Two players. One arena.':'두 플레이어, 하나의 경기장.','No accounts or connection required.':'계정이나 인터넷 연결이 필요하지 않습니다.','LOCAL DUEL · SAME DEVICE · OFFLINE':'로컬 대결 · 같은 기기 · 오프라인','THE STRATEGY ARENA':'전략 경기장','THE SCOREBOARD':'점수판','PLAYERS IN ROOM':'참가 플레이어','SECURED':'확보한 칸','CURRENT PLAYER':'현재 플레이어','PLAYER':'플레이어','YOU':'나','PLAYING':'진행 중','OFFLINE':'연결 끊김','READY':'준비 완료','WAITING':'대기 중','SAFE':'진출 확정','LEADER':'선두',
'Opening setup':'초기 배치','Place your counter':'말을 배치하세요','Place a square':'사각 말을 배치하세요','Choose your next move':'이동할 말을 선택하세요','Select a counter, then select a highlighted destination.':'말을 선택한 뒤 표시된 목적지를 누르세요.','Build one wall':'벽을 하나 세우세요','Tap any glowing edge beside your moved counter.':'이동한 말 옆의 빛나는 경계를 누르세요.','Wall placement':'벽 설치','SECONDS LEFT':'남은 시간','YOUR TURN':'내 차례','YOUR WALL':'벽 설치 차례','WALL IN PROGRESS':'벽 설치 중','CLEAR':'선택 해제','SQUARE':'사각 말','ROUND':'원형 말','Place a counter':'말 배치','Initial placement':'초기 배치','Two round counters are already positioned. Place your two squares.':'원형 말은 이미 배치되어 있습니다. 사각 말 두 개를 배치하세요.','Tap either of your counters to see available moves.':'내 말을 누르면 이동 가능한 칸이 표시됩니다.','Choose any glowing destination.':'빛나는 목적지를 선택하세요.','Choose one of the glowing lines next to the moved piece. All walls block every player.':'이동한 말 옆의 빛나는 선을 선택하세요. 벽은 모든 플레이어의 이동을 막습니다.',
'QUICK RULES':'간단 규칙','VIEW COMPLETE RULES':'전체 규칙 보기','FINAL TERRITORY':'최종 영토','COMPLETE':'완료','STALEMATE':'교착 상태','CELLS':'칸','PLAY AGAIN':'다시 대결','Match complete.':'경기 종료.','Play another game in this room.':'이 방에서 새 경기를 시작하세요.','Match concluded':'경기 종료','The walls are closed':'영토 분리 완료','Final territory has been counted. A rematch is ready.':'최종 영토 계산이 끝났습니다. 다시 대결할 수 있습니다.',
'TABLE TALK':'대화','LIVE CHAT':'실시간 채팅','Say something…':'메시지 입력…','SEND':'전송','Chat message':'채팅 메시지','CLOSE ✕':'닫기 ✕','How to play':'게임 방법','Scores reflect territories fully enclosed by walls and occupied exclusively by one player.':'벽으로 분리되고 한 플레이어의 말만 있는 영역의 칸 수를 점수로 계산합니다.',
'■ Squares travel 1–2 spaces straight.':'■ 사각 말: 직선으로 1~2칸 이동.', '● Circles travel 1 space, then optionally turn 90° for one more.':'● 원형 말: 1칸 이동 후 직각으로 1칸 추가 이동 가능.', '◈ Move, then build a wall beside your piece.':'◈ 말을 이동한 뒤 그 옆에 벽 하나 설치.', '✦ Isolate the most territory to win.':'✦ 가장 넓은 영토를 분리하면 승리.',
'Load once for local play. Offline reload is available when the app cache is ready.':'처음 한 번 접속하세요. 저장이 완료되면 오프라인에서도 다시 열 수 있습니다.','Ready for offline local play and reload.':'오프라인 플레이 및 다시 열기 준비 완료.',
'Choose an empty square':'빈 칸을 선택하세요','Not your move':'내 차례가 아닙니다','It is not your turn':'내 차례가 아닙니다','Connecting to online multiplayer…':'온라인 멀티플레이에 연결 중…','Restart this local duel?':'로컬 대결을 처음부터 다시 시작할까요?','Return to mode selection and end this local game?':'현재 로컬 게임을 종료하고 모드 선택으로 돌아갈까요?',
'Private match lobby':'비공개 경기 대기실','Head-to-head showdown':'일대일 대결','Three-player elimination':'3인 토너먼트','Your room is ready.':'방이 준비되었습니다.','The arena awaits.':'승부를 시작하세요.','Invite your opponents to begin.':'상대를 초대하여 시작하세요.','INVITE':'초대','Waiting for players':'플레이어 대기 중','Gather your opponents':'상대를 초대하세요','Players take their seats using the invite link.':'초대 링크로 방에 참가할 수 있습니다.','Open seat':'빈 자리','START MATCH':'경기 시작','Waiting for the host to start…':'방장의 시작을 기다리는 중…','COPY INVITE LINK':'초대 링크 복사','Invite link copied to clipboard':'초대 링크를 복사했습니다','USE WALL BREAKER':'벽 파괴 사용','EXIT BREAK MODE':'벽 파괴 취소','BREAKER READY':'벽 파괴 사용 가능','BREAKER USED':'벽 파괴 사용 완료',
'Local game format':'로컬 경기 형식','START LOCAL GAME':'로컬 경기 시작','Same device · offline · no accounts':'같은 기기 · 오프라인 · 계정 불필요','SAME DEVICE · OFFLINE':'같은 기기 · 오프라인','LOCAL PLAY · OFFLINE':'로컬 경기 · 오프라인','2–4 Players':'2~4인','2-Player Breaker Duel':'2인 벽 파괴 대결','4-Player Match':'4인 경기','One wall breaker each':'각자 벽 파괴 1회',
'Action history':'행동 기록','History':'기록','Undo':'되돌리기','Latest actions first. Board coordinates are (row, column).':'최근 행동부터 표시합니다. 좌표는 (행, 열)입니다.','The host can undo actions for the entire room.':'온라인 경기에서는 방장이 행동을 되돌릴 수 있습니다.','No actions yet.':'아직 행동 기록이 없습니다.','Final round':'결승','Qualifier':'예선','Placed a round counter at':'원형 말 배치','Placed a square counter at':'사각 말 배치','Moved':'이동','Broke wall':'벽 파괴','Built wall':'벽 설치','Skipped · no legal move':'건너뜀 · 가능한 이동 없음','Turn completed on timeout':'시간 초과로 턴 자동 완료','Round finished':'라운드 종료',
'Place one square and one round counter, in snake order.':'사각 말과 원형 말을 뱀 순서로 하나씩 배치하세요.','Tap one of your counters to see available moves.':'내 말을 누르면 이동 가능한 칸이 표시됩니다.','Restart this local game?':'로컬 경기를 처음부터 다시 시작할까요?','Online rooms need a connection. Local play is available offline.':'온라인 경기에는 인터넷 연결이 필요합니다. 로컬 경기는 오프라인에서도 할 수 있습니다.','The game changed. Review the board and try again.':'경기 상태가 바뀌었습니다. 판을 확인하고 다시 시도하세요.'
};
const ordered=Object.entries(pairs).sort((a,b)=>b[0].length-a[0].length);
window.wallgoTranslate = value => {
 if(localStorage.getItem('wallgo-language')!=='ko')return value;
 let out=String(value);for(const [en,ko] of ordered)out=out.split(en).join(ko);
 return out.replace(/Player 1 · Blue/g,'플레이어 1 · 파랑').replace(/Player 2 · Pink/g,'플레이어 2 · 분홍').replace(/Player 2 · Yellow/g,'플레이어 2 · 노랑').replace(/Player 3 · Pink/g,'플레이어 3 · 분홍').replace(/Player 4 · Green/g,'플레이어 4 · 초록').replace(/Turn (\d+)/g,'$1번째 턴').replace(/Counter (\d+) of (\d+) · Tap an empty square to place./g,'말 배치 $1 / $2 · 빈 칸을 누르세요.').replace(/Your move/g,'이동 차례');
};
window.wallgoLocalize = root => {
 const ko=localStorage.getItem('wallgo-language')==='ko';document.documentElement.lang=ko?'ko':'en';
 if(!ko)return;
 const walk=node=>{if(node.nodeType===3){node.nodeValue=wallgoTranslate(node.nodeValue);return;}if(node.nodeType!==1)return;
 if(node.matches('input,textarea,.chat-log,.player-meta strong,.result-name,.history-player,.room-code,script'))return;
 for(const attr of ['placeholder','aria-label','title'])if(node.hasAttribute(attr))node.setAttribute(attr,wallgoTranslate(node.getAttribute(attr)));
 for(const child of node.childNodes)walk(child);
 };walk(root);
 const modal=root.querySelector('.modal[aria-label="Wall Go II game rules"]');
 if(modal){
 const headings=['01 · 목표','02 · 말 배치','03 · 말 이동','04 · 벽 설치','05 · 벽 파괴','06 · 종료 및 점수','07 · 제한 시간'];
 const paragraphs=['7×7 판에서 가장 넓은 영토를 확보하세요. 벽과 판의 테두리로 둘러싸인 연결 영역에 한 플레이어의 말만 있으면 그 영역 전체가 해당 플레이어의 영토입니다. 여러 영역의 칸 수를 합산합니다.','3인 및 4인 경기에서는 참가 순서대로 말 하나를 배치한 후 역순으로 나머지 말을 배치합니다. 각자 사각 말과 원형 말을 하나씩 배치합니다. 두 가지 2인 대결에서는 각자 사각 말과 원형 말을 두 개씩 사용합니다. 원형 말은 지정된 위치에서 시작하고 사각 말은 1–2–2–1 순서로 배치합니다.','한 턴에 말 하나를 이동합니다. 사각 말은 상하좌우 직선으로 1칸 또는 2칸 이동합니다. 원형 말은 상하좌우 1칸 이동 후 선택적으로 직각 방향으로 1칸 더 이동할 수 있습니다. 다른 말이나 벽을 통과하거나 말이 있는 칸으로 이동할 수 없으며 제자리에 머물 수도 없습니다.','이동 후 도착한 칸 옆의 비어 있는 내부 경계에 벽을 정확히 하나 설치합니다. 벽은 설치한 사람을 포함한 모든 플레이어의 이동을 막습니다. 기존 벽 위에 중복 설치할 수 없습니다.','2인 벽 파괴 대결, 3인 예선, 4인 경기에서는 각자 경기당 한 번 벽을 파괴할 수 있습니다. 벽 파괴를 활성화한 뒤 벽을 지나는 이동 경로를 선택하세요. 기본 2인 대결과 토너먼트 결승에는 일반 이동 규칙이 적용됩니다.','서로 다른 플레이어의 말이 벽으로 완전히 분리되면 종료됩니다. 자신의 말만 있는 영역의 모든 칸을 합산하며 말이 없는 영역은 0점입니다. 총점이 같으면 가장 큰 단일 영토로 순위를 정합니다. 여전히 같으면 무승부입니다. 3인 경기에서는 예선 1위가 진출하고 나머지 두 명이 결승을 치릅니다.','이동과 벽 설치를 합쳐 90초입니다. 시간이 끝나면 로컬과 온라인 모두 무작위 합법 이동과 벽 설치를 자동으로 완료합니다. 이미 이동했다면 벽만 자동 설치합니다.'];
 modal.querySelectorAll('h3').forEach((el,i)=>el.textContent=headings[i]);modal.querySelectorAll('p').forEach((el,i)=>{if(paragraphs[i])el.textContent=paragraphs[i];});
 const notice=modal.querySelector('.notice');if(notice)notice.textContent='데블스 플랜 시즌 3 10화 규칙을 바탕으로 제작한 비공식 팬 게임입니다. 원형 말의 시작 위치는 대칭 기본 배치이며 추가 참고 이미지에 맞춰 조정할 수 있습니다.';
 }
 for(const el of root.querySelectorAll('input[placeholder]'))el.placeholder=wallgoTranslate(el.placeholder);
};
})();
