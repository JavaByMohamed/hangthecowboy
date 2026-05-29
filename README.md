# 🎮 Game Menu

A multiplayer game platform built with Node.js, Express, and Socket.IO featuring:

- **Hangman** – Guess the word before you run out of lives
- **Four in a Row** – Connect 4 pieces to win
- **Tic Tac Toe** – Classic 3x3 grid game
- **Draughts** – Checkers on a 10x10 board
- **Crossword Puzzle** – Build words together on a shared board

## 🌐 Play Online

> **This app uses WebSockets for multiplayer, so it can't run on GitHub Pages (static-only).**
> It auto-deploys to **Render** from this repo for free.

### One-time setup (takes 2 minutes):

1. Go to [render.com](https://render.com) and sign in with your **GitHub** account
2. Click **New → Web Service**
3. Select this repo (`JavaByMohamed/hangthecowboy`)
4. Render auto-detects settings from `render.yaml` — just click **Deploy**
5. Once deployed, share your public URL (e.g. `https://game-menu-xxxx.onrender.com`) with friends!

Every push to `main` will **auto-deploy** — no extra steps needed.

## Running Locally

```bash
npm install
npm start
```

The server starts on `http://localhost:5000`.
