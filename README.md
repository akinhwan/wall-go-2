# Wall Go II / 벽바둑 II

A multiplayer, mobile-friendly browser implementation of **Wall Go II**, inspired by *The Devil's Plan*, Season 3, Episode 10. Unofficial fan project; not affiliated with Netflix.

## Run locally

Requires **Node.js 20+**.

```bash
npm install
npm start
```

Open **http://localhost:3000**. To play with other people, send them the room link. If playing over a local network, open the host computer's LAN address on each device (e.g. `http://192.168.1.12:3000`) and allow the port through your firewall.

## Publish on the web

Create a GitHub repository with these files and deploy it as a **Node web service** on Render, Railway, Fly.io, or another host that supports long-lived Node processes and WebSocket connections.

- Build command: `npm install`
- Start command: `npm start`
- Port: `$PORT` provided by your host (defaults to `3000` locally)
- Health check: `/health`
- Docker deployment: `docker build -t wall-go-ii . && docker run -p 3000:3000 wall-go-ii`

**Important:** room state is currently **in memory**. Use **one server instance** (no horizontal scaling). Restarting the server resets all active rooms. For persistence or multi-instance hosting, replace the `rooms` map with a database and use a shared Socket.IO adapter.

## Arena edition visual design

This updated version recreates the close-up board aesthetic shown in the episode reference photos:

- Pink/rose beveled 7×7 tiles recessed into dark grooves, inside a metallic board frame
- Electric blue, lemon-yellow and neon-pink wall segments with acrylic highlights
- Concentric-line ceramic square and circular counters, with highlights and shadows
- Steel-blue textured playing platform and decorative side/top stacks of wall pieces
- Clear move destinations, selected counter treatments, wall placement options and live territory tinting
- Responsive layout for both desktop and phone browsers

The visual design is original SVG and CSS artwork — **no photographs or screenshot images are used as the live board background**. Wall-piece stacks around the playing surface are decorative, not limited inventory counters. A static preview is in `assets/arena-board-preview.png`.

## Local Duel and offline play

Choose **Local Duel** on the home screen for two players sharing this device. No name, account, room, or connection is needed. The current player is shown above the board and highlighted on the scoreboard. Place squares in 1–2–2–1 order, then alternate full move-and-wall turns. New Game / Restart and Mode Selection are available throughout; leaving an unfinished game asks for confirmation.

The browser and server use the exact same engine in `public/rules.js`; `server/rules.js` re-exports it. Local play also uses the 90-second clock and timeout completion, territory scoring, tie breakers and stalemate behavior. Local games are kept in memory; reloading starts at mode selection.

Once the page reports **Ready for offline local play and reload**, its service worker has cached the game shell, engine and browser libraries. It requires HTTPS or localhost. Local play continues if connectivity is lost, and the cached home screen can be reopened offline. Online rooms still require a running server and connection. Fonts use local fallbacks so they do not require external downloads. To release changed assets, bump the cache version in `public/sw.js`.

## Game modes

**3-player tournament**: each player receives one round and one square counter. Players place them in snake order (1-2-3-3-2-1). The game ends when all differently owned pieces are separated by walls; the highest score survives and the other two play the final. Each player has a once-per-game wall breaker during this round.

**2-player duel/final**: each player has 2 square and 2 round counters. The 2 circular counters begin at a symmetric fixed position for each side. The remaining 4 squares are placed 1-2-2-1. Wall breakers are disabled. A standalone 2-player quick match is also available.

**Move rules**: squares move exactly 1 or 2 cells in one of the four cardinal directions; circles move 1 cardinal cell, optionally followed by 1 perpendicular cell. Paths cannot cross occupied cells, board boundaries, or existing walls (unless consuming a breaker). Then build exactly one wall beside the moved piece. Walls apply to all players.

**Scoring**: each connected region that contains counters from exactly one player belongs wholly to that player. All regions are calculated by flood fill of the board, blocked by walls and borders. Total enclosed region sizes determine the winner; largest single territory breaks ties. A remaining exact tie is reported as a tie rather than inventing another tie-breaker.

**90-second clock**: on timeout, an uncompleted turn is completed with a random legal move + random legal wall, or a random wall if the counter has already moved. If no legal move exists, the player is skipped. No automated wall breaker is spent if a legal normal move exists.

## Reference / fidelity note

The core rules were transcribed from the user-provided screenshots of Season 3 Episode 10, including later movement and wall close-ups. **The exact preassigned 2-player circular-counter squares are not specified in the provided first set of photographs**, so this implementation uses a fair mirrored layout. You can adjust `opening` in `server/rules.js` inside `makeGame()` to match later screenshots. Other behavior (e.g. auto-moving on timeout, a forced stalemate fallback and rematch handling) is made explicit as implementation-level decisions, not claimed as extra official rules.

## Architecture

- `server/rules.js` — authoritative, testable game engine: legal movement, pathfinding, wall breaker, territory flood fill, turn flow, scoring
- `server/index.js` — Express + Socket.IO, private rooms, seat tokens, chat, reconnect, tournament progression, timers
- `public/index.html`, `public/style.css`, `public/app.js` — responsive browser UI using SVG for the game board
- `test/` — game-rule tests

Play from different browsers/devices, or use incognito windows for local testing. In-room player seat tokens are stored in each browser's localStorage for automatic reconnection.

## Future extensions

Database persistence, ranked matchmaking, spectator replay, move history timeline, alternate opening presets, clocks during placement, AI players, and account profiles can all be added without changing core movement/territory rules.
