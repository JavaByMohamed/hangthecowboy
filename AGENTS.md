# AGENTS.md

## Project Overview
This is a real-time multiplayer game platform built with **Node.js, Express, and Socket.IO**. It serves multiple browser-based games and is also wrapped as a **Capacitor Android app**.

Games include:
- Hangman
- Tic Tac Toe
- Four in a Row
- Draughts (Checkers)
- Crossword
- Sudoku
- Chess
- Guess Who
- Quoridor
- Additional modular games in `/public/js`

The system uses WebSockets for real-time synchronization between players.

---

## Architecture

- `index.js` → entry point (loads `app.js`)
- `app.js` → main server (Express + Socket.IO + session handling)
- `/public` → frontend static client (HTML/CSS/JS games)
- `/public/js/*.js` → each game implemented as an isolated module
- `/views/*.html` → per-game HTML templates served by Express routes (e.g. `/hangman` → `views/hangman.html`)
- `/android` → Capacitor Android wrapper project
- Home page (`/`) is currently rendered inline from `app.js` rather than from `public/index.html`
- Socket.IO manages:
    - real-time game state sync
    - player rooms/lobbies
    - connection keep-alive (ping/pong tuning enabled)

---

## Real-time System (Critical)

- All multiplayer logic runs through **Socket.IO**
- Server uses:
    - `pingTimeout: 60000`
    - `pingInterval: 25000`
- Clients join game rooms (per match/session)
- Game state is synchronized via socket events (not REST APIs)
- Private multiplayer sessions use invite codes through Socket.IO events such as `create-private-game` and `join-by-invite`

---

## Game Implementation Pattern

Each game module in `/public/js`:
- Owns its **game state**
- Listens for socket events
- Emits updates back to server
- Updates DOM directly (no framework)
- Is usually paired with a matching view in `/views` that loads the module script directly
- Can reuse shared frontend helpers like `invite-system.js` (private match flow) and `chat-widget.js` (loaded by several multiplayer views such as `views/hangman.html` and `views/chess.html`)

Example pattern:
- `hangman.js` → word guessing logic
- `tic-tac-toe.js` → board state + win detection
- `four-in-a-row.js` → grid-based logic

---

## Backend Responsibilities

- Express serves static frontend (`/public`)
- Session management via `express-session`
- Word generation uses:
    - `an-array-of-english-words`
- Express routes serve each game page from `/views`
- Home page HTML and visitor IP logging (`logs/ips.txt`) currently live in `app.js`
- Socket.IO handles:
    - matchmaking / rooms
    - game coordination
    - reconnect handling

---

## Android Build (Capacitor)

- Located in `/android`
- Uses Capacitor v8
- App is a wrapper around the web game platform
- APK generation is handled in Android Gradle build outputs
- Server looks for the latest `.apk` in `android/app/build/outputs/apk/release/` first, then `public/apk/`
- APK download/metadata endpoints are `/download/latest-apk` and `/api/latest-apk`
- `public/apk/README.md` documents production upload/deployment options for the downloadable APK

---

## Development Workflows

Start server:
```bash
npm start
```

Development mode:
```bash
npm run dev
```

Restart quickly:
```bash
npm run fresh
```

Restart once without `nodemon`:
```bash
npm run restart
```

Stop server:
```bash
npm run stop
```

Tests:
```bash
npm test
```

`npm test` is currently a placeholder script that exits with an error; there is no automated test suite in `package.json`.

---

## Deployment

- Designed for deployment on **Render**
- Uses WebSocket support (not GitHub Pages)
- Auto-deploys on push to `main`
- `/health` returns `200 OK` for uptime/health checks
- Environment port:
    - `process.env.PORT || 5000`

---

## Conventions

- Game logic stays in frontend modules (`/public/js`)
- Socket events are the only sync mechanism between players
- Avoid duplicating game state between client and server
- Keep games modular and isolated
- Edit per-game markup in `/views/*.html`; the root home page is not driven by `public/index.html`
- Do not introduce frameworks unless replacing entire client architecture

---

## Key Files

- `app.js` → core server logic
- `index.js` → bootstrap
- `/views/` → per-game HTML entry pages served by Express routes
- `/public/js/` → all game implementations plus shared helpers like `invite-system.js` and `chat-widget.js`
- `/public/apk/` → production-served APK files
- `/android/` → mobile wrapper

---